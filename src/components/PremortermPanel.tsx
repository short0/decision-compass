import { useState, useRef, useEffect } from "react";
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

function useAutoResize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return ref;
}

const severityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-warning/10 text-warning border-warning/30",
  high: "bg-destructive/10 text-destructive border-destructive/30",
  critical: "bg-destructive/20 text-destructive border-destructive/50",
};

const frequencyColors: Record<string, string> = {
  rare: "bg-muted text-muted-foreground border-border",
  occasional: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
  likely: "bg-warning/10 text-warning border-warning/30",
  "almost certain": "bg-destructive/10 text-destructive border-destructive/30",
};

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
          Imagine this decision has already failed. What went wrong? List every reason you can think of.
        </p>

        {localPremortems.length > 0 && (
          <div className="hidden sm:grid grid-cols-[24px_1fr_120px_100px_36px] gap-2 text-xs text-muted-foreground font-mono px-1">
            <span />
            <span>Risk / Failure Reason</span>
            <span className="text-center">Frequency</span>
            <span className="text-center">Severity</span>
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

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      {/* Desktop layout */}
      <div className="hidden sm:grid grid-cols-[24px_1fr_120px_100px_36px] gap-2 items-start">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none mt-2"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <textarea
          ref={reasonRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => onUpdate(premortem.id, { reason })}
          className={`w-full text-sm rounded-md border border-input bg-background px-3 py-2 overflow-hidden resize-none focus:outline-none focus:ring-1 focus:ring-ring leading-snug ${bias ? "border-warning/50" : ""}`}
          rows={1}
          style={{ minHeight: "36px" }}
        />
        <select
          value={premortem.frequency}
          onChange={(e) => onUpdate(premortem.id, { frequency: e.target.value })}
          className={`h-9 px-2 rounded-md text-xs font-medium border cursor-pointer shrink-0 w-full ${frequencyColors[premortem.frequency] || frequencyColors.occasional}`}
        >
          <option value="rare">Rare</option>
          <option value="occasional">Occasional</option>
          <option value="likely">Likely</option>
          <option value="almost certain">Almost Certain</option>
        </select>
        <select
          value={premortem.severity}
          onChange={(e) => onUpdate(premortem.id, { severity: e.target.value })}
          className={`h-9 px-2 rounded-md text-xs font-medium border cursor-pointer shrink-0 w-full ${severityColors[premortem.severity] || severityColors.medium}`}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onDelete(premortem.id)}>
          <Trash2 className="w-3 h-3 text-muted-foreground" />
        </Button>
      </div>

      {/* Mobile layout */}
      <div className="sm:hidden space-y-2 p-3 border border-border rounded-md">
        <div className="flex items-center justify-between">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-muted-foreground touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(premortem.id)}>
            <Trash2 className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>
        <textarea
          ref={reasonRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => onUpdate(premortem.id, { reason })}
          className={`w-full text-sm rounded-md border border-input bg-background px-3 py-2 overflow-hidden resize-none focus:outline-none focus:ring-1 focus:ring-ring leading-snug ${bias ? "border-warning/50" : ""}`}
          rows={2}
          style={{ minHeight: "54px" }}
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Frequency</label>
            <select
              value={premortem.frequency}
              onChange={(e) => onUpdate(premortem.id, { frequency: e.target.value })}
              className={`h-9 px-2 rounded-md text-xs font-medium border cursor-pointer w-full ${frequencyColors[premortem.frequency] || frequencyColors.occasional}`}
            >
              <option value="rare">Rare</option>
              <option value="occasional">Occasional</option>
              <option value="likely">Likely</option>
              <option value="almost certain">Almost Certain</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Severity</label>
            <select
              value={premortem.severity}
              onChange={(e) => onUpdate(premortem.id, { severity: e.target.value })}
              className={`h-9 px-2 rounded-md text-xs font-medium border cursor-pointer w-full ${severityColors[premortem.severity] || severityColors.medium}`}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
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
          <TooltipContent side="top" className="max-w-sm z-50" sideOffset={4}>
            <p className="text-sm font-semibold mb-1">{bias.bias_name}</p>
            <p className="text-xs leading-relaxed">{bias.explanation}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
