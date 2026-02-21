// Temporary simple model classes to unblock compilation
// These will be replaced with proper Freezed models once the generation issue is resolved

/// Event categories
enum EventCategory { military, diplomacy, economy, unrest }

/// Geographic regions
enum Region {
  middleEast,
  eastAsia,
  southeastAsia,
  southAsia,
  europe,
  africa,
  americas,
  centralAsia,
  oceania,
  other,
}

/// Event source model
class EventSource {
  final String id;
  final String headline;
  final String summary;
  final String sourceName;
  final String sourceUrl;
  final DateTime timestamp;
  final int originalSeverity;

  const EventSource({
    required this.id,
    required this.headline,
    required this.summary,
    required this.sourceName,
    required this.sourceUrl,
    required this.timestamp,
    this.originalSeverity = 1,
  });

  factory EventSource.fromJson(Map<String, dynamic> json) {
    return EventSource(
      id: json['id'] as String,
      headline: json['headline'] as String,
      summary: json['summary'] as String,
      sourceName: json['sourceName'] as String,
      sourceUrl: json['sourceUrl'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      originalSeverity: json['original_severity'] as int? ?? 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'headline': headline,
      'summary': summary,
      'sourceName': sourceName,
      'sourceUrl': sourceUrl,
      'timestamp': timestamp.toIso8601String(),
      'original_severity': originalSeverity,
    };
  }
}

/// Main event model
class GeoEvent {
  final String id;
  final String title;
  final EventCategory category;
  final List<double> coordinates;
  final String locationName;
  final Region? region;
  final int severity;
  final String summary;
  final DateTime timestamp;
  final DateTime? lastUpdated;
  final String? falloutPrediction;
  final List<EventSource> sources;

  const GeoEvent({
    required this.id,
    required this.title,
    required this.category,
    required this.coordinates,
    required this.locationName,
    this.region,
    this.severity = 5,
    required this.summary,
    required this.timestamp,
    this.lastUpdated,
    this.falloutPrediction,
    required this.sources,
  });

  factory GeoEvent.fromJson(Map<String, dynamic> json) {
    return GeoEvent(
      id: json['id'] as String,
      title: json['title'] as String,
      category: EventCategory.values.firstWhere(
        (e) =>
            e.name.toLowerCase() == (json['category'] as String).toLowerCase(),
        orElse: () => EventCategory.military,
      ),
      coordinates: (json['coordinates'] as List)
          .map((e) => e as double)
          .toList(),
      locationName: json['location_name'] as String,
      region: json['region'] != null
          ? Region.values.firstWhere(
              (r) =>
                  r.name.toLowerCase() ==
                  (json['region'] as String).toLowerCase(),
              orElse: () => Region.other,
            )
          : null,
      severity: json['severity'] as int? ?? 5,
      summary: json['summary'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      lastUpdated: json['last_updated'] != null
          ? DateTime.parse(json['last_updated'] as String)
          : null,
      falloutPrediction: json['fallout_prediction'] as String?,
      sources: (json['sources'] as List)
          .map((e) => EventSource.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'category': category.name,
      'coordinates': coordinates,
      'location_name': locationName,
      'region': region?.name,
      'severity': severity,
      'summary': summary,
      'timestamp': timestamp.toIso8601String(),
      'last_updated': lastUpdated?.toIso8601String(),
      'fallout_prediction': falloutPrediction,
      'sources': sources.map((e) => e.toJson()).toList(),
    };
  }

  String get categoryColor {
    switch (category) {
      case EventCategory.military:
        return '#EF4444';
      case EventCategory.diplomacy:
        return '#06B6D4';
      case EventCategory.economy:
        return '#10B981';
      case EventCategory.unrest:
        return '#F59E0B';
    }
  }

  String get categoryEmoji {
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

  /// Get relative time string (e.g., "2h ago", "3d ago")
  String get relativeTime {
    final now = DateTime.now();
    final difference = now.difference(timestamp);

    if (difference.inMinutes < 1) {
      return 'now';
    } else if (difference.inMinutes < 60) {
      return '${difference.inMinutes}m ago';
    } else if (difference.inHours < 24) {
      return '${difference.inHours}h ago';
    } else if (difference.inDays < 7) {
      return '${difference.inDays}d ago';
    } else {
      return '${difference.inDays ~/ 7}w ago';
    }
  }
}

/// Event filters
class EventFilters {
  final bool military;
  final bool diplomacy;
  final bool economy;
  final bool unrest;
  final List<Region> regions;
  final int minSeverity;
  final String searchQuery;

  const EventFilters({
    this.military = true,
    this.diplomacy = true,
    this.economy = true,
    this.unrest = true,
    this.regions = const [],
    this.minSeverity = 1,
    this.searchQuery = '',
  });

  factory EventFilters.fromJson(Map<String, dynamic> json) {
    return EventFilters(
      military: json['military'] as bool? ?? true,
      diplomacy: json['diplomacy'] as bool? ?? true,
      economy: json['economy'] as bool? ?? true,
      unrest: json['unrest'] as bool? ?? true,
      regions:
          (json['regions'] as List?)
              ?.map(
                (e) => Region.values.firstWhere(
                  (r) => r.name.toLowerCase() == (e as String).toLowerCase(),
                  orElse: () => Region.other,
                ),
              )
              .toList() ??
          [],
      minSeverity: json['min_severity'] as int? ?? 1,
      searchQuery: json['searchQuery'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'military': military,
      'diplomacy': diplomacy,
      'economy': economy,
      'unrest': unrest,
      'regions': regions.map((e) => e.name).toList(),
      'min_severity': minSeverity,
      'searchQuery': searchQuery,
    };
  }

  EventFilters copyWith({
    bool? military,
    bool? diplomacy,
    bool? economy,
    bool? unrest,
    List<Region>? regions,
    int? minSeverity,
    String? searchQuery,
  }) {
    return EventFilters(
      military: military ?? this.military,
      diplomacy: diplomacy ?? this.diplomacy,
      economy: economy ?? this.economy,
      unrest: unrest ?? this.unrest,
      regions: regions ?? this.regions,
      minSeverity: minSeverity ?? this.minSeverity,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }
}
