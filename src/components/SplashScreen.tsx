"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface SplashScreenProps {
  onEnter: () => void;
}

export function SplashScreen({ onEnter }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const isExitingRef = useRef(false);

  const handleEnter = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onEnter();
    }, 800);
  }, [onEnter]);

  useEffect(() => {
    // Show the "click to enter" prompt after a delay
    const timer = setTimeout(() => setShowPrompt(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyPress = () => handleEnter();
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleEnter]);

  if (!isVisible) return null;

  return (
    <div
      onClick={handleEnter}
      className={`fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-background transition-opacity duration-700 ${
        isExiting ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(99, 102, 241, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(99, 102, 241, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: "50px 50px",
            animation: "gridPulse 4s ease-in-out infinite",
          }}
        />
      </div>

      {/* Radial gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, var(--background) 70%)",
        }}
      />

      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{
            background: "linear-gradient(135deg, #ef4444, #f97316)",
            top: "20%",
            left: "10%",
            animation: "float 8s ease-in-out infinite",
          }}
        />
        <div
          className="absolute h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{
            background: "linear-gradient(135deg, #22d3ee, #6366f1)",
            bottom: "20%",
            right: "15%",
            animation: "float 6s ease-in-out infinite reverse",
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center">
        {/* Logo */}
        <div
          className="mb-6 flex justify-center"
          style={{
            animation: "fadeSlideUp 1s ease-out forwards",
            opacity: 0,
          }}
        >
          <img
            src="/logo.svg"
            alt="Realpolitik"
            className="h-20 w-20 md:h-28 md:w-28"
            style={{
              filter: "drop-shadow(0 0 30px rgba(99, 102, 241, 0.6))",
            }}
          />
        </div>

        {/* Pre-title */}
        <div
          className="mb-4 font-mono text-xs uppercase tracking-[0.5em] text-foreground/40"
          style={{
            animation: "fadeSlideUp 1s ease-out 0.15s forwards",
            opacity: 0,
          }}
        >
          Intelligence Briefing System
        </div>

        {/* Main title */}
        <h1
          className="mb-2 font-mono text-6xl font-bold tracking-tight text-foreground md:text-8xl"
          style={{
            animation: "fadeSlideUp 1s ease-out 0.3s forwards",
            opacity: 0,
            textShadow: "0 0 60px rgba(99, 102, 241, 0.5)",
          }}
        >
          REALPOLITIK
        </h1>

        {/* Subtitle */}
        <div
          className="mb-12 font-mono text-lg uppercase tracking-widest text-foreground/50 md:text-xl"
          style={{
            animation: "fadeSlideUp 1s ease-out 0.5s forwards",
            opacity: 0,
          }}
        >
          Global Situational Awareness
        </div>

        {/* Decorative line */}
        <div
          className="mx-auto mb-12 h-px w-48 bg-gradient-to-r from-transparent via-foreground/30 to-transparent"
          style={{
            animation: "expandWidth 1s ease-out 0.7s forwards",
            transform: "scaleX(0)",
          }}
        />

        {/* Enter prompt */}
        <div
          className={`transition-opacity duration-500 ${showPrompt ? "opacity-100" : "opacity-0"}`}
        >
          <div className="mb-2 font-mono text-sm uppercase tracking-widest text-foreground/60">
            Press any key or click to enter
          </div>
          <div
            className="mx-auto h-1 w-16 rounded-full bg-accent"
            style={{
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* Bottom decorative elements */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8">
        {["MILITARY", "DIPLOMACY", "ECONOMY", "UNREST"].map((cat, i) => (
          <div
            key={cat}
            className="font-mono text-[10px] uppercase tracking-wider text-foreground/20"
            style={{
              animation: `fadeSlideUp 0.5s ease-out ${0.9 + i * 0.1}s forwards`,
              opacity: 0,
            }}
          >
            {cat}
          </div>
        ))}
      </div>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes expandWidth {
          from {
            transform: scaleX(0);
          }
          to {
            transform: scaleX(1);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(30px, -30px);
          }
        }

        @keyframes gridPulse {
          0%,
          100% {
            opacity: 0.05;
          }
          50% {
            opacity: 0.15;
          }
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 0.4;
            transform: scaleX(1);
          }
          50% {
            opacity: 1;
            transform: scaleX(1.2);
          }
        }
      `}</style>
    </div>
  );
}
