/// Configuration for different app environments
class AppConfig {
  static const String environment = String.fromEnvironment(
    'ENVIRONMENT',
    defaultValue: 'development',
  );

  /// Delphi API Configuration
  static const String delphiBaseUrl = String.fromEnvironment(
    'DELPHI_API_URL',
    defaultValue:
        'http://localhost:9999', // Non-existent port to force mock data
  );

  /// Mapbox Access Token
  static const String mapboxAccessToken = String.fromEnvironment(
    'MAPBOX_ACCESS_TOKEN',
    defaultValue: '',
  );

  /// Firebase Configuration
  static const String firebaseProjectId = String.fromEnvironment(
    'FIREBASE_PROJECT_ID',
    defaultValue: 'aegis-dev',
  );

  /// WebSocket Configuration
  static const String websocketUrl = String.fromEnvironment(
    'WEBSOCKET_URL',
    defaultValue:
        'ws://localhost:9999/ws', // Non-existent WebSocket to prevent errors
  );

  /// Debug Configuration
  static const bool enableDebugLogs = environment == 'development';
  static const bool enableNetworkLogs = environment == 'development';
  static const bool forceMockData = environment == 'development';

  /// Feature Flags
  static const bool enable3DGlobe = true;
  static const bool enableRealTimeUpdates = true;
  static const bool enableOfflineMode = true;
  static const bool enablePushNotifications = true;
  static const bool enableAnalytics = environment == 'production';

  /// Environment-specific settings
  static Map<String, dynamic> get settings {
    switch (environment) {
      case 'production':
        return {
          'apiTimeout': Duration(seconds: 10),
          'maxRetries': 3,
          'cacheExpiry': Duration(hours: 6),
          'mapStyle': 'mapbox://styles/mapbox/dark-v11',
        };
      case 'staging':
        return {
          'apiTimeout': Duration(seconds: 15),
          'maxRetries': 2,
          'cacheExpiry': Duration(hours: 3),
          'mapStyle': 'mapbox://styles/mapbox/dark-v11',
        };
      default: // development
        return {
          'apiTimeout': Duration(seconds: 30),
          'maxRetries': 1,
          'cacheExpiry': Duration(hours: 1),
          'mapStyle': 'mapbox://styles/mapbox/dark-v11',
        };
    }
  }
}
