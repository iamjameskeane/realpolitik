/// App-wide constants and configuration
class AppConstants {
  // App Info
  static const String appName = 'Aegis';
  static const String appVersion = '1.0.0';
  static const String appDescription = 'Realpolitik Intelligence Platform';

  // Mapbox Configuration
  static const String mapboxStyle = 'mapbox://styles/mapbox/dark-v11';
  static const String mapboxStyleSatellite = 'mapbox://styles/mapbox/standard-satellite';
  static const double mapboxInitialZoom = 1.5;
  static const List<double> mapboxInitialCenter = [15.0, 50.0]; // [longitude, latitude] - Europe
  static const double mapboxInitialPitch = 30.0;
  static const double mapboxInitialBearing = 0.0;

  // Animation Timing
  static const Duration mapFlyAnimationDuration = Duration(milliseconds: 1000);
  static const Duration autoRotateDelay = Duration(seconds: 3);
  static const Duration popupAnimationDuration = Duration(milliseconds: 300);

  // Cluster Configuration
  static const int clusterRadius = 50;
  static const int maxClusterZoom = 15;
  static const double singleEventZoom = 4.0;

  // Event Configuration
  static const int maxEventsPerLocation = 10;
  static const Duration eventRefreshInterval = Duration(minutes: 1);

  // Map Padding (for UI overlays)
  static const Map<String, double> mapPadding = {
    'top': 0.0,
    'right': 0.0,
    'bottom': 80.0, // Space for bottom UI
    'left': 0.0,
  };

  // Event Categories
  static const Map<String, String> eventCategoryColors = {
    'military': '#EF4444',   // Red
    'diplomacy': '#06B6D4',  // Cyan
    'economy': '#10B981',    // Green
    'unrest': '#F59E0B',     // Amber
  };

  static const Map<String, String> eventCategoryEmojis = {
    'military': '🔴',
    'diplomacy': '🔵',
    'economy': '🟢',
    'unrest': '🟡',
  };

  // Atmospheric Effects (Mapbox Globe)
  static const Map<String, dynamic> mapboxFog = {
    'range': [0.5, 10.0],
    'color': '#020617',
    'horizon-blend': 0.03,
    'high-color': '#0f172a',
    'space-color': '#020617',
    'star-intensity': 0.25,
  };

  // Auto-rotation Configuration
  static const int secondsPerRevolution = 120; // 2 minutes per revolution
  static const double maxSpinZoom = 5.0;
  static const double slowSpinZoom = 3.0;

  // URL Schemes for Deep Linking
  static const String appUrlScheme = 'aegis';
  static const String eventDeepLinkPath = 'event';

  // Caching Configuration
  static const Duration cacheExpiry = Duration(hours: 1);
  static const int maxCachedEvents = 1000;

  // UI Thresholds
  static const double mobileBreakpoint = 768.0;
  static const int eventsPerPage = 50;
  static const int searchDebounceMs = 300;
}

/// Event visual states (similar to Next.js useEventStates)
enum EventVisualState {
  incoming,    // New event just received
  processed,   // Event has been processed/displayed
  backlog,     // Event in background queue
  history,     // Historical event
}

/// Cluster interaction modes
enum ClusterInteractionMode {
  none,
  popup,       // Shift+click to show popup
  contextMenu, // Right-click context menu
  tooltip,     // Hover tooltip
  flyover,     // Start flyover mode
}

/// Pilot's View phases (mobile interface)
enum PilotPhase {
  scanner,   // Phase 1: Scrollable event feed
  pilot,     // Phase 2: Detailed event cards
  analyst,   // Phase 3: AI briefing interface
}

/// WebSocket event types
enum WebSocketEventType {
  newEvent,
  eventUpdate,
  eventClusterUpdate,
  briefingUpdate,
  connectionStatus,
}

/// API endpoints
class ApiEndpoints {
  static const String baseUrl = 'http://localhost:8000'; // Delphi API
  
  static const String events = '/api/events';
  static const String eventsStream = '/api/events/stream';
  static const String eventById = '/api/events/{id}';
  static const String briefing = '/api/briefing/{event_id}';
  static const String search = '/api/search';
  static const String filters = '/api/filters';
}

/// Map layer IDs (for Mapbox GL)
class MapLayers {
  static const String clusters = 'clusters';
  static const String clusterCount = 'cluster-count';
  static const String unclusteredPoints = 'unclustered-point';
  static const String events = 'events-circles';
  static const String eventsLabels = 'events-labels';
}

/// Animation curves for map transitions
class AnimationCurves {
  static const String easeInOutCubic = 'cubic-bezier(0.4, 0.0, 0.2, 1.0)';
  static const String easeOutBack = 'cubic-bezier(0.34, 1.56, 0.64, 1.0)';
  static const String easeInOutQuart = 'cubic-bezier(0.77, 0, 0.175, 1.0)';
}