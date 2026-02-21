import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../models/simple_geo_event.dart';
import '../constants/app_config.dart';
import '../constants/app_constants.dart';
import 'mock_data_service.dart';

/// Dio instance for API calls
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.delphiBaseUrl,
      connectTimeout: AppConfig.settings['apiTimeout'],
      receiveTimeout: AppConfig.settings['apiTimeout'],
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ),
  );

  // Add interceptors based on environment
  if (AppConfig.enableNetworkLogs) {
    dio.interceptors.add(
      LogInterceptor(
        requestBody: true,
        responseBody: true,
        logPrint: (obj) => Logger().d(obj),
      ),
    );
  }

  return dio;
});

/// API service for Delphi backend communication
class DelphiApiService {
  final Dio _dio;
  final Logger _logger = Logger();

  DelphiApiService(this._dio);

  /// Fetch all events with optional filtering
  Future<List<GeoEvent>> fetchEvents({
    EventFilters? filters,
    DateTime? since,
    int limit = 100,
  }) async {
    // Force mock data in development mode
    if (AppConfig.forceMockData) {
      _logger.i('Development mode: using mock data only');
      return _getMockEvents(filters, limit);
    }

    try {
      final queryParams = <String, dynamic>{
        'limit': limit,
        if (since != null) 'since': since.toIso8601String(),
      };

      // Add filter parameters
      if (filters != null) {
        if (!filters.military) queryParams['exclude_categories'] = 'MILITARY';
        if (!filters.diplomacy)
          queryParams['exclude_categories'] += ',DIPLOMACY';
        if (!filters.economy) queryParams['exclude_categories'] += ',ECONOMY';
        if (!filters.unrest) queryParams['exclude_categories'] += ',UNREST';

        if (filters.regions.isNotEmpty) {
          queryParams['regions'] = filters.regions.map((r) => r.name).join(',');
        }

        if (filters.minSeverity > 1) {
          queryParams['min_severity'] = filters.minSeverity;
        }

        if (filters.searchQuery.isNotEmpty) {
          queryParams['search'] = filters.searchQuery;
        }
      }

      final response = await _dio.get(
        ApiEndpoints.events,
        queryParameters: queryParams,
      );

      final List<dynamic> data = response.data as List<dynamic>;
      return data.map((json) => GeoEvent.fromJson(json)).toList();
    } on DioException catch (e) {
      _logger.w('API unavailable, using mock data: $e');
      // Fallback to mock data when API is unavailable
      return _getMockEvents(filters, limit);
    } catch (e) {
      _logger.w('Network error, using mock data: $e');
      // Fallback to mock data for any network error
      return _getMockEvents(filters, limit);
    }
  }

  /// Generate mock events with filtering
  List<GeoEvent> _getMockEvents(EventFilters? filters, int limit) {
    EventCategory? category;
    if (filters != null) {
      // Apply category filter - if only one category is enabled, use it
      final enabledCategories = [
        if (filters.military) EventCategory.military,
        if (filters.diplomacy) EventCategory.diplomacy,
        if (filters.economy) EventCategory.economy,
        if (filters.unrest) EventCategory.unrest,
      ];

      if (enabledCategories.length == 1) {
        category = enabledCategories.first;
      }
      // If no categories are enabled, return empty list
      if (enabledCategories.isEmpty) {
        return [];
      }
    }

    var events = MockDataService.generateEvents(
      count: limit,
      category: category,
      minSeverity: filters?.minSeverity ?? 1,
    );

    // Apply search filter if present
    if (filters?.searchQuery.isNotEmpty == true) {
      final searchQuery = filters!.searchQuery.toLowerCase();
      events = events
          .where(
            (event) =>
                event.title.toLowerCase().contains(searchQuery) ||
                event.summary.toLowerCase().contains(searchQuery) ||
                event.locationName.toLowerCase().contains(searchQuery),
          )
          .toList();
    }

    // Apply region filter if present
    if (filters?.regions.isNotEmpty == true) {
      final allowedRegions = filters!.regions;
      events = events
          .where((event) => allowedRegions.contains(event.region))
          .toList();
    }

    return events;
  }

  /// Fetch a single event by ID
  Future<GeoEvent?> fetchEventById(String eventId) async {
    // Force mock data in development mode
    if (AppConfig.forceMockData) {
      _logger.i('Development mode: searching mock data for event $eventId');
      final events = MockDataService.generateEvents(count: 50);
      try {
        return events.firstWhere((event) => event.id == eventId);
      } catch (_) {
        return null;
      }
    }

    try {
      final response = await _dio.get(
        ApiEndpoints.eventById.replaceAll('{id}', eventId),
      );

      return GeoEvent.fromJson(response.data);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        return null;
      }
      _logger.w('API unavailable, searching mock data for event $eventId');
      // Fallback to mock data search
      final events = MockDataService.generateEvents(count: 50);
      return events.firstWhere(
        (event) => event.id == eventId,
        orElse: () => throw Exception('Event not found'),
      );
    } catch (e) {
      _logger.w('Network error, searching mock data for event $eventId');
      // Fallback to mock data search
      final events = MockDataService.generateEvents(count: 50);
      try {
        return events.firstWhere((event) => event.id == eventId);
      } catch (_) {
        return null;
      }
    }
  }

  /// Request AI briefing for an event
  Future<String> requestBriefing(String eventId) async {
    // Force mock data in development mode
    if (AppConfig.forceMockData) {
      _logger.i('Development mode: generating mock briefing only');
      return _generateMockBriefing(eventId);
    }

    try {
      final response = await _dio.post(
        ApiEndpoints.briefing.replaceAll('{event_id}', eventId),
      );

      return response.data['briefing'] as String;
    } on DioException catch (e) {
      _logger.w('API unavailable, generating mock briefing for event $eventId');
      // Fallback to mock briefing generation
      return _generateMockBriefing(eventId);
    } catch (e) {
      _logger.w('Network error, generating mock briefing for event $eventId');
      // Fallback to mock briefing generation
      return _generateMockBriefing(eventId);
    }
  }

  /// Generate mock briefing content
  String _generateMockBriefing(String eventId) {
    final briefings = [
      '''## Strategic Assessment

This event represents a significant shift in regional dynamics with potential cascading effects on multiple theaters. 

### Key Implications:
- **Security Impact**: Elevated threat perception in adjacent regions
- **Economic Ripple Effects**: Potential disruption to critical supply chains
- **Diplomatic Consequences**: May require multilateral intervention

### Recommended Actions:
1. Enhanced monitoring of escalation indicators
2. Coordination with allied intelligence services
3. Preparation of contingency response plans

### Confidence Level: HIGH
Analysis based on validated intelligence sources and historical precedent.''',

      '''## Intelligence Briefing

Current situation indicates coordinated activity with broader strategic implications.

### Threat Assessment:
- **Immediate**: Medium risk of escalation
- **Medium-term**: Potential for regional destabilization
- **Long-term**: Systemic impact on regional balance of power

### Stakeholder Analysis:
- Primary actors exhibit rational decision-making patterns
- Regional powers likely to maintain strategic ambiguity
- International community response will be critical

### Intelligence Gaps:
- Limited visibility into private diplomatic communications
- Insufficient coverage of underground networks
- Partial understanding of economic motivations

**Assessment Date**: ${DateTime.now().toIso8601String().split('T').first}''',
    ];

    return briefings[DateTime.now().millisecond % briefings.length];
  }

  /// Search events with text query
  Future<List<GeoEvent>> searchEvents(String query) async {
    // Force mock data in development mode
    if (AppConfig.forceMockData) {
      _logger.i('Development mode: using mock search data only');
      return _performMockSearch(query);
    }

    try {
      final response = await _dio.get(
        ApiEndpoints.search,
        queryParameters: {'q': query},
      );

      final List<dynamic> data = response.data as List<dynamic>;
      return data.map((json) => GeoEvent.fromJson(json)).toList();
    } on DioException catch (e) {
      _logger.w('API unavailable, using mock search for query: $query');
      // Fallback to mock data search
      return _performMockSearch(query);
    } catch (e) {
      _logger.w('Network error, using mock search for query: $query');
      // Fallback to mock data search
      return _performMockSearch(query);
    }
  }

  /// Perform search using mock data
  List<GeoEvent> _performMockSearch(String query) {
    if (query.isEmpty) {
      return MockDataService.generateEvents(count: 25);
    }

    final searchQuery = query.toLowerCase();
    final events = MockDataService.generateEvents(count: 50);

    return events
        .where(
          (event) =>
              event.title.toLowerCase().contains(searchQuery) ||
              event.summary.toLowerCase().contains(searchQuery) ||
              event.locationName.toLowerCase().contains(searchQuery) ||
              (event.falloutPrediction ?? '').toLowerCase().contains(
                searchQuery,
              ),
        )
        .toList();
  }
}

/// Provider for Delphi API service
final delphiApiProvider = Provider<DelphiApiService>((ref) {
  final dio = ref.watch(dioProvider);
  return DelphiApiService(dio);
});
