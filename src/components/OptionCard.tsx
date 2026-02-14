import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, ChevronDown, ChevronUp, Sparkles, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddOutcome: () => void;
  onUpdateOutcome: (id: string, updates: Partial<Outcome>) => void;
  onDeleteOutcome: (id: string) => void;
  onMoveOutcomeUp: (outcomeId: string) => void;
  onMoveOutcomeDown: (outcomeId: string) => void;
  onSuggestOutcomes: (optionId: string) => void;
  suggestingOutcomes: boolean;
}

export default function OptionCard({
  option, index, totalOptions, ev, biases, onUpdate, onDelete,
  onMoveUp, onMoveDown,
  onAddOutcome, onUpdateOutcome, onDeleteOutcome,
  onMoveOutcomeUp, onMoveOutcomeDown,
  onSuggestOutcomes, suggestingOutcomes,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [title, setTitle] = useState(option.title);

  const optionBias = biases.find(
    b => b.target_type === "option" && option.title.toLowerCase().includes(b.target_label.toLowerCase().slice(0, 20))
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`glass-panel overflow-hidden ${optionBias ? "ring-1 ring-warning/50" : ""}`}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex flex-col">
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onMoveUp} disabled={index === 0}>
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onMoveDown} disabled={index === totalOptions - 1}>
              <ArrowDown className="w-3 h-3" />
            </Button>
          </div>
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
                <TooltipContent side="bottom" className="max-w-xs z-50">
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
                <div className="hidden sm:grid grid-cols-[auto_1fr_80px_80px_32px] gap-2 text-xs text-muted-foreground font-mono px-1">
                  <span className="w-14" />
                  <span>Outcome</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-center cursor-help underline decoration-dotted">Prob %</span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-sm font-semibold mb-1">Probability (0–100%)</p>
                      <p className="text-xs text-muted-foreground">How likely this outcome is to occur. All probabilities for an option should ideally sum to ~100%.</p>
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
              {option.outcomes.map((oc, oci) => (
                <OutcomeRow
                  key={oc.id}
                  outcome={oc}
                  index={oci}
                  totalOutcomes={option.outcomes.length}
                  bias={biases.find(
                    b => b.target_type === "outcome" && oc.description.toLowerCase().includes(b.target_label.toLowerCase().slice(0, 20))
                  )}
                  onUpdate={onUpdateOutcome}
                  onDelete={onDeleteOutcome}
                  onMoveUp={() => onMoveOutcomeUp(oc.id)}
                  onMoveDown={() => onMoveOutcomeDown(oc.id)}
                />
              ))}
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
    </motion.div>
  );
}

function OutcomeRow({
  outcome,
  index,
  totalOutcomes,
  bias,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  outcome: Outcome;
  index: number;
  totalOutcomes: number;
  bias?: BiasAnnotation;
  onUpdate: (id: string, updates: Partial<Outcome>) => void;
  onDelete: (id: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [desc, setDesc] = useState(outcome.description);
  const [prob, setProb] = useState(String(outcome.probability));
  const [impact, setImpact] = useState(String(outcome.impact));

  return (
    <div className="space-y-1">
      {/* Desktop layout */}
      <div className="hidden sm:grid grid-cols-[auto_1fr_80px_80px_32px] gap-2 items-center">
        <div className="flex flex-col w-14">
          <Button variant="ghost" size="icon" className="h-4 w-4" onClick={onMoveUp} disabled={index === 0}>
            <ArrowUp className="w-2.5 h-2.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-4 w-4" onClick={onMoveDown} disabled={index === totalOutcomes - 1}>
            <ArrowDown className="w-2.5 h-2.5" />
          </Button>
        </div>
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
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={index === 0}>
              <ArrowUp className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={index === totalOutcomes - 1}>
              <ArrowDown className="w-3 h-3" />
            </Button>
          </div>
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
          <TooltipContent side="bottom" className="max-w-xs z-50">
            <p className="text-sm font-semibold mb-1">{bias.bias_name}</p>
            <p className="text-xs">{bias.explanation}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
