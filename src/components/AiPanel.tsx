import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import type { Database } from "@/integrations/supabase/types";

type Decision = Database["public"]["Tables"]["decisions"]["Row"];
type Option = Database["public"]["Tables"]["options"]["Row"];
type Outcome = Database["public"]["Tables"]["outcomes"]["Row"];
type Premortem = Database["public"]["Tables"]["premortems"]["Row"];

interface Props {
  decision: Decision;
  options: (Option & { outcomes: Outcome[] })[];
  premortems: Premortem[];
  onClose: () => void;
  onRefresh: () => void;
}

type AiAction = "suggest_options" | "suggest_outcomes" | "check_biases" | "refine_reasoning";

const actions: { key: AiAction; label: string; desc: string }[] = [
  { key: "suggest_options", label: "Suggest Options", desc: "Generate alternative options" },
  { key: "suggest_outcomes", label: "Suggest Outcomes", desc: "Identify possible outcomes & risks" },
  { key: "check_biases", label: "Check Biases", desc: "Highlight cognitive biases" },
  { key: "refine_reasoning", label: "Refine Reasoning", desc: "Improve your analysis" },
];

export default function AiPanel({ decision, options, premortems, onClose, onRefresh }: Props) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState("");
  const [activeAction, setActiveAction] = useState<AiAction | null>(null);

  const runAction = async (action: AiAction) => {
    setLoading(true);
    setActiveAction(action);
    setResponse("");

    const context = {
      title: decision.title,
      context: decision.context,
      options: options.map(o => ({
        title: o.title,
        outcomes: o.outcomes.map(oc => ({
          description: oc.description,
          probability: oc.probability,
          impact: oc.impact,
        })),
      })),
      premortems: premortems.map(p => ({ reason: p.reason, severity: p.severity })),
    };

    try {
      const { data, error } = await supabase.functions.invoke("ai-decision-assist", {
        body: { action, decision: context },
      });
      if (error) throw error;
      setResponse(data.content || "No response received.");
    } catch (err: any) {
      setResponse(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">AI Assistant</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-2 border-b border-border">
        {actions.map(a => (
          <button
            key={a.key}
            onClick={() => runAction(a.key)}
            disabled={loading}
            className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
              activeAction === a.key
                ? "bg-primary/10 border border-primary/30"
                : "hover:bg-accent border border-transparent"
            }`}
          >
            <div className="font-medium">{a.label}</div>
            <div className="text-xs text-muted-foreground">{a.desc}</div>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : response ? (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>Select an action above to get AI-powered insights for your decision.</p>
          </div>
        )}
      </div>
    </div>
  );
}
