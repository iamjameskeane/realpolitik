import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/simple_geo_event.dart';
import '../features/map/globe_widget.dart';
import '../features/map/event_popup_widget.dart';
import '../providers/events_provider.dart';
import '../providers/map_provider.dart';
import '../providers/filters_provider.dart';
import '../services/websocket_service.dart';
import '../main.dart';

/// Main Aegis application
/// Combines the globe map with event management
class AegisApp extends ConsumerWidget {
  const AegisApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'Aegis',
      theme: AppTheme.createTheme(),
      home: const MainScreen(),
      debugShowCheckedModeBanner: false,
      builder: (context, child) {
        return Directionality(textDirection: TextDirection.ltr, child: child!);
      },
    );
  }
}

class MainScreen extends ConsumerStatefulWidget {
  const MainScreen({super.key});

  @override
  ConsumerState<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends ConsumerState<MainScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      duration: const Duration(milliseconds: 1000),
      vsync: this,
    );

    _animation = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

    _controller.forward();

    // Load initial data
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(eventsNotifierProvider).loadEvents();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final eventsAsync = ref.watch(eventsProvider);
    final filters = ref.watch(filtersProvider);
    final selectedEvent = ref.watch(selectedEventProvider);
    final isLoading = ref.watch(isLoadingEventsProvider);
    final isGlobeMode = ref.watch(isGlobeModeProvider);
    final isFlying = ref.watch(mapProvider).isFlying;

    return Scaffold(
      body: Stack(
        children: [
          // Main globe widget
          FadeTransition(
            opacity: _animation,
            child: GlobeWidget(
              onEventTap: _onEventTap,
              onClusterTap: _onClusterTap,
              onClusterLongPress: _onClusterLongPress,
            ),
          ),

          // Top status bar - Next.js Design System
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: DesignTokens.md,
                  vertical: DesignTokens.sm,
                ),
                child: GlassPanel(
                  padding: const EdgeInsets.symmetric(
                    horizontal: DesignTokens.md,
                    vertical: DesignTokens.sm,
                  ),
                  child: Row(
                    children: [
                      // Logo and Brand
                      Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: DesignTokens.purpleAccent.withOpacity(0.2),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.public,
                          color: DesignTokens.purpleAccent,
                          size: 16,
                        ),
                      ),
                      const SizedBox(width: DesignTokens.sm),
                      Text(
                        'Realpolitik',
                        style: AppTypography.headingSmall.copyWith(
                          color: DesignTokens.lightGray,
                          fontSize: 18,
                        ),
                      ),
                      const Spacer(),

                      // Live indicator
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: DesignTokens.sm,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.green.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: Colors.green.withValues(alpha: 0.3),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: const BoxDecoration(
                                color: Colors.green,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'LIVE',
                              style: AppTypography.caption.copyWith(
                                color: Colors.green,
                                fontWeight: DesignTokens.medium,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: DesignTokens.sm),

                      // Event count
                      _buildEventCount(),
                      const SizedBox(width: DesignTokens.sm),

                      // Projection toggle
                      _buildProjectionToggle(),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // Left sidebar for filters (desktop)
          if (MediaQuery.of(context).size.width > 768)
            Positioned(
              top: 80,
              bottom: 0,
              left: 16,
              child: SizedBox(
                width: 280,
                child: FilterSidebar(
                  filters: filters,
                  onFiltersChanged: _onFiltersChanged,
                ),
              ),
            ),

          // Event popup overlay
          if (selectedEvent != null) _buildEventPopup(selectedEvent, isFlying),

          // Loading overlay - Next.js Design System
          if (isLoading)
            Container(
              color: DesignTokens.deepSpaceBlack.withOpacity(0.9),
              child: Center(
                child: GlassPanel(
                  padding: const EdgeInsets.all(DesignTokens.lg),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 32,
                        height: 32,
                        child: CircularProgressIndicator(
                          strokeWidth: 3,
                          valueColor: AlwaysStoppedAnimation<Color>(
                            DesignTokens.purpleAccent,
                          ),
                        ),
                      ),
                      const SizedBox(height: DesignTokens.md),
                      Text(
                        'Loading events...',
                        style: AppTypography.body.copyWith(
                          color: DesignTokens.lightGray,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // Bottom controls for mobile
          if (MediaQuery.of(context).size.width <= 768)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: SafeArea(
                child: BottomControls(
                  onFilterTap: _showFilterBottomSheet,
                  onToggleProjection: _toggleProjection,
                  isGlobeMode: isGlobeMode,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildConnectionStatus() {
    return Consumer(
      builder: (context, ref, child) {
        final connectionStatus = ref.watch(webSocketConnectionProvider);

        return Icon(
          connectionStatus.isConnected ? Icons.wifi : Icons.wifi_off,
          color: connectionStatus.isConnected
              ? Colors.green[400]
              : Colors.red[400],
          size: 16,
        );
      },
    );
  }

  Widget _buildEventCount() {
    final eventCount = ref.watch(eventsCountProvider);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: DesignTokens.sm,
        vertical: 4,
      ),
      decoration: BoxDecoration(
        color: DesignTokens.surfaceVariant.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: DesignTokens.panelBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.circle,
            size: 8,
            color: DesignTokens.lightGray.withOpacity(0.6),
          ),
          const SizedBox(width: 6),
          Text(
            '$eventCount events',
            style: AppTypography.caption.copyWith(
              color: DesignTokens.lightGray,
              fontWeight: DesignTokens.medium,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProjectionToggle() {
    return GestureDetector(
      onTap: _toggleProjection,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: DesignTokens.sm,
          vertical: 4,
        ),
        decoration: BoxDecoration(
          color: DesignTokens.surfaceVariant.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: DesignTokens.panelBorder),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              ref.watch(isGlobeModeProvider) ? Icons.public : Icons.map,
              size: 12,
              color: DesignTokens.lightGray.withValues(alpha: 0.8),
            ),
            const SizedBox(width: 6),
            Text(
              ref.watch(isGlobeModeProvider) ? 'GLobe' : '2D',
              style: AppTypography.caption.copyWith(
                color: DesignTokens.lightGray,
                fontWeight: DesignTokens.medium,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEventPopup(GeoEvent event, bool isFlying) {
    // Calculate popup position (this would normally come from the map widget)
    return const SizedBox.shrink(); // TODO: Implement popup positioning
  }

  void _onEventTap(GeoEvent event) {
    ref.read(mapNotifierProvider).focusOnEvent(event);
  }

  void _onClusterTap(List<GeoEvent> events) {
    // TODO: Implement cluster interaction
    ref.read(mapNotifierProvider).focusOnEvent(events.first);
  }

  void _onClusterLongPress(List<GeoEvent> events) {
    // TODO: Implement cluster interaction
    ref.read(mapNotifierProvider).focusOnEvent(events.first);
  }

  void _onFiltersChanged(EventFilters newFilters) {
    // TODO: Implement filter updates
    ref.read(eventsNotifierProvider).loadEvents();
  }

  void _toggleProjection() {
    ref.read(mapNotifierProvider).toggleProjection();
  }

  void _showFilterBottomSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: FilterBottomSheet(
          filters: ref.watch(filtersProvider),
          onFiltersChanged: _onFiltersChanged,
        ),
      ),
    );
  }

  BackdropFilter? blurEffect() {
    try {
      return BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(color: Colors.transparent),
      );
    } catch (e) {
      return null; // Fallback if blur not supported
    }
  }
}

/// Filter sidebar for desktop - Next.js Design System
/// Filter sidebar for desktop - Next.js Design System
class FilterSidebar extends ConsumerWidget {
  final EventFilters filters;
  final Function(EventFilters) onFiltersChanged;

  const FilterSidebar({
    super.key,
    required this.filters,
    required this.onFiltersChanged,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GlassPanel(
      width: 280,
      padding: const EdgeInsets.all(DesignTokens.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(
                Icons.tune,
                size: 16,
                color: DesignTokens.lightGray.withValues(alpha: 0.8),
              ),
              const SizedBox(width: DesignTokens.sm),
              Text(
                'Filters',
                style: AppTypography.headingSmall.copyWith(
                  color: DesignTokens.lightGray,
                  fontSize: 18,
                ),
              ),
            ],
          ),
          const SizedBox(height: DesignTokens.lg),
          
          // Categories
          _buildCategoryFilters(),
          const SizedBox(height: DesignTokens.lg),
          
          // Severity
          _buildSeveritySlider(context),
        ],
      ),
    );
  }

  Widget _buildCategoryFilters() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Categories',
          style: AppTypography.label.copyWith(
            color: DesignTokens.lightGray.withValues(alpha: 0.9),
            fontSize: 14,
          ),
        ),
        const SizedBox(height: DesignTokens.sm),
        
        // Military Filter
        _buildCategoryFilter(
          'Military',
          DesignTokens.military,
          filters.military,
          '⚔️',
          (value) => onFiltersChanged(filters.copyWith(military: value)),
        ),
        
        // Diplomacy Filter  
        _buildCategoryFilter(
          'Diplomacy',
          DesignTokens.diplomacy,
          filters.diplomacy,
          '🤝',
          (value) => onFiltersChanged(filters.copyWith(diplomacy: value)),
        ),
        
        // Economy Filter
        _buildCategoryFilter(
          'Economy',
          DesignTokens.economy,
          filters.economy,
          '💰',
          (value) => onFiltersChanged(filters.copyWith(economy: value)),
        ),
        
        // Unrest Filter
        _buildCategoryFilter(
          'Unrest',
          DesignTokens.unrest,
          filters.unrest,
          '⚡',
          (value) => onFiltersChanged(filters.copyWith(unrest: value)),
        ),
      ],
    );
  }

  Widget _buildCategoryFilter(
    String label,
    Color color,
    bool value,
    String emoji,
    Function(bool) onChanged,
  ) {
    return Container(
      margin: const EdgeInsets.only(bottom: DesignTokens.xs),
      child: InkWell(
        onTap: () => onChanged(!value),
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: DesignTokens.sm,
            vertical: DesignTokens.xs,
          ),
          decoration: BoxDecoration(
            color: value 
                ? color.withValues(alpha: 0.2)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: value 
                  ? color
                  : DesignTokens.panelBorder,
              width: 1,
            ),
          ),
          child: Row(
            children: [
              Text(
                emoji,
                style: const TextStyle(fontSize: 14),
              ),
              const SizedBox(width: DesignTokens.sm),
              Expanded(
                child: Text(
                  label,
                  style: AppTypography.body.copyWith(
                    color: value 
                        ? color 
                        : DesignTokens.lightGray.withValues(alpha: 0.8),
                    fontWeight: value 
                        ? DesignTokens.medium 
                        : DesignTokens.regular,
                  ),
                ),
              ),
              Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  color: value ? color : Colors.transparent,
                  border: Border.all(
                    color: value ? color : DesignTokens.outline,
                    width: 2,
                  ),
                  borderRadius: BorderRadius.circular(2),
                ),
                child: value 
                    ? Icon(
                        Icons.check,
                        size: 10,
                        color: Colors.white,
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSeveritySlider(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Minimum Severity',
          style: AppTypography.label.copyWith(
            color: DesignTokens.lightGray.withValues(alpha: 0.9),
            fontSize: 14,
          ),
        ),
        const SizedBox(height: DesignTokens.sm),
        
        // Severity indicator
        Container(
          padding: const EdgeInsets.all(DesignTokens.sm),
          decoration: BoxDecoration(
            color: DesignTokens.surfaceVariant.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: DesignTokens.panelBorder),
          ),
          child: Column(
            children: [
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  activeTrackColor: DesignTokens.purpleAccent,
                  inactiveTrackColor: DesignTokens.outlineVariant,
                  thumbColor: DesignTokens.lightGray,
                  overlayColor: DesignTokens.purpleAccent.withValues(alpha: 0.3),
                  thumbShape: const RoundSliderThumbShape(
                    enabledThumbRadius: 8,
                  ),
                  trackHeight: 4,
                ),
                child: Slider(
                  value: filters.minSeverity.toDouble(),
                  min: 1,
                  max: 10,
                  divisions: 9,
                  label: filters.minSeverity.toString(),
                  onChanged: (value) {
                    onFiltersChanged(filters.copyWith(minSeverity: value.toInt()));
                  },
                ),
              ),
              
              // Severity scale
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '1',
                    style: AppTypography.caption.copyWith(
                      color: DesignTokens.muted,
                    ),
                  ),
                  Text(
                    '5',
                    style: AppTypography.caption.copyWith(
                      color: DesignTokens.muted,
                    ),
                  ),
                  Text(
                    '10',
                    style: AppTypography.caption.copyWith(
                      color: DesignTokens.muted,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
}

/// Bottom controls for mobile - Next.js Design System
class BottomControls extends ConsumerWidget {
  final VoidCallback onFilterTap;
  final VoidCallback onToggleProjection;
  final bool isGlobeMode;

  const BottomControls({
    super.key,
    required this.onFilterTap,
    required this.onToggleProjection,
    required this.isGlobeMode,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(DesignTokens.md),
        child: GlassPanel(
          padding: const EdgeInsets.symmetric(
            horizontal: DesignTokens.md,
            vertical: DesignTokens.sm,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _buildControlButton(
                icon: Icons.tune,
                tooltip: 'Filters',
                onTap: onFilterTap,
              ),
              _buildControlButton(
                icon: isGlobeMode ? Icons.public : Icons.map,
                tooltip: isGlobeMode ? 'Switch to 2D' : 'Switch to Globe',
                onTap: onToggleProjection,
              ),
              _buildControlButton(
                icon: Icons.analytics,
                tooltip: 'Analytics',
                onTap: () {},
              ),
              _buildControlButton(
                icon: Icons.settings,
                tooltip: 'Settings',
                onTap: () {},
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildControlButton({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
  }) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: DesignTokens.surfaceVariant.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: DesignTokens.panelBorder),
          ),
          child: Icon(
            icon,
            color: DesignTokens.lightGray.withValues(alpha: 0.8),
            size: 20,
          ),
        ),
      ),
    );
  }
}

/// Filter bottom sheet for mobile - Next.js Design System
class FilterBottomSheet extends StatefulWidget {
  final EventFilters filters;
  final Function(EventFilters) onFiltersChanged;

  const FilterBottomSheet({
    super.key,
    required this.filters,
    required this.onFiltersChanged,
  });

  @override
  State<FilterBottomSheet> createState() => _FilterBottomSheetState();
}

class _FilterBottomSheetState extends State<FilterBottomSheet> {
  late EventFilters _currentFilters;

  @override
  void initState() {
    super.initState();
    _currentFilters = widget.filters;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: DesignTokens.deepSpaceBlack,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(DesignTokens.xlRadius),
        ),
        border: Border.all(color: DesignTokens.panelBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.all(DesignTokens.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Drag handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: DesignTokens.muted,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: DesignTokens.lg),

            // Header
            Row(
              children: [
                Icon(
                  Icons.tune,
                  size: 16,
                  color: DesignTokens.lightGray.withValues(alpha: 0.8),
                ),
                const SizedBox(width: DesignTokens.sm),
                Text(
                  'Filters',
                  style: AppTypography.headingMedium.copyWith(
                    color: DesignTokens.lightGray,
                    fontSize: 20,
                  ),
                ),
              ],
            ),
            const SizedBox(height: DesignTokens.lg),

            // Categories Section
            Text(
              'Categories',
              style: AppTypography.label.copyWith(
                color: DesignTokens.lightGray.withOpacity(0.9),
                fontSize: 16,
              ),
            ),
            const SizedBox(height: DesignTokens.md),

            // Category chips
            Wrap(
              spacing: DesignTokens.sm,
              runSpacing: DesignTokens.sm,
              children: [
                _buildCategoryChip(
                  'Military',
                  DesignTokens.military,
                  _currentFilters.military,
                  '⚔️',
                  (value) => setState(() {
                    _currentFilters = _currentFilters.copyWith(military: value);
                  }),
                ),
                _buildCategoryChip(
                  'Diplomacy',
                  DesignTokens.diplomacy,
                  _currentFilters.diplomacy,
                  '🤝',
                  (value) => setState(() {
                    _currentFilters = _currentFilters.copyWith(
                      diplomacy: value,
                    );
                  }),
                ),
                _buildCategoryChip(
                  'Economy',
                  DesignTokens.economy,
                  _currentFilters.economy,
                  '💰',
                  (value) => setState(() {
                    _currentFilters = _currentFilters.copyWith(economy: value);
                  }),
                ),
                _buildCategoryChip(
                  'Unrest',
                  DesignTokens.unrest,
                  _currentFilters.unrest,
                  '⚡',
                  (value) => setState(() {
                    _currentFilters = _currentFilters.copyWith(unrest: value);
                  }),
                ),
              ],
            ),

            const SizedBox(height: DesignTokens.xl),

            // Action buttons
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      widget.onFiltersChanged(_currentFilters);
                      Navigator.pop(context);
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: DesignTokens.purpleAccent,
                      padding: const EdgeInsets.symmetric(
                        vertical: DesignTokens.md,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(
                          DesignTokens.smRadius,
                        ),
                      ),
                    ),
                    child: Text(
                      'Apply Filters',
                      style: AppTypography.button.copyWith(
                        color: DesignTokens.lightGray,
                        fontWeight: DesignTokens.medium,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: DesignTokens.md),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: DesignTokens.panelBorder),
                      padding: const EdgeInsets.symmetric(
                        vertical: DesignTokens.md,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(
                          DesignTokens.smRadius,
                        ),
                      ),
                    ),
                    child: Text(
                      'Cancel',
                      style: AppTypography.button.copyWith(
                        color: DesignTokens.muted,
                      ),
                    ),
                  ),
                ),
],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

  Widget _buildCategoryChip(
    String label,
    Color color,
    bool value,
    String emoji,
    Function(bool) onChanged,
  ) {
    return FilterChip(
      label: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji, style: const TextStyle(fontSize: 14)),
          const SizedBox(width: 4),
          Text(
            label,
            style: AppTypography.body.copyWith(
              color: value ? Colors.white : DesignTokens.lightGray,
              fontWeight: value ? DesignTokens.medium : DesignTokens.regular,
            ),
          ),
        ],
      ),
      selected: value,
      onSelected: onChanged,
      selectedColor: color.withValues(alpha: 0.3),
      backgroundColor: DesignTokens.surfaceVariant.withValues(alpha: 0.3),
      checkmarkColor: color,
      side: BorderSide(
        color: value ? color : DesignTokens.panelBorder,
        width: 1,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(DesignTokens.smRadius),
      ),
      labelStyle: AppTypography.body,
    );
  }
}
