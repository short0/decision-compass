import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Sparkles, Loader2, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { api, type Decision, type Option, type Outcome, type Premortem } from "@/lib/api";

interface Props {
  decision: Decision;
  options: (Option & { outcomes: Outcome[] })[];
  premortems: Premortem[];
  onClose: () => void;
}

type Msg = { role: "user" | "assistant"; content: string };

function buildDecisionContext(
  decision: Decision,
  options: (Option & { outcomes: Outcome[] })[],
  premortems: Premortem[]
) {
  const optionsText = options.map((o, i) =>
    `${i + 1}. ${o.title}${o.outcomes.length > 0 ? "\n   Outcomes: " + o.outcomes.map(oc => `${oc.description} (${oc.probability}%, impact: ${oc.impact})`).join("; ") : ""}`
  ).join("\n");

  const premText = premortems.length > 0
    ? premortems.map(p => `- [${p.severity}] ${p.reason}`).join("\n")
    : "None";

  return `Decision: ${decision.title}\nContext: ${decision.context || "Not provided"}\nStatus: ${decision.status}\n\nOptions:\n${optionsText || "None"}\n\nPremortem Risks:\n${premText}`;
}

export default function AiPanel({ decision, options, premortems, onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      const decisionContext = buildDecisionContext(decision, options, premortems);
      const stream = api.ai.chatStream([...messages, userMsg], decisionContext);

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      for await (const chunk of stream) {
        upsert(chunk);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">AI Chat</h3>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>Ask anything about your decision.</p>
            <p className="text-xs mt-1">e.g. "What am I missing?" or "Is my probability estimate realistic?"</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{m.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border space-y-2">
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your decision..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-[11px] text-center text-muted-foreground">Decy can make mistakes. Check important info.</p>
      </div>
    </div>
  );
}
