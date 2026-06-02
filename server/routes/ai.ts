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
  suggest_options: `You are a decision analysis expert inspired by Annie Duke's "How to Decide". The user is making a decision. Based on the context provided, suggest ONE new alternative option they may not have considered, with 3-4 possible outcomes covering a range of realistic scenarios (best case, worst case, and likely middle grounds). Be concrete and specific — avoid generic options. IMPORTANT: Probabilities must be whole numbers (e.g. 60, not 0.6) and MUST sum to exactly 100 for all outcomes of the option. Impact is on a scale of -10 to +10.`,
  suggest_outcomes: `You are a decision analysis expert. For the specific option provided, suggest 2-3 additional outcomes the user may have missed, including both positive and negative scenarios. Make outcomes concrete and specific, not generic. IMPORTANT: Probabilities must be whole numbers (e.g. 60, not 0.6). When combined with existing outcomes, all probabilities for this option should sum to approximately 100. Impact is on a scale of -10 to +10.`,
  check_biases: `You are a cognitive bias expert inspired by Annie Duke's work. Analyze the user's decision framework and identify specific cognitive biases. For each bias found, specify which element it relates to (an option title, outcome description, or premortem reason). Be direct and cite specific bias names. For each bias, provide a concise explanation (1-2 sentences max) and include a brief real-world example.`,
  suggest_premortems: `You are a premortem analysis expert inspired by Gary Klein's premortem technique. Imagine this decision has already failed. Identify 3-5 specific, concrete reasons why it could fail — focus on risks the user may have overlooked, not obvious ones. Be specific and actionable. For each risk, assign a realistic frequency and severity using ONLY these exact values: frequency must be one of "very unlikely", "unlikely", "possible", "likely", "very likely"; severity must be one of "negligible", "minor", "moderate", "significant", "severe".`,
  auto_generate: `You are a decision analysis expert inspired by Annie Duke's "How to Decide". The user will give you a decision title and context. Generate a complete decision analysis with exactly 2-3 concrete, distinct options (avoid generic "do nothing" as a sole option), each with exactly 3-4 realistic outcomes spanning best-case, worst-case, and likely middle scenarios. Also generate 4-5 specific premortem risks. Be concrete and specific — avoid vague or generic content. IMPORTANT: For each option, the probabilities of all outcomes MUST sum to exactly 100. Use whole numbers (e.g. 60, not 0.6). Impact is on a scale of -10 to +10. For premortems, frequency must be one of "very unlikely", "unlikely", "possible", "likely", "very likely"; severity must be one of "negligible", "minor", "moderate", "significant", "severe".`,
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
                frequency: { type: "string", enum: ["very unlikely", "unlikely", "possible", "likely", "very likely"] },
                severity: { type: "string", enum: ["negligible", "minor", "moderate", "significant", "severe"] },
              },
              required: ["reason", "frequency", "severity"],
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
                frequency: { type: "string", enum: ["very unlikely", "unlikely", "possible", "likely", "very likely"] },
                severity: { type: "string", enum: ["negligible", "minor", "moderate", "significant", "severe"] },
              },
              required: ["reason", "frequency", "severity"],
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
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserContent(action, decision) },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: toolName } },
      max_tokens: 4096,
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return res.status(500).json({ error: "No structured response from AI" });
    }
    let args: any;
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error("AI returned malformed JSON (likely truncated):", toolCall.function.arguments.slice(-200));
      return res.status(500).json({ error: "AI response was too large or malformed. Try a shorter decision description." });
    }
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

  const systemPrompt = `You are a decision analysis assistant. You help users think through decisions clearly.

Current Decision Context:
${decision_context}

RULES:
- Be concise and direct. Max 3-4 sentences per response unless more detail is explicitly asked for.
- Use bullet points for lists.
- Challenge assumptions briefly.
- No filler phrases like "That's a great question" or "I'd be happy to help".
- Use markdown sparingly.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
