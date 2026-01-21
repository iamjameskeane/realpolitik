"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { GeoEvent, EventCategory } from "@/types/events";
import { solveChallenge } from "@/lib/pow";

// Preset chips by category
const UNIVERSAL_CHIPS = ["What's happening?", "What happens next?", "Historical context?"];

const CATEGORY_CHIPS: Record<EventCategory, string[]> = {
  MILITARY: ["Who's fighting?", "Casualties reported?", "International response?"],
  DIPLOMACY: ["What's being negotiated?", "Key players?", "Expected outcome?"],
  ECONOMY: ["Market impact?", "Which sectors affected?", "Winners and losers?"],
  UNREST: ["How widespread?", "Government response?", "What are the demands?"],
};

// Status labels for display
const STATUS_LABELS: Record<string, string> = {
  authenticating: "Authenticating...",
  searching: "Searching sources...",
  analyzing: "Analyzing results...",
  thinking: "Reasoning...",
  generating: "Generating briefing...",
};

export type BriefingStatus =
  | "idle"
  | "authenticating"
  | "searching"
  | "analyzing"
  | "thinking"
  | "generating"
  | "done";

// Session token storage (persists across component remounts)
let sessionToken: string | null = null;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface UseBriefingChatOptions {
  event: GeoEvent;
  onError?: (error: Error) => void;
}

export interface UseBriefingChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  status: BriefingStatus;
  statusLabel: string;
  error: Error | undefined;
  sendMessage: (question: string) => void;
  availableChips: string[];
  usedChips: Set<string>;
  resetChat: () => void;
}

let messageIdCounter = 0;
function generateId(): string {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

// SSE event data types
interface SSEContentEvent {
  content: string;
}

interface SSEStatusEvent {
  status: BriefingStatus;
  query?: string;
}

interface SSEDoneEvent {
  done: true;
}

interface SSEErrorEvent {
  error: string;
}

interface SSESessionTokenEvent {
  sessionToken: string;
}

type SSEEvent =
  | SSEContentEvent
  | SSEStatusEvent
  | SSEDoneEvent
  | SSEErrorEvent
  | SSESessionTokenEvent;

// PoW challenge response from server
interface PowChallengeResponse {
  requiresPow: true;
  challenge: string;
  difficulty: number;
}

export function useBriefingChat({ event, onError }: UseBriefingChatOptions): UseBriefingChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<BriefingStatus>("idle");
  const [error, setError] = useState<Error | undefined>();
  const [usedChipsMap, setUsedChipsMap] = useState<Record<string, Set<string>>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentEventIdRef = useRef(event.id);
  const sseBufferRef = useRef<string>("");

  // Reset messages if event changes
  if (currentEventIdRef.current !== event.id) {
    currentEventIdRef.current = event.id;
  }

  // Get used chips for current event
  const usedChips = useMemo(
    () => usedChipsMap[event.id] || new Set<string>(),
    [usedChipsMap, event.id]
  );

  // Status label for display
  const statusLabel = STATUS_LABELS[status] || "";

  // Parse SSE chunk - handles buffering of partial chunks across network packets
  const parseSSEChunk = useCallback((chunk: string): SSEEvent[] => {
    const events: SSEEvent[] = [];

    // Add new chunk to buffer
    sseBufferRef.current += chunk;

    // Split by SSE event boundary (double newline)
    const parts = sseBufferRef.current.split("\n\n");

    // The last part might be incomplete, keep it in the buffer
    sseBufferRef.current = parts.pop() || "";

    // Process complete events
    for (const rawEvent of parts) {
      if (!rawEvent.trim()) continue;

      const lines = rawEvent.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            events.push(data as SSEEvent);
          } catch (e) {
            console.warn("[SSE] Failed to parse event:", jsonStr, e);
          }
        }
      }
    }

    return events;
  }, []);

  // Send a message
  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || isLoading) return;

      // Clear any previous error
      setError(undefined);
      setStatus("thinking");

      // Track if this was a chip
      const allChips = [...UNIVERSAL_CHIPS, ...CATEGORY_CHIPS[event.category]];
      if (allChips.includes(question)) {
        setUsedChipsMap((prev) => ({
          ...prev,
          [event.id]: new Set([...(prev[event.id] || []), question]),
        }));
      }

      // Add user message
      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content: question,
      };

      // Create assistant message placeholder
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Reset SSE buffer for new request
      sseBufferRef.current = "";

      try {
        // Build base request payload
        const basePayload = {
          eventId: event.id,
          eventTitle: event.title,
          eventSummary: event.summary,
          eventCategory: event.category,
          eventLocation: event.location_name || "Unknown",
          question,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        };

        // Make request with session token if available
        let response = await fetch("/api/briefing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...basePayload,
            sessionToken: sessionToken || undefined,
          }),
          signal: abortControllerRef.current.signal,
        });

        // Handle PoW challenge (401 response)
        if (response.status === 401) {
          const challengeData = await response.json();

          if (challengeData.requiresPow) {
            setStatus("authenticating");

            // Solve the proof of work challenge
            const { nonce } = await solveChallenge(
              challengeData.challenge,
              challengeData.difficulty
            );

            // Retry with PoW solution
            response = await fetch("/api/briefing", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...basePayload,
                powSolution: {
                  challenge: challengeData.challenge,
                  nonce,
                },
              }),
              signal: abortControllerRef.current.signal,
            });

            // If still 401, clear token and throw
            if (response.status === 401) {
              sessionToken = null;
              const errorData = await response.json();
              throw new Error(errorData.message || "Authentication failed");
            }
          }
        }

        if (!response.ok) {
          try {
            const errorData = await response.json();

            if (response.status === 429) {
              throw new Error(errorData.message || "Daily limit reached. Check back tomorrow!");
            }

            if (response.status === 503) {
              throw new Error(
                errorData.message ||
                  "AI briefings are temporarily unavailable. Please check back later."
              );
            }

            throw new Error(
              errorData.message || errorData.error || `API error: ${response.status}`
            );
          } catch (parseError) {
            if (parseError instanceof Error && !parseError.message.startsWith("API error:")) {
              throw parseError;
            }
            throw new Error(`Failed to connect. Please check your internet connection.`);
          }
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Stream the response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let hasReceivedContent = false;
        let streamError: string | null = null;

        const processEvents = (events: SSEEvent[]) => {
          for (const evt of events) {
            // Session token (store for future requests)
            if ("sessionToken" in evt && evt.sessionToken) {
              sessionToken = evt.sessionToken;
            }

            // Status updates
            if ("status" in evt && evt.status) {
              setStatus(evt.status);
            }

            // Content chunks
            if ("content" in evt && evt.content) {
              if (!hasReceivedContent) {
                hasReceivedContent = true;
                setStatus("generating");
              }

              accumulatedContent += evt.content;

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id ? { ...msg, content: accumulatedContent } : msg
                )
              );
            }

            // Error
            if ("error" in evt && evt.error) {
              streamError = evt.error;
            }

            // Done
            if ("done" in evt && evt.done) {
              setStatus("done");
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const events = parseSSEChunk(chunk);
          processEvents(events);

          if (streamError) break;
        }

        // Process any remaining data in the buffer after stream ends
        if (sseBufferRef.current.trim()) {
          // Force process remaining buffer by adding terminator
          const remainingEvents = parseSSEChunk("\n\n");
          processEvents(remainingEvents);
        }

        // Handle errors
        if (streamError) {
          const errorContent = `⚠️ **Error:** ${streamError}`;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id ? { ...msg, content: errorContent } : msg
            )
          );
          setError(new Error(streamError));
          return;
        }

        // If stream finished without any content, treat as error
        if (!hasReceivedContent || !accumulatedContent.trim()) {
          const errorMsg =
            "Unable to generate briefing. The AI service may be temporarily unavailable.";
          const errorContent = `⚠️ **Error:** ${errorMsg}`;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessage.id ? { ...msg, content: errorContent } : msg
            )
          );
          setError(new Error(errorMsg));
          return;
        }

        setStatus("done");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const error = err instanceof Error ? err : new Error("Unknown error");
        setError(error);
        onError?.(error);

        const errorContent = `⚠️ **Error:** ${error.message}`;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id ? { ...msg, content: errorContent } : msg
          )
        );
      } finally {
        setIsLoading(false);
        setStatus("idle");
        abortControllerRef.current = null;
      }
    },
    [event, isLoading, messages, onError, parseSSEChunk]
  );

  // Get available chips (unused ones)
  const availableChips = useMemo(
    () => [
      ...UNIVERSAL_CHIPS.filter((c) => !usedChips.has(c)),
      ...CATEGORY_CHIPS[event.category].filter((c) => !usedChips.has(c)),
    ],
    [event.category, usedChips]
  );

  // Reset the chat
  const resetChat = useCallback(() => {
    abortControllerRef.current?.abort();

    setMessages([]);
    setError(undefined);
    setUsedChipsMap((prev) => ({
      ...prev,
      [event.id]: new Set<string>(),
    }));
  }, [event.id]);

  return {
    messages,
    isLoading,
    status,
    statusLabel,
    error,
    sendMessage,
    availableChips,
    usedChips,
    resetChat,
  };
}
