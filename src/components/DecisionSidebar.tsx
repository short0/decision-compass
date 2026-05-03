import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Decision } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Scale, LogOut, Trash2, PanelLeftClose, PanelLeft, User, Home, Loader2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

export default function DecisionSidebar() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
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

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    const wasActive = activeId === pendingDeleteId;
    setDeleting(true);
    setDecisions((prev) => prev.filter((d) => d.id !== pendingDeleteId));
    if (wasActive) navigate("/");
    try {
      await api.decisions.delete(pendingDeleteId);
    } catch {
      loadDecisions();
    } finally {
      setDeleting(false);
      setPendingDeleteId(null);
    }
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
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          data-testid="link-home-logo"
        >
          <Scale className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Decy</span>
        </button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed(true)}>
          <PanelLeftClose className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-2 space-y-1 border-b border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={() => navigate("/")}
          data-testid="button-home"
        >
          <Home className="w-3 h-3 mr-1" />
          Home
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={() => navigate("/")}
          data-testid="button-new-decision"
        >
          <Plus className="w-3 h-3 mr-1" />
          New Decision
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {decisions.map(d => (
          <div
            key={d.id}
            onClick={() => navigate(`/decision/${d.id}`)}
            data-testid={`link-decision-${d.id}`}
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
              onClick={(e) => { e.stopPropagation(); setPendingDeleteId(d.id); }}
              data-testid={`button-delete-decision-${d.id}`}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-border space-y-1">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        {isGuest ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={() => navigate("/auth")}
            data-testid="button-signin"
          >
            <User className="w-3 h-3 mr-1" />
            Sign In / Sign Up
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={handleSignOut}
            data-testid="button-signout"
          >
            <LogOut className="w-3 h-3 mr-1" />
            Sign Out
          </Button>
        )}
      </div>

      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent onOpenAutoFocus={(e) => { e.preventDefault(); requestAnimationFrame(() => cancelRef.current?.focus()); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this decision?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the decision and all its options, outcomes, and risks. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel ref={cancelRef} disabled={deleting} data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-delete-confirm"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
