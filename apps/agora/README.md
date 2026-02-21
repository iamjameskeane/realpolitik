# Agora - Marketing & Landing Page

**The public assembly** - Agora serves as the public forum where citizens first learn about Realpolitik's capabilities.

## Overview

Agora is the **marketing and landing page** built with Astro, introducing visitors to the Realpolitik platform, showcasing features, and providing onboarding. All actual application functionality (web, mobile, desktop) is delivered through the Flutter application.

## Features

### 🏛️ Platform Introduction
- **Architecture Overview**: Visual explanation of the Olympian system
- **Feature Showcase**: Interactive demos of Realpolitik capabilities
- **Use Cases**: Real-world scenarios and intelligence applications
- **Technology Stack**: Deep dive into distributed architecture

### 🎯 Call-to-Action
- **Web App Launch**: Direct link to Flutter web application
- **Mobile App Download**: Links to iOS and Android apps
- **API Documentation**: Developer resources and integration guides
- **Contact & Support**: Get started guides and community links

### 📊 Live Demo
- **Event Feed Preview**: Sample of recent geopolitical events
- **Chat Demo**: Interactive Pythia conversation example
- **3D Visualization**: Preview of globe and relationship graphs
- **Analytics Dashboard**: Sample intelligence insights

### 📱 Multi-Platform Access
- **Progressive Web App**: Full-featured Flutter web experience
- **Native Mobile**: iOS and Android applications
- **Desktop Apps**: Windows, macOS, and Linux builds
- **API Access**: RESTful API for developers

## Technology Stack

### Static Site
- **Astro**: Static site generation with optimized performance
- **React Components**: Interactive UI elements
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Framer Motion**: Smooth animations and transitions

### Marketing Analytics
- **Google Analytics**: Visitor tracking and conversion analysis
- **Hotjar**: User behavior and heatmap analysis
- **A/B Testing**: Feature flag testing and optimization
- **SEO Optimization**: Meta tags, structured data, sitemap

## Project Structure

```
apps/agora/
├── src/
│   ├── components/          # React components
│   │   ├── hero/           # Hero section with CTAs
│   │   ├── features/       # Feature showcase components
│   │   ├── demo/           # Interactive demos
│   │   ├── architecture/   # System architecture visualization
│   │   └── pricing/        # Pricing and plans
│   ├── layouts/            # Astro page layouts
│   ├── pages/              # Marketing pages
│   │   ├── index.astro     # Home page
│   │   ├── features.astro  # Features page
│   │   ├── pricing.astro   # Pricing page
│   │   ├── docs.astro      # Documentation
│   │   └── about.astro     # About page
│   ├── lib/                # Utilities
│   └── types/              # TypeScript definitions
├── public/                 # Static assets
├── astro.config.mjs        # Astro configuration
├── tailwind.config.js      # Tailwind CSS config
└── package.json            # Dependencies
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Deploy
npm run deploy
```

## SEO Optimization

### Pages
- **Home (/)**: Main landing page with hero and features
- **Features (/features)**: Detailed feature explanations
- **Pricing (/pricing)**: Plans and pricing tiers
- **Documentation (/docs)**: Getting started guides
- **About (/about)**: Company and team information

### Features
- **Structured Data**: Schema.org markup for better SEO
- **Meta Tags**: Dynamic meta tags for social sharing
- **Sitemap**: Auto-generated XML sitemap
- **Performance**: Optimized loading and Core Web Vitals

This marketing site serves as the entry point for all Realpolitik platform users.