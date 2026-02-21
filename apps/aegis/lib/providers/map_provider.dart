import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/simple_geo_event.dart';
import '../constants/app_constants.dart';

/// Simple map state
class MapState {
  final String style;
  final bool interactive;
  final bool isGlobeMode;
  final bool isFlying;
  final double zoom;
  final double bearing;
  final double pitch;
  final GeoEvent? selectedEvent;
  final List<GeoEvent> focusedEvents;
  final DateTime? lastInteraction;

  MapState({
    required this.style,
    required this.interactive,
    required this.isGlobeMode,
    required this.isFlying,
    required this.zoom,
    required this.bearing,
    required this.pitch,
    this.selectedEvent,
    required this.focusedEvents,
    this.lastInteraction,
  });

  MapState.initial()
    : style = AppConstants.mapboxStyle,
      interactive = true,
      isGlobeMode = true,
      isFlying = false,
      zoom = AppConstants.mapboxInitialZoom,
      bearing = AppConstants.mapboxInitialBearing,
      pitch = AppConstants.mapboxInitialPitch,
      selectedEvent = null,
      focusedEvents = [],
      lastInteraction = null;

  MapState copyWith({
    String? style,
    bool? interactive,
    bool? isGlobeMode,
    bool? isFlying,
    double? zoom,
    double? bearing,
    double? pitch,
    GeoEvent? selectedEvent,
    List<GeoEvent>? focusedEvents,
    DateTime? lastInteraction,
  }) {
    return MapState(
      style: style ?? this.style,
      interactive: interactive ?? this.interactive,
      isGlobeMode: isGlobeMode ?? this.isGlobeMode,
      isFlying: isFlying ?? this.isFlying,
      zoom: zoom ?? this.zoom,
      bearing: bearing ?? this.bearing,
      pitch: pitch ?? this.pitch,
      selectedEvent: selectedEvent ?? this.selectedEvent,
      focusedEvents: focusedEvents ?? this.focusedEvents,
      lastInteraction: lastInteraction ?? this.lastInteraction,
    );
  }
}

/// Simple global map state (for now)
MapState _currentMapState = MapState.initial();

/// Get current map state
MapState get currentMapState => _currentMapState;

/// Update map state
void updateMapState(MapState newState) {
  _currentMapState = newState;
}

/// Provider to check if globe mode is enabled
final isGlobeModeProvider = Provider<bool>((ref) {
  return currentMapState.isGlobeMode;
});

/// Map provider (for compatibility with existing code)
final mapProvider = Provider<MapState>((ref) {
  return currentMapState;
});

/// Map state notifier
class MapNotifier {
  Timer? _autoRotateTimer;
  DateTime? _lastInteraction;

  MapState get state => currentMapState;

  /// Update map style
  void updateStyle(String style) {
    final currentState = state;
    final newState = currentState.copyWith(style: style);
    updateMapState(newState);
  }

  /// Toggle between 2D and globe mode
  void toggleProjection() {
    final currentState = state;
    final newState = currentState.copyWith(
      isGlobeMode: !currentState.isGlobeMode,
    );
    updateMapState(newState);
  }

  /// Focus on a specific event
  void focusOnEvent(GeoEvent event) {
    final currentState = state;
    final newState = currentState.copyWith(
      selectedEvent: event,
      focusedEvents: [event],
    );
    updateMapState(newState);
  }

  /// Clear event selection
  void clearSelection() {
    final currentState = state;
    final newState = currentState.copyWith(
      selectedEvent: null,
      focusedEvents: [],
    );
    updateMapState(newState);
  }

  /// Set flying state
  void setIsFlying(bool isFlying) {
    final currentState = state;
    final newState = currentState.copyWith(isFlying: isFlying);
    updateMapState(newState);
  }

  /// Update last interaction time
  void updateLastInteraction() {
    final currentState = state;
    final newState = currentState.copyWith(lastInteraction: DateTime.now());
    updateMapState(newState);
  }

  /// Toggle map interactivity
  void setInteractive(bool interactive) {
    final currentState = state;
    final newState = currentState.copyWith(interactive: interactive);
    updateMapState(newState);
  }

  /// Update map camera state
  void updateCameraState({double? zoom, double? bearing, double? pitch}) {
    final currentState = state;
    final newState = currentState.copyWith(
      zoom: zoom,
      bearing: bearing,
      pitch: pitch,
    );
    updateMapState(newState);
  }
}

/// Provider for map notifier (singleton)
final mapNotifierProvider = Provider<MapNotifier>((ref) {
  return MapNotifier();
});
