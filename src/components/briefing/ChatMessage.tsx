"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  statusLabel?: string;
}

/**
 * Loading animation with status message from API
 */
function ThinkingLoader({ statusLabel }: { statusLabel?: string }) {
  return (
    <div className="flex items-center gap-3">
      {/* Animated dots */}
      <div className="flex gap-1">
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-accent"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-accent"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-2 w-2 animate-bounce rounded-full bg-accent"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      {/* Status text from API */}
      <span className="text-sm text-foreground/60">{statusLabel || "Thinking..."}</span>
    </div>
  );
}

/**
 * Single chat message bubble.
 * User messages are right-aligned, assistant messages are left-aligned.
 * Assistant messages render markdown.
 */
export const ChatMessage = memo(function ChatMessage({
  role,
  content,
  isStreaming,
  statusLabel,
}: ChatMessageProps) {
  const isUser = role === "user";
  const isEmpty = !content || content.trim() === "";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser ? "bg-accent text-white" : "bg-foreground/10 text-foreground/90"
        }`}
      >
        {isUser ? (
          <div className="text-sm leading-relaxed">{content}</div>
        ) : isEmpty && isStreaming ? (
          /* Show loading state when streaming but no content yet */
          <ThinkingLoader statusLabel={statusLabel} />
        ) : (
          <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-foreground prose-a:text-accent prose-a:no-underline hover:prose-a:underline">
            <ReactMarkdown>{content}</ReactMarkdown>
            {isStreaming && content && (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-current" />
            )}
          </div>
        )}
      </div>
    </div>
  );
});
