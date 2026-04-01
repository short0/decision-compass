import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Scale, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function HomePage() {
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !user) return;

    setCreating(true);
    try {
      const lines = text.split("\n");
      const title = lines[0].slice(0, 100) || "Untitled Decision";
      const context = text;

      const data = await api.decisions.create({ title, context });
      window.dispatchEvent(new Event("decisions-updated"));
      navigate(`/decision/${data.id}`);
    } catch {
      // fallback
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-full p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl space-y-8"
      >
        <div className="text-center space-y-3">
          <Scale className="w-10 h-10 text-primary mx-auto" />
          <h1 className="text-2xl font-semibold text-foreground">
            What decision are you facing?
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="glass-panel p-3 space-y-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your decision... (e.g. Should I accept the job offer from Company X?)"
              className="border-none bg-transparent focus-visible:ring-0 resize-none text-base min-h-[60px]"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!input.trim() || creating}
                size="sm"
              >
                {creating ? "Creating..." : "Start Analysis"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
