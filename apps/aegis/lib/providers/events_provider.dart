import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../models/simple_geo_event.dart';
import '../services/delphi_api.dart';
import '../constants/app_config.dart';
import 'filters_provider.dart';

/// Simple events provider using FutureProvider
final eventsProvider = FutureProvider<List<GeoEvent>>((ref) async {
  final apiService = ref.read(delphiApiProvider);
  final filters = ref.watch(eventFiltersProvider);
  try {
    final events = await apiService.fetchEvents(filters: filters);
    return events;
  } catch (e) {
    throw Exception('Failed to load events: $e');
  }
});

/// Filtered events provider
final filteredEventsProvider = Provider<List<GeoEvent>>((ref) {
  final eventsAsync = ref.watch(eventsProvider);
  return eventsAsync.value ?? [];
});

/// Events loading state provider
final isLoadingEventsProvider = Provider<bool>((ref) {
  final eventsAsync = ref.watch(eventsProvider);
  return eventsAsync.isLoading;
});

/// Events count provider
final eventsCountProvider = Provider<int>((ref) {
  final events = ref.watch(filteredEventsProvider);
  return events.length;
});

/// Events notifier for manual control
class EventsNotifier {
  final DelphiApiService _apiService;
  final Logger _logger = Logger();
  Timer? _refreshTimer;

  EventsNotifier(this._apiService);

  /// Load events with optional filters
  Future<List<GeoEvent>> loadEvents({EventFilters? filters}) async {
    try {
      final events = await _apiService.fetchEvents(filters: filters);
      _logger.i('Loaded ${events.length} events');
      return events;
    } catch (e) {
      _logger.e('Failed to load events: $e');
      rethrow;
    }
  }

  /// Refresh events (manual trigger)
  Future<void> refreshEvents() async {
    await loadEvents();
  }

  /// Search events with text query
  Future<List<GeoEvent>> searchEvents(String query) async {
    try {
      if (query.isEmpty) {
        return await loadEvents();
      }

      final events = await _apiService.searchEvents(query);
      _logger.i('Found ${events.length} events for query: $query');
      return events;
    } catch (e) {
      _logger.e('Failed to search events: $e');
      rethrow;
    }
  }

  /// Start periodic refresh
  void _startPeriodicRefresh() {
    _refreshTimer = Timer.periodic(
      const Duration(minutes: 5),
      (_) => refreshEvents(),
    );
  }

  /// Stop periodic refresh
  void stopPeriodicRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  /// Cleanup
  void dispose() {
    stopPeriodicRefresh();
  }
}

/// Provider for Delphi API service
final delphiApiProvider = Provider<DelphiApiService>((ref) {
  final dio = ref.read(dioProvider);
  return DelphiApiService(dio);
});

/// Provider for events notifier
final eventsNotifierProvider = Provider<EventsNotifier>((ref) {
  final apiService = ref.read(delphiApiProvider);
  return EventsNotifier(apiService);
});
