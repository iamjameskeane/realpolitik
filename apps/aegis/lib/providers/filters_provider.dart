import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/simple_geo_event.dart';

/// Simple event filters provider
final eventFiltersProvider = Provider<EventFilters>((ref) {
  return const EventFilters();
});

/// Alias for compatibility
final filtersProvider = eventFiltersProvider;

/// Selected event provider (simple)
GeoEvent? _selectedEvent;

/// Selected event provider
final selectedEventProvider = Provider<GeoEvent?>((ref) {
  return _selectedEvent;
});

/// Update selected event
void updateSelectedEvent(GeoEvent? event) {
  _selectedEvent = event;
}

class EventFiltersNotifier {
  EventFiltersNotifier(this._filters);

  EventFilters _filters;

  EventFilters get filters => _filters;

  void toggleCategory(String category) {
    switch (category.toLowerCase()) {
      case 'military':
        _filters = _filters.copyWith(military: !_filters.military);
        break;
      case 'diplomacy':
        _filters = _filters.copyWith(diplomacy: !_filters.diplomacy);
        break;
      case 'economy':
        _filters = _filters.copyWith(economy: !_filters.economy);
        break;
      case 'unrest':
        _filters = _filters.copyWith(unrest: !_filters.unrest);
        break;
    }
  }

  void updateSeverity(int severity) {
    _filters = _filters.copyWith(minSeverity: severity);
  }

  void updateSearchQuery(String query) {
    _filters = _filters.copyWith(searchQuery: query);
  }

  void updateRegions(List<String> regions) {
    // Convert string regions to Region enums
    final regionEnums = regions.map((name) {
      try {
        return Region.values.firstWhere(
          (r) => r.name.toLowerCase() == name.toLowerCase(),
        );
      } catch (e) {
        return Region.other;
      }
    }).toList();
    _filters = _filters.copyWith(regions: regionEnums);
  }

  void resetFilters() {
    _filters = const EventFilters();
  }
}

/// Provider for event filters notifier
final eventFiltersNotifierProvider = Provider<EventFiltersNotifier>((ref) {
  final initialFilters = ref.read(eventFiltersProvider);
  return EventFiltersNotifier(initialFilters);
});
