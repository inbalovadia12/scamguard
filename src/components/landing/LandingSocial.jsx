import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowRight, ChevronDown } from "lucide-react";
import { useState } from "react";

const faqs = [
  { q: "How accurate is Vardin?", a: "Vardin's AI gives every check a risk score from 0 to 100 with a plain-English explanation and recommended next steps. Vardin is in beta and its assessments can be wrong, so treat each result as one input and verify anything important yourself." },
  { q: "Can I protect my family members?", a: "Yes! Vardin's Family Protection lets you invite family members by email and sends you an alert when they check something that looks risky. See Pricing for what each plan includes." },
  { q: "What types of scams are supported?", a: "Vardin analyzes SMS messages, emails, job offers, marketplace listings, romance scams, tech support scams, bank impersonation, and more. Premium plans also support screenshot and QR code analysis." },
  { q: "Is my data private?", a: "Yes. Messages are analyzed in real-time and only stored to your account history. Vardin auto-redacts phone numbers, emails, SSNs, credit cards, and crypto wallet addresses before storage. Your data is never sold." },
  { q: "Can I analyze screenshots?", a: "Yes. Plus and Premium plans support image upload and screenshot analysis. Upload a screenshot of any suspicious message, email, or listing and our AI will analyze it for scam indicators." },
  { q: "Can I cancel anytime?", a: "Yes. You can cancel your subscription at any time and your plan remains active until the end of your billing period. No questions asked." },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-5 rounded-xl border border-border/50 bg-card">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-left">
        <h3 className="font-semibold text-sm">{q}</h3>
        <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 ml-2 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="text-sm text-muted-foreground leading-relaxed mt-3 animate-fade-in">{a}</p>}
    </div>
  );
}

export default function LandingSocial({ preview = false }) {
  const ctaHref = preview ? "/" : "/register";

  return (
    <>
      {/* FAQ */}
      <section id="faq" className="py-24 border-y border-border/50 bg-card/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">Frequently Asked Questions</h2>
            <p className="mt-4 text-lg text-muted-foreground">Everything you need to know about Vardin.</p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 mb-6">
            <ShieldCheck className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">
            Start Protecting Your Family Today
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Start free and check your first suspicious message in seconds. Upgrade whenever you need more.
          </p>
          <Link to={ctaHref} className="inline-block mt-8">
            <Button size="lg" className="h-12 px-8 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20">
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
