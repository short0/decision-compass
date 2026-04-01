import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Decision } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Plus, Scale, LogOut, Trash2, PanelLeftClose, PanelLeft, User } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function DecisionSidebar() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const { user, isGuest, refetch } = useAuth();
  const navigate = useNavigate();
  const { id: activeId } = useParams();

  useEffect(() => {
    if (user) loadDecisions();
  }, [user]);

  const loadDecisions = async () => {
    try {
      const data = await api.decisions.list();
      setDecisions(data || []);
    } catch {
      setDecisions([]);
    }
  };

  const deleteDecision = async (e: React.MouseEvent, decisionId: string) => {
    e.stopPropagation();
    await api.decisions.delete(decisionId);
    loadDecisions();
    if (activeId === decisionId) navigate("/");
  };

  const handleSignOut = async () => {
    await api.auth.logout();
    await refetch();
    navigate("/auth");
  };

  useEffect(() => {
    const handler = () => loadDecisions();
    window.addEventListener("decisions-updated", handler);
    return () => window.removeEventListener("decisions-updated", handler);
  }, [user]);

  if (collapsed) {
    return (
      <div className="w-12 border-r border-border bg-sidebar-background flex flex-col items-center py-3 gap-2 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsed(false)}>
          <PanelLeft className="w-4 h-4" />
        </Button>
        <Scale className="w-4 h-4 text-primary mt-2" />
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-border bg-sidebar-background flex flex-col shrink-0 h-full">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Decy</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(true)}>
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={() => navigate("/")}
        >
          <Plus className="w-3 h-3 mr-1" />
          New Decision
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {decisions.map(d => (
          <div
            key={d.id}
            onClick={() => navigate(`/decision/${d.id}`)}
            className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
              activeId === d.id
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            }`}
          >
            <span className="truncate flex-1">{d.title}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0"
              onClick={(e) => deleteDecision(e, d.id)}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-border space-y-1">
        <ThemeToggle />
        {isGuest ? (
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => navigate("/auth")}>
            <User className="w-3 h-3 mr-1" />
            Sign In / Sign Up
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={handleSignOut}>
            <LogOut className="w-3 h-3 mr-1" />
            Sign Out
          </Button>
        )}
      </div>
    </div>
  );
}
