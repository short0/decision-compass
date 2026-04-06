import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Scale, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const PRESETS = [
  {
    emoji: "💼",
    label: "Job Offer",
    title: "Should I accept the new job offer?",
    context: "I've received an offer from Company X with a 20% salary increase but it requires relocating to another city. I'm currently happy at my job but the growth potential feels limited.",
  },
  {
    emoji: "🏠",
    label: "Buy vs. Rent",
    title: "Should I buy a house or continue renting?",
    context: "I have enough savings for a down payment. Buying would lock up capital but build equity. Renting keeps me flexible but feels like throwing money away. I plan to stay in this city for at least 5 years.",
  },
  {
    emoji: "🚀",
    label: "Start a Business",
    title: "Should I leave my job to start my own business?",
    context: "I have a business idea I've been working on evenings and weekends for 6 months. I have 12 months of savings. The market opportunity looks real but there's no revenue yet.",
  },
  {
    emoji: "🎓",
    label: "Graduate School",
    title: "Should I go back to school for a graduate degree?",
    context: "I'm considering an MBA or Master's program. It would cost ~$80k and 2 years. The credential could open doors, but I'm not sure if the ROI justifies the cost and opportunity cost.",
  },
];

export default function HomePage() {
  const [input, setInput] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !user) return;

    setCreating(true);
    try {
      const lines = trimmed.split("\n");
      const title = lines[0].slice(0, 100) || "Untitled Decision";
      const context = trimmed;

      const data = await api.decisions.create({ title, context });
      window.dispatchEvent(new Event("decisions-updated"));
      navigate(`/decision/${data.id}`);
    } catch {
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  return (
    <div className="flex items-start justify-center min-h-full p-4 pt-12 overflow-y-auto">
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
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Decy helps you think through decisions clearly using expected value, premortem analysis, and AI — inspired by Annie Duke's work.
          </p>
        </div>

        <div className="glass-panel p-3 space-y-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your decision... (e.g. Should I accept the job offer from Company X?)"
            className="w-full border-none bg-transparent focus:outline-none resize-none text-base min-h-[60px] placeholder:text-muted-foreground leading-relaxed"
            rows={3}
            autoFocus
            data-testid="input-decision"
          />
          <div className="flex justify-end">
            <Button
              onClick={() => handleSubmit(input)}
              disabled={!input.trim() || creating}
              size="sm"
              data-testid="button-start"
            >
              {creating ? "Creating..." : "Start Analysis"}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Try an example</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleSubmit(preset.title + "\n\n" + preset.context)}
                disabled={creating}
                data-testid={`button-preset-${preset.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-left p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all text-sm space-y-1 disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5">
                  <span>{preset.emoji}</span>
                  <span className="font-medium text-xs text-muted-foreground">{preset.label}</span>
                </div>
                <p className="text-xs text-foreground leading-snug">{preset.title}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center text-xs text-muted-foreground space-y-1 pb-8">
          <p className="font-medium">How it works</p>
          <p>1. Describe your decision → 2. Add options &amp; outcomes with probabilities → 3. Run premortem → 4. Review expected value</p>
        </div>
      </motion.div>
    </div>
  );
}
