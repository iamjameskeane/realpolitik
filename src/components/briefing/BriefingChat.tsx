"use client";

import { useRef, useEffect, useCallback } from "react";
import { GeoEvent } from "@/types/events";
import { useBriefingChat } from "@/hooks/useBriefingChat";
import { ChatMessage } from "./ChatMessage";
import { ChatChips } from "./ChatChips";
import { ChatInput } from "./ChatInput";
import { useAuth } from "@/contexts/AuthContext";
import { SignInPrompt } from "../auth/SignInPrompt";

interface BriefingChatProps {
  event: GeoEvent;
  className?: string;
}

/**
 * Main chat interface for AI briefings.
 * Combines messages, chips, and input into a cohesive chat experience.
 */
export function BriefingChat({ event, className = "" }: BriefingChatProps) {
  const { user } = useAuth();
  const { messages, isLoading, statusLabel, sendMessage, availableChips } = useBriefingChat({
    event,
    onError: (err) => console.error("Briefing error:", err),
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);

  // Gate behind auth
  if (!user) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <SignInPrompt feature="briefing" />
      </div>
    );
  }

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle input focus - scroll input container into view on mobile when keyboard opens
  const handleInputFocus = useCallback(() => {
    // Small delay to let keyboard animate open
    setTimeout(() => {
      inputContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 350);
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <div className={`grid grid-rows-[1fr_auto_auto] ${className}`}>
      {/* Messages area */}
      <div className="custom-scrollbar min-h-0 overflow-y-auto p-4">
        {!hasMessages ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 text-4xl">🔍</div>
            <h4 className="font-mono text-sm font-medium uppercase tracking-wide text-foreground/70">
              Intelligence Briefing
            </h4>
            <p className="mt-2 max-w-xs text-sm text-foreground/50">
              Ask questions about this event. I&apos;ll search for the latest information and
              provide analysis.
            </p>
          </div>
        ) : (
          /* Message list */
          <div className="space-y-3">
            {messages.map((message, index) => {
              const isLastAssistantMessage =
                isLoading && index === messages.length - 1 && message.role === "assistant";

              return (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  isStreaming={isLastAssistantMessage}
                  statusLabel={isLastAssistantMessage ? statusLabel : undefined}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Chips - only show when no messages yet (empty state) */}
      {!hasMessages && availableChips.length > 0 ? (
        <div className="border-t border-foreground/10 px-4 py-3">
          <ChatChips
            chips={availableChips.slice(0, 4)}
            onChipClick={sendMessage}
            disabled={isLoading}
          />
        </div>
      ) : (
        <div /> /* Empty div to maintain grid structure */
      )}

      {/* Input area */}
      <div
        ref={inputContainerRef}
        className="border-t border-foreground/10 p-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 1rem))" }}
      >
        <ChatInput onSend={sendMessage} disabled={isLoading} onFocus={handleInputFocus} />
      </div>
    </div>
  );
}
