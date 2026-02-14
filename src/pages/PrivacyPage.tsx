import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";

export default function PrivacyPage() {
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
        <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>

        <h2 className="text-lg font-semibold mt-6 mb-2">1. Information We Collect</h2>
        <p className="text-sm text-muted-foreground">We collect information you provide when creating an account (email address) and the decision-related content you enter into the Service. We also collect basic usage analytics.</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">2. How We Use Your Information</h2>
        <p className="text-sm text-muted-foreground">Your information is used to provide and improve the Service, including sending your decision context to AI models to generate suggestions. We do not sell your personal information.</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">3. AI Processing</h2>
        <p className="text-sm text-muted-foreground">When you use AI features, your decision data (titles, options, outcomes) is sent to third-party AI providers for processing. We recommend not entering sensitive personal, financial, or medical information.</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">4. Data Storage & Security</h2>
        <p className="text-sm text-muted-foreground">Your data is stored securely using industry-standard encryption and access controls. We take reasonable measures to protect your information but cannot guarantee absolute security.</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">5. Data Retention</h2>
        <p className="text-sm text-muted-foreground">Your data is retained as long as your account is active. You may delete your decisions at any time through the Service.</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">6. Your Rights</h2>
        <p className="text-sm text-muted-foreground">You have the right to access, correct, or delete your personal data. Contact us at the address on our <Link to="/contact" className="underline text-primary">Contact page</Link> to exercise these rights.</p>

        <h2 className="text-lg font-semibold mt-6 mb-2">7. Changes to This Policy</h2>
        <p className="text-sm text-muted-foreground">We may update this policy from time to time. We will notify users of significant changes via the Service.</p>
      </main>
      <Footer />
    </div>
  );
}
