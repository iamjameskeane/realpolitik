import type { NextConfig } from "next";

// Allowed origins for CORS (production domains)
const allowedOrigins = ["https://realpolitik.world", "https://www.realpolitik.world"];

// Content Security Policy directives
const cspDirectives = [
  "default-src 'self'",
  // Next.js requires unsafe-inline and unsafe-eval for hydration/dev
  // Vercel live preview needs vercel.live scripts
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  // Images: self, data URIs, HTTPS sources (for news thumbnails), blob (for map)
  "img-src 'self' data: https: blob:",
  // Fonts: Google Fonts
  "font-src 'self' https://fonts.gstatic.com",
  // API connections: self, Mapbox, Vercel, Push services, Supabase
  "connect-src 'self' https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com wss://*.tiles.mapbox.com https://vercel.live https://*.push.apple.com https://fcm.googleapis.com https://updates.push.services.mozilla.com https://*.supabase.co",
  // Workers: Mapbox uses web workers
  "worker-src 'self' blob:",
  // Prevent clickjacking
  "frame-ancestors 'none'",
  // Restrict base URI
  "base-uri 'self'",
  // Restrict form targets
  "form-action 'self'",
];

const nextConfig: NextConfig = {
  async headers() {
    // In development, allow all origins for easier testing
    const corsOrigin = process.env.NODE_ENV === "development" ? "*" : allowedOrigins.join(", ");

    return [
      {
        // Security headers for all routes
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspDirectives.join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
      {
        // CORS headers for API routes
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: corsOrigin,
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
