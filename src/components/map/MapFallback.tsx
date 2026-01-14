"use client";

/**
 * Fallback UI shown when the WorldMap component fails to load.
 * Displays a helpful error message without crashing the app.
 */
export function MapFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
      <div className="glass-panel max-w-lg p-8 text-center">
        {/* Globe icon */}
        <div className="mb-6">
          <svg
            className="mx-auto h-16 w-16 text-cyan-400/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
        </div>

        <h2 className="mb-3 font-mono text-xl font-bold text-foreground">Map Failed to Load</h2>

        <p className="mb-6 text-sm leading-relaxed text-foreground/60">
          The interactive globe couldn&apos;t be initialized. This might be due to:
        </p>

        <ul className="mb-6 space-y-2 text-left text-sm text-foreground/50">
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>WebGL not supported by your browser</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>Network issues loading map tiles</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-400">•</span>
            <span>Ad blockers interfering with Mapbox</span>
          </li>
        </ul>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-lg bg-cyan-500/20 px-4 py-3 font-mono text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/30"
          >
            Try Again
          </button>

          <a
            href="https://get.webgl.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-foreground/40 transition-colors hover:text-foreground/60"
          >
            Check WebGL Support →
          </a>
        </div>
      </div>
    </div>
  );
}
