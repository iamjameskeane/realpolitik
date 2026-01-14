# REALPOLITIK

> Global Situational Awareness

A real-time geopolitical event monitoring dashboard that aggregates news from multiple sources, enriches them with AI analysis, and displays them on an interactive 3D globe.

🌍 **Live at [realpolitik.world](https://realpolitik.world)**

[![GitHub stars](https://img.shields.io/github/stars/iamjameskeane/realpolitik?style=flat-square)](https://github.com/iamjameskeane/realpolitik/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Last Commit](https://img.shields.io/github/last-commit/iamjameskeane/realpolitik?style=flat-square)](https://github.com/iamjameskeane/realpolitik/commits)

## Features

### 🌍 Interactive Globe

- 3D Mapbox globe with auto-rotation
- Event clustering for high-density regions
- Color-coded markers by category (Military, Diplomacy, Economy, Unrest)
- Severity-based sizing and glow effects
- Click-to-focus with detailed event popups

### 📱 Responsive Design

- **Desktop**: Full dashboard with sidebar event list and map popups
- **Mobile**: Three-phase "Pilot's View" intelligence sheet
  - Scanner mode: Scrollable event feed with sort/filter
  - Pilot mode: Detailed event cards with swipe navigation
  - Analyst mode: AI briefing (coming soon)
- **iOS Safari optimized**: Full viewport height, safe area handling

### 🔗 Sharing & Deep Linking

- Shareable URLs: `realpolitik.world/?event=EVENT_ID`
- Opens directly to event with fly-to animation
- Works on both desktop and mobile

### 📰 Source Timeline

- Chronological view of how stories develop
- Multiple sources consolidated into single events
- Relative timestamps ("2h ago", "3d ago")
- Direct links to original articles

### 🤖 AI-Powered Analysis

- Gemini AI integration for event summarization
- Fallout prediction: AI-generated impact analysis
- Multi-source aggregation and deduplication
- Semantic similarity for event clustering

### 📡 Real-Time Updates

- Automatic polling for new events
- Live indicator with last-updated timestamp
- Toast notifications for breaking events

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS v4
- **Mapping**: Mapbox GL JS (3D globe, clustering, custom layers)
- **Animation**: Framer Motion (mobile gestures)
- **Worker**: Python + Google Gemini, runs on GitHub Actions
- **Storage**: Cloudflare R2 (production) / local JSON (development)

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+ (for worker)
- Mapbox API token
- Google Gemini API key (for worker)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your NEXT_PUBLIC_MAPBOX_TOKEN

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

### Mobile Testing

Add `?mobile=1` to the URL to force mobile layout on desktop:

```
http://localhost:3000/?mobile=1
```

### Running the Worker

The worker fetches and enriches news events:

```bash
cd worker

# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
export GEMINI_API_KEY=your_key
export NEWSAPI_KEY=your_key

# Run locally
python run_local.py
```

## Project Structure

```
realpolitik/
├── src/
│   ├── app/                 # Next.js app router
│   ├── components/
│   │   ├── mobile/          # Mobile-specific components
│   │   ├── map/             # Map popup and fallback
│   │   ├── Dashboard.tsx    # Desktop layout
│   │   ├── WorldMap.tsx     # Mapbox globe
│   │   └── EventsSidebar.tsx
│   ├── hooks/               # Custom React hooks
│   │   ├── useEventLayers.ts
│   │   ├── useAutoRotate.ts
│   │   ├── useMediaQuery.ts
│   │   ├── useViewportHeight.ts
│   │   └── usePopupPosition.ts
│   └── types/               # TypeScript definitions
├── worker/                  # Python news worker
├── public/
│   └── events.json          # Event data
└── shared/
    └── event_schema.json    # Event schema definition
```

## Event Categories

| Category     | Color | Description                       |
| ------------ | ----- | --------------------------------- |
| 🔴 MILITARY  | Red   | Armed conflicts, defense actions  |
| 🔵 DIPLOMACY | Cyan  | International relations, treaties |
| 🟢 ECONOMY   | Green | Trade, sanctions, markets         |
| 🟡 UNREST    | Amber | Protests, civil unrest            |

## Deployment

### Architecture

```
GitHub Actions (hourly cron) → Cloudflare R2 → Vercel (Next.js)
```

- **Frontend**: Vercel (free tier)
- **Worker**: GitHub Actions (2000 free min/month)
- **Storage**: Cloudflare R2 (free tier, S3-compatible)

### 1. Frontend (Vercel)

```bash
# Deploy to Vercel
vercel deploy --prod

# Set environment variable in Vercel dashboard:
# NEXT_PUBLIC_EVENTS_URL = https://pub-xxxxx.r2.dev/events.json
```

### 2. Storage (Cloudflare R2)

1. Create bucket at [dash.cloudflare.com](https://dash.cloudflare.com) → R2
2. Enable public access or custom domain
3. Create API token with Object Read & Write permissions
4. Note: `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`

### 3. Worker (GitHub Actions)

Add secrets to GitHub repo (Settings → Secrets → Actions):

| Secret                     | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `NEWSAPI_KEY`              | NewsAPI.org API key                             |
| `GEMINI_API_KEY`           | Google Gemini API key for AI enrichment         |
| `TAVILY_API_KEY`           | Tavily API key for briefing web search          |
| `R2_ACCESS_KEY_ID`         | Cloudflare R2 access key                        |
| `R2_SECRET_ACCESS_KEY`     | Cloudflare R2 secret key                        |
| `R2_ENDPOINT_URL`          | `https://<account_id>.r2.cloudflarestorage.com` |
| `R2_BUCKET_NAME`           | `realpolitik-events`                            |
| `UPSTASH_REDIS_REST_URL`   | Upstash Redis REST URL (for reactions/limits)   |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token                        |

The worker runs automatically every 15 minutes via `.github/workflows/update-intel.yml`.

### Polling Frequency

NewsAPI free tier allows 100 requests/day. Default is every 15 minutes (96/day).

To adjust, edit the cron in `.github/workflows/update-intel.yml`:

- Every hour: `0 * * * *` (24/day)
- Every 30 min: `*/30 * * * *` (48/day)

## License

MIT

---

_Built for those who need to stay ahead of global events._
