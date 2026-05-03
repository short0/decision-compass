import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Sparkles, Send } from "lucide-react";
import CompassSpinner from "@/components/CompassSpinner";
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0 bg-primary/5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-semibold">Decy AI</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} data-testid="button-ai-close">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Ask anything about your decision</p>
              <p className="text-xs text-muted-foreground mt-1">e.g. "What am I missing?" or "Is my estimate realistic?"</p>
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                </div>
              )}
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted rounded-bl-sm"
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
          <div className="flex gap-2 justify-start">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2">
              <CompassSpinner size={14} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0 space-y-2">
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Decy AI..."
            disabled={isLoading}
            className="flex-1 text-sm h-9"
          />
          <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={isLoading || !input.trim()} data-testid="button-ai-send">
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
        <p className="text-[10px] text-center text-muted-foreground">Decy can make mistakes. Check important info.</p>
      </div>
    </div>
  );
}
