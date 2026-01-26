"use client";

import { useAuth } from "@/contexts/AuthContext";

interface SignInPromptProps {
  feature: "reactions" | "briefing" | "fallout" | "notifications";
  className?: string;
}

const FEATURE_LABELS = {
  reactions: "vote",
  briefing: "use the briefing agent",
  fallout: "view fallout analysis",
  notifications: "enable notifications",
};

const FEATURE_ICONS = {
  reactions: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
      />
    </svg>
  ),
  briefing: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  ),
  fallout: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  notifications: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  ),
};

export function SignInPrompt({ feature, className = "" }: SignInPromptProps) {
  const { openAuthModal } = useAuth();

  return (
    <button
      onClick={openAuthModal}
      className={`group flex items-center gap-3 rounded-lg border border-foreground/10 bg-foreground/5 px-4 py-3 transition-all hover:border-accent/30 hover:bg-accent/5 ${className}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-foreground/40 transition-colors group-hover:bg-accent/10 group-hover:text-accent">
        {FEATURE_ICONS[feature]}
      </div>
      <div className="flex-1 text-left">
        <div className="font-mono text-xs uppercase tracking-wide text-foreground/90">
          Sign in to {FEATURE_LABELS[feature]}
        </div>
        <div className="text-xs text-foreground/50">Free account • No password needed</div>
      </div>
      <svg
        className="h-4 w-4 text-foreground/30 transition-colors group-hover:text-accent"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
