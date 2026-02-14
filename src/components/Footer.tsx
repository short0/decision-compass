import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-5xl mx-auto px-4 py-4 text-center space-y-2">
        <p className="text-xs text-muted-foreground">
          By using Decy, an AI tool, you agree to our{" "}
          <Link to="/terms" className="underline hover:text-foreground">Terms</Link>{" "}
          and have read our{" "}
          <Link to="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
        </p>
        <p className="text-xs text-muted-foreground">
          <Link to="/contact" className="underline hover:text-foreground">Contact Us</Link>
        </p>
      </div>
    </footer>
  );
}
