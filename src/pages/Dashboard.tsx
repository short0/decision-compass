import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Plus, Scale, LogOut, Clock, CheckCircle2, BarChart3, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";

type Decision = Database["public"]["Tables"]["decisions"]["Row"];

export default function Dashboard() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadDecisions();
  }, []);

  const loadDecisions = async () => {
    const { data } = await supabase
      .from("decisions")
      .select("*")
      .order("updated_at", { ascending: false });
    setDecisions(data || []);
    setLoading(false);
  };

  const createDecision = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("decisions")
      .insert({ title: "Untitled Decision", user_id: user.id })
      .select()
      .single();
    if (data) navigate(`/decision/${data.id}`);
  };

  const deleteDecision = async (e: React.MouseEvent, decisionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Delete related data first
    const { data: opts } = await supabase.from("options").select("id").eq("decision_id", decisionId);
    const optionIds = (opts || []).map(o => o.id);
    if (optionIds.length > 0) {
      await supabase.from("outcomes").delete().in("option_id", optionIds);
    }
    await supabase.from("premortems").delete().eq("decision_id", decisionId);
    await supabase.from("options").delete().eq("decision_id", decisionId);
    await supabase.from("decisions").delete().eq("id", decisionId);
    loadDecisions();
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "active": return <Clock className="w-4 h-4 text-primary" />;
      case "decided": return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "reviewed": return <BarChart3 className="w-4 h-4 text-muted-foreground" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">Decide</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-1" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Your Decisions</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Make better choices with structured analysis
            </p>
          </div>
          <Button variant="hero" onClick={createDecision}>
            <Plus className="w-4 h-4 mr-1" />
            New Decision
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-panel p-5 animate-pulse h-20" />
            ))}
          </div>
        ) : decisions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 space-y-4"
          >
            <Scale className="w-12 h-12 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">No decisions yet. Create your first one.</p>
            <Button variant="hero" onClick={createDecision}>
              <Plus className="w-4 h-4 mr-1" />
              New Decision
            </Button>
          </motion.div>
        ) : (
          <div className="grid gap-3">
            {decisions.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div
                  onClick={() => navigate(`/decision/${d.id}`)}
                  className="glass-panel p-5 flex items-center justify-between hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    {statusIcon(d.status)}
                    <div>
                      <h3 className="font-medium">{d.title}</h3>
                      <p className="text-xs text-muted-foreground font-mono">
                        {new Date(d.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-secondary px-2 py-1 rounded-full capitalize text-secondary-foreground">
                      {d.status}
                    </span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{d.title}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this decision and all its data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDecision(e, d.id);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
