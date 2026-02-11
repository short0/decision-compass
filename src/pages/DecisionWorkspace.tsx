import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Trash2, Sparkles, AlertTriangle,
  CheckCircle2, Scale, Target, Shield
} from "lucide-react";
import OptionCard from "@/components/OptionCard";
import PremortermPanel from "@/components/PremortermPanel";
import AiPanel from "@/components/AiPanel";
import type { Database } from "@/integrations/supabase/types";

type Decision = Database["public"]["Tables"]["decisions"]["Row"];
type Option = Database["public"]["Tables"]["options"]["Row"];
type Outcome = Database["public"]["Tables"]["outcomes"]["Row"];
type Premortem = Database["public"]["Tables"]["premortems"]["Row"];

type Tab = "options" | "premortem" | "review";

export default function DecisionWorkspace() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [decision, setDecision] = useState<Decision | null>(null);
  const [options, setOptions] = useState<(Option & { outcomes: Outcome[] })[]>([]);
  const [premortems, setPremortems] = useState<Premortem[]>([]);
  const [tab, setTab] = useState<Tab>("options");
  const [title, setTitle] = useState("");
  const [context, setContext] = useState("");
  const [showAi, setShowAi] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const { data: d } = await supabase.from("decisions").select("*").eq("id", id).single();
    if (!d) { navigate("/"); return; }
    setDecision(d);
    setTitle(d.title);
    setContext(d.context || "");

    const { data: opts } = await supabase.from("options").select("*").eq("decision_id", id).order("sort_order");
    const optionIds = (opts || []).map(o => o.id);
    let allOutcomes: Outcome[] = [];
    if (optionIds.length > 0) {
      const { data: oc } = await supabase.from("outcomes").select("*").in("option_id", optionIds);
      allOutcomes = oc || [];
    }
    setOptions((opts || []).map(o => ({
      ...o,
      outcomes: allOutcomes.filter(oc => oc.option_id === o.id),
    })));

    const { data: pm } = await supabase.from("premortems").select("*").eq("decision_id", id);
    setPremortems(pm || []);
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const saveDecision = async () => {
    if (!id) return;
    setSaving(true);
    await supabase.from("decisions").update({ title, context }).eq("id", id);
    setSaving(false);
  };

  const addOption = async () => {
    if (!id) return;
    await supabase.from("options").insert({
      decision_id: id,
      title: `Option ${options.length + 1}`,
      sort_order: options.length,
    });
    load();
  };

  const deleteOption = async (optionId: string) => {
    await supabase.from("options").delete().eq("id", optionId);
    load();
  };

  const updateOption = async (optionId: string, updates: Partial<Option>) => {
    await supabase.from("options").update(updates).eq("id", optionId);
  };

  const addOutcome = async (optionId: string) => {
    await supabase.from("outcomes").insert({
      option_id: optionId,
      description: "New outcome",
    });
    load();
  };

  const updateOutcome = async (outcomeId: string, updates: Partial<Outcome>) => {
    await supabase.from("outcomes").update(updates).eq("id", outcomeId);
  };

  const deleteOutcome = async (outcomeId: string) => {
    await supabase.from("outcomes").delete().eq("id", outcomeId);
    load();
  };

  const addPremortem = async (optionId?: string) => {
    if (!id) return;
    await supabase.from("premortems").insert({
      decision_id: id,
      option_id: optionId || null,
      reason: "What could go wrong?",
    });
    load();
  };

  const updatePremortem = async (pmId: string, updates: Partial<Premortem>) => {
    await supabase.from("premortems").update(updates).eq("id", pmId);
  };

  const deletePremortem = async (pmId: string) => {
    await supabase.from("premortems").delete().eq("id", pmId);
    load();
  };

  const calcEV = (outcomes: Outcome[]) => {
    if (outcomes.length === 0) return 0;
    return outcomes.reduce((sum, o) => sum + (Number(o.probability) / 100) * Number(o.impact), 0);
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "options", label: "Options & Outcomes", icon: <Target className="w-4 h-4" /> },
    { key: "premortem", label: "Premortem", icon: <Shield className="w-4 h-4" /> },
    { key: "review", label: "Review", icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  if (!decision) return null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Main workspace */}
      <div className={`flex-1 transition-all ${showAi ? "mr-80 lg:mr-96" : ""}`}>
        <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Scale className="w-4 h-4 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={showAi ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAi(!showAi)}
              >
                <Sparkles className="w-4 h-4 mr-1" />
                AI Assist
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
          {/* Title & Context */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveDecision}
              className="text-2xl font-bold border-none bg-transparent px-0 focus-visible:ring-0 h-auto"
              placeholder="What decision are you making?"
            />
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              onBlur={saveDecision}
              className="border-none bg-transparent px-0 focus-visible:ring-0 resize-none text-muted-foreground"
              placeholder="Describe the context and constraints..."
              rows={2}
            />
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  tab === t.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <AnimatePresence mode="wait">
            {tab === "options" && (
              <motion.div
                key="options"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                {options.map((option, i) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    index={i}
                    ev={calcEV(option.outcomes)}
                    onUpdate={updateOption}
                    onDelete={() => deleteOption(option.id)}
                    onAddOutcome={() => addOutcome(option.id)}
                    onUpdateOutcome={updateOutcome}
                    onDeleteOutcome={deleteOutcome}
                  />
                ))}
                <Button variant="workspace" onClick={addOption} className="w-full py-6">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Option
                </Button>
              </motion.div>
            )}

            {tab === "premortem" && (
              <motion.div
                key="premortem"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <PremortermPanel
                  premortems={premortems}
                  options={options}
                  onAdd={addPremortem}
                  onUpdate={updatePremortem}
                  onDelete={deletePremortem}
                />
              </motion.div>
            )}

            {tab === "review" && (
              <motion.div
                key="review"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <div className="glass-panel p-6 space-y-4">
                  <h3 className="font-semibold text-lg">Expected Value Summary</h3>
                  {options.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Add options to see analysis.</p>
                  ) : (
                    <div className="space-y-3">
                      {[...options]
                        .sort((a, b) => calcEV(b.outcomes) - calcEV(a.outcomes))
                        .map((opt, i) => {
                          const ev = calcEV(opt.outcomes);
                          const maxEV = Math.max(...options.map(o => Math.abs(calcEV(o.outcomes))), 1);
                          const width = Math.abs(ev) / maxEV * 100;
                          return (
                            <div key={opt.id} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span className="font-medium">{opt.title}</span>
                                <span className={`font-mono font-semibold ${ev >= 0 ? "text-success" : "text-destructive"}`}>
                                  EV: {ev.toFixed(2)}
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${ev >= 0 ? "bg-success" : "bg-destructive"}`}
                                  style={{ width: `${Math.max(width, 2)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {premortems.length > 0 && (
                  <div className="glass-panel p-6 space-y-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-warning" />
                      Risk Summary
                    </h3>
                    <div className="space-y-2">
                      {premortems.filter(p => p.severity === "high").map(p => (
                        <div key={p.id} className="flex items-start gap-2 text-sm">
                          <span className="w-2 h-2 rounded-full bg-destructive mt-1.5 shrink-0" />
                          <span>{p.reason}</span>
                        </div>
                      ))}
                      {premortems.filter(p => p.severity === "medium").map(p => (
                        <div key={p.id} className="flex items-start gap-2 text-sm">
                          <span className="w-2 h-2 rounded-full bg-warning mt-1.5 shrink-0" />
                          <span>{p.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="glass-panel p-6 space-y-3">
                  <h3 className="font-semibold text-lg">Reflection</h3>
                  <Textarea
                    placeholder="What did you learn? What would you do differently?"
                    value={decision.reflection || ""}
                    onChange={async (e) => {
                      setDecision({ ...decision, reflection: e.target.value });
                      await supabase.from("decisions").update({ reflection: e.target.value }).eq("id", decision.id);
                    }}
                    rows={4}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* AI Panel */}
      <AnimatePresence>
        {showAi && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            className="fixed right-0 top-0 bottom-0 w-80 lg:w-96 border-l border-border bg-card z-20"
          >
            <AiPanel
              decision={decision}
              options={options}
              premortems={premortems}
              onClose={() => setShowAi(false)}
              onRefresh={load}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
