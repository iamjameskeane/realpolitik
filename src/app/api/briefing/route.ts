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

const getEntityEventsTool: FunctionDeclaration = {
  name: "get_entity_events",
  description:
    "Get recent events involving a specific entity (country, company, leader, organization, etc.). Use this to provide context about what else an entity has been involved in, or to answer questions like 'What else has [entity] been doing lately?'",
  parameters: {
    type: Type.OBJECT,
    properties: {
      entity_name: {
        type: Type.STRING,
        description:
          "The name of the entity to look up (e.g., 'China', 'TSMC', 'Vladimir Putin', 'NATO'). Use the exact name as shown in the ENTITIES INVOLVED section.",
      },
      limit: {
        type: Type.NUMBER,
        description: "Maximum number of events to return (default: 5, max: 10)",
      },
    },
    required: ["entity_name"],
  },
};

const getCausalChainTool: FunctionDeclaration = {
  name: "get_causal_chain",
  description:
    "Trace the chain of events and factors that LED TO this event. Use this to answer questions like 'What caused this?', 'How did we get here?', 'What's the background?'. Returns preceding events and their causal relationships.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      max_depth: {
        type: Type.NUMBER,
        description: "How many steps back to trace (default: 3, max: 5)",
      },
    },
    required: [],
  },
};

const getImpactChainTool: FunctionDeclaration = {
  name: "get_impact_chain",
  description:
    "Trace the downstream impacts and effects of this event. Use this to answer questions like 'What will this affect?', 'What are the consequences?', 'Who/what is impacted?'. Returns affected entities and their relationships.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      max_depth: {
        type: Type.NUMBER,
        description: "How many steps forward to trace (default: 3, max: 5)",
      },
    },
    required: [],
  },
};

// Context cache for the current request (populated after initial setup)
interface BriefingContext {
  eventId: string;
  entities: Array<{ entity_id: string; name: string; node_type: string; relation_type: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any; // Supabase client with RPC methods (types not generated)
}

// Execute tool calls
async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  context?: BriefingContext
): Promise<string> {
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

  if (toolName === "get_entity_events") {
    const entityName = args.entity_name as string;
    const limit = Math.min((args.limit as number) || 5, 10);
    console.log(`[Briefing] Looking up events for entity: "${entityName}"`);

    if (!context) {
      return `Entity lookup unavailable - no context loaded`;
    }

    // Find the entity in the cache (case-insensitive match)
    const entity = context.entities.find((e) => e.name.toLowerCase() === entityName.toLowerCase());

    if (!entity) {
      // Try partial match
      const partialMatch = context.entities.find((e) =>
        e.name.toLowerCase().includes(entityName.toLowerCase())
      );
      if (partialMatch) {
        return `Entity "${entityName}" not found. Did you mean "${partialMatch.name}"? Available entities: ${context.entities.map((e) => e.name).join(", ")}`;
      }
      return `Entity "${entityName}" not found in this event. Available entities: ${context.entities.map((e) => e.name).join(", ")}`;
    }

    try {
      // Fetch events for this entity
      const { data: events, error } = await context.supabase.rpc("get_entity_events", {
        entity_uuid: entity.entity_id,
        max_count: limit,
      });

      if (error) {
        console.error("Entity events lookup error:", error);
        return `Failed to lookup events for "${entityName}"`;
      }

      if (!events || events.length === 0) {
        return `No other events found for "${entityName}"`;
      }

      const eventList = events
        .map(
          (e: {
            event_id: string;
            title: string;
            category: string;
            event_timestamp: string;
            relation_type: string;
          }) => {
            const date = new Date(e.event_timestamp).toLocaleDateString();
            return `- [${e.category}] ${e.title} (${date}) - ${e.relation_type} [ID: ${e.event_id}]`;
          }
        )
        .join("\n");

      return `Recent events involving "${entityName}" (${entity.node_type}):\n\n${eventList}\n\nTo cite these events, use: [Event Title](/?event=EVENT_ID)`;
    } catch (error) {
      console.error("Entity events lookup error:", error);
      return `Failed to lookup events: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  if (toolName === "get_causal_chain") {
    const maxDepth = Math.min((args.max_depth as number) || 3, 5);
    console.log(`[Briefing] Tracing causal chain for event, depth: ${maxDepth}`);

    if (!context) {
      return `Causal chain unavailable - no context loaded`;
    }

    try {
      const { data: chain, error } = await context.supabase.rpc("get_causal_chain", {
        event_id: context.eventId,
        max_depth: maxDepth,
      });

      if (error) {
        console.error("Causal chain lookup error:", error);
        return `Failed to trace causal chain`;
      }

      if (!chain || chain.length === 0) {
        return `No causal chain data available for this event. The graph may not have causal relationships mapped yet.`;
      }

      const chainList = chain
        .map(
          (item: { name: string; depth: number; relation: string; confidence: number }) =>
            `${"  ".repeat(item.depth - 1)}↳ ${item.name} (${item.relation}, confidence: ${Math.round(item.confidence * 100)}%)`
        )
        .join("\n");

      return `Causal chain leading to this event:\n\n${chainList}`;
    } catch (error) {
      console.error("Causal chain lookup error:", error);
      return `Failed to trace causal chain: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  if (toolName === "get_impact_chain") {
    const maxDepth = Math.min((args.max_depth as number) || 3, 5);
    console.log(`[Briefing] Tracing impact chain for event, depth: ${maxDepth}`);

    if (!context) {
      return `Impact chain unavailable - no context loaded`;
    }

    try {
      // Note: The constellation migration changed parameter name from event_id to start_node_id
      const { data: chain, error } = await context.supabase.rpc("get_impact_chain", {
        start_node_id: context.eventId,
        max_depth: maxDepth,
        min_weight: 0.1, // Lower threshold to catch more relationships
        min_cumulative: 0.05,
        edges_per_node: 10,
      });

      if (error) {
        console.error("Impact chain lookup error:", error);
        return `Failed to trace impact chain: ${error.message}`;
      }

      if (!chain || chain.length === 0) {
        return `No impact chain data available for this event. The graph may not have impact relationships mapped yet.`;
      }

      const chainList = chain
        .map(
          (item: { name: string; node_type: string; depth: number; cumulative_weight: number }) => {
            const weight = Math.round(item.cumulative_weight * 100);
            return `${"  ".repeat(item.depth - 1)}→ ${item.name} (${item.node_type}) [${weight}% impact]`;
          }
        )
        .join("\n");

      return `Downstream impacts of this event:\n\n${chainList}`;
    } catch (error) {
      console.error("Impact chain lookup error:", error);
      return `Failed to trace impact chain: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  return `Unknown tool: ${toolName}`;
}

// System prompt for the briefing assistant
const SYSTEM_PROMPT = `<role>
You are an intelligence analyst for Realpolitik, a platform that helps people understand geopolitical events.
Your job is to answer questions clearly and help users understand why events matter.
</role>

<instructions>
1. Answer questions about the event the user is viewing
2. Use the search_news tool when you need current information (max 1-2 searches per question)
3. Use the get_entity_events tool to look up what else a specific entity has been involved in
4. Connect events to real-world impacts when relevant (prices, products, travel, investments)
5. Be direct - give your actual read on the situation, don't over-hedge
6. Cite your sources at the end
</instructions>

<tools>
You have 4 tools available. The database tools (2-4) query OUR tracked events and knowledge graph - prefer these over web search when possible.

1. search_news (LIMITED - max 2/question)
   - Searches the web for current news
   - Use for: Breaking developments, analyst opinions, latest updates not yet in our database
   - Costs: Uses external API, limited to 2 calls

2. get_entity_events (UNLIMITED - use freely)
   - Looks up recent events involving a specific entity from OUR database
   - Use for: "What else has [entity] done?", "Is [entity] involved in other events?", context about an actor
   - Example: User asks "What's China been up to?" → call get_entity_events("China")

3. get_causal_chain (UNLIMITED - use freely)
   - Traces what events/factors LED TO this event (backwards in time)
   - Use for: "Why did this happen?", "What caused this?", "Background?", "How did we get here?"
   - Returns: Chain of preceding events with causal relationships and confidence scores
   - Example: User asks "Why is this happening?" → call get_causal_chain first

4. get_impact_chain (UNLIMITED - use freely)
   - Traces what this event AFFECTS downstream (forwards in time)
   - Use for: "What happens next?", "Who's affected?", "Consequences?", "Should I be worried?"
   - Returns: Affected entities (companies, sectors, countries) and relationship paths
   - Example: User asks "How does this affect me?" → call get_impact_chain first
</tools>

<tool_selection>
CHOOSE THE RIGHT TOOL FOR THE QUESTION:

"Why did this happen?" / "Background?" / "What led to this?"
→ START with get_causal_chain, then optionally search_news for color

"What happens next?" / "Who's affected?" / "Consequences?"
→ START with get_impact_chain, then optionally search_news for analyst takes

"What else has [entity] done?" / "Is [country] involved elsewhere?"
→ Use get_entity_events with the entity name

"Latest updates?" / "What are experts saying?" / "Current status?"
→ Use search_news (this is where web search shines)

IMPORTANT: The database tools give you structured, verified information from our knowledge graph.
Web search gives you raw news that may be unverified. Prefer database tools when the question fits.
</tool_selection>

<tool_examples>
USER: "Why is this happening?"
TOOL CALLS: get_causal_chain() → then synthesize the chain into a narrative

USER: "How does this affect regular people?"
TOOL CALLS: get_impact_chain() → trace through to consumer-facing companies/products

USER: "What else has Russia been involved in recently?"
TOOL CALLS: get_entity_events("Russia") → list their recent activity

USER: "What's the latest on this situation?"
TOOL CALLS: search_news("[specific event topic]") → get fresh updates
</tool_examples>

<style>
- Write for someone smart but not following this topic closely
- Use **bold** for key terms
- Short paragraphs (2-3 sentences max)
- Aim for 150-250 words - get to the point fast
- Define jargon briefly when you use it (e.g., "sanctions (trade restrictions)")
- When explaining impact, be specific: name products, companies, timeframes when possible
</style>

<source_citation>
End every response with a **Sources:** section when you have citable sources.

WEB sources (from search_news):
- [The Guardian](https://www.theguardian.com/article-url)
- [Reuters](https://www.reuters.com/article-url)

DATABASE events (from get_entity_events - each event has an ID):
- [Event Title](/?event=EVENT_UUID)
Use the event ID from the tool result to create clickable deep links to those events.

Rules:
- Links must be [Text](URL) with NO space between ] and (
- Do NOT cite "Atlas", "Constellation", or tool names as sources
- get_causal_chain and get_impact_chain provide analysis context, not citable sources - don't cite them
- If you only used causal/impact chain, you can skip Sources
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
        const limit = usageData?.limit_value || 5;

        return new Response(
          JSON.stringify({
            error: "Daily limit reached",
            message: `You've used all ${limit} briefings for today. Check back tomorrow!`,
            remaining: 0,
            limit,
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
      void limitChecked; // Suppress unused variable warning
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

    // Fetch user's tier for model selection
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .single();

    const userTier = userProfile?.tier || "free";
    // Pro users get the full Flash model, free users get Flash-Lite
    const modelToUse = userTier === "pro" ? "gemini-2.5-flash" : "gemini-2.0-flash-lite";
    console.log(`[Briefing] User tier: ${userTier}, using model: ${modelToUse}`);

    // Fetch entities for this event
    const { data: entities } = await supabase.rpc("get_event_entities", {
      event_uuid: eventId,
    });

    // Build context for tool calls
    const briefingContext: BriefingContext = {
      eventId,
      entities: entities || [],
      supabase,
    };

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

            // Build available tools
            const availableTools: FunctionDeclaration[] = [];
            if (!shouldDisableTools) {
              availableTools.push(searchNewsTool);
            }
            // Entity and graph tools are always available (no search limit)
            if (briefingContext.entities.length > 0) {
              availableTools.push(getEntityEventsTool);
            }
            // Graph traversal tools always available
            availableTools.push(getCausalChainTool);
            availableTools.push(getImpactChainTool);

            // Call Gemini API
            const response = await ai.models.generateContent({
              model: modelToUse,
              contents,
              config: {
                systemInstruction: SYSTEM_PROMPT,
                tools:
                  availableTools.length > 0
                    ? [{ functionDeclarations: availableTools }]
                    : undefined,
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

            if (functionCalls && functionCalls.length > 0) {
              // Add model response to conversation
              contents.push({
                role: "model",
                parts: candidate.content.parts ?? [],
              });

              // Execute each function call
              const functionResponses: Part[] = [];

              for (const funcCall of functionCalls) {
                const { name, args } = funcCall.functionCall;

                // Check search limit for news searches only
                if (name === "search_news" && tavilySearchCount >= maxSearches) {
                  console.log(`[Briefing] Skipping search - limit reached (${maxSearches})`);
                  functionResponses.push({
                    functionResponse: {
                      name,
                      response: {
                        result:
                          "Search limit reached. Please respond with information you already have.",
                      },
                    },
                  });
                  continue;
                }

                // Send status update to client with branded messages
                if (name === "search_news") {
                  sendEvent({
                    status: "searching",
                    query: `Searching the web for "${args.query}"`,
                  });
                } else if (name === "get_entity_events") {
                  sendEvent({
                    status: "atlas",
                    query: `Querying Atlas for ${args.entity_name} events`,
                  });
                } else if (name === "get_causal_chain") {
                  sendEvent({
                    status: "constellation",
                    query: "Tracing causal chain in Constellation",
                  });
                } else if (name === "get_impact_chain") {
                  sendEvent({
                    status: "constellation",
                    query: "Mapping impact chain in Constellation",
                  });
                }

                const result = await executeToolCall(name, args, briefingContext);

                // Only count Tavily searches against the limit
                if (name === "search_news") {
                  tavilySearchCount++;
                }

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
