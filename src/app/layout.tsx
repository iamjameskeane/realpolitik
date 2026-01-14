import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

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
  description: "Civilization-style dashboard for real-world geopolitical events",
  manifest: "/manifest.json",
  themeColor: "#6366f1",
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
  openGraph: {
    title: "Realpolitik",
    description: "Global Situational Awareness - Real-time geopolitical monitoring",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Realpolitik",
    description: "Global Situational Awareness",
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
        {/* iOS Safari: extend to full screen, enable safe area insets */}
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
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
