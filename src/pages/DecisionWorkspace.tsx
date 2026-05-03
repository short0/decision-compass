import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, type Decision, type Option, type Outcome, type Premortem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Sparkles, CheckCircle2, Target, Shield, Wand2, Loader2,
  Brain, X, ClipboardCheck, TrendingUp, AlertTriangle, Undo2, Redo2,
} from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import OptionCard, { type BiasAnnotation } from "@/components/OptionCard";
import PremortermPanel, { getRiskScore } from "@/components/PremortermPanel";
import AiPanel from "@/components/AiPanel";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Tab = "options" | "premortem" | "review" | "actual";

type Command = {
  execute: () => Promise<void>;
  unexecute: () => Promise<void>;
  description: string;
};

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
  const [generating, setGenerating] = useState(false);
  const [suggestingOption, setSuggestingOption] = useState(false);
  const [suggestingOutcomesFor, setSuggestingOutcomesFor] = useState<string | null>(null);
  const [checkingBiases, setCheckingBiases] = useState(false);
  const [suggestingPremortems, setSuggestingPremortems] = useState(false);
  const [biases, setBiases] = useState<BiasAnnotation[]>([]);

  const undoStack = useRef<Command[]>([]);
  const redoStack = useRef<Command[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => { setBiases([]); }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const { decision: d, options: opts, premortems: pms } = await api.decisions.workspace(id);
      if (!d) { navigate("/"); return; }
      setDecision(d);
      setTitle(d.title);
      setContext(d.context || "");
      setOptions(opts || []);
      setPremortems(pms || []);
    } catch {
      navigate("/");
    }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const syncUndo = () => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  };

  const executeCommand = async (cmd: Command) => {
    await cmd.execute();
    undoStack.current = [...undoStack.current, cmd].slice(-20);
    redoStack.current = [];
    syncUndo();
  };

  const handleUndo = async () => {
    const cmd = undoStack.current.at(-1);
    if (!cmd) return;
    undoStack.current = undoStack.current.slice(0, -1);
    await cmd.unexecute();
    redoStack.current = [...redoStack.current, cmd].slice(-20);
    syncUndo();
    toast({ title: `Undid: ${cmd.description}` });
  };

  const handleRedo = async () => {
    const cmd = redoStack.current.at(-1);
    if (!cmd) return;
    redoStack.current = redoStack.current.slice(0, -1);
    await cmd.execute();
    undoStack.current = [...undoStack.current, cmd].slice(-20);
    syncUndo();
    toast({ title: `Redid: ${cmd.description}` });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const saveDecision = async () => {
    if (!id) return;
    await api.decisions.update(id, { title, context: context || null });
    window.dispatchEvent(new Event("decisions-updated"));
  };

  const [deleting, setDeleting] = useState(false);

  const deleteDecision = async () => {
    if (!id) return;
    setDeleting(true);
    navigate("/");
    window.dispatchEvent(new Event("decisions-updated"));
    try {
      await api.decisions.delete(id);
      toast({ title: "Decision deleted" });
    } finally {
      setDeleting(false);
    }
  };

  const addOption = async () => {
    if (!id) return;
    let createdId: string | null = null;
    const sortOrder = options.length;
    const cmd: Command = {
      description: "Add option",
      execute: async () => {
        const created = await api.options.create(id, { title: `Option ${sortOrder + 1}`, sortOrder } as any);
        createdId = created.id;
        setOptions(prev => [...prev, { ...created, outcomes: [] }]);
      },
      unexecute: async () => {
        if (createdId) {
          await api.options.delete(createdId);
          const deleted = createdId;
          createdId = null;
          setOptions(prev => prev.filter(o => o.id !== deleted));
        }
      },
    };
    await executeCommand(cmd);
  };

  const deleteOption = async (optionId: string) => {
    const optionData = options.find(o => o.id === optionId);
    if (!optionData) return;
    let recreatedId: string | null = null;
    const cmd: Command = {
      description: "Delete option",
      execute: async () => {
        const toDelete = recreatedId || optionId;
        await api.options.delete(toDelete);
        recreatedId = null;
        setOptions(prev => prev.filter(o => o.id !== toDelete));
      },
      unexecute: async () => {
        const created = await api.options.create(id!, { title: optionData.title, sortOrder: optionData.sortOrder } as any);
        recreatedId = created.id;
        const newOutcomes = await Promise.all(
          optionData.outcomes.map(oc =>
            api.outcomes.create(created.id, { description: oc.description, probability: oc.probability, impact: oc.impact, sortOrder: oc.sortOrder } as any)
          )
        );
        setOptions(prev => [...prev, { ...created, outcomes: newOutcomes }].sort((a, b) => a.sortOrder - b.sortOrder));
      },
    };
    await executeCommand(cmd);
  };

  const updateOption = async (optionId: string, updates: Partial<Option>) => {
    await api.options.update(optionId, updates);
  };

  const addOutcome = async (optionId: string) => {
    const opt = options.find(o => o.id === optionId);
    const sortOrder = opt ? opt.outcomes.length : 0;
    let createdId: string | null = null;
    const cmd: Command = {
      description: "Add outcome",
      execute: async () => {
        const created = await api.outcomes.create(optionId, { description: "New outcome", probability: 50, impact: 0, sortOrder } as any);
        createdId = created.id;
        setOptions(prev => prev.map(o => o.id === optionId ? { ...o, outcomes: [...o.outcomes, created] } : o));
      },
      unexecute: async () => {
        if (createdId) {
          await api.outcomes.delete(createdId);
          const deleted = createdId;
          createdId = null;
          setOptions(prev => prev.map(o => o.id === optionId ? { ...o, outcomes: o.outcomes.filter(oc => oc.id !== deleted) } : o));
        }
      },
    };
    await executeCommand(cmd);
  };

  const updateOutcome = async (outcomeId: string, updates: Partial<Outcome>) => {
    await api.outcomes.update(outcomeId, updates);
  };

  const deleteOutcome = async (outcomeId: string) => {
    let outcomeData: Outcome | undefined;
    let parentOptionId: string | undefined;
    for (const opt of options) {
      const oc = opt.outcomes.find(o => o.id === outcomeId);
      if (oc) { outcomeData = oc; parentOptionId = opt.id; break; }
    }
    if (!outcomeData || !parentOptionId) return;
    let recreatedId: string | null = null;
    const cmd: Command = {
      description: "Delete outcome",
      execute: async () => {
        const toDelete = recreatedId || outcomeId;
        await api.outcomes.delete(toDelete);
        recreatedId = null;
        setOptions(prev => prev.map(o => o.id === parentOptionId ? { ...o, outcomes: o.outcomes.filter(oc => oc.id !== toDelete) } : o));
      },
      unexecute: async () => {
        const created = await api.outcomes.create(parentOptionId!, { description: outcomeData!.description, probability: outcomeData!.probability, impact: outcomeData!.impact, sortOrder: outcomeData!.sortOrder } as any);
        recreatedId = created.id;
        setOptions(prev => prev.map(o => o.id === parentOptionId ? { ...o, outcomes: [...o.outcomes, created].sort((a, b) => a.sortOrder - b.sortOrder) } : o));
      },
    };
    await executeCommand(cmd);
  };

  const reorderOutcomes = async (optionId: string, reordered: Outcome[]) => {
    setOptions(prev => prev.map(o => o.id === optionId ? { ...o, outcomes: reordered } : o));
    await Promise.all(reordered.map((oc, idx) => api.outcomes.update(oc.id, { sortOrder: idx } as any)));
  };

  const handleOptionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = options.findIndex(o => o.id === active.id);
    const newIndex = options.findIndex(o => o.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(options, oldIndex, newIndex);
    setOptions(reordered);
    Promise.all(reordered.map((opt, idx) => api.options.update(opt.id, { sortOrder: idx } as any)));
  };

  const reorderPremortems = async (reordered: Premortem[]) => {
    setPremortems(reordered);
    await Promise.all(reordered.map((pm, idx) => api.premortems.update(pm.id, { sortOrder: idx } as any)));
  };

  const addPremortem = async () => {
    if (!id) return;
    const sortOrder = premortems.length;
    let createdId: string | null = null;
    const cmd: Command = {
      description: "Add risk",
      execute: async () => {
        const created = await api.premortems.create(id, { reason: "New risk", severity: "moderate", frequency: "possible", sortOrder } as any);
        createdId = created.id;
        setPremortems(prev => [...prev, created]);
      },
      unexecute: async () => {
        if (createdId) {
          await api.premortems.delete(createdId);
          const deleted = createdId;
          createdId = null;
          setPremortems(prev => prev.filter(p => p.id !== deleted));
        }
      },
    };
    await executeCommand(cmd);
  };

  const updatePremortem = async (pmId: string, updates: Partial<Premortem>) => {
    await api.premortems.update(pmId, updates);
    setPremortems(prev => prev.map(p => p.id === pmId ? { ...p, ...updates } : p));
  };

  const deletePremortem = async (pmId: string) => {
    const pmData = premortems.find(p => p.id === pmId);
    if (!pmData) return;
    let recreatedId: string | null = null;
    const cmd: Command = {
      description: "Delete risk",
      execute: async () => {
        const toDelete = recreatedId || pmId;
        await api.premortems.delete(toDelete);
        recreatedId = null;
        setPremortems(prev => prev.filter(p => p.id !== toDelete));
      },
      unexecute: async () => {
        const created = await api.premortems.create(id!, { reason: pmData.reason, severity: pmData.severity, frequency: pmData.frequency, sortOrder: pmData.sortOrder } as any);
        recreatedId = created.id;
        setPremortems(prev => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
      },
    };
    await executeCommand(cmd);
  };

  const calcEV = (ocs: Outcome[]) =>
    ocs.reduce((sum, o) => sum + (Number(o.probability) / 100) * Number(o.impact), 0);

  const buildContext = () => ({
    title, context,
    options: options.map(o => ({
      title: o.title,
      outcomes: o.outcomes.map(oc => ({ description: oc.description, probability: oc.probability, impact: oc.impact })),
    })),
    premortems: premortems.map(p => ({ reason: p.reason, severity: p.severity })),
  });

  const autoGenerate = async () => {
    if (!id || !title.trim()) { toast({ title: "Enter a decision title first", variant: "destructive" }); return; }
    setGenerating(true);
    try {
      const { generated: gen } = await api.ai.assist("auto_generate", { title, context });
      if (!gen?.options) throw new Error("No data generated");
      const newOptions: (Option & { outcomes: Outcome[] })[] = [];
      for (let i = 0; i < gen.options.length; i++) {
        const opt = gen.options[i];
        const inserted = await api.options.create(id, { title: opt.title, description: opt.description || null, sort_order: options.length + i } as any);
        const newOutcomes: Outcome[] = [];
        if (inserted && opt.outcomes) {
          const created = await Promise.all(opt.outcomes.map((oc: any) =>
            api.outcomes.create(inserted.id, { description: oc.description, probability: Math.max(0, Math.min(100, oc.probability)), impact: Math.max(-10, Math.min(10, oc.impact)) } as any)
          ));
          newOutcomes.push(...created);
        }
        newOptions.push({ ...inserted, outcomes: newOutcomes });
      }
      setOptions(prev => [...prev, ...newOptions]);
      if (gen.premortems) {
        const newPms = await Promise.all(gen.premortems.map((pm: any) =>
          api.premortems.create(id, { reason: pm.reason, severity: pm.severity || "moderate" } as any)
        ));
        setPremortems(prev => [...prev, ...newPms]);
      }
      toast({ title: "AI generated options, outcomes & risks!" });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const suggestOption = async () => {
    if (!id) return;
    setSuggestingOption(true);
    try {
      const { generated: gen } = await api.ai.assist("suggest_options", buildContext());
      if (!gen?.title) throw new Error("No option generated");
      const inserted = await api.options.create(id, { title: gen.title, description: gen.description || null, sort_order: options.length } as any);
      const newOutcomes: Outcome[] = [];
      if (inserted && gen.outcomes) {
        const created = await Promise.all(gen.outcomes.map((oc: any) =>
          api.outcomes.create(inserted.id, { description: oc.description, probability: Math.max(0, Math.min(100, oc.probability)), impact: Math.max(-10, Math.min(10, oc.impact)) } as any)
        ));
        newOutcomes.push(...created);
      }
      setOptions(prev => [...prev, { ...inserted, outcomes: newOutcomes }]);
      toast({ title: `AI suggested: "${gen.title}"` });
    } catch (err: any) {
      toast({ title: "Suggestion failed", description: err.message, variant: "destructive" });
    } finally { setSuggestingOption(false); }
  };

  const suggestOutcomes = async (optionId: string) => {
    setSuggestingOutcomesFor(optionId);
    const opt = options.find(o => o.id === optionId);
    if (!opt) return;
    try {
      const { generated: gen } = await api.ai.assist("suggest_outcomes", { ...buildContext(), target_option_title: opt.title, target_option_outcomes: opt.outcomes.map(oc => ({ description: oc.description })) });
      if (!gen?.outcomes) throw new Error("No outcomes generated");
      const created = await Promise.all(gen.outcomes.map((oc: any) =>
        api.outcomes.create(optionId, { description: oc.description, probability: Math.max(0, Math.min(100, oc.probability)), impact: Math.max(-10, Math.min(10, oc.impact)) } as any)
      ));
      setOptions(prev => prev.map(o => o.id === optionId ? { ...o, outcomes: [...o.outcomes, ...created] } : o));
      toast({ title: `Added ${gen.outcomes.length} suggested outcomes` });
    } catch (err: any) {
      toast({ title: "Suggestion failed", description: err.message, variant: "destructive" });
    } finally { setSuggestingOutcomesFor(null); }
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
    } finally { setCheckingBiases(false); }
  };

  const suggestPremortems = async () => {
    if (!id) return;
    setSuggestingPremortems(true);
    try {
      const { generated: gen } = await api.ai.assist("suggest_premortems", buildContext());
      if (!gen?.premortems) throw new Error("No premortems generated");
      const newPms = await Promise.all(gen.premortems.map((pm: any) =>
        api.premortems.create(id, { reason: pm.reason, severity: pm.severity || "moderate" } as any)
      ));
      setPremortems(prev => [...prev, ...newPms]);
      toast({ title: `Added ${gen.premortems.length} potential risks` });
    } catch (err: any) {
      toast({ title: "Suggestion failed", description: err.message, variant: "destructive" });
    } finally { setSuggestingPremortems(false); }
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "options", label: "Options & Outcomes", icon: <Target className="w-4 h-4" /> },
    { key: "premortem", label: "Premortem", icon: <Shield className="w-4 h-4" /> },
    { key: "review", label: "Review", icon: <CheckCircle2 className="w-4 h-4" /> },
    { key: "actual", label: "Actual Outcome", icon: <ClipboardCheck className="w-4 h-4" /> },
  ];

  if (!decision) return null;

  const sortedByEV = [...options].sort((a, b) => calcEV(b.outcomes) - calcEV(a.outcomes));

  const sortedPremortems = [...premortems].sort((a, b) =>
    getRiskScore(b.frequency || "possible", b.severity || "moderate") -
    getRiskScore(a.frequency || "possible", a.severity || "moderate")
  );

  const riskCountByImpact = ["severe", "significant", "moderate", "minor", "negligible"].map(imp => ({
    impact: imp,
    count: premortems.filter(p => (p.severity || "moderate") === imp).length,
  }));

  const topRisks = sortedPremortems.slice(0, 5);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        <div className={`flex-1 transition-all flex flex-col ${showAi ? "mr-80 lg:mr-96" : ""}`}>
          <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-10">
            <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!canUndo}
                  onClick={handleUndo}
                  title="Undo (Ctrl+Z)"
                  data-testid="button-undo"
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!canRedo}
                  onClick={handleRedo}
                  title="Redo (Ctrl+Shift+Z)"
                  data-testid="button-redo"
                >
                  <Redo2 className="w-4 h-4" />
                </Button>
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
                      <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={deleteDecision} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                        {deleting ? "Deleting…" : "Delete"}
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

          <div className="max-w-5xl mx-auto px-4 py-6 space-y-6 flex-1 w-full">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">What decision are you making?</p>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={saveDecision}
                  className="text-2xl font-bold border-none bg-transparent px-0 focus-visible:ring-0 h-auto"
                  placeholder="e.g. Should I accept the job offer?"
                  data-testid="input-decision-title"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Context &amp; constraints</p>
                <Textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  onBlur={saveDecision}
                  className="border-none bg-transparent px-0 focus-visible:ring-0 resize-none text-muted-foreground"
                  placeholder="What's the situation? Any key constraints or trade-offs to keep in mind?"
                  rows={2}
                  data-testid="input-decision-context"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={autoGenerate} disabled={generating || !title.trim()} data-testid="button-auto-generate">
                  {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                  {generating ? "Generating..." : "Auto-Generate with AI"}
                </Button>
                <Button variant="outline" onClick={checkBiases} disabled={checkingBiases || options.length === 0} data-testid="button-check-biases">
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
                  data-testid={`button-tab-${t.key}`}
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
                          onReorderOutcomes={(reordered) => reorderOutcomes(option.id, reordered)}
                          onSuggestOutcomes={suggestOutcomes}
                          suggestingOutcomes={suggestingOutcomesFor === option.id}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                  <div className="flex gap-2">
                    <Button variant="workspace" onClick={addOption} className="flex-1 py-6" data-testid="button-add-option">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Option
                    </Button>
                    <Button variant="workspace" onClick={suggestOption} disabled={suggestingOption || !title.trim()} className="flex-1 py-6" data-testid="button-suggest-option">
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
                      <TrendingUp className="w-5 h-5 text-primary" />
                      Expected Value Summary
                    </h3>
                    {options.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Add options in the Options tab to compare expected values.</p>
                    ) : (
                      <div className="space-y-3">
                        {sortedByEV.map((opt, i) => {
                          const ev = calcEV(opt.outcomes);
                          const maxAbsEV = Math.max(...sortedByEV.map(o => Math.abs(calcEV(o.outcomes))), 0.01);
                          const barWidth = (Math.abs(ev) / maxAbsEV) * 100;
                          return (
                            <div key={opt.id} className={`p-3 rounded-lg border space-y-2 ${i === 0 ? "border-primary/50 bg-primary/5" : "border-border"}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {i === 0 && <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Best EV</span>}
                                  <span className="font-medium text-sm">{opt.title}</span>
                                </div>
                                <span className={`font-mono text-sm font-semibold ${ev >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                                  EV: {ev.toFixed(2)}
                                </span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${ev >= 0 ? "bg-green-500" : "bg-destructive"}`} style={{ width: `${barWidth}%` }} />
                              </div>
                              {opt.outcomes.length > 0 && (
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                  {opt.outcomes.map(oc => (
                                    <div key={oc.id} className="flex justify-between">
                                      <span className="truncate max-w-xs">{oc.description}</span>
                                      <span className="font-mono ml-2 shrink-0">{Number(oc.probability)}% × {Number(oc.impact) >= 0 ? "+" : ""}{Number(oc.impact)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="glass-panel p-6 space-y-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                      Risk Summary
                    </h3>
                    {premortems.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Add premortem risks in the Premortem tab to see them summarized here.</p>
                    ) : (
                      <div className="space-y-3">
                        {topRisks.length > 0 && (
                          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
                            <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Highest Risk Items</p>
                            {topRisks.map(pm => {
                              const rs = getRiskScore(pm.frequency || "possible", pm.severity || "moderate");
                              return (
                                <div key={pm.id} className="flex items-start gap-2 text-sm">
                                  <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-bold mt-0.5 ${rs >= 20 ? "bg-destructive/20 text-destructive" : rs >= 12 ? "bg-destructive/10 text-destructive" : rs >= 6 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                                    {rs}
                                  </span>
                                  <span className="text-muted-foreground leading-snug text-xs">{pm.reason}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="grid grid-cols-5 gap-2 text-center">
                          {riskCountByImpact.map(({ impact, count }) => (
                            <div key={impact} className={`p-2 rounded-lg border ${
                              impact === "severe" ? "border-destructive/40 bg-destructive/10" :
                              impact === "significant" ? "border-destructive/20 bg-destructive/5" :
                              impact === "moderate" ? "border-warning/30 bg-warning/5" :
                              "border-border bg-muted/30"
                            }`}>
                              <p className="text-lg font-bold">{count}</p>
                              <p className="text-xs text-muted-foreground capitalize leading-tight">{impact}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {tab === "actual" && (
                <motion.div key="actual" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                  <div className="glass-panel p-6 space-y-5">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-primary" />
                      Actual Outcome
                    </h3>
                    <p className="text-sm text-muted-foreground">Record what actually happened after making this decision to close the feedback loop.</p>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">When did you make the decision?</label>
                      <Input
                        type="date"
                        value={decision.outcomeDate ? decision.outcomeDate.split("T")[0] : ""}
                        onChange={(e) => setDecision({ ...decision, outcomeDate: e.target.value || null })}
                        onBlur={() => id && api.decisions.update(id, { outcomeDate: decision.outcomeDate || null } as any)}
                        className="max-w-xs"
                        data-testid="input-outcome-date"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">Which option did you choose?</label>
                      <select
                        value={decision.chosenOptionId || ""}
                        onChange={(e) => {
                          const val = e.target.value || null;
                          setDecision({ ...decision, chosenOptionId: val });
                          if (id) api.decisions.update(id, { chosenOptionId: val } as any);
                        }}
                        className="h-9 px-3 rounded-md border border-input bg-background text-sm w-full max-w-xs"
                        data-testid="select-chosen-option"
                      >
                        <option value="">— Select an option —</option>
                        {options.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.title}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">What actually happened?</label>
                      <Textarea
                        value={decision.actualOutcome || ""}
                        onChange={(e) => setDecision({ ...decision, actualOutcome: e.target.value })}
                        onBlur={() => id && api.decisions.update(id, { actualOutcome: decision.actualOutcome })}
                        placeholder="Describe what actually happened after you made the decision..."
                        rows={4}
                        data-testid="input-actual-outcome"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">Reflection</label>
                      <Textarea
                        value={decision.reflection || ""}
                        onChange={(e) => setDecision({ ...decision, reflection: e.target.value })}
                        onBlur={() => id && api.decisions.update(id, { reflection: decision.reflection })}
                        placeholder="What did you learn? Was the process useful? Would you make the same decision again?"
                        rows={3}
                        data-testid="input-reflection"
                      />
                    </div>
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

function getImpactColorClass(severity: string) {
  if (severity === "severe") return "bg-destructive/20 text-destructive";
  if (severity === "significant") return "bg-destructive/10 text-destructive";
  if (severity === "moderate") return "bg-warning/10 text-warning";
  return "bg-muted text-muted-foreground";
}
