import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Viewport configuration for edge-to-edge display
// This makes the Android navigation bar transparent, allowing our background to show through
export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover", // Critical for Android nav bar transparency
  colorScheme: "dark", // Forces light nav buttons on dark background (prevents Android contrast override)
};

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://realpolitik.world"),
  title: "Realpolitik | Global Situational Awareness",
  description: "Real-time geopolitical event tracking on an interactive globe. Monitor military, diplomatic, economic, and civil unrest events worldwide.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-icon", // Dynamic generator for iOS
  },
  openGraph: {
    title: "Realpolitik | Global Situational Awareness",
    description: "Real-time geopolitical event tracking on an interactive globe. Monitor military, diplomatic, economic, and civil unrest events worldwide.",
    type: "website",
    siteName: "Realpolitik",
  },
  twitter: {
    card: "summary_large_image",
    title: "Realpolitik | Global Situational Awareness",
    description: "Real-time geopolitical event tracking on an interactive globe.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* iOS Safari: enable standalone PWA mode */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Realpolitik" />
        {/* Explicit apple-touch-icon links - static fallback for crawlers */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${outfit.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
