import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
  onReorder: (activeId: string, overId: string) => void;
  onSuggestPremortems: () => void;
  suggestingPremortems: boolean;
}

export default function PremortermPanel({ premortems, options, biases, onAdd, onUpdate, onDelete, onReorder, onSuggestPremortems, suggestingPremortems }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          <h3 className="font-semibold text-lg">Premortem Analysis</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Imagine this decision has failed. What went wrong? List every reason you can think of.
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={premortems.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {premortems.map((pm) => (
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

        <Button variant="workspace" onClick={() => onAdd()} className="w-full">
          <Plus className="w-4 h-4 mr-1" />
          Add Risk
        </Button>
        <Button
          variant="workspace"
          onClick={onSuggestPremortems}
          disabled={suggestingPremortems}
          className="w-full"
        >
          {suggestingPremortems ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-1" />
          )}
          {suggestingPremortems ? "Suggesting..." : "Suggest Risks with AI"}
        </Button>
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
    opacity: isDragging ? 0.5 : 1,
  };

  const severityColors: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-warning/10 text-warning",
    high: "bg-destructive/10 text-destructive",
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => onUpdate(premortem.id, { reason })}
          className={`flex-1 min-h-[36px] text-sm resize-none ${bias ? "border-warning/50" : ""}`}
          rows={1}
        />
        <select
          value={premortem.severity}
          onChange={(e) => onUpdate(premortem.id, { severity: e.target.value })}
          className={`h-9 px-2 rounded-md text-xs font-medium border-0 cursor-pointer shrink-0 ${severityColors[premortem.severity]}`}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onDelete(premortem.id)}>
          <Trash2 className="w-3 h-3 text-muted-foreground" />
        </Button>
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