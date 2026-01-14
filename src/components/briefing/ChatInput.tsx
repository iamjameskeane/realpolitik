"use client";

import { useState, useCallback, KeyboardEvent, FocusEvent, memo, useRef, useEffect } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onFocus?: () => void;
}

/**
 * Text input with send button for free-form questions.
 */
export const ChatInput = memo(function ChatInput({
  onSend,
  disabled,
  placeholder = "Ask a question...",
  onFocus,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = useCallback(() => {
    if (!value.trim() || disabled) return;
    onSend(value.trim());
    setValue("");
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Handle focus - scroll input into view when keyboard opens
  const handleFocus = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      onFocus?.();
      // Scroll input into view after keyboard animation
      setTimeout(() => {
        e.target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    },
    [onFocus]
  );

  // Also handle visualViewport scroll to keep input visible
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handleViewportChange = () => {
      // If the input is focused and keyboard is open, ensure it's visible
      if (document.activeElement === input && window.visualViewport) {
        const inputRect = input.getBoundingClientRect();
        const viewportHeight = window.visualViewport.height;
        const viewportTop = window.visualViewport.offsetTop;

        // If input is below the visible viewport, scroll it into view
        if (inputRect.bottom > viewportHeight + viewportTop) {
          input.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange);
      return () => {
        window.visualViewport?.removeEventListener("resize", handleViewportChange);
      };
    }
  }, []);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        disabled={disabled}
        placeholder={placeholder}
        enterKeyHint="send"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
        className="flex-1 rounded-xl border border-foreground/20 bg-foreground/5 px-4 py-2.5 text-base text-foreground placeholder:text-foreground/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition-all hover:bg-accent/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2 12l18-7-7 18-2-7-9-4z"
          />
        </svg>
      </button>
    </div>
  );
});
