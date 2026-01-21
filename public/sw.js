// =============================================================================
// REALPOLITIK SERVICE WORKER - Push Notifications
// =============================================================================
// This file MUST be at the root of public/ to have scope over entire app.
// Do NOT put this in src/ - it must be served as a static file.

// VAPID public key - set by main app via postMessage
let VAPID_PUBLIC_KEY = null;

// IndexedDB for pending notifications (iOS workaround)
const DB_NAME = 'realpolitik-notifications';
const DB_VERSION = 1;
const STORE_NAME = 'pending';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'eventId' });
      }
    };
  });
}

async function addPendingNotification(eventId, title, timestamp) {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ eventId, title, timestamp });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.log('[SW] Failed to store pending notification:', e);
  }
}

// =============================================================================
// PUSH EVENT - Fires when server sends a push notification
// =============================================================================
self.addEventListener('push', (event) => {
  // iOS CRITICAL: You MUST call showNotification() for every push event.
  // If you don't, iOS may revoke your push subscription silently.
  
  let data = {
    title: 'Realpolitik',
    body: 'New event detected',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    url: '/',
    tag: 'default',
    severity: 5,
  };

  // Parse push payload if available
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      // If not JSON, try text
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag || data.id || 'realpolitik-notification', // Prevents duplicates
    renotify: true, // Vibrate even if replacing existing notification with same tag
    requireInteraction: data.severity >= 8, // High severity stays until dismissed
    silent: false, // Request sound (though iOS may ignore)
    vibrate: data.severity >= 8 ? [200, 100, 200, 100, 200] : [200, 100, 200],
    data: {
      url: data.url || '/',
      eventId: data.id,
      timestamp: Date.now(),
    },
    // Action buttons (desktop only, ignored on mobile)
    actions: [
      { action: 'view', title: 'View Event', icon: '/favicon-32x32.png' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  // Store to IndexedDB FIRST (before showing notification)
  // iOS may terminate SW immediately after showNotification, so persist first
  event.waitUntil(
    (async () => {
      // iOS WORKAROUND: Store to IndexedDB BEFORE showing notification
      // iOS may terminate SW right after notification is shown
      if (data.id) {
        await addPendingNotification(data.id, data.title, Date.now());
      }
      
      // Now show the notification
      await self.registration.showNotification(data.title, options);
      
      // Try to notify any open app windows (works on Android/Desktop, often fails on iOS)
      const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        client.postMessage({
          type: 'NOTIFICATION_RECEIVED',
          eventId: data.id,
          title: data.title,
          timestamp: Date.now(),
        });
      }
      
      // Set app badge (iOS 16.4+, desktop browsers)
      if (navigator.setAppBadge) {
        try {
          await navigator.setAppBadge();
        } catch (e) {
          // Badge API may fail silently on some platforms
        }
      }
    })()
  );
});

// =============================================================================
// NOTIFICATION CLICK - User taps/clicks the notification
// =============================================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Handle action buttons
  if (event.action === 'dismiss') {
    return; // Just close, don't navigate
  }

  const eventId = event.notification.data?.eventId;
  const baseUrl = event.notification.data?.url || '/';
  
  // Build URL with cache busting to ensure navigation always triggers
  // Even if app is already on /?event={id}, the _t param forces a fresh load
  const cacheBuster = `_t=${Date.now()}`;
  const urlWithSource = eventId 
    ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}from=notification&notif_event=${eventId}&${cacheBuster}`
    : `/?${cacheBuster}`;

  // iOS PWA CRITICAL: Do NOT use client.postMessage() here.
  // On iOS, when the PWA is backgrounded/suspended, postMessage is silently dropped.
  // The SW can find and focus() the window, but the message never arrives.
  // Instead, we use client.navigate() which changes the actual URL, triggering
  // the app to read event ID from URL params on the navigation event.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'navigate' in client) {
          await client.navigate(urlWithSource);
          await client.focus();
          return;
        }
      }
      // No existing window - open new one
      if (clients.openWindow) {
        return clients.openWindow(urlWithSource);
      }
    })
  );
});

// =============================================================================
// PUSH SUBSCRIPTION CHANGE - Subscription expired or was revoked
// =============================================================================
self.addEventListener('pushsubscriptionchange', (event) => {
  // This fires when:
  // - Browser/OS revokes subscription
  // - Subscription expires
  // - User clears browser data
  
  event.waitUntil(
    (async () => {
      try {
        // Only attempt resubscribe if we have VAPID key
        if (!VAPID_PUBLIC_KEY) {
          console.log('[SW] No VAPID key, cannot resubscribe');
          return;
        }

        // Convert base64 to Uint8Array
        const urlBase64ToUint8Array = (base64String) => {
          const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
          const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
          const rawData = atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        };

        // Try to resubscribe
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        
        // Send new subscription to server
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            resubscribe: true, // Flag that this is a resubscription
          }),
        });
        
        console.log('[SW] Resubscribed after pushsubscriptionchange');
      } catch (error) {
        console.error('[SW] Failed to resubscribe:', error);
      }
    })()
  );
});

// =============================================================================
// INSTALL & ACTIVATE - Standard service worker lifecycle
// =============================================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  // Claim all clients immediately
  event.waitUntil(clients.claim());
});

// =============================================================================
// MESSAGE HANDLER - Communication from main app
// =============================================================================
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_VAPID_KEY') {
    VAPID_PUBLIC_KEY = event.data.key;
    console.log('[SW] VAPID key set');
  }
});
