import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../models/simple_geo_event.dart';
import '../constants/app_config.dart';
import '../constants/app_constants.dart';

/// WebSocket event types
enum WebSocketEventType {
  connectionStatus,
  newEvent,
  eventUpdate,
  eventClusterUpdate,
  briefingUpdate,
}

/// WebSocket service for real-time event updates
class WebSocketService {
  final Logger _logger = Logger();
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;
  final StreamController<WebSocketEventType> _eventController =
      StreamController<WebSocketEventType>.broadcast();

  /// Stream of WebSocket events
  Stream<WebSocketEventType> get events => _eventController.stream;

  /// Connect to the WebSocket
  Future<void> connect() async {
    if (_channel != null) return; // Already connected

    try {
      _logger.i('Connecting to WebSocket: ${AppConfig.websocketUrl}');

      _channel = WebSocketChannel.connect(Uri.parse(AppConfig.websocketUrl));

      // Listen for messages
      _subscription = _channel!.stream.listen(
        (data) {
          _handleMessage(data);
        },
        onError: (error) {
          _logger.e('WebSocket error: $error');
          _eventController.addError(error);
        },
        onDone: () {
          _logger.i('WebSocket connection closed');
          _channel = null;
        },
      );

      _logger.i('WebSocket connected successfully');
      _eventController.add(WebSocketEventType.connectionStatus);
    } catch (e) {
      _logger.e('Failed to connect to WebSocket: $e');
      rethrow;
    }
  }

  /// Disconnect from WebSocket
  void disconnect() {
    _subscription?.cancel();
    _channel?.sink.close();
    _channel = null;
    _logger.i('WebSocket disconnected');
  }

  /// Handle incoming WebSocket messages
  void _handleMessage(dynamic data) {
    try {
      final Map<String, dynamic> message = data is String
          ? {'type': 'raw', 'data': data}
          : data as Map<String, dynamic>;

      final String? eventType = message['type'] as String?;

      switch (eventType) {
        case 'new_event':
          _eventController.add(WebSocketEventType.newEvent);
          break;
        case 'event_update':
          _eventController.add(WebSocketEventType.eventUpdate);
          break;
        case 'cluster_update':
          _eventController.add(WebSocketEventType.eventClusterUpdate);
          break;
        case 'briefing_update':
          _eventController.add(WebSocketEventType.briefingUpdate);
          break;
        case 'ping':
          // Respond to ping
          _channel?.sink.add('{"type": "pong"}');
          break;
        default:
          _logger.w('Unknown WebSocket message type: $eventType');
      }
    } catch (e) {
      _logger.e('Failed to parse WebSocket message: $e');
    }
  }

  /// Send a message to the WebSocket
  void send(Map<String, dynamic> message) {
    if (_channel != null) {
      _channel!.sink.add(message);
    } else {
      _logger.w('Cannot send message: WebSocket not connected');
    }
  }

  /// Check if WebSocket is connected
  bool get isConnected => _channel != null;

  /// Cleanup resources
  void dispose() {
    disconnect();
    _eventController.close();
  }
}

/// Provider for WebSocket service
final webSocketProvider = Provider<WebSocketService>((ref) {
  return WebSocketService();
});

/// Simple WebSocket connection state
class WebSocketConnectionState {
  final bool isConnected;
  final String? error;

  WebSocketConnectionState({required this.isConnected, this.error});

  WebSocketConnectionState.initial() : isConnected = false, error = null;

  WebSocketConnectionState.connected() : isConnected = true, error = null;

  WebSocketConnectionState.error(this.error) : isConnected = false;
}

/// Provider for WebSocket connection status
final webSocketConnectionProvider = Provider<WebSocketConnectionState>((ref) {
  final webSocket = ref.read(webSocketProvider);

  // Create a simple stream to monitor connection state
  final controller = StreamController<WebSocketConnectionState>.broadcast();

  webSocket.events.listen(
    (event) {
      if (event == WebSocketEventType.connectionStatus) {
        controller.add(WebSocketConnectionState.connected());
      }
    },
    onError: (error) {
      controller.add(WebSocketConnectionState.error(error.toString()));
    },
  );

  // Return initial state
  return WebSocketConnectionState.initial();
});
