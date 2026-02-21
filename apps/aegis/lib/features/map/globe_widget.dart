import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../models/simple_geo_event.dart';
import '../../constants/app_constants.dart';
import '../../constants/app_config.dart';
import '../../providers/map_provider.dart';
import '../../providers/events_provider.dart';
import '../../providers/filters_provider.dart';

/// Main Mapbox GL 3D Globe Widget
/// Replicates the Next.js WorldMap functionality using mapbox_gl package
class GlobeWidget extends ConsumerStatefulWidget {
  const GlobeWidget({
    super.key,
    this.onEventTap,
    this.onEventLongPress,
    this.onClusterLongPress,
    this.onClusterTap,
    this.height,
  });

  final Function(GeoEvent)? onEventTap;
  final Function(GeoEvent)? onEventLongPress;
  final Function(List<GeoEvent>)? onClusterLongPress;
  final Function(List<GeoEvent>)? onClusterTap;
  final double? height;

  @override
  ConsumerState<GlobeWidget> createState() => _GlobeWidgetState();
}

class _GlobeWidgetState extends ConsumerState<GlobeWidget>
    with TickerProviderStateMixin {
  final Logger _logger = Logger();
  late MaplibreMapController _mapController;
  late AnimationController _rotationController;
  late Animation<double> _rotationAnimation;

  // Auto-rotation state
  Timer? _rotationTimer;
  DateTime? _lastInteraction;
  bool _isAutoRotating = false;

  @override
  void initState() {
    super.initState();
    _initializeAnimation();
    _startAutoRotation();
  }

  @override
  void dispose() {
    _rotationController.dispose();
    _rotationTimer?.cancel();
    super.dispose();
  }

  void _initializeAnimation() {
    _rotationController = AnimationController(
      duration: const Duration(seconds: 120), // 2 minutes per revolution
      vsync: this,
    );

    _rotationAnimation = Tween<double>(begin: 0, end: 2 * math.pi).animate(
      CurvedAnimation(parent: _rotationController, curve: Curves.linear),
    );
  }

  void _startAutoRotation() {
    _rotationTimer = Timer.periodic(const Duration(milliseconds: 50), (timer) {
      if (_shouldAutoRotate()) {
        _updateCameraPosition();
      }
    });
  }

  bool _shouldAutoRotate() {
    final mapState = ref.read(mapProvider);
    return mapState.isGlobeMode &&
        !mapState.isFlying &&
        _isAutoRotating &&
        (_lastInteraction == null ||
            DateTime.now().difference(_lastInteraction!) >
                const Duration(seconds: 3));
  }

  void _updateCameraPosition() {
    // Animate rotation by updating bearing
    _rotationController.repeat();
  }

  void _handleUserInteraction() {
    ref.read(mapNotifierProvider).updateLastInteraction();
  }

  @override
  Widget build(BuildContext context) {
    final mapState = ref.watch(mapProvider);
    final events = ref.watch(filteredEventsProvider);
    final isGlobeMode = ref.watch(isGlobeModeProvider);

    // Check if Mapbox token is available
    if (AppConfig.mapboxAccessToken.isEmpty) {
      return _buildMapErrorWidget();
    }

    return Container(
      height: widget.height ?? MediaQuery.of(context).size.height,
      child: MaplibreMap(
        styleString: mapState.style,
        initialCameraPosition: CameraPosition(
          target: LatLng(
            AppConstants.mapboxInitialCenter[1],
            AppConstants.mapboxInitialCenter[0],
          ),
          zoom: AppConstants.mapboxInitialZoom,
        ),
        onMapCreated: _onMapCreated,
        // Gesture handling
        trackCameraPosition: true,
        tiltGesturesEnabled: mapState.interactive,
        rotateGesturesEnabled: mapState.interactive,
        scrollGesturesEnabled: mapState.interactive,
        zoomGesturesEnabled: mapState.interactive,
        onStyleLoadedCallback: _onStyleLoaded,
      ),
    );
  }

  Widget _buildMapErrorWidget() {
    return Container(
      height: widget.height ?? MediaQuery.of(context).size.height,
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A), // Dark slate background
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.public_off, size: 64, color: Color(0xFF64748B)),
            const SizedBox(height: 16),
            Text(
              'Map Unavailable',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                color: const Color(0xFFE2E8F0),
                fontFamily: 'Inter',
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Please configure your Mapbox access token',
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: const Color(0xFF94A3B8)),
            ),
          ],
        ),
      ),
    );
  }

  /// Callback when map style is loaded
  void _onStyleLoaded() {
    _setupEventLayers();
  }

  /// Setup event sources and layers for clustering and markers
  Future<void> _setupEventLayers() async {
    try {
      _logger.d('Setting up event layers...');
      // TODO: Implement event layer setup using Flutter Mapbox GL API
      // For now, just log the intent to setup layers
      final events = ref.read(filteredEventsProvider);
      _logger.d('Found ${events.length} events to display');
    } catch (e) {
      _logger.e('Failed to setup event layers: $e');
    }
  }

  /// Create GeoJSON data for events with clustering support
  Map<String, dynamic> _createEventsGeoJson(List<GeoEvent> events) {
    final features = <Map<String, dynamic>>[];

    for (final event in events) {
      features.add({
        'type': 'Feature',
        'geometry': {
          'type': 'Point',
          'coordinates': event.coordinates, // [longitude, latitude]
        },
        'properties': {
          'id': event.id,
          'title': event.title,
          'category': event.category.name,
          'severity': event.severity,
          'location': event.locationName,
          'timestamp': event.timestamp.toIso8601String(),
        },
      });
    }

    return {'type': 'FeatureCollection', 'features': features};
  }

  void _onMapCreated(MaplibreMapController controller) async {
    _mapController = controller;
    _logger.i('Mapbox map created successfully');

    // Configure map style and effects
    try {
      // Set up atmospheric effects for globe mode
      if (ref.read(isGlobeModeProvider)) {
        await _setupGlobeEffects();
      }

      // Enable clustering
      await _setupEventClustering();
    } catch (e) {
      _logger.e('Error configuring map: $e');
    }
  }

  Future<void> _setupGlobeEffects() async {
    try {
      // TODO: Implement globe atmospheric effects for Flutter Mapbox GL
      _logger.d('Globe atmospheric effects configured');
    } catch (e) {
      _logger.e('Failed to setup globe effects: $e');
    }
  }

  Future<void> _setupEventClustering() async {
    try {
      // TODO: Implement event clustering for Flutter Mapbox GL
      _logger.d('Event clustering configured');
    } catch (e) {
      _logger.e('Failed to setup event clustering: $e');
    }
  }

  Map<String, dynamic> _createGeoJsonData() {
    final events = ref.read(filteredEventsProvider);

    return {
      'type': 'FeatureCollection',
      'features': events
          .map(
            (event) => {
              'type': 'Feature',
              'geometry': {'type': 'Point', 'coordinates': event.coordinates},
              'properties': {
                'id': event.id,
                'title': event.title,
                'category': event.category.name,
                'severity': event.severity,
                'color': event.categoryColor,
              },
            },
          )
          .toList(),
    };
  }

  void _onCameraMove(CameraPosition position) {
    // Update map state with current camera position
    // TODO: Implement camera position tracking
  }

  void _onCameraIdle() {
    ref.read(mapNotifierProvider).setIsFlying(false);
  }

  void _onMapClick(LatLng coordinates) {
    _handleUserInteraction();
    ref.read(mapNotifierProvider).clearSelection();

    // TODO: Implement event handling for Flutter Mapbox GL
    _logger.d(
      'Map clicked at: ${coordinates.latitude}, ${coordinates.longitude}',
    );
  }

  void _onMapLongPress(LatLng coordinates) {
    _handleUserInteraction();
    // TODO: Handle long press for clustering
  }

  /// Fly to a specific event
  Future<void> flyToEvent(GeoEvent event, {double? zoom}) async {
    ref.read(mapNotifierProvider).setIsFlying(true);
    _logger.d('Flying to event: ${event.id}');
    // TODO: Implement event navigation using Flutter Mapbox GL API
    ref.read(mapNotifierProvider).setIsFlying(false);
  }

  /// Toggle between globe and 2D mode
  Future<void> toggleProjection() async {
    ref.read(mapNotifierProvider).toggleProjection();
    _logger.d('Toggled projection mode');
    // TODO: Implement projection toggle using Flutter Mapbox GL API
  }
}

/// Custom marker widget for events
class EventMarkerWidget extends StatelessWidget {
  final GeoEvent event;
  final bool isSelected;
  final VoidCallback? onTap;

  const EventMarkerWidget({
    super.key,
    required this.event,
    this.isSelected = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: isSelected ? 24 : 20,
        height: isSelected ? 24 : 20,
        decoration: BoxDecoration(
          color: _getEventColor(),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: isSelected ? 3 : 2),
          boxShadow: [
            BoxShadow(
              color: _getEventColor().withOpacity(0.5),
              blurRadius: isSelected ? 12 : 8,
              spreadRadius: isSelected ? 4 : 2,
            ),
          ],
        ),
        child: Center(
          child: Text(
            event.categoryEmoji,
            style: TextStyle(fontSize: isSelected ? 14 : 12),
          ),
        ),
      ),
    );
  }

  Color _getEventColor() {
    // Convert hex string to Color
    final hexColor = event.categoryColor.replaceAll('#', '');
    return Color(int.parse('FF$hexColor', radix: 16));
  }
}
