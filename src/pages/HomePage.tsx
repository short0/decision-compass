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
          { description: "Great fit — career accelerates, salary increase makes relocation worthwhile", probability: 35, impact: 9 },
          { description: "Good financially but relocation strains personal relationships significantly", probability: 30, impact: 2 },
          { description: "Role disappoints, poor culture fit, back on the job market within a year", probability: 20, impact: -6 },
          { description: "Company downsizes or folds shortly after joining, forced restart", probability: 15, impact: -8 },
        ],
      },
      {
        title: "Stay at current job",
        outcomes: [
          { description: "Negotiate a raise internally and feel vindicated staying", probability: 25, impact: 6 },
          { description: "Career stagnates, frustration and regret grow over the next year", probability: 45, impact: -4 },
          { description: "Opportunity sparks action — find a better local role within a year", probability: 20, impact: 7 },
          { description: "Career plateaus completely, stuck for 3+ years with no clear path", probability: 10, impact: -7 },
        ],
      },
      {
        title: "Negotiate remote or hybrid arrangement",
        outcomes: [
          { description: "Company fully accommodates remote — best of both worlds", probability: 30, impact: 9 },
          { description: "Hybrid deal struck — partial travel required but manageable", probability: 25, impact: 5 },
          { description: "Company withdraws the offer, back to status quo", probability: 35, impact: -2 },
          { description: "Negotiations sour the relationship, offer rescinded unfavorably", probability: 10, impact: -5 },
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
          { description: "Strong appreciation and equity build meaningful wealth over 5–10 years", probability: 30, impact: 9 },
          { description: "Modest equity gains — maintenance costs manageable, breaks even vs. renting", probability: 40, impact: 3 },
          { description: "Major unexpected repairs (roof, HVAC) drain savings and stress finances", probability: 15, impact: -6 },
          { description: "Market declines or forced early sale results in a financial loss", probability: 15, impact: -8 },
        ],
      },
      {
        title: "Continue renting",
        outcomes: [
          { description: "Invest savings productively — returns clearly outpace real estate appreciation", probability: 25, impact: 7 },
          { description: "Stable rent, flexibility preserved — financially neutral but comfortable", probability: 25, impact: 3 },
          { description: "Rent rises sharply — savings eroded without any equity to show for it", probability: 40, impact: -5 },
          { description: "Forced to move repeatedly — instability significantly affects quality of life", probability: 10, impact: -7 },
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
          { description: "Exceptional outcome — raises funding or exits for a life-changing sum", probability: 10, impact: 10 },
          { description: "Profitable within 18 months — sustainable business, freedom achieved", probability: 20, impact: 8 },
          { description: "Gains traction but takes 3+ years to reach sustainability", probability: 30, impact: 3 },
          { description: "Business fails — savings exhausted, must return to employment", probability: 35, impact: -8 },
          { description: "Pivots to a different idea that eventually works", probability: 5, impact: 2 },
        ],
      },
      {
        title: "Continue building nights & weekends while keeping job",
        outcomes: [
          { description: "Reaches revenue milestones safely and transitions full-time with confidence", probability: 25, impact: 8 },
          { description: "Slow but steady — transitions full-time in 2+ years", probability: 25, impact: 4 },
          { description: "Burnout from dual commitments forces abandonment of the project", probability: 35, impact: -4 },
          { description: "Employer discovers conflict of interest, current job at risk", probability: 15, impact: -7 },
        ],
      },
      {
        title: "Take a sabbatical or reduced hours to test the idea",
        outcomes: [
          { description: "Validates the model — goes full-time after sabbatical with confidence", probability: 30, impact: 7 },
          { description: "Partial success — extends sabbatical or negotiates ongoing flexibility", probability: 25, impact: 3 },
          { description: "Validation fails — returns to full-time work having reduced risk", probability: 20, impact: -2 },
          { description: "Employer refuses reduced arrangement — forced to choose cold", probability: 25, impact: -3 },
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
          { description: "Credential and network transform career — strong ROI within 5 years", probability: 30, impact: 9 },
          { description: "Career improves meaningfully — ROI is positive but modest over time", probability: 35, impact: 4 },
          { description: "Debt burden significant — competitive job market, ROI uncertain", probability: 20, impact: -4 },
          { description: "Poor job market post-graduation — debt-to-income ratio painful for a decade", probability: 15, impact: -8 },
        ],
      },
      {
        title: "Pursue a part-time or online program while working",
        outcomes: [
          { description: "Earn credential with no career gap — employer funds part of the cost", probability: 35, impact: 6 },
          { description: "Complete the degree but lower prestige limits its career impact", probability: 40, impact: 1 },
          { description: "Work and study burnout — performance suffers in both", probability: 15, impact: -5 },
          { description: "Employer promotes internally after degree — credential opens doors", probability: 10, impact: 7 },
        ],
      },
      {
        title: "Skip the degree and invest in targeted skills instead",
        outcomes: [
          { description: "Skills, portfolio, and reputation outperform peers with MBAs", probability: 30, impact: 8 },
          { description: "Solid progress but hit a ceiling at target companies without the credential", probability: 35, impact: -3 },
          { description: "Build strong domain expertise and speaking presence — exceeds expectations", probability: 20, impact: 7 },
          { description: "Recurring self-doubt and imposter syndrome limits risk-taking", probability: 15, impact: -4 },
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
      const { id: decisionId } = await api.decisions.seed({
        title: preset.title,
        context: preset.context,
        options: preset.options.map((o) => ({
          title: o.title,
          outcomes: o.outcomes.map((oc) => ({
            description: oc.description,
            probability: oc.probability,
            impact: oc.impact,
          })),
        })),
        premortems: preset.premortems.map((pm) => ({
          reason: pm.reason,
          severity: pm.severity,
          frequency: pm.frequency,
        })),
      });
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
