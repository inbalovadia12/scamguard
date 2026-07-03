import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Star, ShieldCheck, ArrowRight, ChevronDown } from "lucide-react";
import { useState } from "react";

const testimonials = [
  { name: "Sarah M.", role: "Protecting her parents", quote: "My 78-year-old father was getting bombarded with scam texts. Vardin's alerts let me intervene before he sent money. This is peace of mind.", rating: 5 },
  { name: "James K.", role: "Tech professional", quote: "The AI analysis is shockingly accurate. It caught a sophisticated phishing attempt that I almost fell for. The tactic breakdowns are genuinely educational.", rating: 5 },
  { name: "Linda R.", role: "Family caregiver", quote: "The Family Protection feature is exactly what I needed. My mother submits suspicious messages and I get an instant assessment. It's changed how she uses her phone.", rating: 5 },
];

const faqs = [
  { q: "How accurate is Vardin?", a: "Vardin uses advanced AI models trained on thousands of verified scam patterns. Each analysis includes a risk score (0-100), plain-English explanation, and recommended next steps. While no system is 100% accurate, Vardin provides highly reliable assessments with transparent reasoning." },
  { q: "Can I protect my family members?", a: "Yes! Vardin's Family Protection system lets you invite family members via email, receive shared scam alerts, and monitor protection activity. Premium plan includes unlimited family members and shared alerts." },
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

export default function LandingSocial() {
  return (
    <>
      {/* Testimonials */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">Loved by Families Everywhere</h2>
            <p className="mt-4 text-lg text-muted-foreground">Real stories from real users who stayed safe.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl border border-border/50 bg-card">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-chart-3 text-chart-3" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-4">"{t.quote}"</p>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
            Join thousands of families who use Vardin to stay safe from scams. Free to start, no credit card required.
          </p>
          <Link to="/register" className="inline-block mt-8">
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