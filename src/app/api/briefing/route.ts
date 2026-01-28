import { GoogleGenAI, Content, Part, FunctionDeclaration, Type } from "@google/genai";
import { tavily } from "@tavily/core";
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientIP } from "@/lib/request";
import { MAX_QUESTION_LENGTH, MAX_HISTORY_LENGTH } from "@/lib/constants";

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

// System prompt for the briefing assistant
const SYSTEM_PROMPT = `<role>
You are a news explainer for Realpolitik, a platform that helps regular people understand geopolitical events.
Your job is to answer questions clearly and help users understand why events matter.
</role>

<instructions>
1. Answer questions about the event the user is viewing
2. Use the search_news tool when you need current information (max 1-2 searches per question)
3. Connect events to real-world impacts when relevant (prices, products, travel, investments)
4. Be direct - give your actual read on the situation, don't over-hedge
5. Cite your sources at the end
</instructions>

<search_rules>
- Search ONCE for current information, then respond with what you have
- Skip searching for follow-up questions if you already have context
- After searching, ALWAYS provide a response - never search repeatedly for "better" results
- If results are limited, work with what you have and say so
</search_rules>

<style>
- Write for someone smart but not following this topic closely
- Use **bold** for key terms
- Short paragraphs (2-3 sentences max)
- Aim for 150-250 words - get to the point fast
- Define jargon briefly when you use it (e.g., "sanctions (trade restrictions)")
- When explaining impact, be specific: name products, companies, timeframes when possible
</style>

<source_citation>
End every response with a Sources section. Use EXACT markdown link format:

**Sources:**
- [The Guardian](https://www.theguardian.com/article-url)
- [Reuters](https://www.reuters.com/article-url)

CRITICAL: Links must be [Text](URL) with NO space between ] and (
DO NOT use numbered references like [1] or put URLs in parentheses separately.
Only cite sources you actually used.
</source_citation>

<guardrails>
STAY ON TOPIC:
- Only answer questions related to geopolitics, world events, and their impacts
- For off-topic questions, briefly redirect: "I focus on geopolitical events. For this event, I can help you understand..."

ACCURACY:
- If information is unverified, say "Unverified reports suggest..."
- If you don't know or can't find information, say so clearly
- Don't speculate on military operations, troop movements, or classified information

SAFETY:
- Don't provide tactical/operational military advice
- Don't help with anything that could endanger people
- For questions about personal safety in conflict zones, recommend official sources (State Dept, FCO, etc.)
</guardrails>

<examples>
USER: "Why does this matter?"
GOOD: "Taiwan produces 90% of the world's most advanced computer chips through TSMC. These go into iPhones, cars, medical devices - basically anything with electronics. If tensions escalate, we could see global shortages within weeks. That's why markets react sharply to any Taiwan news."
BAD: "This event has significant geopolitical implications and could affect regional stability. The international community is closely monitoring developments."

USER: "What happens next?"
GOOD: "Three scenarios to watch: (1) Exercises end as planned and tensions ease, (2) China extends exercises as leverage, (3) An incident occurs that forces both sides to respond. Most analysts expect scenario 1, but the risk of miscalculation is why markets are nervous."
BAD: "It's difficult to predict what will happen. Many factors could influence the outcome."
</examples>`;

export async function POST(request: NextRequest) {
  try {
    const body: BriefingRequest = await request.json();
    const { eventId, eventTitle, eventSummary, eventCategory, eventLocation, question, history } =
      body;

    // ==========================================================================
    // STEP 0: User Authentication (Required)
    // ==========================================================================

    // Get authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: "Authentication required",
          message: "You must be signed in to use the briefing agent.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.substring(7);

    // Validate user session with Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: "Invalid session",
          message: "Please sign in again.",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[Briefing] Authenticated user: ${user.email} (${user.id})`);

    // ==========================================================================
    // STEP 1: Input Validation
    // ==========================================================================

    // Validate required fields
    if (!eventId || !eventTitle || !question) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate question length
    if (question.length > MAX_QUESTION_LENGTH) {
      return new Response(
        JSON.stringify({
          error: "Question too long",
          message: `Questions must be under ${MAX_QUESTION_LENGTH} characters.`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Validate history
    if (history && Array.isArray(history)) {
      if (history.length > MAX_HISTORY_LENGTH) {
        return new Response(
          JSON.stringify({
            error: "History too long",
            message: "Too many messages in conversation history.",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Validate each history message
      for (const msg of history) {
        if (!msg.role || !msg.content || (msg.role !== "user" && msg.role !== "assistant")) {
          return new Response(JSON.stringify({ error: "Invalid history message format" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
    }

    // ==========================================================================
    // STEP 2: Rate Limiting (User-based)
    // ==========================================================================

    let limitChecked = false;

    try {
      // Check user's daily briefing quota
      const { data: canUse, error: quotaError } = await supabase.rpc("increment_briefing_usage", {
        user_uuid: user.id,
      });

      if (quotaError) throw quotaError;

      if (!canUse) {
        // Get current usage to show in error message
        const { data: usage } = await supabase.rpc("get_briefing_usage", {
          user_uuid: user.id,
        });

        const usageData = usage?.[0];

        return new Response(
          JSON.stringify({
            error: "Daily limit reached",
            message: `You've used all 10 briefings for today. Check back tomorrow!`,
            remaining: 0,
            limit: 10,
            resetsAt: usageData?.resets_at,
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Get remaining quota
      const { data: usage } = await supabase.rpc("get_briefing_usage", {
        user_uuid: user.id,
      });

      const usageData = usage?.[0];

      limitChecked = true;
      console.log(`[Briefing] User has ${usageData?.remaining || 0} briefings remaining today`);
    } catch (dbError) {
      // Fail CLOSED on database errors - deny the request
      console.error("[Briefing] Database error (denying request):", dbError);
      return new Response(
        JSON.stringify({
          error: "Service temporarily unavailable",
          message: "Please try again in a moment.",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Fetch entities for this event
    const { data: entities } = await supabase.rpc("get_event_entities", {
      event_uuid: eventId,
    });

    // Build entity context string
    const entityContext =
      entities && entities.length > 0
        ? `\nENTITIES INVOLVED:\n${entities.map((e: { name: string; node_type: string; relation_type: string }) => `- ${e.name} (${e.node_type}) [${e.relation_type}]`).join("\n")}`
        : "";

    // Build event context
    const eventContext = `
EVENT CONTEXT:
- Title: ${eventTitle}
- Category: ${eventCategory}
- Location: ${eventLocation}
- Summary: ${eventSummary}${entityContext}
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

            // Usage already tracked in Supabase via increment_briefing_usage RPC call
            console.log(
              `[Briefing] Usage: ${totalInputTokens || 0} input tokens, ${totalOutputTokens || 0} output tokens, ${tavilySearchCount} searches`
            );

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
