import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, type Decision, type Option, type Outcome, type Premortem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Sparkles, CheckCircle2, Target, Shield, Wand2, Loader2,
  Brain, X, ClipboardCheck,
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import OptionCard, { type BiasAnnotation } from "@/components/OptionCard";
import PremortermPanel from "@/components/PremortermPanel";
import AiPanel from "@/components/AiPanel";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const d = await api.decisions.get(id);
      if (!d) { navigate("/"); return; }
      setDecision(d);
      setTitle(d.title);
      setContext(d.context || "");
      const opts = await api.options.list(id);
      setOptions(opts || []);
      const pm = await api.premortems.list(id);
      setPremortems(pm || []);
    } catch {
      navigate("/");
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const saveDecision = async () => {
    if (!id) return;
    setSaving(true);
    await api.decisions.update(id, { title, context: context || null });
    window.dispatchEvent(new Event("decisions-updated"));
    setSaving(false);
  };

  const deleteDecision = async () => {
    if (!id) return;
    await api.decisions.delete(id);
    window.dispatchEvent(new Event("decisions-updated"));
    navigate("/");
    toast({ title: "Decision deleted" });
  };

  const addOption = async () => {
    if (!id) return;
    await api.options.create(id, {
      title: `Option ${options.length + 1}`,
      sortOrder: options.length,
    } as any);
    load();
  };

  const deleteOption = async (optionId: string) => {
    await api.options.delete(optionId);
    load();
  };

  const updateOption = async (optionId: string, updates: Partial<Option>) => {
    await api.options.update(optionId, updates);
  };

  const addOutcome = async (optionId: string) => {
    await api.outcomes.create(optionId, { description: "New outcome" } as any);
    load();
  };

  const updateOutcome = async (outcomeId: string, updates: Partial<Outcome>) => {
    await api.outcomes.update(outcomeId, updates);
  };

  const deleteOutcome = async (outcomeId: string) => {
    await api.outcomes.delete(outcomeId);
    load();
  };

  const reorderOutcomes = async (optionId: string, activeId: string, overId: string) => {
    const opt = options.find(o => o.id === optionId);
    if (!opt) return;
    const ocs = [...opt.outcomes];
    const activeIdx = ocs.findIndex(o => o.id === activeId);
    const overIdx = ocs.findIndex(o => o.id === overId);
    if (activeIdx === -1 || overIdx === -1) return;
    const a = ocs[activeIdx];
    const b = ocs[overIdx];
    await api.outcomes.update(a.id, { description: b.description, probability: b.probability, impact: b.impact });
    await api.outcomes.update(b.id, { description: a.description, probability: a.probability, impact: a.impact });
    load();
  };

  const handleOptionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeIdx = options.findIndex(o => o.id === active.id);
    const overIdx = options.findIndex(o => o.id === over.id);
    if (activeIdx === -1 || overIdx === -1) return;
    const a = options[activeIdx];
    const b = options[overIdx];
    Promise.all([
      api.options.update(a.id, { sortOrder: b.sortOrder } as any),
      api.options.update(b.id, { sortOrder: a.sortOrder } as any),
    ]).then(() => load());
  };

  const reorderPremortems = async (activeId: string, overId: string) => {
    const activeIdx = premortems.findIndex(p => p.id === activeId);
    const overIdx = premortems.findIndex(p => p.id === overId);
    if (activeIdx === -1 || overIdx === -1) return;
    const a = premortems[activeIdx];
    const b = premortems[overIdx];
    await api.premortems.update(a.id, { reason: b.reason, severity: b.severity });
    await api.premortems.update(b.id, { reason: a.reason, severity: a.severity });
    load();
  };

  const addPremortem = async (optionId?: string) => {
    if (!id) return;
    await api.premortems.create(id, { option_id: optionId || null } as any);
    load();
  };

  const updatePremortem = async (pmId: string, updates: Partial<Premortem>) => {
    await api.premortems.update(pmId, updates);
  };

  const deletePremortem = async (pmId: string) => {
    await api.premortems.delete(pmId);
    load();
  };

  const calcEV = (ocs: Outcome[]) => {
    if (ocs.length === 0) return 0;
    return ocs.reduce((sum, o) => sum + (Number(o.probability) / 100) * Number(o.impact), 0);
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
      const { generated: gen } = await api.ai.assist("auto_generate", { title, context });
      if (!gen?.options) throw new Error("No data generated");

      for (let i = 0; i < gen.options.length; i++) {
        const opt = gen.options[i];
        const inserted = await api.options.create(id, {
          title: opt.title,
          description: opt.description || null,
          sort_order: options.length + i,
        } as any);
        if (inserted && opt.outcomes) {
          for (const oc of opt.outcomes) {
            await api.outcomes.create(inserted.id, {
              description: oc.description,
              probability: Math.max(0, Math.min(100, oc.probability)),
              impact: Math.max(-10, Math.min(10, oc.impact)),
            } as any);
          }
        }
      }
      if (gen.premortems) {
        for (const pm of gen.premortems) {
          await api.premortems.create(id, { reason: pm.reason, severity: pm.severity || "medium" } as any);
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
      const { generated: gen } = await api.ai.assist("suggest_options", buildContext());
      if (!gen?.title) throw new Error("No option generated");

      const inserted = await api.options.create(id, {
        title: gen.title,
        description: gen.description || null,
        sort_order: options.length,
      } as any);
      if (inserted && gen.outcomes) {
        for (const oc of gen.outcomes) {
          await api.outcomes.create(inserted.id, {
            description: oc.description,
            probability: Math.max(0, Math.min(100, oc.probability)),
            impact: Math.max(-10, Math.min(10, oc.impact)),
          } as any);
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
      const { generated: gen } = await api.ai.assist("suggest_outcomes", {
        ...buildContext(),
        target_option_title: opt.title,
        target_option_outcomes: opt.outcomes.map(oc => ({ description: oc.description })),
      });
      if (!gen?.outcomes) throw new Error("No outcomes generated");

      for (const oc of gen.outcomes) {
        await api.outcomes.create(optionId, {
          description: oc.description,
          probability: Math.max(0, Math.min(100, oc.probability)),
          impact: Math.max(-10, Math.min(10, oc.impact)),
        } as any);
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
      const { generated: gen } = await api.ai.assist("check_biases", buildContext());
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
      const { generated: gen } = await api.ai.assist("suggest_premortems", buildContext());
      if (!gen?.premortems) throw new Error("No premortems generated");

      for (const pm of gen.premortems) {
        await api.premortems.create(id, { reason: pm.reason, severity: pm.severity || "medium" } as any);
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
      <div className="flex flex-col h-full">
        <div className={`flex-1 transition-all flex flex-col ${showAi ? "mr-80 lg:mr-96" : ""}`}>
          <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground truncate max-w-[200px]">{title || "Untitled"}</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Delete</span>
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
                <Button variant={showAi ? "default" : "outline"} size="sm" onClick={() => setShowAi(!showAi)}>
                  <Sparkles className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">AI Chat</span>
                </Button>
              </div>
            </div>
          </header>

          <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 flex-1 w-full overflow-y-auto">
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
                <Button variant="outline" onClick={checkBiases} disabled={checkingBiases || options.length === 0}>
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

            <div className="flex flex-wrap gap-1 p-1 bg-muted rounded-lg w-fit">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {tab === "options" && (
                <motion.div key="options" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleOptionDragEnd}>
                    <SortableContext items={options.map(o => o.id)} strategy={verticalListSortingStrategy}>
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
                          onAddOutcome={() => addOutcome(option.id)}
                          onUpdateOutcome={updateOutcome}
                          onDeleteOutcome={deleteOutcome}
                          onReorderOutcomes={(activeId, overId) => reorderOutcomes(option.id, activeId, overId)}
                          onSuggestOutcomes={suggestOutcomes}
                          suggestingOutcomes={suggestingOutcomesFor === option.id}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  <div className="flex gap-2">
                    <Button variant="workspace" onClick={addOption} className="flex-1 py-6">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Option
                    </Button>
                    <Button variant="workspace" onClick={suggestOption} disabled={suggestingOption || !title.trim()} className="flex-1 py-6">
                      {suggestingOption ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                      {suggestingOption ? "Suggesting..." : "Suggest Option"}
                    </Button>
                  </div>
                </motion.div>
              )}

              {tab === "premortem" && (
                <motion.div key="premortem" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <PremortermPanel
                    premortems={premortems}
                    options={options}
                    biases={biases}
                    onAdd={addPremortem}
                    onUpdate={updatePremortem}
                    onDelete={deletePremortem}
                    onReorder={reorderPremortems}
                    onSuggestPremortems={suggestPremortems}
                    suggestingPremortems={suggestingPremortems}
                  />
                </motion.div>
              )}

              {tab === "review" && (
                <motion.div key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                  <div className="glass-panel p-6 space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      Decision Review
                    </h3>
                    {options.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Add options in the Options tab to review them here.</p>
                    ) : (
                      <div className="space-y-3">
                        {[...options]
                          .sort((a, b) => calcEV(b.outcomes) - calcEV(a.outcomes))
                          .map((opt, i) => (
                            <div key={opt.id} className={`flex items-center justify-between p-3 rounded-lg border ${i === 0 ? "border-primary/50 bg-primary/5" : "border-border"}`}>
                              <div className="flex items-center gap-3">
                                {i === 0 && <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Best EV</span>}
                                <span className="font-medium text-sm">{opt.title}</span>
                              </div>
                              <span className={`font-mono text-sm font-semibold ${calcEV(opt.outcomes) >= 0 ? "text-green-600" : "text-destructive"}`}>
                                EV: {calcEV(opt.outcomes).toFixed(2)}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {tab === "actual" && (
                <motion.div key="actual" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <div className="glass-panel p-6 space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-primary" />
                      Actual Outcome
                    </h3>
                    <p className="text-sm text-muted-foreground">Record what actually happened after making this decision.</p>
                    <Textarea
                      value={decision.actualOutcome || ""}
                      onChange={(e) => setDecision({ ...decision, actualOutcome: e.target.value })}
                      onBlur={() => id && api.decisions.update(id, { actualOutcome: decision.actualOutcome })}
                      placeholder="What actually happened? How did it turn out?"
                      rows={4}
                    />
                    <Textarea
                      value={decision.reflection || ""}
                      onChange={(e) => setDecision({ ...decision, reflection: e.target.value })}
                      onBlur={() => id && api.decisions.update(id, { reflection: decision.reflection })}
                      placeholder="Reflection: What did you learn? Would you make the same decision again?"
                      rows={3}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {showAi && (
          <div className="fixed right-0 top-0 h-full w-80 lg:w-96 border-l border-border bg-background z-20 flex flex-col">
            <AiPanel
              decision={decision}
              options={options}
              premortems={premortems}
              onClose={() => setShowAi(false)}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
