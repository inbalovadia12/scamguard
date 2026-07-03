import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowRight, Users, Zap, Bot, ScanLine } from "lucide-react";

const stats = [
  { value: "48K+", label: "Analyses performed" },
  { value: "12", label: "Scam categories" },
  { value: "4.9/5", label: "User satisfaction" },
  { value: "100%", label: "Privacy committed" },
];

export default function LandingHero() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30 dark:opacity-10"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/20 dark:bg-primary/10 blur-[120px] rounded-full"></div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered Scam Detection
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-balance max-w-3xl mx-auto animate-slide-up font-heading">
            Know What's Real{" "}
            <span className="gradient-text">Before You Click.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance animate-slide-up">
            AI-powered scam detection for individuals and families. Paste any message, link, or
            phone number and get an instant risk assessment.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up">
            <Link to="/register">
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20">
                Try Free — 10 Credits
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link to="/register">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base">
                <Users className="w-4 h-4 mr-1" />
                Protect Your Family
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required • Cancel anytime
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><ScanLine className="w-4 h-4 text-primary" /> SMS & Email</span>
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-primary" /> Link Verification</span>
            <span className="flex items-center gap-1.5"><Bot className="w-4 h-4 text-primary" /> AI Analysis</span>
            <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-primary" /> Family Protection</span>
          </div>
        </div>
      </section>

      <section className="border-y border-border/50 bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-primary font-heading">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}