# Comprehensive Migration Blueprint: Realpolitik Next.js to Flutter

## Executive Summary

The Realpolitik intelligence platform is a sophisticated web application that provides real-time geospatial event tracking with AI-powered analysis. This comprehensive blueprint outlines the migration from Next.js to Flutter, covering every aspect of the application including UI components, state management, real-time features, and backend integrations.

## 1. Application Architecture Overview

### Core System Components
- **Frontend**: Next.js 16.1.1 with React 19 (TypeScript)
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Maps**: Mapbox GL JS for 3D/2D globe visualization
- **AI Integration**: Google Gemini AI for briefings and analysis
- **Real-time**: WebSocket connections via Supabase
- **Styling**: Tailwind CSS 4 with custom design system
- **State Management**: React Context + Custom hooks (SWR pattern)

### Key Features Catalog

#### 1.1 Interactive Globe Visualization
- **3D Globe**: Mapbox GL JS with custom event markers
- **2D Mode**: Toggle between 3D and 2D map views
- **Auto-rotation**: Smart globe rotation with user interaction detection
- **Clustering**: Event clustering at different zoom levels
- **Event Popups**: Detailed event information on click
- **Fly-to Animation**: Smooth camera transitions to events
- **Real-time Updates**: Live event updates via WebSocket

#### 1.2 Event Management System
- **Event Categories**: Military, Diplomacy, Economy, Unrest
- **Severity Levels**: 1-10 severity rating system
- **Geographic Filtering**: Location-based event filtering
- **Time Range Filtering**: 1H, 6H, 12H, 1D, 3D, 1W, 1M time windows
- **Event Deep Linking**: URL-based event sharing (`?event=EVENT_ID`)
- **Event States**: New, Read, Incoming, Processed tracking

#### 1.3 AI Briefing System
- **Google Gemini Integration**: AI-powered event analysis
- **Tool-Enabled AI**: Search, entity lookup, causal chain analysis
- **Web Search Integration**: Tavily API for current information
- **Knowledge Graph**: Entity relationship analysis
- **Streaming Responses**: Real-time AI response streaming
- **Context-Aware**: Historical context and relationship mapping

#### 1.4 User Engagement Features
- **Reaction System**: Critical, Market, Noise voting
- **Consensus Tracking**: Community-driven event importance
- **Hot Events**: High-engagement event highlighting
- **Threat Assessment**: Visual threat level indicators
- **User Profiles**: Authentication and preferences

#### 1.5 Notification System
- **Push Notifications**: Browser-based notifications
- **Smart Filtering**: Custom notification rules
- **Inbox System**: Notification queue and management
- **Email Integration**: Email notification options
- **Quiet Hours**: Configurable notification schedules

#### 1.6 Mobile Responsive Design
- **Mobile Layout**: Dedicated mobile interface
- **Touch Interactions**: Mobile-optimized controls
- **Sheet Interface**: Bottom sheet for mobile navigation
- **Progressive Web App**: PWA capabilities
- **Platform Detection**: Responsive breakpoints

## 2. Technical Implementation Details

### 2.1 Data Models and Types

#### GeoEvent Interface
```typescript
interface GeoEvent {
  id: string;
  title: string; // Synthesized headline
  category: "MILITARY" | "DIPLOMACY" | "ECONOMY" | "UNREST";
  coordinates: [number, number]; // [lng, lat]
  location_name: string;
  region?: EventRegion;
  severity: number; // 1-10
  summary: string;
  timestamp: string; // ISO 8601
  last_updated?: string;
  fallout_prediction: string;
  sources: EventSource[];
}
```

#### EventCategory Configuration
```typescript
const CATEGORY_COLORS = {
  MILITARY: "#ef4444", // red-500
  DIPLOMACY: "#22d3ee", // cyan-400
  ECONOMY: "#34d399", // emerald-400
  UNREST: "#fbbf24", // amber-400
};
```

#### Reaction System Types
```typescript
type ReactionType = "critical" | "market" | "noise";

interface EnrichedReactionData extends ReactionCounts {
  consensus: ConsensusType;
  consensusPct: number;
  isHot: boolean;
  adjustedSeverity: number;
}
```

### 2.2 State Management Architecture

#### Custom Hook Pattern (SWR-based)
- **useEvents**: Event fetching and real-time updates
- **useEventStates**: New/read event tracking
- **useBatchReactions**: Reaction voting system
- **useNotificationInbox**: Notification queue management
- **useAutoRotate**: Globe auto-rotation logic
- **useEventLayers**: Map layer management

#### Context Providers
- **AuthProvider**: User authentication state
- **BatchReactionsProvider**: Reaction voting context

### 2.3 API Integration Patterns

#### Supabase Integration
```typescript
// Real-time subscriptions
const supabase = createClient(url, key);
const subscription = supabase
  .from('events_with_reactions')
  .on('*', payload => {
    // Handle real-time updates
  })
  .subscribe();
```

#### API Routes Structure
- `/api/briefing` - AI briefing system
- `/api/stripe/*` - Payment processing
- `/api/push/*` - Push notification management
- `/api/reactions` - Reaction voting system

### 2.4 Mapbox GL Implementation

#### Globe Configuration
```typescript
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  center: [15, 50], // Center on Europe
  zoom: 1.5,
  projection: 'globe'
});
```

#### Custom Layers
- **Event Layer**: Dynamic event markers
- **Cluster Layer**: Event clustering visualization
- **Glow Effects**: High-severity event highlighting

### 2.5 Styling System

#### Design Tokens (CSS Variables)
```css
:root {
  --background: #020617; /* Deep Space Black */
  --foreground: #2e8f0;
  --accent: #6366f1; /* Purple accent */
  
  /* Category Colors */
  --military: #ef4444;
  --economy: #34d399;
  --diplomacy: #22d3ee;
  --unrest: #fbbf24;
  
  /* UI Components */
  --panel-bg: rgba(0, 0, 0, 0.4);
  --panel-border: rgba(255, 255, 255, 0.1);
}
```

#### Typography System
- **Primary Font**: Outfit (Google Fonts)
- **Monospace**: JetBrains Mono
- **Font Classes**: `.font-sans`, `.font-mono`

#### Glass Panel Effect
```css
.glass-panel {
  background: var(--panel-bg);
  backdrop-filter: blur(12px);
  border: 1px solid var(--panel-border);
  border-radius: 12px;
}
```

## 3. Component Architecture Analysis

### 3.1 Core Components

#### WorldMap Component (900+ lines)
- **Purpose**: Main globe visualization component
- **Features**: 3D/2D toggle, event clustering, auto-rotation
- **Dependencies**: Mapbox GL, Custom hooks
- **Key Methods**:
  - `flyToEvent()` - Camera animation to event
  - `handleSingleEventClick()` - Event selection
  - `handleClusterClick()` - Cluster interaction
- **State Management**: Multiple useState hooks for popup, selection, flying state

#### Dashboard Component (920+ lines)
- **Purpose**: Main application container
- **Features**: Layout management, sidebar, time controls, category filtering
- **Key Elements**:
  - Header with logo and live indicator
  - Time range slider with dynamic options
  - Category legend with counts
  - Inbox notification system
  - Settings modal
- **Responsive Behavior**: Different layouts for mobile/desktop

#### MobileLayout Component (1051+ lines)
- **Purpose**: Mobile-optimized interface
- **Features**: Bottom sheet navigation, touch interactions
- **Three-layer Architecture**:
  - Layer 1: Ambient Globe (auto-rotating)
  - Layer 2: HUD (logo, live indicator)
  - Layer 3: Intelligence Sheet (bottom sheet)

### 3.2 Event Management Components

#### EventPopup Component
- **Features**: Event details, reaction buttons, source timeline
- **Interactive Elements**: Vote buttons, source links, briefing request
- **Dynamic Content**: Event summary, fallout prediction, category styling

#### EventsSidebar Component
- **Features**: Event list, category filtering, severity filtering
- **Interactions**: Event selection, category toggle, flyover mode
- **State Tracking**: Read/unread indicators, incoming events

#### IntelligenceSheet Component (Mobile)
- **Purpose**: Mobile bottom sheet interface
- **Features**: Event cards, filtering, entity browser
- **Phases**: Collapsed, expanded, full-screen modes

### 3.3 Reaction System Components

#### VoteButtons Component
- **Button Types**: PuckButton (compact), VoteButton (full-size)
- **Features**: Animated counts, loading states, tooltips
- **States**: Active, loading, fetching
- **Styling**: Discord-style reaction buttons with category colors

#### ThreatBar Component
- **Purpose**: Visual threat level indicator
- **Features**: Gradient fills, severity-based coloring
- **Animation**: Pulse effects for high-severity events

#### ConsensusBadge Component
- **Features**: Consensus type display, percentage indicators
- **States**: Critical, Market, Noise consensus

### 3.4 Entity Management

#### EntityModal Component
- **Features**: Entity details, relationship visualization
- **Data Sources**: Knowledge graph, event associations
- **Interactions**: Event navigation, relationship exploration

#### EntityList Component
- **Purpose**: Entity browsing and selection
- **Features**: Entity cards, type indicators, event counts

### 3.5 Notification System

#### NotificationPrompt Component
- **Purpose**: Browser notification permission requests
- **Features**: Progressive enhancement, fallback messaging

#### Inbox System Components
- **InboxDropdown**: Notification queue display
- **Catch Up Mode**: Automated event review
- **Smart Filtering**: Notification preferences

### 3.6 AI Briefing Components

#### BriefingChat Component
- **Purpose**: Chat interface for AI briefings
- **Features**: Streaming responses, tool calling, context management
- **Integration**: Google Gemini API with custom tools

#### ChatMessage Component
- **Features**: Message rendering, source citation, tool results
- **Styling**: Different styles for user/AI messages

### 3.7 Authentication Components

#### AuthModal Component
- **Features**: Sign in/up forms, social authentication
- **Integration**: Supabase Auth
- **Styling**: Glass modal design

### 3.8 Utility Components

#### ErrorBoundary Component
- **Purpose**: React error handling
- **Features**: Error fallback UI, error reporting

#### SplashScreen Component
- **Purpose**: Initial loading experience
- **Features**: Brand elements, loading animation

## 4. Visual Design System

### 4.1 Color Palette

#### Primary Colors
- **Background**: `#020617` (Deep Space Black)
- **Foreground**: `#e2e8f0` (Light Gray)
- **Accent**: `#6366f1` (Purple)

#### Category Colors
- **Military**: `#ef4444` (Red) - Armed conflict, defense
- **Diplomacy**: `#22d3ee` (Cyan) - International relations
- **Economy**: `#34d399` (Green) - Trade, financial policy
- **Unrest**: `#fbbf24` (Amber) - Civil disorder, protests

#### Reaction Colors
- **Critical**: Red variants (`#ef4444`, `bg-red-500/20`)
- **Market**: Amber variants (`#f59e0b`, `bg-amber-500/20`)
- **Noise**: Blue variants (`#3b82f6`, `bg-blue-500/20`)

### 4.2 Typography

#### Font Stack
- **Primary**: Outfit (Google Fonts) - Clean, modern sans-serif
- **Monospace**: JetBrains Mono - Technical content, data display
- **System Fallbacks**: `system-ui, sans-serif`

#### Font Sizes
- **Headers**: `text-xl`, `text-2xl` (20px, 24px)
- **Body**: `text-sm`, `text-base` (14px, 16px)
- **Captions**: `text-xs`, `text-[10px]` (12px, 10px)
- **Micro**: `text-[9px]` (9px)

#### Font Weights
- **Bold**: `font-bold` (700) - Headers, emphasis
- **Medium**: `font-medium` (500) - Interactive elements
- **Regular**: `font-normal` (400) - Body text
- **Mono**: JetBrains Mono - Technical data

### 4.3 Layout Patterns

#### Glass Panel Design
```css
.glass-panel {
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}
```

#### Responsive Breakpoints
- **Mobile**: `< 768px` (md breakpoint)
- **Desktop**: `>= 768px`
- **Large Desktop**: `>= 1024px`

#### Grid System
- **Flexbox**: Primary layout method
- **CSS Grid**: Complex layouts (map positioning)
- **Absolute Positioning**: Overlays, modals

### 4.4 Interactive Elements

#### Buttons
- **Primary**: Glass panels with hover effects
- **Secondary**: Outline style with transparency
- **Interactive States**: Hover, focus-visible, active

#### Form Elements
- **Focus States**: Purple outline (`outline: 2px solid var(--accent)`)
- **Input Styling**: Transparent backgrounds with borders
- **Select Components**: Custom dropdown styling

#### Animations
- **Framer Motion**: Component animations
- **CSS Transitions**: Hover effects, state changes
- **Custom Keyframes**:
  - `pulse-glow`: Pulsing effect for high-severity events
  - `shimmer-sweep`: Button shine effect
  - `loading-bar`: Progress animation
  - `fadeSlideIn`: Modal/panel entrance

### 4.5 Mobile-Specific Design

#### Three-Layer Glass Stack (Mobile)
1. **Layer 1**: Ambient Globe (z-0) - Locked, auto-rotating
2. **Layer 2**: HUD (z-10) - Logo, live indicator
3. **Layer 3**: Intelligence Sheet (z-50) - Bottom sheet

#### Mobile Optimizations
- **Touch Targets**: Minimum 44px touch targets
- **Edge-to-Edge**: Full-width layouts
- **Safe Areas**: iOS notch and home indicator handling
- **Viewport Handling**: CSS `100vh` fixes for mobile browsers

## 5. Mobile/Responsive Features

### 5.1 Responsive Design Strategy

#### Breakpoint System
```typescript
const BREAKPOINTS = {
  mobile: '768px',
  tablet: '1024px', 
  desktop: '1200px'
};
```

#### Layout Variations

**Desktop Layout**:
- Fixed sidebar (344px width)
- Category legend (bottom-left)
- Settings button (bottom-left)
- Event count (bottom-right)
- Time slider (bottom-center)

**Mobile Layout**:
- Full-screen map
- Bottom sheet interface
- Compact category chips (top)
- No sidebar (replaced by sheet)
- Touch-optimized controls

### 5.2 Mobile-Specific Components

#### IntelligenceSheet Component
- **Purpose**: Mobile main interface
- **Features**: 
  - Bottom sheet with drag handle
  - Event cards with swipe interactions
  - Search and filtering
  - Entity browser integration
- **States**: Collapsed, intermediate, expanded, full-screen

#### MobileLayout Features
- **Touch Interactions**:
  - Long press for cluster context menu
  - Swipe gestures for navigation
  - Pull-to-refresh functionality
- **Optimizations**:
  - Reduced information density
  - Larger touch targets
  - Simplified navigation

### 5.3 Progressive Web App Features

#### PWA Configuration
```json
{
  "name": "Realpolitik",
  "short_name": "Realpolitik",
  "description": "Global Situational Awareness",
  "theme_color": "#020617",
  "background_color": "#020617",
  "display": "standalone",
  "orientation": "any"
}
```

#### Service Worker Features
- **Push Notifications**: Background notification handling
- **Offline Support**: Cached critical data
- **Background Sync**: Sync when connection restored

### 5.4 Platform-Specific Optimizations

#### iOS Optimizations
- **Safari**: Viewport height fixes
- **iOS PWA**: Standalone mode support
- **Touch Events**: Optimized for iOS gestures

#### Android Optimizations
- **Chrome**: Edge-to-edge display
- **Navigation Bar**: Transparent navbar handling
- **Material You**: Adaptive theming support

## 6. Technical Implementation Details

### 6.1 State Management Migration Strategy

#### Current React Pattern → Flutter Equivalent

**React Context + Hooks**:
```typescript
// Current: React Context
const AuthContext = createContext<AuthContextType>({});

// Current: Custom Hook
const useEvents = ({ initialEvents }) => {
  const [events, setEvents] = useState(initialEvents);
  // SWR pattern implementation
  return { events, isLoading, refresh };
};
```

**Flutter Equivalent**:
```dart
// Provider/Riverpod equivalent
final authProvider = StateProvider<AuthContextType>((ref) => AuthContext());

// Custom Hook equivalent (Riverpod Hooks)
final eventsProvider = FutureProvider<List<GeoEvent>>((ref) async {
  final initialEvents = ref.watch(initialEventsProvider);
  // SWR pattern implementation
  return EventsService.fetchEvents(initialEvents);
});
```

#### Key State Patterns

**SWR Pattern (Stale-While-Revalidate)**:
- **Purpose**: Automatic polling with cache
- **Current**: Custom useEvents hook
- **Flutter**: Riverpod with auto-refresh

**Event State Tracking**:
- **Purpose**: New/read event detection
- **Current**: useEventStates hook
- **Flutter**: SharedPreferences with Hive

**Batch Reactions**:
- **Purpose**: Optimized voting API calls
- **Current**: BatchReactionsProvider
- **Flutter**: Batched API service

### 6.2 API Integration Patterns

#### Supabase Real-time → Flutter

**Current React Pattern**:
```typescript
const subscription = supabase
  .from('events_with_reactions')
  .on('*', payload => {
    // Handle real-time updates
    setEvents(prev => updateEvents(prev, payload));
  })
  .subscribe();
```

**Flutter Equivalent**:
```dart
final subscription = supabase
    .from('events_with_reactions')
    .stream(primaryKey: ['id'])
    .listen((data) {
      // Handle real-time updates
      ref.read(eventsProvider.notifier).updateEvents(data);
    });
```

#### WebSocket Management
- **Current**: Supabase auto-reconnection
- **Flutter**: Supabase Flutter with connection handling

### 6.3 Map Integration Strategy

#### Mapbox GL JS → Flutter Map

**Current JavaScript**:
```javascript
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v11',
  projection: 'globe'
});
```

**Flutter Equivalent**:
```dart
Widget buildMap() {
  return FlutterMap(
    options: MapOptions(
      center: LatLng(50, 15), // Europe center
      zoom: 1.5,
      projection: Projection.globe,
    ),
    children: [
      TileLayer(
        urlTemplate: 'https://tile.mapbox.com/v4/mapbox.dark/{z}/{x}/{y}.png?access_token=$MAPBOX_TOKEN',
      ),
      // Custom markers and layers
    ],
  );
}
```

#### Custom Map Features

**Event Clustering**:
- **Current**: Mapbox GL clustering
- **Flutter**: flutter_map + custom clustering logic

**3D Globe**:
- **Current**: Mapbox globe projection
- **Flutter**: Limited 3D support, may need WebView or alternative

**Marker Customization**:
- **Current**: Mapbox GL custom layers
- **Flutter**: Custom markers with widget support

### 6.4 Animation System

#### Framer Motion → Flutter Animations

**Current Framer Motion**:
```typescript
<motion.div
  initial={{ opacity: 0, y: 50 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
>
```

**Flutter Equivalent**:
```dart
AnimatedContainer(
  duration: Duration(milliseconds: 300),
  curve: Curves.easeInOut,
  child: Transform.translate(
    offset: Offset(0, isVisible ? 0 : 50),
    child: Opacity(
      opacity: isVisible ? 1.0 : 0.0,
      child: child,
    ),
  ),
);
```

#### Complex Animations

**Page Transitions**:
- **Current**: Framer Motion page transitions
- **Flutter**: PageRoute with custom transitions

**Gesture Animations**:
- **Current**: React Spring, Framer Motion
- **Flutter**: GestureDetector + AnimationController

### 6.5 Offline Support Strategy

#### Local Storage Migration

**Current React**:
```typescript
// localStorage usage
localStorage.setItem(STORAGE_KEYS.READ_IDS, JSON.stringify(readIds));
const readIds = JSON.parse(localStorage.getItem(STORAGE_KEYS.READ_IDS) || '[]');
```

**Flutter Equivalent**:
```dart
// Hive for local storage
await Hive.box('app_data').put('read_ids', readIds);
final readIds = Hive.box('app_data').get('read_ids', defaultValue: []);
```

#### Caching Strategy
- **Events Cache**: Recent events for offline viewing
- **User Preferences**: Settings, filters, read states
- **Entity Data**: Knowledge graph cache

## 7. Flutter Migration Implementation Plan

### 7.1 Project Structure

```
lib/
├── main.dart
├── app/
│   ├── app.dart
│   ├── router.dart
│   └── theme.dart
├── core/
│   ├── constants/
│   ├── network/
│   ├── storage/
│   └── utils/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── map/
│   ├── events/
│   ├── entities/
│   ├── reactions/
│   ├── notifications/
│   ├── briefing/
│   └── settings/
├── shared/
│   ├── widgets/
│   ├── models/
│   ├── services/
│   └── providers/
└── integration_test/
```

### 7.2 Dependencies

#### Core Dependencies
```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # State Management
  riverpod: ^2.4.0
  flutter_riverpod: ^2.4.0
  
  # Navigation
  go_router: ^12.0.0
  
  # Networking
  supabase_flutter: ^1.10.25
  dio: ^5.3.0
  
  # Maps
  flutter_map: ^6.1.0
  latlong2: ^0.8.1
  
  # Local Storage
  hive: ^2.2.3
  hive_flutter: ^1.1.0
  
  # UI & Animation
  flutter_animate: ^4.2.0
  lottie: ^2.7.0
  
  # Utilities
  intl: ^0.18.1
  uuid: ^4.0.0
  
  # Platform
  url_launcher: ^6.2.0
  share_plus: ^7.2.0
  device_info_plus: ^9.0.0
  package_info_plus: ^4.2.0
```

#### Development Dependencies
```yaml
dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0
  build_runner: ^2.4.0
  hive_generator: ^2.0.0
  riverpod_generator: ^2.3.0
```

### 7.3 Key Flutter Implementations

#### Map Component (flutter_map + custom layers)
```dart
class WorldMap extends ConsumerWidget {
  const WorldMap({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return FlutterMap(
      options: MapOptions(
        center: const LatLng(50, 15),
        zoom: 1.5,
        maxZoom: 18,
        minZoom: 1,
        onTap: (tapPosition, point) => _handleMapTap(context, ref, point),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.mapbox.com/v4/mapbox.dark/{z}/{x}/{y}.png?access_token={accessToken}',
          additionalOptions: {
            'accessToken': ref.watch(mapboxTokenProvider),
          },
        ),
        EventMarkersLayer(
          events: ref.watch(eventsProvider),
          onEventTap: _handleEventTap,
        ),
        ClusterMarkersLayer(
          clusters: ref.watch(clustersProvider),
          onClusterTap: _handleClusterTap,
        ),
      ],
    );
  }
}
```

#### Event Markers with Custom Painting
```dart
class EventMarker extends StatelessWidget {
  final GeoEvent event;
  final bool isSelected;
  final bool isNew;
  final VoidCallback? onTap;

  const EventMarker({
    super.key,
    required this.event,
    this.isSelected = false,
    this.isNew = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: Duration(milliseconds: 200),
        width: isSelected ? 20 : 12,
        height: isSelected ? 20 : 12,
        decoration: BoxDecoration(
          color: _getCategoryColor(event.category),
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white,
            width: isSelected ? 3 : 2,
          ),
          boxShadow: [
            BoxShadow(
              color: _getCategoryColor(event.category).withOpacity(0.5),
              blurRadius: isSelected ? 20 : 10,
              spreadRadius: isSelected ? 10 : 5,
            ),
          ],
        ),
        child: isNew 
          ? Icon(Icons.circle, size: 8, color: Colors.white)
          : null,
      ),
    );
  }

  Color _getCategoryColor(EventCategory category) {
    switch (category) {
      case EventCategory.military:
        return const Color(0xffef4444);
      case EventCategory.diplomacy:
        return const Color(0xff22d3ee);
      case EventCategory.economy:
        return const Color(0xff34d399);
      case EventCategory.unrest:
        return const Color(0xfffbbf24);
    }
  }
}
```

#### Bottom Sheet Implementation
```dart
class IntelligenceSheet extends ConsumerStatefulWidget {
  const IntelligenceSheet({super.key});

  @override
  ConsumerState<IntelligenceSheet> createState() => _IntelligenceSheetState();
}

class _IntelligenceSheetState extends ConsumerState<IntelligenceSheet> {
  final SheetController _sheetController = SheetController();
  SheetPhase _currentPhase = SheetPhase.collapsed;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      controller: _sheetController,
      initialChildSize: 0.3,
      minChildSize: 0.1,
      maxChildSize: 0.9,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.8),
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              _buildDragHandle(),
              Expanded(
                child: _currentPhase == SheetPhase.expanded
                    ? _buildEventList(scrollController)
                    : _buildQuickPreview(),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDragHandle() {
    return GestureDetector(
      onVerticalDragUpdate: (details) {
        // Handle sheet dragging
      },
      child: Container(
        margin: EdgeInsets.symmetric(vertical: 8),
        width: 40,
        height: 4,
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.3),
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}
```

#### AI Briefing Chat Interface
```dart
class BriefingChat extends ConsumerStatefulWidget {
  final GeoEvent event;

  const BriefingChat({super.key, required this.event});

  @override
  ConsumerState<BriefingChat> createState() => _BriefingChatState();
}

class _BriefingChatState extends ConsumerState<BriefingChat> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _isLoading = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            controller: _scrollController,
            itemCount: _messages.length,
            itemBuilder: (context, index) {
              final message = _messages[index];
              return ChatBubble(
                message: message,
                isUser: message.role == ChatRole.user,
              );
            },
          ),
        ),
        _buildMessageInput(),
      ],
    );
  }

  Widget _buildMessageInput() {
    return Container(
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.4),
        border: Border(
          top: BorderSide(color: Colors.white.withOpacity(0.1)),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _messageController,
              style: TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Ask about this event...',
                hintStyle: TextStyle(color: Colors.white.withOpacity(0.5)),
                border: InputBorder.none,
              ),
              onSubmitted: _sendMessage,
            ),
          ),
          IconButton(
            onPressed: _isLoading ? null : _sendMessage,
            icon: _isLoading
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(Icons.send, color: Colors.white),
          ),
        ],
      ),
    );
  }

  void _sendMessage(String text) async {
    if (text.trim().isEmpty) return;

    final userMessage = ChatMessage(
      id: Uuid().v4(),
      role: ChatRole.user,
      content: text,
      timestamp: DateTime.now(),
    );

    setState(() {
      _messages.add(userMessage);
      _isLoading = true;
    });

    try {
      final response = await ref.read(briefingServiceProvider).sendMessage(
        eventId: widget.event.id,
        message: text,
        history: _messages,
      );

      final aiMessage = ChatMessage(
        id: Uuid().v4(),
        role: ChatRole.assistant,
        content: response,
        timestamp: DateTime.now(),
      );

      setState(() {
        _messages.add(aiMessage);
        _isLoading = false;
      });

      _scrollToBottom();
    } catch (error) {
      setState(() {
        _isLoading = false;
      });
      // Handle error
    }
  }
}
```

#### Notification System
```dart
class NotificationService {
  static Future<void> initialize() async {
    await Firebase.initializeApp();
    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );

    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
    FirebaseMessaging.onMessageOpenedApp.listen(_handleBackgroundMessage);
  }

  static Future<void> _handleForegroundMessage(RemoteMessage message) async {
    // Show in-app notification
    ref.read(notificationInboxProvider.notifier).addNotification(message);
  }
}
```

### 7.4 Platform-Specific Implementations

#### iOS Optimizations
```dart
class IOSPlatformService {
  static Future<void> configureIOS() async {
    // Edge-to-edge display
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    
    // Status bar styling
    SystemChrome.setSystemUIOverlayStyle(
      SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
      ),
    );
    
    // Safe area handling
    final padding = MediaQuery.of(context).padding;
    // Apply safe area insets
  }
}
```

#### Android Optimizations
```dart
class AndroidPlatformService {
  static Future<void> configureAndroid() async {
    // Transparent navigation bar
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    SystemChrome.setSystemUIOverlayStyle(
      SystemUiOverlayStyle(
        systemNavigationBarColor: Colors.transparent,
        systemNavigationBarIconBrightness: Brightness.light,
      ),
    );
    
    // PWA capabilities
    // Handle app shortcuts, widgets, etc.
  }
}
```

### 7.5 Performance Optimizations

#### Widget Recycling
```dart
class EventList extends ListView.builder {
  EventList({
    Key? key,
    required List<GeoEvent> events,
  }) : super.builder(
          key: key,
          itemCount: events.length,
          itemBuilder: (context, index) {
            final event = events[index];
            return EventCard(
              key: ValueKey(event.id), // Ensure proper recycling
              event: event,
            );
          },
          cacheExtent: 1000, // Cache items outside viewport
        );
}
```

#### Efficient Map Updates
```dart
class EventMarkersLayer extends StatelessWidget {
  final List<GeoEvent> events;
  final ValueChanged<GeoEvent>? onEventTap;

  const EventMarkersLayer({
    super.key,
    required this.events,
    this.onEventTap,
  });

  @override
  Widget build(BuildContext context) {
    return MapLayer(
      widgetBuilder: (context, mapState) {
        // Only rebuild visible markers
        final bounds = mapState.getBounds();
        final visibleEvents = _getVisibleEvents(events, bounds);
        
        return Stack(children: [
          for (final event in visibleEvents)
            EventMarker(
              position: LatLng(
                event.coordinates[1],
                event.coordinates[0],
              ),
              event: event,
              onTap: () => onEventTap?.call(event),
            ),
        ]);
      },
    );
  }
}
```

## 8. Migration Timeline and Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Flutter project structure
- [ ] Configure dependencies and build system
- [ ] Implement core routing and navigation
- [ ] Set up theme system and design tokens
- [ ] Create basic app shell and layout

### Phase 2: Core Map Features (Weeks 3-4)
- [ ] Implement flutter_map integration
- [ ] Create custom event markers and clustering
- [ ] Add 3D globe capabilities (WebView fallback if needed)
- [ ] Implement camera animations and interactions
- [ ] Add real-time event updates

### Phase 3: Event System (Weeks 5-6)
- [ ] Implement event data models and services
- [ ] Create event list and detail views
- [ ] Add event filtering and search
- [ ] Implement event deep linking
- [ ] Add offline event caching

### Phase 4: User Interface (Weeks 7-8)
- [ ] Implement mobile bottom sheet interface
- [ ] Create desktop sidebar layout
- [ ] Add responsive design patterns
- [ ] Implement glass panel design system
- [ ] Add animations and transitions

### Phase 5: Advanced Features (Weeks 9-10)
- [ ] Implement AI briefing chat system
- [ ] Add reaction voting system
- [ ] Create notification system
- [ ] Implement entity management
- [ ] Add authentication flow

### Phase 6: Polish and Testing (Weeks 11-12)
- [ ] Performance optimization
- [ ] Platform-specific optimizations
- [ ] Comprehensive testing
- [ ] PWA configuration
- [ ] App store preparation

## 9. Risk Assessment and Mitigation

### High-Risk Areas

#### 3D Globe Visualization
- **Risk**: flutter_map has limited 3D support
- **Mitigation**: Consider WebView integration for Mapbox GL JS
- **Alternative**: Progressive enhancement with 2D fallback

#### Real-time Data Synchronization
- **Risk**: Complex real-time update patterns
- **Mitigation**: Extensive testing of connection scenarios
- **Strategy**: Implement robust offline/online detection

#### AI Integration Complexity
- **Risk**: Streaming AI responses and tool calling
- **Mitigation**: Phase implementation, start with basic responses
- **Strategy**: Use WebSocket or HTTP streaming for AI responses

### Medium-Risk Areas

#### Performance on Low-end Devices
- **Risk**: Complex map rendering may impact performance
- **Mitigation**: Implement view culling and optimization strategies
- **Strategy**: Progressive loading and caching

#### Cross-platform Consistency
- **Risk**: UI differences between platforms
- **Mitigation**: Comprehensive platform-specific testing
- **Strategy**: Adaptive UI components with platform detection

## 10. Conclusion

This comprehensive migration blueprint provides a detailed roadmap for converting the sophisticated Realpolitik Next.js application to Flutter. The key success factors include:

1. **Preserving the sophisticated geospatial visualization**
2. **Maintaining the real-time data synchronization**
3. **Implementing the AI briefing system effectively**
4. **Ensuring cross-platform consistency**
5. **Optimizing performance for complex data visualization**

The migration will result in a fully native mobile application while preserving all the advanced features and user experience of the original web application. The Flutter implementation will provide enhanced performance, better offline capabilities, and native platform integrations.

This blueprint serves as the complete reference for the migration team to recreate every aspect of the Realpolitik intelligence platform in Flutter, ensuring no functionality is lost in the transition.