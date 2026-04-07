import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Scale, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

type PresetOutcome = { description: string; probability: number; impact: number };
type PresetOption = { title: string; outcomes: PresetOutcome[] };
type PresetPremortem = { reason: string; severity: string; frequency: string };

type Preset = {
  emoji: string;
  label: string;
  title: string;
  context: string;
  options: PresetOption[];
  premortems: PresetPremortem[];
};

const PRESETS: Preset[] = [
  {
    emoji: "💼",
    label: "Job Offer",
    title: "Should I accept the new job offer?",
    context: "I've received an offer from Company X with a 20% salary increase but it requires relocating to another city. I'm currently happy at my job but the growth potential feels limited.",
    options: [
      {
        title: "Accept the new job offer",
        outcomes: [
          { description: "Salary increase significantly improves financial security", probability: 90, impact: 7 },
          { description: "Career growth accelerates with new challenges and visibility", probability: 70, impact: 8 },
          { description: "Relocation is stressful and disrupts personal relationships", probability: 65, impact: -5 },
          { description: "New role turns out to be a poor fit, job satisfaction drops", probability: 25, impact: -7 },
        ],
      },
      {
        title: "Stay at current job",
        outcomes: [
          { description: "Stability and familiarity reduce stress", probability: 85, impact: 4 },
          { description: "Miss out on salary increase, feel financially stuck", probability: 75, impact: -4 },
          { description: "Regret not taking the opportunity — lingering 'what if'", probability: 60, impact: -3 },
          { description: "Successfully negotiate a raise or promotion at current employer", probability: 35, impact: 5 },
        ],
      },
      {
        title: "Negotiate remote or hybrid arrangement",
        outcomes: [
          { description: "Get the salary increase without relocating", probability: 40, impact: 9 },
          { description: "Offer is withdrawn or negotiations fail", probability: 45, impact: -2 },
          { description: "Partial accommodation — occasional travel required", probability: 30, impact: 4 },
        ],
      },
    ],
    premortems: [
      { reason: "Company culture is toxic and was hidden during the interview process", severity: "significant", frequency: "possible" },
      { reason: "Relocation costs more than anticipated, eating into the salary gain", severity: "moderate", frequency: "likely" },
      { reason: "The role changes significantly after joining due to reorganization", severity: "significant", frequency: "unlikely" },
      { reason: "Family pushback on relocation causes major relationship strain", severity: "severe", frequency: "possible" },
      { reason: "Manager leaves shortly after I join, leaving me without a sponsor", severity: "moderate", frequency: "unlikely" },
    ],
  },
  {
    emoji: "🏠",
    label: "Buy vs. Rent",
    title: "Should I buy a house or continue renting?",
    context: "I have enough savings for a down payment. Buying would lock up capital but build equity. Renting keeps me flexible. I plan to stay in this city for at least 5 years.",
    options: [
      {
        title: "Buy a house",
        outcomes: [
          { description: "Build equity over time, mortgage replaces rent as wealth creation", probability: 80, impact: 8 },
          { description: "Property value appreciates significantly over 5–10 years", probability: 55, impact: 7 },
          { description: "Unexpected major repairs drain savings (roof, HVAC, plumbing)", probability: 40, impact: -6 },
          { description: "Property value stagnates or declines in local market", probability: 25, impact: -5 },
          { description: "Reduced liquidity limits other investment opportunities", probability: 70, impact: -3 },
        ],
      },
      {
        title: "Continue renting",
        outcomes: [
          { description: "Capital remains liquid and can be invested elsewhere", probability: 90, impact: 5 },
          { description: "Flexibility to relocate quickly if career opportunity arises", probability: 80, impact: 4 },
          { description: "Rent increases significantly over next 5 years", probability: 65, impact: -5 },
          { description: "Investment returns on capital outperform real estate appreciation", probability: 45, impact: 6 },
          { description: "Miss out on building equity, feel 'behind' financially", probability: 70, impact: -3 },
        ],
      },
    ],
    premortems: [
      { reason: "Hidden structural issues discovered after purchase that insurance won't cover", severity: "severe", frequency: "unlikely" },
      { reason: "Job loss or income reduction makes mortgage payments unmanageable", severity: "severe", frequency: "possible" },
      { reason: "Interest rates rise sharply if on a variable mortgage", severity: "significant", frequency: "possible" },
      { reason: "Neighborhood deteriorates, reducing property value and quality of life", severity: "significant", frequency: "unlikely" },
      { reason: "Need to relocate within 2 years due to job change, forced to sell at a loss", severity: "moderate", frequency: "possible" },
    ],
  },
  {
    emoji: "🚀",
    label: "Start a Business",
    title: "Should I leave my job to start my own business?",
    context: "I have a business idea I've been working on evenings and weekends for 6 months. I have 12 months of savings. The market opportunity looks real but there's no revenue yet.",
    options: [
      {
        title: "Leave job and go full-time on the business",
        outcomes: [
          { description: "Achieve product-market fit within 6 months and start generating revenue", probability: 35, impact: 10 },
          { description: "Business gains traction but takes 18+ months to become profitable", probability: 30, impact: 4 },
          { description: "Business fails, savings exhausted, must return to employment", probability: 30, impact: -8 },
          { description: "Business succeeds beyond expectations, exits for significant sum", probability: 10, impact: 10 },
        ],
      },
      {
        title: "Continue building nights & weekends while keeping job",
        outcomes: [
          { description: "Reach revenue milestones without financial risk, then transition", probability: 40, impact: 7 },
          { description: "Burnout from dual commitments forces abandonment of the project", probability: 35, impact: -4 },
          { description: "Slower growth means a competitor captures the market first", probability: 30, impact: -5 },
          { description: "Employer discovers conflict of interest, jeopardizing current job", probability: 15, impact: -6 },
        ],
      },
      {
        title: "Take a sabbatical or reduced hours to test the idea",
        outcomes: [
          { description: "Validate the business model with lower financial risk", probability: 60, impact: 6 },
          { description: "Employer won't agree to reduced arrangement", probability: 40, impact: -2 },
          { description: "Insufficient time commitment means slow validation", probability: 35, impact: -3 },
        ],
      },
    ],
    premortems: [
      { reason: "Target customers don't have the problem I think they have — no product-market fit", severity: "severe", frequency: "possible" },
      { reason: "Savings run out before revenue is sufficient to sustain", severity: "severe", frequency: "likely" },
      { reason: "A well-funded competitor copies the idea and out-executes", severity: "significant", frequency: "possible" },
      { reason: "Regulatory or legal issues emerge that weren't anticipated", severity: "significant", frequency: "unlikely" },
      { reason: "Founder burnout and stress damage health and relationships", severity: "moderate", frequency: "likely" },
      { reason: "Key early customer churns before the product stabilizes", severity: "moderate", frequency: "possible" },
    ],
  },
  {
    emoji: "🎓",
    label: "Graduate School",
    title: "Should I go back to school for a graduate degree?",
    context: "I'm considering an MBA or Master's program. It would cost ~$80k and 2 years. The credential could open doors, but I'm not sure if the ROI justifies the cost and opportunity cost.",
    options: [
      {
        title: "Enroll full-time in a top MBA program",
        outcomes: [
          { description: "Credential opens doors to higher-paying roles (consulting, finance, tech leadership)", probability: 60, impact: 8 },
          { description: "Network built during program leads to significant career opportunities", probability: 70, impact: 7 },
          { description: "Significant debt burden limits financial flexibility for 5–10 years", probability: 80, impact: -6 },
          { description: "Post-MBA job market is weak and ROI doesn't materialize", probability: 20, impact: -7 },
        ],
      },
      {
        title: "Pursue a part-time or online program while working",
        outcomes: [
          { description: "Earn the credential with lower cost and no career interruption", probability: 75, impact: 5 },
          { description: "Lower prestige degree has less impact on career trajectory", probability: 50, impact: -2 },
          { description: "Balancing work and study leads to burnout or poor academic performance", probability: 40, impact: -4 },
          { description: "Employer may fund part of the tuition, reducing out-of-pocket costs", probability: 35, impact: 4 },
        ],
      },
      {
        title: "Skip the degree and invest in targeted skills instead",
        outcomes: [
          { description: "Money and time invested in direct skill-building and experience pays off faster", probability: 65, impact: 6 },
          { description: "Hit a ceiling without the credential in target roles or companies", probability: 40, impact: -5 },
          { description: "Build strong portfolio and reputation that exceeds value of a degree", probability: 35, impact: 8 },
          { description: "Lack of credential causes recurring self-doubt and imposter syndrome", probability: 30, impact: -3 },
        ],
      },
    ],
    premortems: [
      { reason: "Job market for target role is saturated by the time the degree is complete", severity: "significant", frequency: "possible" },
      { reason: "Program quality doesn't match expectations — poor faculty, weak network", severity: "moderate", frequency: "unlikely" },
      { reason: "Personal circumstances change (family, health) making completion difficult", severity: "significant", frequency: "possible" },
      { reason: "Degree becomes less relevant in target field due to industry shifts", severity: "moderate", frequency: "unlikely" },
      { reason: "Financial stress from debt creates anxiety that undermines performance", severity: "moderate", frequency: "likely" },
    ],
  },
];

export default function HomePage() {
  const [input, setInput] = useState("");
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const createFromText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !user) return;
    setCreating(true);
    try {
      const lines = trimmed.split("\n");
      const title = lines[0].slice(0, 100) || "Untitled Decision";
      const data = await api.decisions.create({ title, context: trimmed });
      window.dispatchEvent(new Event("decisions-updated"));
      navigate(`/decision/${data.id}`);
    } catch {
    } finally {
      setCreating(false);
    }
  };

  const createFromPreset = async (preset: Preset) => {
    if (!user || loadingPreset) return;
    setLoadingPreset(preset.label);
    try {
      const decision = await api.decisions.create({ title: preset.title, context: preset.context });
      const decisionId = decision.id;

      for (let i = 0; i < preset.options.length; i++) {
        const opt = preset.options[i];
        const createdOption = await api.options.create(decisionId, {
          title: opt.title,
          sortOrder: i,
        } as any);
        for (let j = 0; j < opt.outcomes.length; j++) {
          const oc = opt.outcomes[j];
          await api.outcomes.create(createdOption.id, {
            description: oc.description,
            probability: oc.probability,
            impact: oc.impact,
            sortOrder: j,
          } as any);
        }
      }

      for (let i = 0; i < preset.premortems.length; i++) {
        const pm = preset.premortems[i];
        await api.premortems.create(decisionId, {
          reason: pm.reason,
          severity: pm.severity,
          frequency: pm.frequency,
          sortOrder: i,
        } as any);
      }

      window.dispatchEvent(new Event("decisions-updated"));
      navigate(`/decision/${decisionId}`);
    } catch {
    } finally {
      setLoadingPreset(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      createFromText(input);
    }
  };

  const busy = creating || !!loadingPreset;

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
              onClick={() => createFromText(input)}
              disabled={!input.trim() || busy}
              size="sm"
              data-testid="button-start"
            >
              {creating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {creating ? "Creating..." : "Start Analysis"}
              {!creating && <ArrowRight className="w-4 h-4 ml-1" />}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Try a fully-populated example</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => createFromPreset(preset)}
                disabled={busy}
                data-testid={`button-preset-${preset.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-left p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all text-sm space-y-1 disabled:opacity-50 relative"
              >
                {loadingPreset === preset.label && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-card/80">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span>{preset.emoji}</span>
                  <span className="font-medium text-xs text-muted-foreground">{preset.label}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {preset.options.length} options · {preset.premortems.length} risks
                  </span>
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
