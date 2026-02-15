import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, ChevronDown, ChevronUp, Sparkles, Loader2, GripVertical } from "lucide-react";
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
} from "@dnd-kit/sortable";
import type { Database } from "@/integrations/supabase/types";

type Option = Database["public"]["Tables"]["options"]["Row"];
type Outcome = Database["public"]["Tables"]["outcomes"]["Row"];

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
  onDeleteOutcome: (id: string) => void;
  onReorderOutcomes: (activeId: string, overId: string) => void;
  onSuggestOutcomes: (optionId: string) => void;
  suggestingOutcomes: boolean;
}

export default function OptionCard({
  option, index, totalOptions, ev, biases, onUpdate, onDelete,
  onAddOutcome, onUpdateOutcome, onDeleteOutcome,
  onReorderOutcomes, onSuggestOutcomes, suggestingOutcomes,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [title, setTitle] = useState(option.title);

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
    opacity: isDragging ? 0.5 : 1,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleOutcomeDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderOutcomes(String(active.id), String(over.id));
    }
  };

  const optionBias = biases.find(
    b => b.target_type === "option" && option.title.toLowerCase().includes(b.target_label.toLowerCase().slice(0, 20))
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`glass-panel overflow-visible ${optionBias ? "ring-1 ring-warning/50" : ""}`}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full cursor-help whitespace-nowrap">
                    ⚠ {optionBias.bias_name}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-sm font-semibold mb-1">{optionBias.bias_name}</p>
                  <p className="text-xs">{optionBias.explanation}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`font-mono text-sm font-semibold cursor-help ${ev >= 0 ? "text-success" : "text-destructive"}`}>
                EV: {ev.toFixed(2)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-sm font-semibold mb-1">Expected Value (EV)</p>
              <p className="text-xs text-muted-foreground">Sum of each outcome's probability × impact. Higher EV = better risk-adjusted choice.</p>
            </TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>

      {/* Outcomes */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {option.outcomes.length > 0 && (
                <div className="hidden sm:grid grid-cols-[24px_1fr_80px_80px_32px] gap-2 text-xs text-muted-foreground font-mono px-1">
                  <span />
                  <span>Outcome</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-center cursor-help underline decoration-dotted">Prob %</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-sm font-semibold mb-1">Probability (0–100%)</p>
                      <p className="text-xs text-muted-foreground">How likely this outcome is to occur. All probabilities for an option should sum to 100%.</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-center cursor-help underline decoration-dotted">Impact</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-sm font-semibold mb-1">Impact (−10 to +10)</p>
                      <p className="text-xs text-muted-foreground">How good or bad this outcome would be. Negative = harmful, positive = beneficial.</p>
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
                  items={option.outcomes.map(o => o.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {option.outcomes.map((oc) => (
                    <SortableOutcomeRow
                      key={oc.id}
                      outcome={oc}
                      bias={biases.find(
                        b => b.target_type === "outcome" && oc.description.toLowerCase().includes(b.target_label.toLowerCase().slice(0, 20))
                      )}
                      onUpdate={onUpdateOutcome}
                      onDelete={onDeleteOutcome}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <div className="flex gap-2">
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
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
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
  onDelete,
}: {
  outcome: Outcome;
  bias?: BiasAnnotation;
  onUpdate: (id: string, updates: Partial<Outcome>) => void;
  onDelete: (id: string) => void;
}) {
  const [desc, setDesc] = useState(outcome.description);
  const [prob, setProb] = useState(String(outcome.probability));
  const [impact, setImpact] = useState(String(outcome.impact));

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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      {/* Desktop layout */}
      <div className="hidden sm:grid grid-cols-[24px_1fr_80px_80px_32px] gap-2 items-center">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        >
          <GripVertical className="w-3 h-3" />
        </button>
        <Textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => onUpdate(outcome.id, { description: desc })}
          className={`min-h-[36px] text-sm resize-none ${bias ? "border-warning/50" : ""}`}
          placeholder="Describe outcome..."
          rows={1}
        />
        <Input
          type="number"
          min={0}
          max={100}
          value={prob}
          onChange={(e) => setProb(e.target.value)}
          onBlur={() => onUpdate(outcome.id, { probability: Number(prob) })}
          className="h-8 text-sm text-center font-mono"
        />
        <Input
          type="number"
          min={-10}
          max={10}
          step={0.5}
          value={impact}
          onChange={(e) => setImpact(e.target.value)}
          onBlur={() => onUpdate(outcome.id, { impact: Number(impact) })}
          className="h-8 text-sm text-center font-mono"
        />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(outcome.id)}>
          <Trash2 className="w-3 h-3 text-muted-foreground" />
        </Button>
      </div>
      {/* Mobile layout */}
      <div className="sm:hidden space-y-2 p-2 border border-border rounded-md">
        <div className="flex items-center justify-between">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(outcome.id)}>
            <Trash2 className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>
        <Textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={() => onUpdate(outcome.id, { description: desc })}
          className={`min-h-[36px] text-sm resize-none ${bias ? "border-warning/50" : ""}`}
          placeholder="Describe outcome..."
          rows={2}
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Prob %</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={prob}
              onChange={(e) => setProb(e.target.value)}
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
              onChange={(e) => setImpact(e.target.value)}
              onBlur={() => onUpdate(outcome.id, { impact: Number(impact) })}
              className="h-8 text-sm text-center font-mono"
            />
          </div>
        </div>
      </div>
      {bias && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full cursor-help ml-1">
              ⚠ {bias.bias_name}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-sm font-semibold mb-1">{bias.bias_name}</p>
            <p className="text-xs">{bias.explanation}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}