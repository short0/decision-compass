import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 flex-1 prose prose-sm dark:prose-invert">
        <h1 className="text-2xl font-bold mb-6">Terms of Service</h1>

        <div className="glass-panel p-6 mb-6 border-primary/30 border">
          <p className="text-sm font-semibold text-primary mb-2">⚠️ Important AI Disclaimer</p>
          <p className="text-sm text-foreground">
            This app uses AI to help you explore options, risks, and perspectives. AI outputs may be inaccurate, biased, or incomplete. The AI does not understand your personal context or goals fully. This tool does not provide professional advice (financial, legal, medical, or otherwise). You remain fully responsible for your decisions and their outcomes. Avoid entering sensitive personal information. Use AI suggestions as a starting point for thinking—not as a final answer.
          </p>
        </div>

        <h2 className="text-lg font-semibold mt-6 mb-2">1. Acceptance of Terms</h2>
        <p className="text-sm text-muted-foreground">By accessing or using Decy ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">2. Description of Service</h2>
        <p className="text-sm text-muted-foreground">Decy is a structured decision-making tool that uses AI to help users analyze options, outcomes, and risks. The Service is provided "as is" without warranties of any kind.</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">3. User Responsibilities</h2>
        <p className="text-sm text-muted-foreground">You are responsible for maintaining the confidentiality of your account credentials. You agree not to use the Service for any unlawful purpose or in violation of any applicable laws.</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">4. Intellectual Property</h2>
        <p className="text-sm text-muted-foreground">Content you create using the Service remains yours. The Service itself, including its design, code, and branding, is owned by the Service operators.</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">5. Limitation of Liability</h2>
        <p className="text-sm text-muted-foreground">To the maximum extent permitted by law, the Service and its operators shall not be liable for any indirect, incidental, special, or consequential damages resulting from your use of the Service or reliance on AI-generated outputs.</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">6. Data & Privacy</h2>
        <p className="text-sm text-muted-foreground">Your use of the Service is also governed by our <Link to="/privacy" className="underline text-primary">Privacy Policy</Link>.</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">7. Modifications</h2>
        <p className="text-sm text-muted-foreground">We reserve the right to modify these terms at any time. Continued use of the Service after changes constitutes acceptance of the new terms.</p>
      </main>
      <Footer />
    </div>
  );
}
