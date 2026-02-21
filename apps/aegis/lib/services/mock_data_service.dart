import 'dart:math';
import '../models/simple_geo_event.dart';

/// Mock data service to provide realistic intelligence events
/// This replaces API calls during development and testing
class MockDataService {
  static final Random _random = Random();

  // Realistic event titles and summaries
  static final List<Map<String, dynamic>> _eventTemplates = [
    // Military Events
    {
      'category': EventCategory.military,
      'title': 'Russian Naval Movement in Black Sea',
      'summary':
          'Russian Navy vessels detected conducting exercises near Sevastopol, Crimea. Multiple ships observed with increased activity levels and communication patterns.',
      'fallout':
          'Potential escalation in Black Sea tensions. May impact grain export negotiations.',
      'location': 'Black Sea',
      'region': Region.europe,
      'severity': 8,
    },
    {
      'category': EventCategory.military,
      'title': 'Chinese Air Force Activity Near Taiwan',
      'summary':
          '34 Chinese military aircraft detected in Taiwan ADIZ over 24-hour period, including fighter jets and surveillance aircraft.',
      'fallout':
          'Escalation in Taiwan Strait tensions ahead of upcoming regional summit.',
      'location': 'Taiwan Strait',
      'region': Region.eastAsia,
      'severity': 7,
    },
    {
      'category': EventCategory.military,
      'title': 'Israeli Strike on Gaza Infrastructure',
      'summary':
          'Israeli Defense Forces conducted targeted strikes on Hamas military infrastructure in northern Gaza.',
      'fallout':
          'Potential retaliatory rocket fire. Continued escalation cycle in Gaza conflict.',
      'location': 'Gaza Strip',
      'region': Region.middleEast,
      'severity': 6,
    },

    // Diplomatic Events
    {
      'category': EventCategory.diplomacy,
      'title': 'G20 Foreign Ministers Meeting Beijing',
      'summary':
          'Foreign ministers from G20 nations meeting in Beijing to discuss global economic security and trade relations.',
      'fallout':
          'May influence upcoming WTO negotiations and bilateral trade agreements.',
      'location': 'Beijing, China',
      'region': Region.eastAsia,
      'severity': 5,
    },
    {
      'category': EventCategory.diplomacy,
      'title': 'EU-Ukraine Association Council Session',
      'summary':
          'EU-Ukraine Association Council meets to discuss aid coordination and post-war reconstruction planning.',
      'fallout':
          'Key decisions on EU aid package totaling €50 billion for reconstruction efforts.',
      'location': 'Brussels, Belgium',
      'region': Region.europe,
      'severity': 7,
    },
    {
      'category': EventCategory.diplomacy,
      'title': 'India-Pakistan Border Talks',
      'summary':
          'India and Pakistan conduct border management talks at Wagah checkpoint following recent ceasefire violations.',
      'fallout':
          'Potential normalization of border crossings and trade resumption.',
      'location': 'Wagah Border',
      'region': Region.southAsia,
      'severity': 6,
    },

    // Economy Events
    {
      'category': EventCategory.economy,
      'title': 'Oil Prices Surge on Middle East Tensions',
      'summary':
          'Crude oil prices jump 4.2% following escalating tensions in Middle East shipping routes.',
      'fallout':
          'Potential impact on global inflation and transportation costs.',
      'location': 'Global Markets',
      'region': Region.middleEast,
      'severity': 7,
    },
    {
      'category': EventCategory.economy,
      'title': 'China-Europe Rail Infrastructure Expansion',
      'summary':
          'New rail freight route launched connecting Chongqing to Duisburg, reducing shipping time by 40%.',
      'fallout':
          'Enhanced China-Europe trade connectivity. Potential reduction in maritime dependency.',
      'location': 'Chongqing-Duisburg Corridor',
      'region': Region.eastAsia,
      'severity': 5,
    },
    {
      'category': EventCategory.economy,
      'title': 'Brazil Soybean Export Surge to China',
      'summary':
          'Brazilian soybean exports to China reach record levels, accounting for 70% of Chinese imports.',
      'fallout':
          'Strengthening Brazil-China agricultural ties. Impact on US soybean market share.',
      'location': 'São Paulo, Brazil',
      'region': Region.americas,
      'severity': 6,
    },

    // Unrest Events
    {
      'category': EventCategory.unrest,
      'title': 'Mass Protests in Bangladesh Over Election',
      'summary':
          'Thousands rally in Dhaka demanding electoral reforms ahead of general elections.',
      'fallout':
          'Potential political instability affecting regional security partnerships.',
      'location': 'Dhaka, Bangladesh',
      'region': Region.southAsia,
      'severity': 5,
    },
    {
      'category': EventCategory.unrest,
      'title': 'Kenya Fuel Price Riots Continue',
      'summary':
          'Protests over fuel subsidies continue for third consecutive day, affecting major transport routes.',
      'fallout': 'Potential disruption to East African trade corridors.',
      'location': 'Nairobi, Kenya',
      'region': Region.africa,
      'severity': 6,
    },
    {
      'category': EventCategory.unrest,
      'title': 'Student Unrest in Pakistan Over Education Policy',
      'summary':
          'University students protest new education policy, blocking major highways in Karachi.',
      'fallout':
          'Potential escalation affecting Pakistan-China economic corridor projects.',
      'location': 'Karachi, Pakistan',
      'region': Region.southAsia,
      'severity': 4,
    },
  ];

  // Realistic source names
  static final List<String> _sources = [
    'Reuters',
    'BBC News',
    'Associated Press',
    'Financial Times',
    'Wall Street Journal',
    'Bloomberg',
    'CNN',
    'Al Jazeera',
    'France 24',
    'Deutsche Welle',
    'NHK',
    'Times of India',
    'The Guardian',
    'New York Times',
    'Washington Post',
  ];

  /// Generate realistic coordinates for locations
  static List<double> _generateCoordinates(String location) {
    final Map<String, List<double>> locationCoords = {
      'Black Sea': [32.0, 44.5],
      'Taiwan Strait': [120.0, 24.0],
      'Gaza Strip': [34.3, 31.5],
      'Beijing, China': [116.4, 39.9],
      'Brussels, Belgium': [4.35, 50.85],
      'Wagah Border': [74.57, 31.55],
      'Global Markets': [0.0, 0.0],
      'Chongqing-Duisburg Corridor': [106.5, 29.6],
      'São Paulo, Brazil': [-46.6, -23.5],
      'Dhaka, Bangladesh': [90.4, 23.8],
      'Nairobi, Kenya': [36.8, -1.3],
      'Karachi, Pakistan': [67.0, 24.9],
      'Sevastopol, Crimea': [33.5, 44.6],
    };

    return locationCoords[location] ??
        [_random.nextDouble() * 360 - 180, _random.nextDouble() * 180 - 90];
  }

  /// Generate a realistic timestamp within the last week
  static DateTime _generateTimestamp() {
    final now = DateTime.now();
    final daysAgo = _random.nextInt(7);
    final hoursAgo = _random.nextInt(24);
    final minutesAgo = _random.nextInt(60);

    return now.subtract(
      Duration(days: daysAgo, hours: hoursAgo, minutes: minutesAgo),
    );
  }

  /// Generate a realistic source
  static EventSource _generateSource(
    String title,
    String summary,
    String location,
  ) {
    return EventSource(
      id: 'src_${_random.nextInt(100000)}',
      headline: title,
      summary: summary,
      sourceName: _sources[_random.nextInt(_sources.length)],
      sourceUrl: 'https://example.com/news/${_random.nextInt(100000)}',
      timestamp: _generateTimestamp(),
      originalSeverity: _random.nextInt(10) + 1,
    );
  }

  /// Generate a single mock event
  static GeoEvent _generateEvent() {
    final template = _eventTemplates[_random.nextInt(_eventTemplates.length)];
    final id = 'evt_${_random.nextInt(100000)}';
    final coordinates = _generateCoordinates(template['location']);
    final timestamp = _generateTimestamp();
    final source = _generateSource(
      template['title'],
      template['summary'],
      template['location'],
    );

    return GeoEvent(
      id: id,
      title: template['title'],
      category: template['category'],
      coordinates: coordinates,
      locationName: template['location'],
      region: template['region'],
      severity: template['severity'],
      summary: template['summary'],
      timestamp: timestamp,
      lastUpdated: timestamp.add(Duration(hours: _random.nextInt(6))),
      falloutPrediction: template['fallout'],
      sources: [source],
    );
  }

  /// Generate multiple events with variety
  static List<GeoEvent> generateEvents({
    int count = 25,
    EventCategory? category,
    int minSeverity = 1,
  }) {
    final events = <GeoEvent>[];

    for (int i = 0; i < count; i++) {
      final event = _generateEvent();

      // Apply filters
      if (category != null && event.category != category) continue;
      if (event.severity < minSeverity) continue;

      // Add some duplicate events for clustering
      if (_random.nextDouble() < 0.3) {
        // Add a similar event nearby
        final duplicate = GeoEvent(
          id: 'evt_${_random.nextInt(100000)}',
          title: event.title,
          category: event.category,
          coordinates: [
            event.coordinates[0] + (_random.nextDouble() - 0.5) * 2.0,
            event.coordinates[1] + (_random.nextDouble() - 0.5) * 2.0,
          ],
          locationName: event.locationName,
          region: event.region,
          severity: (1 > event.severity - 1) ? 1 : event.severity - 1,
          summary: event.summary,
          timestamp: event.timestamp.subtract(
            Duration(hours: _random.nextInt(24)),
          ),
          lastUpdated: event.timestamp,
          falloutPrediction: event.falloutPrediction,
          sources: [event.sources.first],
        );
        events.add(duplicate);
      }

      events.add(event);
    }

    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp.compareTo(a.timestamp));

    return events;
  }

  /// Get live event count (simulates real-time updates)
  static int getLiveEventCount() {
    return 18 + _random.nextInt(15); // 18-32 events
  }

  /// Simulate real-time event addition
  static GeoEvent? getNewEvent() {
    if (_random.nextDouble() < 0.3) {
      // 30% chance of new event
      return _generateEvent();
    }
    return null;
  }
}
