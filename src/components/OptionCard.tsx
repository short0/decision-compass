import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Database } from "@/integrations/supabase/types";

type Option = Database["public"]["Tables"]["options"]["Row"];
type Outcome = Database["public"]["Tables"]["outcomes"]["Row"];

interface Props {
  option: Option & { outcomes: Outcome[] };
  index: number;
  ev: number;
  onUpdate: (id: string, updates: Partial<Option>) => void;
  onDelete: () => void;
  onAddOutcome: () => void;
  onUpdateOutcome: (id: string, updates: Partial<Outcome>) => void;
  onDeleteOutcome: (id: string) => void;
}

export default function OptionCard({
  option, index, ev, onUpdate, onDelete,
  onAddOutcome, onUpdateOutcome, onDeleteOutcome,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [title, setTitle] = useState(option.title);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="glass-panel overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <span className="text-xs font-mono text-muted-foreground w-6">#{index + 1}</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => onUpdate(option.id, { title })}
            className="border-none bg-transparent px-0 focus-visible:ring-0 font-semibold h-auto text-base"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-sm font-semibold ${ev >= 0 ? "text-success" : "text-destructive"}`}>
            EV: {ev.toFixed(2)}
          </span>
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
              {/* Column headers */}
              {option.outcomes.length > 0 && (
                <div className="grid grid-cols-[1fr_100px_100px_32px] gap-2 text-xs text-muted-foreground font-mono px-1">
                  <span>Outcome</span>
                  <span className="text-center">Prob %</span>
                  <span className="text-center">Impact</span>
                  <span />
                </div>
              )}
              {option.outcomes.map((oc) => (
                <OutcomeRow
                  key={oc.id}
                  outcome={oc}
                  onUpdate={onUpdateOutcome}
                  onDelete={onDeleteOutcome}
                />
              ))}
              <Button variant="ghost" size="sm" onClick={onAddOutcome} className="text-xs">
                <Plus className="w-3 h-3 mr-1" />
                Add Outcome
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function OutcomeRow({
  outcome,
  onUpdate,
  onDelete,
}: {
  outcome: Outcome;
  onUpdate: (id: string, updates: Partial<Outcome>) => void;
  onDelete: (id: string) => void;
}) {
  const [desc, setDesc] = useState(outcome.description);
  const [prob, setProb] = useState(String(outcome.probability));
  const [impact, setImpact] = useState(String(outcome.impact));

  return (
    <div className="grid grid-cols-[1fr_100px_100px_32px] gap-2 items-center">
      <Input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() => onUpdate(outcome.id, { description: desc })}
        className="h-8 text-sm"
        placeholder="Describe outcome..."
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
  );
}
