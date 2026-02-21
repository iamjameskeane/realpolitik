import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:timeago/timeago.dart';

import '../../models/simple_geo_event.dart';
import '../../providers/map_provider.dart';
import '../../providers/events_provider.dart';
import '../../constants/app_constants.dart';

/// Event popup widget - displays event details when map marker is clicked
class EventPopupWidget extends ConsumerWidget {
  final GeoEvent event;
  final Offset position;
  final void Function()? onClose;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;
  final VoidCallback? onBriefing;
  final String stackLabel;

  const EventPopupWidget({
    super.key,
    required this.event,
    required this.position,
    this.onClose,
    this.onPrevious,
    this.onNext,
    this.onBriefing,
    this.stackLabel = 'events here',
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final size = MediaQuery.of(context).size;
    final theme = Theme.of(context);

    return Positioned(
      left: _clampPosition(position.dx, size.width - 320, 0),
      top: _clampPosition(position.dy - 200, size.height - 300, 80),
      width: 320,
      child: Material(
        color: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B), // Dark slate
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF475569)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                blurRadius: 20,
                spreadRadius: 2,
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildHeader(theme),
                const SizedBox(height: 12),
                _buildEventInfo(theme),
                const SizedBox(height: 16),
                _buildActions(theme),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(ThemeData theme) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    event.categoryEmoji,
                    style: const TextStyle(fontSize: 16),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      event.title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                event.locationName,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: const Color(0xFF94A3B8),
                ),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: onClose,
          icon: const Icon(Icons.close, color: Color(0xFF94A3B8), size: 20),
          padding: EdgeInsets.zero,
          constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
        ),
      ],
    );
  }

  Widget _buildEventInfo(ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            _buildSeverityIndicator(),
            const SizedBox(width: 12),
            _buildCategoryChip(theme),
            const SizedBox(width: 8),
            _buildTimeInfo(theme),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          event.summary,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: const Color(0xFFE2E8F0),
            height: 1.4,
          ),
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
        ),
        if (event.falloutPrediction != null) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF374151),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.lightbulb_outline,
                  size: 16,
                  color: Colors.amber[400],
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Predicted Impact: ${event.falloutPrediction}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: const Color(0xFFFBBF24),
                      fontStyle: FontStyle.italic,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildSeverityIndicator() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(10, (index) {
        final isActive = index < event.severity;
        return Container(
          width: 8,
          height: 16,
          margin: const EdgeInsets.only(right: 2),
          decoration: BoxDecoration(
            color: isActive
                ? _getSeverityColor(event.severity)
                : const Color(0xFF374151),
            borderRadius: BorderRadius.circular(2),
          ),
        );
      }),
    );
  }

  Widget _buildCategoryChip(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: _getCategoryColor(event.category),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        event.category.name,
        style: theme.textTheme.labelSmall?.copyWith(
          color: Colors.white,
          fontWeight: FontWeight.w600,
          fontSize: 10,
        ),
      ),
    );
  }

  Widget _buildTimeInfo(ThemeData theme) {
    return Text(
      format(event.timestamp),
      style: theme.textTheme.labelSmall?.copyWith(
        color: const Color(0xFF94A3B8),
        fontSize: 11,
      ),
    );
  }

  Widget _buildActions(ThemeData theme) {
    final hasNavigation = onPrevious != null || onNext != null;

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        // Left navigation
        if (onPrevious != null || onNext != null)
          Row(
            children: [
              if (onPrevious != null) ...[
                IconButton(
                  onPressed: onPrevious,
                  icon: const Icon(
                    Icons.arrow_back_ios,
                    color: Color(0xFF94A3B8),
                    size: 16,
                  ),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(
                    minWidth: 32,
                    minHeight: 32,
                  ),
                ),
                IconButton(
                  onPressed: onNext,
                  icon: const Icon(
                    Icons.arrow_forward_ios,
                    color: Color(0xFF94A3B8),
                    size: 16,
                  ),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(
                    minWidth: 32,
                    minHeight: 32,
                  ),
                ),
              ],
              if (hasNavigation) ...[
                const SizedBox(width: 8),
                Text(
                  stackLabel,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: const Color(0xFF64748B),
                    fontSize: 10,
                  ),
                ),
              ],
            ],
          ),

        // Right actions
        Row(
          children: [
            if (onBriefing != null) ...[
              ElevatedButton.icon(
                onPressed: onBriefing,
                icon: const Icon(Icons.smart_toy, size: 16),
                label: const Text('Brief'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF3B82F6),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  textStyle: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 8),
            ],
            IconButton(
              onPressed: () => onClose?.call(),
              icon: const Icon(
                Icons.open_in_new,
                color: Color(0xFF94A3B8),
                size: 16,
              ),
              tooltip: 'Open full view',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            ),
          ],
        ),
      ],
    );
  }

  double _clampPosition(double value, double max, double min) {
    return value.clamp(min, max);
  }

  Color _getSeverityColor(int severity) {
    if (severity >= 8) return Colors.red[600]!;
    if (severity >= 6) return Colors.orange[600]!;
    if (severity >= 4) return Colors.amber[600]!;
    return Colors.green[600]!;
  }

  Color _getCategoryColor(EventCategory category) {
    switch (category) {
      case EventCategory.military:
        return const Color(0xFFEF4444); // Red
      case EventCategory.diplomacy:
        return const Color(0xFF06B6D4); // Cyan
      case EventCategory.economy:
        return const Color(0xFF10B981); // Green
      case EventCategory.unrest:
        return const Color(0xFFF59E0B); // Amber
    }
  }
}

/// Cluster popup widget for displaying cluster information
@immutable
class ClusterPopupWidget extends StatelessWidget {
  final List<GeoEvent> events;
  final String locationLabel;
  final Offset position;
  final void Function()? onClose;
  final void Function()? onStartFlyover;
  final void Function(GeoEvent)? onEventTap;

  const ClusterPopupWidget({
    super.key,
    required this.events,
    required this.locationLabel,
    required this.position,
    this.onClose,
    this.onStartFlyover,
    this.onEventTap,
  });

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Positioned(
      left: _clampPosition(position.dx, size.width - 280, 0),
      top: _clampPosition(position.dy - 150, size.height - 250, 80),
      width: 280,
      child: Material(
        color: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF475569)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                blurRadius: 20,
                spreadRadius: 2,
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        '$locationLabel',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                    IconButton(
                      onPressed: onClose,
                      icon: const Icon(
                        Icons.close,
                        color: Color(0xFF94A3B8),
                        size: 20,
                      ),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(
                        minWidth: 24,
                        minHeight: 24,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  '${events.length} events',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(height: 16),
                // Event list (max 5)
                ...events
                    .take(5)
                    .map((event) => _buildEventItem(context, event)),
                if (events.length > 5) ...[
                  const SizedBox(height: 8),
                  Text(
                    'and ${events.length - 5} more...',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: const Color(0xFF64748B),
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                // Actions
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    if (onStartFlyover != null)
                      ElevatedButton.icon(
                        onPressed: onStartFlyover,
                        icon: const Icon(Icons.flight, size: 16),
                        label: const Text('Fly Over'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF3B82F6),
                          foregroundColor: Colors.white,
                          textStyle: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEventItem(BuildContext context, GeoEvent event) {
    return GestureDetector(
      onTap: () => onEventTap?.call(event),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Text(event.categoryEmoji, style: const TextStyle(fontSize: 12)),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.title,
                    style: Theme.of(
                      context,
                    ).textTheme.bodySmall?.copyWith(color: Colors.white),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    '${format(event.timestamp)} • Severity ${event.severity}',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: const Color(0xFF94A3B8),
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  double _clampPosition(double value, double max, double min) {
    return value.clamp(min, max);
  }
}
