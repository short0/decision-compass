import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompts: Record<string, string> = {
  suggest_options: `You are a decision analysis expert inspired by Annie Duke's "How to Decide". The user is making a decision. Based on the context provided, suggest ONE new alternative option they may not have considered, with 2-3 possible outcomes. Be concrete and specific.`,

  suggest_outcomes: `You are a decision analysis expert. For the specific option provided, suggest 2-3 additional outcomes the user may have missed, including both positive and negative scenarios. Estimate realistic probabilities and impact.`,

  check_biases: `You are a cognitive bias expert inspired by Annie Duke's work. Analyze the user's decision framework and identify specific cognitive biases. For each bias found, specify which element it relates to (an option title, outcome description, or premortem reason). Be direct and cite specific bias names.`,

  auto_generate: `You are a decision analysis expert inspired by Annie Duke's "How to Decide". The user will give you a decision title and context. You must generate a complete decision analysis with options, outcomes, and premortem risks. Be concrete, realistic, and balanced.`,
};

const suggestOptionTool = {
  type: "function",
  function: {
    name: "suggest_option",
    description: "Suggest a single new option with outcomes for the decision.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short option title" },
        description: { type: "string", description: "Brief description" },
        outcomes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              probability: { type: "number", description: "0-100" },
              impact: { type: "number", description: "-10 to +10" },
            },
            required: ["description", "probability", "impact"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "description", "outcomes"],
      additionalProperties: false,
    },
  },
};

const suggestOutcomesTool = {
  type: "function",
  function: {
    name: "suggest_outcomes",
    description: "Suggest additional outcomes for a specific option.",
    parameters: {
      type: "object",
      properties: {
        outcomes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              probability: { type: "number", description: "0-100" },
              impact: { type: "number", description: "-10 to +10" },
            },
            required: ["description", "probability", "impact"],
            additionalProperties: false,
          },
        },
      },
      required: ["outcomes"],
      additionalProperties: false,
    },
  },
};

const checkBiasesTool = {
  type: "function",
  function: {
    name: "check_biases",
    description: "Identify cognitive biases in the decision analysis.",
    parameters: {
      type: "object",
      properties: {
        biases: {
          type: "array",
          items: {
            type: "object",
            properties: {
              bias_name: { type: "string", description: "Name of the cognitive bias" },
              target_type: { type: "string", enum: ["option", "outcome", "premortem", "general"], description: "What element this bias relates to" },
              target_label: { type: "string", description: "The title/description of the element this bias relates to, or empty for general" },
              explanation: { type: "string", description: "How this bias is affecting their analysis and how to counteract it" },
            },
            required: ["bias_name", "target_type", "target_label", "explanation"],
            additionalProperties: false,
          },
        },
      },
      required: ["biases"],
      additionalProperties: false,
    },
  },
};

const autoGenerateTool = {
  type: "function",
  function: {
    name: "generate_decision_analysis",
    description: "Generate a complete decision analysis with options, outcomes for each option, and premortem risks.",
    parameters: {
      type: "object",
      properties: {
        options: {
          type: "array",
          description: "3-5 options the user should consider",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              outcomes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    probability: { type: "number" },
                    impact: { type: "number" },
                  },
                  required: ["description", "probability", "impact"],
                  additionalProperties: false,
                },
              },
            },
            required: ["title", "description", "outcomes"],
            additionalProperties: false,
          },
        },
        premortems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              reason: { type: "string" },
              severity: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["reason", "severity"],
            additionalProperties: false,
          },
        },
      },
      required: ["options", "premortems"],
      additionalProperties: false,
    },
  },
};

function buildUserContent(action: string, decision: any) {
  if (action === "auto_generate") {
    return `Decision: ${decision.title}\nContext: ${decision.context || "Not provided"}\n\nPlease generate a complete decision analysis.`;
  }

  if (action === "suggest_outcomes") {
    return `Decision: ${decision.title}\nContext: ${decision.context || "Not provided"}\n\nSpecific option to suggest outcomes for: "${decision.target_option_title}"\nExisting outcomes: ${decision.target_option_outcomes?.map((o: any) => o.description).join(", ") || "None"}\n\nSuggest additional outcomes.`;
  }

  const optionsText = decision.options?.map((o: any, i: number) =>
    `${i + 1}. ${o.title}${o.outcomes?.length > 0 ? "\n   Outcomes: " + o.outcomes.map((oc: any) => `${oc.description} (${oc.probability}%, impact: ${oc.impact})`).join("; ") : ""}`
  ).join("\n") || "No options defined yet";

  const premText = decision.premortems?.length > 0
    ? decision.premortems.map((p: any) => `- [${p.severity}] ${p.reason}`).join("\n")
    : "None defined yet";

  return `Decision: ${decision.title}\nContext: ${decision.context || "Not provided"}\n\nOptions:\n${optionsText}\n\nPremortem Risks:\n${premText}\n\nPlease analyze.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, decision } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = systemPrompts[action];
    if (!systemPrompt) throw new Error(`Unknown action: ${action}`);

    const body: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserContent(action, decision) },
      ],
    };

    // Add appropriate tool calling per action
    const toolMap: Record<string, any> = {
      suggest_options: { tool: suggestOptionTool, name: "suggest_option" },
      suggest_outcomes: { tool: suggestOutcomesTool, name: "suggest_outcomes" },
      check_biases: { tool: checkBiasesTool, name: "check_biases" },
      auto_generate: { tool: autoGenerateTool, name: "generate_decision_analysis" },
    };

    const toolConfig = toolMap[action];
    if (toolConfig) {
      body.tools = [toolConfig.tool];
      body.tool_choice = { type: "function", function: { name: toolConfig.name } };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (toolCall) {
      const args = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ generated: args }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("No structured response from AI");
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
