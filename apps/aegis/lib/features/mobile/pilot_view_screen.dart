import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timeago/timeago.dart';

import '../../../models/simple_geo_event.dart';
import '../../../providers/events_provider.dart';
import '../../../providers/map_provider.dart';
import '../../../providers/filters_provider.dart';
import '../../../services/websocket_service.dart';
import '../../../constants/app_constants.dart';
import '../../../shared/widgets.dart';
import '../map/globe_widget.dart';

/// Mobile Pilot's View - 3-phase intelligence interface
/// Replicates the Next.js mobile "Pilot's View" functionality
class PilotViewScreen extends ConsumerStatefulWidget {
  const PilotViewScreen({super.key});

  @override
  ConsumerState<PilotViewScreen> createState() => _PilotViewScreenState();
}

class _PilotViewScreenState extends ConsumerState<PilotViewScreen>
    with TickerProviderStateMixin {
  late PageController _pageController;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _tabController = TabController(length: 3, vsync: this);

    // Load initial data
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(eventsNotifierProvider).loadEvents();
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(isLoadingEventsProvider);

    return Scaffold(
      body: Stack(
        children: [
          // Main background - globe view
          Positioned.fill(
            child: GlobeWidget(
              onEventTap: _onEventTap,
              onClusterTap: _onClusterTap,
            ),
          ),

          // Mobile overlay UI
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              child: Container(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Icon(
                      Icons.public,
                      color: Color(0xFF3B82F6),
                      size: 24,
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      'Aegis',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Spacer(),
                    _buildConnectionIndicator(),
                  ],
                ),
              ),
            ),
          ),

          // Bottom intelligence sheet
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: _buildIntelligenceSheet(),
          ),

          // Loading overlay
          if (isLoading)
            Container(
              color: Colors.black.withValues(alpha: 0.8),
              child: const LoadingWidget(
                message: 'Loading intelligence data...',
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildConnectionIndicator() {
    return Consumer(
      builder: (context, ref, child) {
        final connectionStatus = ref.watch(webSocketConnectionProvider);

        return Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: connectionStatus.isConnected
                ? Colors.green[400]
                : Colors.red[400],
            shape: BoxShape.circle,
          ),
        );
      },
    );
  }

  Widget _buildIntelligenceSheet() {
    return Container(
      height: MediaQuery.of(context).size.height * 0.6,
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
      ),
      child: Column(
        children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.symmetric(vertical: 8),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFF475569),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Tab bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: TabBar(
              controller: _tabController,
              labelColor: const Color(0xFF3B82F6),
              unselectedLabelColor: const Color(0xFF64748B),
              indicatorColor: const Color(0xFF3B82F6),
              indicatorSize: TabBarIndicatorSize.tab,
              dividerColor: Colors.transparent,
              labelStyle: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
              tabs: const [
                Tab(text: 'SCANNER', icon: Icon(Icons.radar, size: 16)),
                Tab(text: 'PILOT', icon: Icon(Icons.flight, size: 16)),
                Tab(text: 'ANALYST', icon: Icon(Icons.analytics, size: 16)),
              ],
            ),
          ),

          // Tab content
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [ScannerMode(), PilotMode(), AnalystMode()],
            ),
          ),
        ],
      ),
    );
  }

  void _onEventTap(GeoEvent event) {
    // Navigate to pilot mode with selected event
    _tabController.animateTo(1);
  }

  void _onClusterTap(List<GeoEvent> events) {
    // Handle cluster tap - could show in pilot mode
    _tabController.animateTo(1);
  }

  void _showEventDetails(BuildContext context, GeoEvent event) {
    // TODO: Navigate to detailed event view
  }

  void _requestBriefing(BuildContext context, GeoEvent event) {
    // TODO: Navigate to briefing view
  }

  void _shareEvent(BuildContext context, GeoEvent event) {
    // TODO: Implement share functionality
  }

  Widget _buildEventCategoryIcon(EventCategory category, {double size = 16}) {
    return Container(
      width: size + 8,
      height: size + 8,
      decoration: BoxDecoration(
        color: _getCategoryColor(category).withOpacity(0.2),
        borderRadius: BorderRadius.circular(size / 2),
      ),
      child: Center(
        child: Text(
          _getCategoryEmoji(category),
          style: TextStyle(fontSize: size),
        ),
      ),
    );
  }

  Widget _buildCategoryChip(EventCategory category) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _getCategoryColor(category),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        category.name,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildSeverityIndicator(int severity) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final isActive = index < (severity / 2).round();
        return Container(
          width: 6,
          height: 12,
          margin: const EdgeInsets.only(right: 1),
          decoration: BoxDecoration(
            color: isActive
                ? _getSeverityColor(severity)
                : const Color(0xFF374151),
            borderRadius: BorderRadius.circular(2),
          ),
        );
      }),
    );
  }

  Widget _buildActionButton(
    BuildContext context,
    String label,
    IconData icon,
    VoidCallback onPressed,
  ) {
    return TextButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }

  Color _getCategoryColor(EventCategory category) {
    switch (category) {
      case EventCategory.military:
        return const Color(0xFFEF4444);
      case EventCategory.diplomacy:
        return const Color(0xFF06B6D4);
      case EventCategory.economy:
        return const Color(0xFF10B981);
      case EventCategory.unrest:
        return const Color(0xFFF59E0B);
    }
  }

  Color _getSeverityColor(int severity) {
    if (severity >= 8) return Colors.red[600]!;
    if (severity >= 6) return Colors.orange[600]!;
    if (severity >= 4) return Colors.amber[600]!;
    return Colors.green[600]!;
  }

  String _getCategoryEmoji(EventCategory category) {
    switch (category) {
      case EventCategory.military:
        return '🔴';
      case EventCategory.diplomacy:
        return '🔵';
      case EventCategory.economy:
        return '🟢';
      case EventCategory.unrest:
        return '🟡';
    }
  }
}

/// Phase 1: Scanner Mode - Scrollable event feed
class ScannerMode extends ConsumerWidget {
  const ScannerMode({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final events = ref.watch(filteredEventsProvider);

    if (events.isEmpty) {
      return const EmptyWidget(
        icon: Icons.radar,
        title: 'No Events Detected',
        message:
            'Intelligence feeds are quiet right now.\nPull to refresh for new updates.',
      );
    }

    return RefreshIndicator(
      onRefresh: () => ref.read(eventsNotifierProvider).refreshEvents(),
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: events.length,
        itemBuilder: (context, index) {
          final event = events[index];
          return _buildEventCard(context, event);
        },
      ),
    );
  }

  Widget _buildEventCard(BuildContext context, GeoEvent event) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => _showEventDetails(context, event),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _buildEventCategoryIcon(event.category),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      event.title,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                event.locationName,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: const Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  _buildSeverityIndicator(event.severity),
                  const SizedBox(width: 12),
                  Text(
                    format(event.timestamp),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF94A3B8),
                    ),
                  ),
                  const Spacer(),
                  _buildActionButton(
                    context,
                    'View',
                    Icons.open_in_new,
                    () => _showEventDetails(context, event),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showEventDetails(BuildContext context, GeoEvent event) {
    // TODO: Navigate to detailed event view
  }

  Widget _buildEventCategoryIcon(EventCategory category, {double size = 16}) {
    return Container(
      width: size + 8,
      height: size + 8,
      decoration: BoxDecoration(
        color: _getCategoryColor(category).withOpacity(0.2),
        borderRadius: BorderRadius.circular(size / 2),
      ),
      child: Center(
        child: Text(
          _getCategoryEmoji(category),
          style: TextStyle(fontSize: size),
        ),
      ),
    );
  }

  Widget _buildSeverityIndicator(int severity) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final isActive = index < (severity / 2).round();
        return Container(
          width: 6,
          height: 12,
          margin: const EdgeInsets.only(right: 1),
          decoration: BoxDecoration(
            color: isActive
                ? _getSeverityColor(severity)
                : const Color(0xFF374151),
            borderRadius: BorderRadius.circular(2),
          ),
        );
      }),
    );
  }

  Widget _buildActionButton(
    BuildContext context,
    String label,
    IconData icon,
    VoidCallback onPressed,
  ) {
    return TextButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
    );
  }

  Color _getCategoryColor(EventCategory category) {
    switch (category) {
      case EventCategory.military:
        return const Color(0xFFEF4444);
      case EventCategory.diplomacy:
        return const Color(0xFF06B6D4);
      case EventCategory.economy:
        return const Color(0xFF10B981);
      case EventCategory.unrest:
        return const Color(0xFFF59E0B);
    }
  }

  Color _getSeverityColor(int severity) {
    if (severity >= 8) return Colors.red[600]!;
    if (severity >= 6) return Colors.orange[600]!;
    if (severity >= 4) return Colors.amber[600]!;
    return Colors.green[600]!;
  }

  String _getCategoryEmoji(EventCategory category) {
    switch (category) {
      case EventCategory.military:
        return '🔴';
      case EventCategory.diplomacy:
        return '🔵';
      case EventCategory.economy:
        return '🟢';
      case EventCategory.unrest:
        return '🟡';
    }
  }
}

/// Phase 2: Pilot Mode - Detailed event cards with swipe navigation
class PilotMode extends ConsumerStatefulWidget {
  @override
  ConsumerState<PilotMode> createState() => _PilotModeState();
}

class _PilotModeState extends ConsumerState<PilotMode> {
  final PageController _pageController = PageController();
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final events = ref.watch(filteredEventsProvider);

    if (events.isEmpty) {
      return const EmptyWidget(
        icon: Icons.flight,
        title: 'No Mission Targets',
        message:
            'No events selected for detailed analysis.\nSwitch to Scanner mode to select targets.',
      );
    }

    return Column(
      children: [
        // Mission status
        Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              const Icon(Icons.flight, color: Color(0xFF3B82F6), size: 16),
              const SizedBox(width: 8),
              Text(
                'Mission ${_currentIndex + 1} of ${events.length}',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: const Color(0xFF94A3B8)),
              ),
              const Spacer(),
              IconButton(
                onPressed: () {
                  if (_currentIndex > 0) {
                    _pageController.previousPage(
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeInOut,
                    );
                  }
                },
                icon: const Icon(
                  Icons.arrow_back,
                  size: 20,
                  color: Color(0xFF94A3B8),
                ),
              ),
              IconButton(
                onPressed: () {
                  if (_currentIndex < events.length - 1) {
                    _pageController.nextPage(
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeInOut,
                    );
                  }
                },
                icon: const Icon(
                  Icons.arrow_forward,
                  size: 20,
                  color: Color(0xFF94A3B8),
                ),
              ),
            ],
          ),
        ),

        // Event cards with swipe navigation
        Expanded(
          child: PageView.builder(
            controller: _pageController,
            onPageChanged: (index) {
              setState(() {
                _currentIndex = index;
              });
            },
            itemCount: events.length,
            itemBuilder: (context, index) {
              final event = events[index];
              return Padding(
                padding: const EdgeInsets.all(16),
                child: _buildDetailedEventCard(context, event),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildDetailedEventCard(BuildContext context, GeoEvent event) {
    return Card(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  _buildEventCategoryIcon(event.category, size: 24),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          event.title,
                          style: Theme.of(context).textTheme.headlineSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          event.locationName,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(color: const Color(0xFF94A3B8)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Summary
              Text(
                event.summary,
                style: Theme.of(
                  context,
                ).textTheme.bodyLarge?.copyWith(height: 1.6),
              ),
              const SizedBox(height: 20),

              // Metadata
              Row(
                children: [
                  _buildSeverityIndicator(event.severity),
                  const SizedBox(width: 16),
                  _buildCategoryChip(event.category),
                  const SizedBox(width: 16),
                  Text(
                    format(event.timestamp),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF94A3B8),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Fallout prediction
              if (event.falloutPrediction != null) ...[
                Text(
                  'Impact Assessment',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF374151),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.lightbulb_outline,
                        color: Colors.amber[400],
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          event.falloutPrediction!,
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(
                                color: Colors.amber[200],
                                fontStyle: FontStyle.italic,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // Actions
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _requestBriefing(context, event),
                      icon: const Icon(Icons.smart_toy, size: 18),
                      label: const Text('Request Briefing'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF3B82F6),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  IconButton(
                    onPressed: () => _shareEvent(context, event),
                    icon: const Icon(Icons.share),
                    style: IconButton.styleFrom(
                      backgroundColor: const Color(0xFF374151),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _requestBriefing(BuildContext context, GeoEvent event) {
    // TODO: Navigate to briefing view
  }

  void _shareEvent(BuildContext context, GeoEvent event) {
    // TODO: Implement share functionality
  }

  Widget _buildEventCategoryIcon(EventCategory category, {double size = 16}) {
    return Container(
      width: size + 8,
      height: size + 8,
      decoration: BoxDecoration(
        color: _getCategoryColor(category).withOpacity(0.2),
        borderRadius: BorderRadius.circular(size / 2),
      ),
      child: Center(
        child: Text(
          _getCategoryEmoji(category),
          style: TextStyle(fontSize: size),
        ),
      ),
    );
  }

  Widget _buildCategoryChip(EventCategory category) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _getCategoryColor(category),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        category.name,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Widget _buildSeverityIndicator(int severity) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (index) {
        final isActive = index < (severity / 2).round();
        return Container(
          width: 6,
          height: 12,
          margin: const EdgeInsets.only(right: 1),
          decoration: BoxDecoration(
            color: isActive
                ? _getSeverityColor(severity)
                : const Color(0xFF374151),
            borderRadius: BorderRadius.circular(2),
          ),
        );
      }),
    );
  }

  Color _getCategoryColor(EventCategory category) {
    switch (category) {
      case EventCategory.military:
        return const Color(0xFFEF4444);
      case EventCategory.diplomacy:
        return const Color(0xFF06B6D4);
      case EventCategory.economy:
        return const Color(0xFF10B981);
      case EventCategory.unrest:
        return const Color(0xFFF59E0B);
    }
  }

  Color _getSeverityColor(int severity) {
    if (severity >= 8) return Colors.red[600]!;
    if (severity >= 6) return Colors.orange[600]!;
    if (severity >= 4) return Colors.amber[600]!;
    return Colors.green[600]!;
  }

  String _getCategoryEmoji(EventCategory category) {
    switch (category) {
      case EventCategory.military:
        return '🔴';
      case EventCategory.diplomacy:
        return '🔵';
      case EventCategory.economy:
        return '🟢';
      case EventCategory.unrest:
        return '🟡';
    }
  }
}

/// Phase 3: Analyst Mode - AI briefing interface
class AnalystMode extends ConsumerStatefulWidget {
  @override
  ConsumerState<AnalystMode> createState() => _AnalystModeState();
}

class _AnalystModeState extends ConsumerState<AnalystMode> {
  final TextEditingController _queryController = TextEditingController();
  bool _isAnalyzing = false;
  String? _currentBriefing;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Header
        Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              const Icon(Icons.psychology, color: Color(0xFF8B5CF6), size: 24),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'AI Briefing Center',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),

        // Briefing input
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: _queryController,
                decoration: const InputDecoration(
                  hintText:
                      'Ask about global events, trends, or specific regions...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.all(Radius.circular(8)),
                    borderSide: BorderSide.none,
                  ),
                  filled: true,
                  fillColor: Color(0xFF374151),
                ),
                maxLines: 3,
                maxLength: 500,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _isAnalyzing ? null : _generateBriefing,
                      icon: _isAnalyzing
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(
                                  Colors.white,
                                ),
                              ),
                            )
                          : const Icon(Icons.smart_toy, size: 18),
                      label: Text(
                        _isAnalyzing ? 'Analyzing...' : 'Generate Briefing',
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF8B5CF6),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        // Briefing results
        if (_currentBriefing != null) ...[
          const SizedBox(height: 16),
          Expanded(
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(12),
              ),
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.psychology,
                          color: Color(0xFF8B5CF6),
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'AI Analysis',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _currentBriefing!,
                      style: Theme.of(
                        context,
                      ).textTheme.bodyLarge?.copyWith(height: 1.6),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ] else ...[
          // Empty state
          const Expanded(
            child: EmptyWidget(
              icon: Icons.psychology,
              title: 'Ready for Analysis',
              message:
                  'Enter a query to generate AI-powered\nintelligence briefings.',
            ),
          ),
        ],

        const SizedBox(height: 16),
      ],
    );
  }

  Future<void> _generateBriefing() async {
    if (_queryController.text.trim().isEmpty) return;

    setState(() {
      _isAnalyzing = true;
      _currentBriefing = null;
    });

    try {
      // Simulate AI analysis (would integrate with Pythia service)
      await Future.delayed(const Duration(seconds: 2));

      final query = _queryController.text.trim();
      setState(() {
        _currentBriefing =
            'Based on recent intelligence data: $query\n\nThis assessment is generated using advanced AI models trained on global geopolitical data streams. The analysis considers recent events, trends, and patterns across multiple regions.';
        _isAnalyzing = false;
      });

      _queryController.clear();
    } catch (e) {
      setState(() {
        _isAnalyzing = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Analysis failed: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}
