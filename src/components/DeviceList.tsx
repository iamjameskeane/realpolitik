"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSupabaseClient } from "@/lib/supabase";

interface PushSubscription {
  id: string;
  endpoint: string;
  device_name: string;
  created_at: string;
  last_active: string;
}

export function DeviceList() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<PushSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const loadDevices = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout")), 10000);
      });

      const fetchPromise = supabase.rpc("get_user_subscriptions", {
        user_uuid: user.id,
      });

      const { data, error: rpcError } = await Promise.race([
        fetchPromise,
        timeoutPromise.then(() => {
          throw new Error("Request timeout");
        }),
      ]);

      if (!isMountedRef.current) return;

      if (rpcError) throw rpcError;

      setDevices(data || []);
    } catch (err) {
      console.error("Error loading devices:", err);
      if (isMountedRef.current) {
        setError("Failed to load devices");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [user]);

  // Load user's devices
  useEffect(() => {
    isMountedRef.current = true;
    loadDevices();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadDevices]);

  const removeDevice = async (endpoint: string, deviceId: string) => {
    if (!user) return;

    setRemoving(deviceId);

    try {
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Session expired");
      }

      const response = await fetch("/api/push/unsubscribe", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ endpoint }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove device");
      }

      // Reload devices
      await loadDevices();
    } catch (error) {
      console.error("Error removing device:", error);
      alert("Failed to remove device. Please try again.");
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-16 animate-pulse rounded-md bg-slate-700/30" />
        <div className="h-16 animate-pulse rounded-md bg-slate-700/30" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-4 text-center">
        <p className="text-sm text-red-300">{error}</p>
        <button
          onClick={loadDevices}
          className="mt-2 text-xs text-red-400 underline hover:text-red-300"
        >
          Retry
        </button>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="rounded-md border border-slate-700/30 bg-slate-800/30 px-4 py-6 text-center">
        <svg
          className="mx-auto mb-2 h-8 w-8 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm text-slate-300">No devices connected</p>
        <p className="mt-1 text-xs text-slate-400">Enable push notifications to add this device</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {devices.map((device) => {
        const isCurrentDevice =
          typeof window !== "undefined" && window.navigator?.serviceWorker?.controller !== null;
        const lastActive = new Date(device.last_active);
        const isRecent = Date.now() - lastActive.getTime() < 60 * 60 * 1000; // 1 hour

        return (
          <div
            key={device.id}
            className="flex items-center gap-3 rounded-md border border-slate-700/50 bg-slate-800/30 p-3"
          >
            {/* Device Icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-700/30">
              <svg
                className="h-5 w-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {device.device_name.includes("iPhone") || device.device_name.includes("iPad") ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                )}
              </svg>
            </div>

            {/* Device Info */}
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">{device.device_name}</span>
                {isRecent && (
                  <span className="flex h-2 w-2">
                    <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Added {new Date(device.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Remove Button */}
            <button
              onClick={() => removeDevice(device.endpoint, device.id)}
              disabled={removing === device.id}
              className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              {removing === device.id ? "Removing..." : "Remove"}
            </button>
          </div>
        );
      })}

      <p className="pt-2 text-xs text-slate-400">
        Your notification settings sync across all devices
      </p>
    </div>
  );
}
