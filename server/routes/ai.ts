import { Router } from "express";
import OpenAI from "openai";

export const aiRouter = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function requireAuth(req: any, res: any, next: any) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

aiRouter.use(requireAuth);

const systemPrompts: Record<string, string> = {
  suggest_options: `Decision analysis expert (Annie Duke). Suggest ONE new alternative option with 2-3 outcomes. Be concrete. Probabilities are whole numbers summing to 100. Impact: -10 to +10.`,
  suggest_outcomes: `Decision analysis expert. For the given option, suggest 2-3 additional outcomes (positive and negative). Probabilities are whole numbers. Combined with existing ones they should sum ~100. Impact: -10 to +10.`,
  check_biases: `Cognitive bias expert (Annie Duke). Identify specific cognitive biases in the decision. For each: name it, cite which element it applies to, explain in 1-2 sentences.`,
  suggest_premortems: `Premortem expert (Gary Klein). Assume the decision already failed. List 3-5 specific, concrete failure reasons the user may have missed.`,
  auto_generate: `Decision analysis expert (Annie Duke). Given a decision, generate a complete analysis: 2-4 options each with 2-3 outcomes, plus 3-5 premortem risks. Be concrete and balanced. Each option's outcome probabilities MUST sum to exactly 100 (whole numbers). Impact: -10 to +10.`,
};

const maxTokens: Record<string, number> = {
  suggest_options: 400,
  suggest_outcomes: 300,
  check_biases: 500,
  suggest_premortems: 400,
  auto_generate: 1200,
};

const tools: Record<string, any> = {
  suggest_options: {
    type: "function",
    function: {
      name: "suggest_option",
      description: "Suggest a single new option with outcomes for the decision.",
      parameters: {
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
  },
  suggest_outcomes: {
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
                probability: { type: "number" },
                impact: { type: "number" },
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
  },
  check_biases: {
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
                bias_name: { type: "string" },
                target_type: { type: "string", enum: ["option", "outcome", "premortem", "general"] },
                target_label: { type: "string" },
                explanation: { type: "string" },
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
  },
  suggest_premortems: {
    type: "function",
    function: {
      name: "suggest_premortems",
      description: "Suggest premortem risks for the decision.",
      parameters: {
        type: "object",
        properties: {
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
        required: ["premortems"],
        additionalProperties: false,
      },
    },
  },
  auto_generate: {
    type: "function",
    function: {
      name: "generate_decision_analysis",
      description: "Generate a complete decision analysis.",
      parameters: {
        type: "object",
        properties: {
          options: {
            type: "array",
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
  },
};

const toolNames: Record<string, string> = {
  suggest_options: "suggest_option",
  suggest_outcomes: "suggest_outcomes",
  check_biases: "check_biases",
  suggest_premortems: "suggest_premortems",
  auto_generate: "generate_decision_analysis",
};

function buildUserContent(action: string, decision: any) {
  if (action === "auto_generate") {
    return `Decision: ${decision.title}\nContext: ${decision.context || "Not provided"}`;
  }
  if (action === "suggest_outcomes") {
    return `Decision: ${decision.title}\nContext: ${decision.context || "Not provided"}\nOption: "${decision.target_option_title}"\nExisting outcomes: ${decision.target_option_outcomes?.map((o: any) => o.description).join(", ") || "None"}`;
  }
  const optionsText = decision.options?.map((o: any, i: number) =>
    `${i + 1}. ${o.title}${o.outcomes?.length > 0 ? ": " + o.outcomes.map((oc: any) => `${oc.description} (${oc.probability}%, ${oc.impact > 0 ? "+" : ""}${oc.impact})`).join("; ") : ""}`
  ).join("\n") || "None";
  const premText = decision.premortems?.length > 0
    ? decision.premortems.map((p: any) => `[${p.severity}] ${p.reason}`).join("\n")
    : "None";
  return `Decision: ${decision.title}\nContext: ${decision.context || "Not provided"}\nOptions:\n${optionsText}\nRisks:\n${premText}`;
}

aiRouter.post("/assist", async (req, res) => {
  const { action, decision } = req.body;

  const systemPrompt = systemPrompts[action];
  if (!systemPrompt) {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  try {
    const tool = tools[action];
    const toolName = toolNames[action];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: maxTokens[action],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserContent(action, decision) },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: toolName } },
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return res.status(500).json({ error: "No structured response from AI" });
    }
    const args = JSON.parse(toolCall.function.arguments);
    res.json({ generated: args });
  } catch (err: any) {
    console.error("AI assist error:", err);
    if (err?.status === 429) {
      return res.status(429).json({ error: "Rate limit exceeded. Please try again in a moment." });
    }
    res.status(500).json({ error: err.message || "AI error" });
  }
});

aiRouter.post("/chat", async (req, res) => {
  const { messages, decision_context } = req.body;

  const systemPrompt = `Decision analysis assistant. Help users think through decisions clearly.

Context: ${decision_context}

Rules: Be concise (max 3-4 sentences). Use bullets for lists. Challenge assumptions. No filler phrases. Markdown sparingly.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 300,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for await (const chunk of stream) {
      const data = JSON.stringify(chunk);
      res.write(`data: ${data}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    console.error("AI chat error:", err);
    if (!res.headersSent) {
      if (err?.status === 429) {
        return res.status(429).json({ error: "Rate limit exceeded. Please try again later." });
      }
      res.status(500).json({ error: err.message || "AI error" });
    }
  }
});
