import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Realpolitik - Global Situational Awareness";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "linear-gradient(135deg, #020617 0%, #0f172a 50%, #1e1b4b 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
      }}
    >
      {/* Grid pattern overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage:
            "linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      {/* Globe icon */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          marginBottom: 32,
          boxShadow: "0 0 60px rgba(99, 102, 241, 0.5)",
        }}
      >
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <path d="M2 12h20" />
        </svg>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: 72,
          fontWeight: 700,
          color: "white",
          marginBottom: 16,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        Realpolitik
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 28,
          color: "rgba(255, 255, 255, 0.7)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        Global Situational Awareness
      </div>

      {/* Accent bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 50%, #6366f1 100%)",
        }}
      />
    </div>,
    {
      ...size,
    }
  );
}
