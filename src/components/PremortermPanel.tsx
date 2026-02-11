import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Option = Database["public"]["Tables"]["options"]["Row"];
type Premortem = Database["public"]["Tables"]["premortems"]["Row"];

interface Props {
  premortems: Premortem[];
  options: Option[];
  onAdd: (optionId?: string) => void;
  onUpdate: (id: string, updates: Partial<Premortem>) => void;
  onDelete: (id: string) => void;
}

export default function PremortermPanel({ premortems, options, onAdd, onUpdate, onDelete }: Props) {
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
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>

        <Button variant="workspace" onClick={() => onAdd()} className="w-full">
          <Plus className="w-4 h-4 mr-1" />
          Add Risk
        </Button>
      </div>
    </div>
  );
}

function PremortermRow({
  premortem,
  options,
  onUpdate,
  onDelete,
}: {
  premortem: Premortem;
  options: Option[];
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
    <div className="flex items-center gap-2">
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onBlur={() => onUpdate(premortem.id, { reason })}
        className="flex-1 h-9 text-sm"
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
  );
}
