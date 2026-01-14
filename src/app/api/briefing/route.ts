import { GoogleGenAI, Content, Part, FunctionDeclaration, Type } from "@google/genai";
import { tavily } from "@tavily/core";
import { NextRequest } from "next/server";
import { checkBriefingLimit, incrementBriefingCount, logBriefingUsage } from "@/lib/usage";
import { getClientIP } from "@/lib/request";

// Vercel function configuration - increase timeout for AI streaming
export const maxDuration = 60; // seconds (requires Pro plan for > 10s)

// Lazily initialize Gemini client
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!geminiClient) {
    // Client reads GEMINI_API_KEY from environment automatically
    geminiClient = new GoogleGenAI({});
  }
  return geminiClient;
}

// Types
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface BriefingRequest {
  eventId: string;
  eventTitle: string;
  eventSummary: string;
  eventCategory: string;
  eventLocation: string;
  question: string;
  history: ChatMessage[];
}

// Lazily initialize Tavily client
let tavilyClient: ReturnType<typeof tavily> | null = null;

function getTavilyClient() {
  if (!tavilyClient) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error("TAVILY_API_KEY environment variable is not set");
    }
    tavilyClient = tavily({ apiKey });
  }
  return tavilyClient;
}

// Tool definitions for Gemini
const searchNewsTool: FunctionDeclaration = {
  name: "search_news",
  description:
    "Search for recent news, reports, and information about a geopolitical topic. Use this to find current information, verify facts, or get additional context about events.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description:
          "The search query. Be specific and include relevant context like location, time frame, or key actors.",
      },
    },
    required: ["query"],
  },
};

// Execute tool calls
async function executeToolCall(toolName: string, args: Record<string, unknown>): Promise<string> {
  if (toolName === "search_news") {
    const query = args.query as string;
    console.log(`[Briefing] Executing search: "${query}"`);

    try {
      const searchResponse = await getTavilyClient().search(query, {
        maxResults: 5,
        searchDepth: "basic",
        includeAnswer: false,
      });

      if (searchResponse.results && searchResponse.results.length > 0) {
        const results = searchResponse.results
          .map((r, i) => `[${i + 1}] ${r.title}\nSource: ${r.url}\n${r.content}`)
          .join("\n\n");
        return `Search results for "${query}":\n\n${results}`;
      }
      return `No results found for "${query}"`;
    } catch (error) {
      console.error("Tavily search error:", error);
      return `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  return `Unknown tool: ${toolName}`;
}

// System prompt for the intelligence analyst
const SYSTEM_PROMPT = `You are an Intelligence Analyst for Realpolitik, a geopolitical intelligence platform.

Your role:
- Provide concise, factual analysis about geopolitical events
- Use the search_news tool to find current information when needed
- Be direct and analytical - no fluff or hedging
- If information is unverified, say "Unverified reports suggest..."
- If you don't have enough information after searching, say so clearly

IMPORTANT - Search limits:
- Make at most 1-2 searches per question
- One good search is usually enough - be specific with your query
- After searching, ALWAYS provide a response - do not search again unless absolutely necessary
- If search results are limited, work with what you have

When to search:
- Search once for current/recent information about an event
- Skip searching for simple follow-up questions if you already have context
- Do NOT search multiple times looking for "better" results

Style:
- Use **bold** for key terms and emphasis
- Bullet points for lists
- Short paragraphs (2-3 sentences max)
- No emojis or casual language
- Professional intelligence briefing tone
- Keep responses focused and brief (aim for 150-300 words)
- Get to the point quickly - users want fast intel, not essays

Sources:
- At the end of your response, include a "**Sources:**" section
- List each source you referenced as a markdown link: [Source Name](URL)
- Only include sources you actually used in your analysis`;

export async function POST(request: NextRequest) {
  try {
    const body: BriefingRequest = await request.json();
    const { eventTitle, eventSummary, eventCategory, eventLocation, question, history } = body;

    // Validate required fields
    if (!eventTitle || !question) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Step 0: Check daily limit
    const clientIP = getClientIP(request);
    let limitChecked = false;

    try {
      const { allowed, remaining, limit } = await checkBriefingLimit(clientIP);

      if (!allowed) {
        return new Response(
          JSON.stringify({
            error: "Daily limit reached",
            message: `You've used all ${limit} briefings for today. Check back tomorrow!`,
            remaining: 0,
            limit,
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      limitChecked = true;
      console.log(`[Briefing] IP has ${remaining} requests remaining today`);
    } catch (redisError) {
      console.error("[Briefing] Redis error (allowing request):", redisError);
    }

    // Build event context
    const eventContext = `
EVENT CONTEXT:
- Title: ${eventTitle}
- Category: ${eventCategory}
- Location: ${eventLocation}
- Summary: ${eventSummary}
`.trim();

    // Build conversation history for Gemini
    const contents: Content[] = [
      {
        role: "user",
        parts: [{ text: `Here is the context for this briefing:\n\n${eventContext}` }],
      },
      {
        role: "model",
        parts: [
          {
            text: "Understood. I have the event context. I'll use the search tool to find current information when needed. What would you like to know?",
          },
        ],
      },
    ];

    // Add conversation history
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
    contents.push({ role: "user", parts: [{ text: question }] });

    // Create the response stream
    const encoder = new TextEncoder();
    let tavilySearchCount = 0;

    const readableStream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          const ai = getGeminiClient();

          // Tool calling loop
          let continueLoop = true;
          const maxIterations = 3;
          const maxSearches = 2;
          let iterations = 0;
          let totalInputTokens = 0;
          let totalOutputTokens = 0;

          while (continueLoop && iterations < maxIterations) {
            iterations++;

            // After max searches, don't include tools
            const shouldDisableTools = tavilySearchCount >= maxSearches;

            // Call Gemini API
            const response = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents,
              config: {
                systemInstruction: SYSTEM_PROMPT,
                tools: shouldDisableTools
                  ? undefined
                  : [{ functionDeclarations: [searchNewsTool] }],
                maxOutputTokens: 8000,
              },
            });

            // Track token usage
            if (response.usageMetadata) {
              totalInputTokens += response.usageMetadata.promptTokenCount ?? 0;
              totalOutputTokens += response.usageMetadata.candidatesTokenCount ?? 0;
            }

            // Get the response candidate
            const candidate = response.candidates?.[0];
            if (!candidate || !candidate.content) {
              throw new Error("No response from Gemini");
            }

            // Check for function calls
            const functionCalls = candidate.content.parts?.filter(
              (
                part
              ): part is Part & { functionCall: { name: string; args: Record<string, unknown> } } =>
                !!part.functionCall
            );

            if (functionCalls && functionCalls.length > 0 && !shouldDisableTools) {
              // Add model response to conversation
              contents.push({
                role: "model",
                parts: candidate.content.parts ?? [],
              });

              // Execute each function call
              const functionResponses: Part[] = [];

              for (const funcCall of functionCalls) {
                if (tavilySearchCount >= maxSearches) {
                  console.log(`[Briefing] Skipping search - limit reached (${maxSearches})`);
                  break;
                }

                const { name, args } = funcCall.functionCall;

                // Send status update to client
                sendEvent({ status: "searching", query: args.query });

                const result = await executeToolCall(name, args);
                tavilySearchCount++;

                functionResponses.push({
                  functionResponse: {
                    name,
                    response: { result },
                  },
                });
              }

              // Add function responses to conversation
              contents.push({
                role: "user",
                parts: functionResponses,
              });

              // Send status update
              sendEvent({ status: "analyzing" });

              // Continue the loop to get the next response
              continue;
            }

            // No function calls - we have the final response
            continueLoop = false;
            console.log(
              `[Briefing] Tool loop complete after ${iterations} iteration(s), ${tavilySearchCount} searches`
            );

            // Send status update
            sendEvent({ status: "generating" });

            // Extract text content from the response
            let totalChars = 0;
            const textParts = candidate.content.parts?.filter(
              (part): part is Part & { text: string } => !!part.text
            );

            if (textParts && textParts.length > 0) {
              for (const part of textParts) {
                sendEvent({ content: part.text });
                totalChars += part.text.length;
              }
            }

            // Fallback to response.text if available
            if (totalChars === 0 && response.text) {
              sendEvent({ content: response.text });
              totalChars = response.text.length;
            }

            console.log(`[Briefing] Response complete:`, {
              totalChars,
              iterations,
              searches: tavilySearchCount,
            });

            // Log usage (non-blocking)
            if (limitChecked) {
              incrementBriefingCount(clientIP).catch((err) =>
                console.error("[Briefing] Failed to increment counter:", err)
              );

              logBriefingUsage({
                inputTokens: totalInputTokens || 500,
                outputTokens: totalOutputTokens || Math.ceil(totalChars / 4),
                tavilySearches: tavilySearchCount,
              }).catch((err) => console.error("[Briefing] Failed to log usage:", err));
            }

            sendEvent({ done: true });
            console.log("[Briefing] Done event sent, closing stream");
            controller.close();
            return;
          }

          // Max iterations reached
          sendEvent({ error: "Processing limit reached. Please try a simpler question." });
          controller.close();
        } catch (error) {
          console.error("Gemini error:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);

          if (
            errorMessage.includes("rate limit") ||
            errorMessage.includes("429") ||
            errorMessage.includes("quota") ||
            errorMessage.includes("RESOURCE_EXHAUSTED") ||
            errorMessage.includes("billing")
          ) {
            sendEvent({
              error:
                "AI briefings are temporarily unavailable due to high demand. Please try again later.",
            });
          } else {
            sendEvent({ error: "Unable to generate briefing. Please try again." });
          }
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Briefing API error:", error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("rate limit") ||
      errorMessage.includes("429") ||
      errorMessage.includes("quota") ||
      errorMessage.includes("RESOURCE_EXHAUSTED") ||
      errorMessage.includes("billing")
    ) {
      return new Response(
        JSON.stringify({
          error: "Service temporarily unavailable",
          message: "AI briefings are temporarily unavailable. Please check back later.",
          code: "SERVICE_UNAVAILABLE",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Something went wrong",
        message: "Unable to generate briefing. Please try again.",
        code: "INTERNAL_ERROR",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
