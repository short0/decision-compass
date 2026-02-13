import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Database } from "@/integrations/supabase/types";
import type { BiasAnnotation } from "@/components/OptionCard";

type Option = Database["public"]["Tables"]["options"]["Row"];
type Premortem = Database["public"]["Tables"]["premortems"]["Row"];

interface Props {
  premortems: Premortem[];
  options: Option[];
  biases: BiasAnnotation[];
  onAdd: (optionId?: string) => void;
  onUpdate: (id: string, updates: Partial<Premortem>) => void;
  onDelete: (id: string) => void;
  onSuggestPremortems: () => void;
  suggestingPremortems: boolean;
}

export default function PremortermPanel({ premortems, options, biases, onAdd, onUpdate, onDelete, onSuggestPremortems, suggestingPremortems }: Props) {
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

        <div className="space-y-2">
          {premortems.map((pm) => (
            <PremortermRow
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

function PremortermRow({
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

  const severityColors: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-warning/10 text-warning",
    high: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => onUpdate(premortem.id, { reason })}
          className={`flex-1 h-9 text-sm ${bias ? "border-warning/50" : ""}`}
        />
        <select
          value={premortem.severity}
          onChange={(e) => onUpdate(premortem.id, { severity: e.target.value })}
          className={`h-9 px-2 rounded-md text-xs font-medium border-0 cursor-pointer ${severityColors[premortem.severity]}`}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => onDelete(premortem.id)}>
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
          <TooltipContent side="bottom" className="max-w-xs z-50">
            <p className="text-sm font-semibold mb-1">{bias.bias_name}</p>
            <p className="text-xs">{bias.explanation}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
