import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Transparent background for iOS 18 theming support
        background: "transparent",
      }}
    >
      <svg
        width="160"
        height="160"
        viewBox="0 0 200 200"
        fill="none"
        stroke="#6366f1"
        strokeWidth="6"
        strokeLinecap="round"
      >
        {/* Outer circle */}
        <circle cx="100" cy="100" r="70" />
        {/* Vertical ellipse */}
        <ellipse cx="100" cy="100" rx="35" ry="70" />
        {/* Horizontal ellipse */}
        <ellipse cx="100" cy="100" rx="70" ry="35" />
        {/* Crosshair lines */}
        <line x1="15" y1="100" x2="185" y2="100" />
        <line x1="100" y1="15" x2="100" y2="185" />
        {/* Center dot */}
        <circle cx="100" cy="100" r="12" fill="#6366f1" stroke="none" />
      </svg>
    </div>,
    { ...size }
  );
}
