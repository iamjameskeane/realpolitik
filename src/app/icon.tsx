import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#020617",
        borderRadius: "6px",
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 32 32"
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinecap="round"
      >
        {/* Outer circle */}
        <circle cx="16" cy="16" r="12" />
        {/* Vertical ellipse */}
        <ellipse cx="16" cy="16" rx="6" ry="12" />
        {/* Horizontal line */}
        <line x1="2" y1="16" x2="30" y2="16" />
        {/* Center dot */}
        <circle cx="16" cy="16" r="2" fill="#6366f1" stroke="none" />
      </svg>
    </div>,
    { ...size }
  );
}
