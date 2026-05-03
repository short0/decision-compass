import { useState, useRef, useLayoutEffect, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, ChevronDown, ChevronUp, Sparkles, GripVertical, AlertCircle } from "lucide-react";
import CompassSpinner from "@/components/CompassSpinner";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { Option, Outcome } from "@/lib/api";

export interface BiasAnnotation {
  bias_name: string;
  target_type: "option" | "outcome" | "premortem" | "general";
  target_label: string;
  explanation: string;
}

interface Props {
  option: Option & { outcomes: Outcome[] };
  index: number;
  totalOptions: number;
  ev: number;
  biases: BiasAnnotation[];
  onUpdate: (id: string, updates: Partial<Option>) => void;
  onDelete: () => void;
  onAddOutcome: () => void;
  onUpdateOutcome: (id: string, updates: Partial<Outcome>) => void;
  onUpdateOutcomeLive: (id: string, updates: Partial<Outcome>) => void;
  onDeleteOutcome: (id: string) => void;
  onReorderOutcomes: (reordered: Outcome[]) => void;
  onSuggestOutcomes: (optionId: string) => void;
  suggestingOutcomes: boolean;
}

function useAutoResize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

export default function OptionCard({
  option, index, totalOptions, ev, biases, onUpdate, onDelete,
  onAddOutcome, onUpdateOutcome, onUpdateOutcomeLive, onDeleteOutcome,
  onReorderOutcomes, onSuggestOutcomes, suggestingOutcomes,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [overflowVisible, setOverflowVisible] = useState(false);
  const [title, setTitle] = useState(option.title);
  const [localOutcomes, setLocalOutcomes] = useState(option.outcomes);

  useEffect(() => {
    setLocalOutcomes(option.outcomes);
  }, [option.outcomes]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleOutcomeDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localOutcomes.findIndex(o => o.id === active.id);
    const newIndex = localOutcomes.findIndex(o => o.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(localOutcomes, oldIndex, newIndex);
    setLocalOutcomes(reordered);
    onReorderOutcomes(reordered);
  };

  const probSum = useMemo(
    () => localOutcomes.reduce((s, oc) => s + Number(oc.probability), 0),
    [localOutcomes]
  );
  const showProbWarning = localOutcomes.length > 0 && probSum !== 100;

  const optionBias = biases.find(
    b => b.target_type === "option" && option.title.toLowerCase().includes(b.target_label.toLowerCase().slice(0, 20))
  );

  const handleExpandToggle = () => {
    if (expanded) {
      setOverflowVisible(false);
      setExpanded(false);
    } else {
      setExpanded(true);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`glass-panel group ${optionBias ? "ring-1 ring-warning/50" : ""}`}
    >
      <div className="p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">#{index + 1}</span>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => onUpdate(option.id, { title })}
              className="border-none bg-transparent px-0 focus-visible:ring-0 font-semibold h-auto text-base"
            />
            {optionBias && (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full cursor-help whitespace-nowrap shrink-0">
                    ⚠ {optionBias.bias_name}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px] z-[100]" sideOffset={4}>
                  <p className="text-sm font-semibold mb-1">{optionBias.bias_name}</p>
                  <p className="text-xs leading-relaxed break-words">{optionBias.explanation}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <span className={`font-mono text-sm font-semibold cursor-help ${ev >= 0 ? "text-success" : "text-destructive"}`}>
                EV: {ev.toFixed(2)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[280px] z-[100]" sideOffset={4}>
              <p className="text-sm font-semibold mb-1">Expected Value (EV)</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Sum of each outcome's probability × impact. Higher EV = better risk-adjusted choice.</p>
            </TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon" onClick={handleExpandToggle}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            style={{ overflow: overflowVisible ? "visible" : "hidden" }}
            onAnimationComplete={() => setOverflowVisible(true)}
          >
            <div className="px-4 pb-4 space-y-2">
              {localOutcomes.length > 0 && (
                <div className="hidden sm:grid grid-cols-[24px_1fr_80px_80px_32px] gap-2 text-xs text-muted-foreground font-mono px-1">
                  <span />
                  <span>Outcome</span>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <span className="text-center cursor-help underline decoration-dotted">Prob %</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px] z-[100]" sideOffset={4}>
                      <p className="text-sm font-semibold mb-1">Probability (0–100%)</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">How likely this outcome is to occur. All probabilities for an option should sum to 100%.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <span className="text-center cursor-help underline decoration-dotted">Impact</span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[280px] z-[100]" sideOffset={4}>
                      <p className="text-sm font-semibold mb-1">Impact (−10 to +10)</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">How good or bad this outcome would be. Negative = harmful, positive = beneficial.</p>
                    </TooltipContent>
                  </Tooltip>
                  <span />
                </div>
              )}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleOutcomeDragEnd}
              >
                <SortableContext
                  items={localOutcomes.map(o => o.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {localOutcomes.map((oc) => (
                    <SortableOutcomeRow
                      key={oc.id}
                      outcome={oc}
                      bias={biases.find(
                        b => b.target_type === "outcome" && oc.description.toLowerCase().includes(b.target_label.toLowerCase().slice(0, 20))
                      )}
                      onUpdate={onUpdateOutcome}
                      onUpdateLive={onUpdateOutcomeLive}
                      onDelete={onDeleteOutcome}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {showProbWarning && (
                <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-md px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Probabilities sum to <span className="font-mono font-semibold">{probSum}%</span> — ideally they should add up to <span className="font-mono font-semibold">100%</span>.
                  </span>
                </div>
              )}
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" onClick={onAddOutcome} className="text-xs">
                  <Plus className="w-3 h-3 mr-1" />
                  Add Outcome
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSuggestOutcomes(option.id)}
                  disabled={suggestingOutcomes}
                  className="text-xs text-primary"
                >
                  {suggestingOutcomes ? (
                    <CompassSpinner size={12} />
                  ) : (
                    <Sparkles className="w-3 h-3 mr-1" />
                  )}
                  Suggest Outcomes
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SortableOutcomeRow({
  outcome,
  bias,
  onUpdate,
  onUpdateLive,
  onDelete,
}: {
  outcome: Outcome;
  bias?: BiasAnnotation;
  onUpdate: (id: string, updates: Partial<Outcome>) => void;
  onUpdateLive: (id: string, updates: Partial<Outcome>) => void;
  onDelete: (id: string) => void;
}) {
  const [desc, setDesc] = useState(outcome.description);
  const [prob, setProb] = useState(String(outcome.probability));
  const [impact, setImpact] = useState(String(outcome.impact));

  useEffect(() => {
    setDesc(outcome.description);
    setProb(String(outcome.probability));
    setImpact(String(outcome.impact));
  }, [outcome.description, outcome.probability, outcome.impact]);

  const descRef = useAutoResize(desc);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: outcome.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-1 group/row">
      <div className="hidden sm:grid grid-cols-[24px_1fr_80px_80px_32px] gap-2 items-start">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none mt-2 opacity-0 group-hover/row:opacity-100 transition-opacity"
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <textarea
          ref={descRef}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => onUpdate(outcome.id, { description: desc })}
          className={`w-full text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring leading-snug ${bias ? "border-warning/50" : ""}`}
          placeholder="Describe outcome..."
          style={{ overflowY: "hidden", minHeight: "36px" }}
        />
        <Input
          type="number"
          min={0}
          max={100}
          value={prob}
          onChange={(e) => { setProb(e.target.value); onUpdateLive(outcome.id, { probability: Number(e.target.value) }); }}
          onBlur={() => onUpdate(outcome.id, { probability: Number(prob) })}
          className="h-9 text-sm text-center font-mono"
        />
        <Input
          type="number"
          min={-10}
          max={10}
          step={0.5}
          value={impact}
          onChange={(e) => { setImpact(e.target.value); onUpdateLive(outcome.id, { impact: Number(e.target.value) }); }}
          onBlur={() => onUpdate(outcome.id, { impact: Number(impact) })}
          className="h-9 text-sm text-center font-mono"
        />
        <Button variant="ghost" size="icon" className="h-9 w-8 mt-0 opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={() => onDelete(outcome.id)}>
          <Trash2 className="w-3 h-3 text-muted-foreground" />
        </Button>
      </div>
      <div className="sm:hidden space-y-2 p-2 border border-border rounded-md">
        <div className="flex items-center justify-between">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground touch-none opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={() => onDelete(outcome.id)}>
            <Trash2 className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => onUpdate(outcome.id, { description: desc })}
          className={`w-full text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring leading-snug ${bias ? "border-warning/50" : ""}`}
          placeholder="Describe outcome..."
          style={{ overflowY: "hidden", minHeight: "54px" }}
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Prob %</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={prob}
              onChange={(e) => { setProb(e.target.value); onUpdateLive(outcome.id, { probability: Number(e.target.value) }); }}
              onBlur={() => onUpdate(outcome.id, { probability: Number(prob) })}
              className="h-8 text-sm text-center font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Impact</label>
            <Input
              type="number"
              min={-10}
              max={10}
              step={0.5}
              value={impact}
              onChange={(e) => { setImpact(e.target.value); onUpdateLive(outcome.id, { impact: Number(e.target.value) }); }}
              onBlur={() => onUpdate(outcome.id, { impact: Number(impact) })}
              className="h-8 text-sm text-center font-mono"
            />
          </div>
        </div>
      </div>
      {bias && (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full cursor-help ml-1 inline-block">
              ⚠ {bias.bias_name}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[300px] z-[100]" sideOffset={4}>
            <p className="text-sm font-semibold mb-1">{bias.bias_name}</p>
            <p className="text-xs leading-relaxed break-words">{bias.explanation}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
