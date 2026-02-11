import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const systemPrompts: Record<string, string> = {
  suggest_options: `You are a decision analysis expert inspired by Annie Duke's "How to Decide". The user is making a decision. Based on the context provided, suggest 3-5 alternative options they may not have considered. For each, briefly explain why it's worth considering. Be concrete and specific.`,

  suggest_outcomes: `You are a decision analysis expert. For each option the user has listed, suggest possible outcomes they may have missed, including both positive and negative scenarios. Estimate rough probabilities and potential impact (-10 to +10 scale). Format clearly with headers per option.`,

  check_biases: `You are a cognitive bias expert inspired by Annie Duke's work on resulting, hindsight bias, and motivated reasoning. Analyze the user's decision framework and identify specific cognitive biases that might be affecting their analysis. Be direct, cite the specific bias by name, and explain how it might be distorting their thinking. Suggest concrete debiasing strategies.`,

  refine_reasoning: `You are a decision quality coach. Review the user's decision analysis including their options, outcomes, probabilities, and premortem analysis. Identify gaps in their reasoning, suggest refinements to probability estimates, and point out areas where their analysis could be stronger. Be constructive and specific.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, decision } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = systemPrompts[action] || systemPrompts.refine_reasoning;

    const userContent = `Here is my decision analysis:

**Decision:** ${decision.title}
**Context:** ${decision.context || "Not provided"}

**Options:**
${decision.options?.map((o: any, i: number) => `
${i + 1}. ${o.title}
   Outcomes: ${o.outcomes?.length > 0 ? o.outcomes.map((oc: any) => `${oc.description} (${oc.probability}% probability, impact: ${oc.impact})`).join("; ") : "None defined yet"}`).join("\n") || "No options defined yet"}

**Premortem Risks:**
${decision.premortems?.length > 0 ? decision.premortems.map((p: any) => `- [${p.severity}] ${p.reason}`).join("\n") : "None defined yet"}

Please analyze and provide your insights.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "No response";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
