import { useState, useLayoutEffect, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, AlertTriangle, Sparkles, Loader2, GripVertical } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Option, Premortem } from "@/lib/api";
import type { BiasAnnotation } from "@/components/OptionCard";

// Frequency: stored in the `frequency` column
// Severity: stored in the `severity` column

export const FREQUENCY_OPTIONS = [
  { value: "very unlikely", label: "Very Unlikely", score: 1 },
  { value: "unlikely", label: "Unlikely", score: 2 },
  { value: "possible", label: "Possible", score: 3 },
  { value: "likely", label: "Likely", score: 4 },
  { value: "very likely", label: "Very Likely", score: 5 },
];

export const SEVERITY_OPTIONS = [
  { value: "negligible", label: "Negligible", score: 1 },
  { value: "minor", label: "Minor", score: 2 },
  { value: "moderate", label: "Moderate", score: 3 },
  { value: "significant", label: "Significant", score: 4 },
  { value: "severe", label: "Severe", score: 5 },
];

export function getFrequencyScore(value: string) {
  return FREQUENCY_OPTIONS.find(o => o.value === value)?.score ?? 3;
}

export function getSeverityScore(value: string) {
  return SEVERITY_OPTIONS.find(o => o.value === value)?.score ?? 3;
}

export function getRiskScore(frequency: string, severity: string) {
  return getFrequencyScore(frequency) * getSeverityScore(severity);
}

function riskColor(score: number) {
  if (score >= 20) return "bg-destructive/20 text-destructive border-destructive/40";
  if (score >= 12) return "bg-destructive/10 text-destructive border-destructive/20";
  if (score >= 6) return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground border-border";
}

function frequencyColor(value: string) {
  const score = getFrequencyScore(value);
  if (score >= 4) return "bg-destructive/10 text-destructive border-destructive/20";
  if (score === 3) return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground border-border";
}

function severityColor(value: string) {
  const score = getSeverityScore(value);
  if (score >= 4) return "bg-destructive/10 text-destructive border-destructive/20";
  if (score === 3) return "bg-warning/10 text-warning border-warning/20";
  return "bg-muted text-muted-foreground border-border";
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

interface Props {
  premortems: Premortem[];
  options: Option[];
  biases: BiasAnnotation[];
  onAdd: (optionId?: string) => void;
  onUpdate: (id: string, updates: Partial<Premortem>) => void;
  onDelete: (id: string) => void;
  onReorder: (reordered: Premortem[]) => void;
  onSuggestPremortems: () => void;
  suggestingPremortems: boolean;
}

export default function PremortermPanel({ premortems, options, biases, onAdd, onUpdate, onDelete, onReorder, onSuggestPremortems, suggestingPremortems }: Props) {
  const [localPremortems, setLocalPremortems] = useState(premortems);

  useEffect(() => {
    setLocalPremortems(premortems);
  }, [premortems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localPremortems.findIndex(p => p.id === active.id);
    const newIndex = localPremortems.findIndex(p => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(localPremortems, oldIndex, newIndex);
    setLocalPremortems(reordered);
    onReorder(reordered);
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h3 className="font-semibold text-lg">Premortem Analysis</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Imagine this decision has already failed. What went wrong? For each risk, rate Frequency (1–5) × Severity (1–5) to get a Risk Score.
        </p>

        {localPremortems.length > 0 && (
          <div className="hidden sm:grid grid-cols-[24px_1fr_130px_130px_56px_36px] gap-2 text-xs text-muted-foreground font-mono px-1">
            <span />
            <span>Risk / Failure Reason</span>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <span className="text-center cursor-help underline decoration-dotted">Frequency</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] z-[100]">
                <p className="text-sm font-semibold mb-1">Frequency (1–5)</p>
                <p className="text-xs text-muted-foreground">How probable is this failure mode?</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <span className="text-center cursor-help underline decoration-dotted">Severity</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] z-[100]">
                <p className="text-sm font-semibold mb-1">Severity (1–5)</p>
                <p className="text-xs text-muted-foreground">How severe would the damage be?</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <span className="text-center cursor-help underline decoration-dotted">Risk</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] z-[100]">
                <p className="text-sm font-semibold mb-1">Risk Score (1–25)</p>
                <p className="text-xs text-muted-foreground">Frequency × Severity. ≥20 = critical, ≥12 = high, ≥6 = medium.</p>
              </TooltipContent>
            </Tooltip>
            <span />
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localPremortems.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {localPremortems.map((pm) => (
                <SortablePremortermRow
                  key={pm.id}
                  premortem={pm}
                  options={options}
                  bias={biases.find(
                    b => b.target_type === "premortem" && pm.reason.toLowerCase().includes(b.target_label.toLowerCase().slice(0, 20))
                  )}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex gap-2">
          <Button variant="workspace" onClick={() => onAdd()} className="flex-1">
            <Plus className="w-4 h-4 mr-1" />
            Add Risk
          </Button>
          <Button
            variant="workspace"
            onClick={onSuggestPremortems}
            disabled={suggestingPremortems}
            className="flex-1"
          >
            {suggestingPremortems ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-1" />
            )}
            {suggestingPremortems ? "Suggesting..." : "Suggest with AI"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SortablePremortermRow({
  premortem,
  options,
  bias,
  onUpdate,
  onDelete,
}: {
  premortem: Premortem;
  options: Option[];
  bias?: BiasAnnotation;
  onUpdate: (id: string, updates: Partial<Premortem>) => void;
  onDelete: (id: string) => void;
}) {
  const [reason, setReason] = useState(premortem.reason);

  useEffect(() => {
    setReason(premortem.reason);
  }, [premortem.reason]);

  const reasonRef = useAutoResize(reason);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: premortem.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const frequency = premortem.frequency || "possible";
  const severity = premortem.severity || "moderate";
  const riskScore = getRiskScore(frequency, severity);

  return (
    <div ref={setNodeRef} style={style} className="space-y-1 group">
      {/* Desktop layout */}
      <div className="hidden sm:grid grid-cols-[24px_1fr_130px_130px_56px_36px] gap-2 items-start">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <textarea
          ref={reasonRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => onUpdate(premortem.id, { reason })}
          className={`w-full text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring leading-snug ${bias ? "border-warning/50" : ""}`}
          style={{ overflowY: "hidden", minHeight: "36px" }}
        />
        <select
          value={frequency}
          onChange={(e) => onUpdate(premortem.id, { frequency: e.target.value })}
          className={`h-9 px-2 rounded-md text-xs font-medium border cursor-pointer shrink-0 w-full ${frequencyColor(frequency)}`}
        >
          {FREQUENCY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label} ({o.score})</option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => onUpdate(premortem.id, { severity: e.target.value })}
          className={`h-9 px-2 rounded-md text-xs font-medium border cursor-pointer shrink-0 w-full ${severityColor(severity)}`}
        >
          {SEVERITY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label} ({o.score})</option>
          ))}
        </select>
        <div className={`h-9 flex items-center justify-center rounded-md border text-xs font-bold ${riskColor(riskScore)}`}>
          {riskScore}
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDelete(premortem.id)}>
          <Trash2 className="w-3 h-3 text-muted-foreground" />
        </Button>
      </div>

      {/* Mobile layout */}
      <div className="sm:hidden space-y-2 p-3 border border-border rounded-md">
        <div className="flex items-center justify-between">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground touch-none opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${riskColor(riskScore)}`}>
              Risk: {riskScore}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onDelete(premortem.id)}>
              <Trash2 className="w-3 h-3 text-muted-foreground" />
            </Button>
          </div>
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => onUpdate(premortem.id, { reason })}
          className={`w-full text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring leading-snug ${bias ? "border-warning/50" : ""}`}
          style={{ overflowY: "hidden", minHeight: "54px" }}
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => onUpdate(premortem.id, { frequency: e.target.value })}
              className={`h-9 px-2 rounded-md text-xs font-medium border cursor-pointer w-full ${frequencyColor(frequency)}`}
            >
              {FREQUENCY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label} ({o.score})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Severity</label>
            <select
              value={severity}
              onChange={(e) => onUpdate(premortem.id, { severity: e.target.value })}
              className={`h-9 px-2 rounded-md text-xs font-medium border cursor-pointer w-full ${severityColor(severity)}`}
            >
              {SEVERITY_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label} ({o.score})</option>
              ))}
            </select>
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
