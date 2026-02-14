import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";

export default function ContactPage() {
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
      <main className="max-w-3xl mx-auto px-4 py-8 flex-1">
        <h1 className="text-2xl font-bold mb-6">Contact Us</h1>
        <div className="glass-panel p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Email</p>
              <a href="mailto:support@decy.app" className="text-sm text-primary underline">support@decy.app</a>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Have questions, feedback, or concerns? We'd love to hear from you. Send us an email and we'll get back to you as soon as possible.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
