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
  CheckCircle2, Scale, Target, Shield, Wand2, Loader2,
  Brain, X, ClipboardCheck
} from "lucide-react";
import Footer from "@/components/Footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import OptionCard, { type BiasAnnotation } from "@/components/OptionCard";
import ThemeToggle from "@/components/ThemeToggle";
import PremortermPanel from "@/components/PremortermPanel";
import AiPanel from "@/components/AiPanel";
import type { Database } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Decision = Database["public"]["Tables"]["decisions"]["Row"];
type Option = Database["public"]["Tables"]["options"]["Row"];
type Outcome = Database["public"]["Tables"]["outcomes"]["Row"];
type Premortem = Database["public"]["Tables"]["premortems"]["Row"];

type Tab = "options" | "premortem" | "review" | "actual";

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
  const [generating, setGenerating] = useState(false);
  const [suggestingOption, setSuggestingOption] = useState(false);
  const [suggestingOutcomesFor, setSuggestingOutcomesFor] = useState<string | null>(null);
  const [checkingBiases, setCheckingBiases] = useState(false);
  const [suggestingPremortems, setSuggestingPremortems] = useState(false);
  const [biases, setBiases] = useState<BiasAnnotation[]>([]);

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

  const deleteDecision = async () => {
    if (!id) return;
    await supabase.from("premortems").delete().eq("decision_id", id);
    const optionIds = options.map(o => o.id);
    if (optionIds.length > 0) {
      await supabase.from("outcomes").delete().in("option_id", optionIds);
    }
    await supabase.from("options").delete().eq("decision_id", id);
    await supabase.from("decisions").delete().eq("id", id);
    navigate("/");
    toast({ title: "Decision deleted" });
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
    await supabase.from("outcomes").delete().eq("option_id", optionId);
    await supabase.from("premortems").delete().eq("option_id", optionId);
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

  const moveOption = async (idx: number, direction: "up" | "down") => {
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= options.length) return;
    const a = options[idx];
    const b = options[swapIdx];
    await supabase.from("options").update({ sort_order: b.sort_order }).eq("id", a.id);
    await supabase.from("options").update({ sort_order: a.sort_order }).eq("id", b.id);
    load();
  };

  const moveOutcome = async (optionId: string, outcomeId: string, direction: "up" | "down") => {
    const opt = options.find(o => o.id === optionId);
    if (!opt) return;
    const outcomes = opt.outcomes;
    const idx = outcomes.findIndex(o => o.id === outcomeId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= outcomes.length) return;
    // Swap by re-inserting with swapped created_at isn't ideal, so we just swap in local state and reload
    // We'll use a simple approach: delete and re-insert in order isn't great either.
    // Best approach: swap the descriptions/data between the two outcome rows
    const a = outcomes[idx];
    const b = outcomes[swapIdx];
    await supabase.from("outcomes").update({ description: b.description, probability: b.probability, impact: b.impact }).eq("id", a.id);
    await supabase.from("outcomes").update({ description: a.description, probability: a.probability, impact: a.impact }).eq("id", b.id);
    load();
  };

  const movePremortem = async (pmId: string, direction: "up" | "down") => {
    const idx = premortems.findIndex(p => p.id === pmId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= premortems.length) return;
    const a = premortems[idx];
    const b = premortems[swapIdx];
    await supabase.from("premortems").update({ reason: b.reason, severity: b.severity }).eq("id", a.id);
    await supabase.from("premortems").update({ reason: a.reason, severity: a.severity }).eq("id", b.id);
    load();
  };

  const calcEV = (outcomes: Outcome[]) => {
    if (outcomes.length === 0) return 0;
    return outcomes.reduce((sum, o) => sum + (Number(o.probability) / 100) * Number(o.impact), 0);
  };

  const buildContext = () => ({
    title,
    context,
    options: options.map(o => ({
      title: o.title,
      outcomes: o.outcomes.map(oc => ({
        description: oc.description,
        probability: oc.probability,
        impact: oc.impact,
      })),
    })),
    premortems: premortems.map(p => ({ reason: p.reason, severity: p.severity })),
  });

  const autoGenerate = async () => {
    if (!id || !title.trim()) {
      toast({ title: "Enter a decision title first", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-decision-assist", {
        body: { action: "auto_generate", decision: { title, context } },
      });
      if (error) throw error;
      const gen = data.generated;
      if (!gen?.options) throw new Error("No data generated");

      for (let i = 0; i < gen.options.length; i++) {
        const opt = gen.options[i];
        const { data: inserted } = await supabase.from("options").insert({
          decision_id: id, title: opt.title, description: opt.description || null, sort_order: options.length + i,
        }).select().single();
        if (inserted && opt.outcomes) {
          for (const oc of opt.outcomes) {
            await supabase.from("outcomes").insert({
              option_id: inserted.id, description: oc.description,
              probability: Math.max(0, Math.min(100, oc.probability)),
              impact: Math.max(-10, Math.min(10, oc.impact)),
            });
          }
        }
      }
      if (gen.premortems) {
        for (const pm of gen.premortems) {
          await supabase.from("premortems").insert({
            decision_id: id, reason: pm.reason, severity: pm.severity || "medium",
          });
        }
      }
      await load();
      toast({ title: "AI generated options, outcomes & risks!" });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const suggestOption = async () => {
    if (!id) return;
    setSuggestingOption(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-decision-assist", {
        body: { action: "suggest_options", decision: buildContext() },
      });
      if (error) throw error;
      const gen = data.generated;
      if (!gen?.title) throw new Error("No option generated");

      const { data: inserted } = await supabase.from("options").insert({
        decision_id: id, title: gen.title, description: gen.description || null, sort_order: options.length,
      }).select().single();

      if (inserted && gen.outcomes) {
        for (const oc of gen.outcomes) {
          await supabase.from("outcomes").insert({
            option_id: inserted.id, description: oc.description,
            probability: Math.max(0, Math.min(100, oc.probability)),
            impact: Math.max(-10, Math.min(10, oc.impact)),
          });
        }
      }
      await load();
      toast({ title: `AI suggested: "${gen.title}"` });
    } catch (err: any) {
      toast({ title: "Suggestion failed", description: err.message, variant: "destructive" });
    } finally {
      setSuggestingOption(false);
    }
  };

  const suggestOutcomes = async (optionId: string) => {
    setSuggestingOutcomesFor(optionId);
    const opt = options.find(o => o.id === optionId);
    if (!opt) return;
    try {
      const { data, error } = await supabase.functions.invoke("ai-decision-assist", {
        body: {
          action: "suggest_outcomes",
          decision: {
            ...buildContext(),
            target_option_title: opt.title,
            target_option_outcomes: opt.outcomes.map(oc => ({ description: oc.description })),
          },
        },
      });
      if (error) throw error;
      const gen = data.generated;
      if (!gen?.outcomes) throw new Error("No outcomes generated");

      for (const oc of gen.outcomes) {
        await supabase.from("outcomes").insert({
          option_id: optionId, description: oc.description,
          probability: Math.max(0, Math.min(100, oc.probability)),
          impact: Math.max(-10, Math.min(10, oc.impact)),
        });
      }
      await load();
      toast({ title: `Added ${gen.outcomes.length} suggested outcomes` });
    } catch (err: any) {
      toast({ title: "Suggestion failed", description: err.message, variant: "destructive" });
    } finally {
      setSuggestingOutcomesFor(null);
    }
  };

  const checkBiases = async () => {
    setCheckingBiases(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-decision-assist", {
        body: { action: "check_biases", decision: buildContext() },
      });
      if (error) throw error;
      const gen = data.generated;
      if (!gen?.biases) throw new Error("No biases found");
      setBiases(gen.biases);
      toast({ title: `Found ${gen.biases.length} potential biases` });
    } catch (err: any) {
      toast({ title: "Bias check failed", description: err.message, variant: "destructive" });
    } finally {
      setCheckingBiases(false);
    }
  };

  const suggestPremortems = async () => {
    if (!id) return;
    setSuggestingPremortems(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-decision-assist", {
        body: { action: "suggest_premortems", decision: buildContext() },
      });
      if (error) throw error;
      const gen = data.generated;
      if (!gen?.premortems) throw new Error("No premortems generated");

      for (const pm of gen.premortems) {
        await supabase.from("premortems").insert({
          decision_id: id,
          reason: pm.reason,
          severity: pm.severity || "medium",
        });
      }
      await load();
      toast({ title: `Added ${gen.premortems.length} potential risks` });
    } catch (err: any) {
      toast({ title: "Suggestion failed", description: err.message, variant: "destructive" });
    } finally {
      setSuggestingPremortems(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "options", label: "Options & Outcomes", icon: <Target className="w-4 h-4" /> },
    { key: "premortem", label: "Premortem", icon: <Shield className="w-4 h-4" /> },
    { key: "review", label: "Review", icon: <CheckCircle2 className="w-4 h-4" /> },
    { key: "actual", label: "Actual Outcome", icon: <ClipboardCheck className="w-4 h-4" /> },
  ];

  if (!decision) return null;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Main workspace */}
        <div className={`flex-1 transition-all flex flex-col ${showAi ? "mr-80 lg:mr-96" : ""}`}>
          <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Scale className="w-4 h-4 text-primary" />
              </div>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this decision?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{title}" and all its options, outcomes, and premortem data.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteDecision} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  variant={showAi ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowAi(!showAi)}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  AI Chat
                </Button>
              </div>
            </div>
          </header>

          <main className="max-w-5xl mx-auto px-4 py-6 space-y-6 flex-1 w-full">
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
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={autoGenerate} disabled={generating || !title.trim()}>
                  {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  {generating ? "Generating..." : "Auto-Generate with AI"}
                </Button>
                <Button
                  variant="outline"
                  onClick={checkBiases}
                  disabled={checkingBiases || options.length === 0}
                >
                  {checkingBiases ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
                  {checkingBiases ? "Checking..." : "Check Biases"}
                </Button>
                {biases.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setBiases([])}>
                    <X className="w-4 h-4 mr-1" />
                    Clear Biases ({biases.length})
                  </Button>
                )}
              </div>
            </motion.div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-lg w-fit">
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
                  <span className="hidden sm:inline">{t.label}</span>
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
                      totalOptions={options.length}
                      ev={calcEV(option.outcomes)}
                      biases={biases}
                      onUpdate={updateOption}
                      onDelete={() => deleteOption(option.id)}
                      onMoveUp={() => moveOption(i, "up")}
                      onMoveDown={() => moveOption(i, "down")}
                      onAddOutcome={() => addOutcome(option.id)}
                      onUpdateOutcome={updateOutcome}
                      onDeleteOutcome={deleteOutcome}
                      onMoveOutcomeUp={(ocId) => moveOutcome(option.id, ocId, "up")}
                      onMoveOutcomeDown={(ocId) => moveOutcome(option.id, ocId, "down")}
                      onSuggestOutcomes={suggestOutcomes}
                      suggestingOutcomes={suggestingOutcomesFor === option.id}
                    />
                  ))}
                  <div className="flex gap-2">
                    <Button variant="workspace" onClick={addOption} className="flex-1 py-6">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Option
                    </Button>
                    <Button
                      variant="workspace"
                      onClick={suggestOption}
                      disabled={suggestingOption || !title.trim()}
                      className="flex-1 py-6"
                    >
                      {suggestingOption ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-1" />
                      )}
                      {suggestingOption ? "Suggesting..." : "Suggest Option"}
                    </Button>
                  </div>
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
                    biases={biases}
                    onAdd={addPremortem}
                    onUpdate={updatePremortem}
                    onDelete={deletePremortem}
                    onMoveUp={(id) => movePremortem(id, "up")}
                    onMoveDown={(id) => movePremortem(id, "down")}
                    onSuggestPremortems={suggestPremortems}
                    suggestingPremortems={suggestingPremortems}
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
                          .map((opt) => {
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

              {tab === "actual" && (
                <motion.div
                  key="actual"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-6"
                >
                  <div className="glass-panel p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-lg">Record Actual Outcome</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      After your decision plays out, record what actually happened to calibrate future decisions.
                    </p>

                    {options.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Which option did you choose?</label>
                        <select
                          value={decision.chosen_option_id || ""}
                          onChange={async (e) => {
                            const val = e.target.value || null;
                            setDecision({ ...decision, chosen_option_id: val });
                            await supabase.from("decisions").update({ chosen_option_id: val }).eq("id", decision.id);
                          }}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="">— Not yet decided —</option>
                          {options.map(o => (
                            <option key={o.id} value={o.id}>{o.title}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">When did the outcome become clear?</label>
                      <Input
                        type="date"
                        value={decision.outcome_date ? new Date(decision.outcome_date).toISOString().split("T")[0] : ""}
                        onChange={async (e) => {
                          const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                          setDecision({ ...decision, outcome_date: val });
                          await supabase.from("decisions").update({ outcome_date: val }).eq("id", decision.id);
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">What actually happened?</label>
                      <Textarea
                        placeholder="Describe the actual outcome — what went right, what went wrong, any surprises..."
                        value={decision.actual_outcome || ""}
                        onChange={async (e) => {
                          setDecision({ ...decision, actual_outcome: e.target.value });
                          await supabase.from("decisions").update({ actual_outcome: e.target.value }).eq("id", decision.id);
                        }}
                        rows={5}
                      />
                    </div>

                    {decision.chosen_option_id && (
                      <div className="glass-panel p-4 space-y-2 bg-muted/30">
                        <h4 className="text-sm font-medium">Predicted vs Actual</h4>
                        <p className="text-xs text-muted-foreground">
                          You chose: <span className="font-semibold text-foreground">{options.find(o => o.id === decision.chosen_option_id)?.title}</span>
                        </p>
                        {(() => {
                          const chosen = options.find(o => o.id === decision.chosen_option_id);
                          if (!chosen || chosen.outcomes.length === 0) return null;
                          return (
                            <div className="space-y-1 mt-2">
                              <p className="text-xs font-medium text-muted-foreground">Predicted outcomes:</p>
                              {chosen.outcomes.map(oc => (
                                <div key={oc.id} className="text-xs flex justify-between">
                                  <span>{oc.description}</span>
                                  <span className="font-mono text-muted-foreground">
                                    {Number(oc.probability)}% · {Number(oc.impact) > 0 ? "+" : ""}{Number(oc.impact)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
           </main>
          <Footer />
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
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
