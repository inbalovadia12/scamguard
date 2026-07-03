import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Search, Users, Bell, Bot, Puzzle, Crown, Check, ArrowRight, Star, Lock, Zap, Eye, AlertTriangle } from "lucide-react";

const features = [
  { icon: Search, title: "Instant Message Analysis", description: "Paste any suspicious message and get an AI-powered risk assessment in seconds — with plain-English explanations of the manipulation tactics used." },
  { icon: Eye, title: "Image & Screenshot Analysis", description: "Upload screenshots of suspicious emails, texts, or listings. Our AI analyzes visual cues like fake logos, urgent banners, and phishing links." },
  { icon: Bot, title: "AI Agent Chat", description: "Chat with our scam expert AI in real-time. Ask questions, get advice, and learn how to respond to suspicious contacts." },
  { icon: Users, title: "Senior Guardian Mode", description: "Protect your elderly family members. Seniors submit suspicious messages, you get instant alerts and can review and manage them." },
  { icon: Puzzle, title: "Chrome Extension", description: "Right-click any message on any website and analyze it instantly. Available on Plus plans and above." },
  { icon: Bell, title: "Real-Time Guardian Alerts", description: "Get notified the moment a protected senior submits a high-risk message. Set preferences for alert types and severity." },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "For occasional checks",
    credits: "10 AI credits/month",
    features: ["Text message analysis", "Risk score & explanation", "Basic next steps", "1 protected family member"],
    notIncluded: ["Chrome extension", "Image upload", "AI Agent chat", "Advanced analytics"],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Plus",
    price: "$40",
    period: "/year",
    description: "For individuals who want more",
    credits: "100 AI credits/month",
    features: ["Everything in Free, plus:", "Chrome Extension access", "Image upload & screenshots", "AI Agent chat", "5 protected family members", "Real-time alerts"],
    notIncluded: ["Advanced analytics", "Priority support", "Custom rules"],
    cta: "Choose Plus",
    highlighted: false,
  },
  {
    name: "Premium",
    price: "$80",
    period: "/year",
    description: "Complete family protection",
    credits: "100 AI credits/month",
    features: ["Everything in Plus, plus:", "Bank account monitoring", "Priority scam pattern updates", "Auto-redaction of sensitive data", "Personalized risk profiles", "Detailed educational content"],
    notIncluded: ["Unlimited family members", "Elite analytics"],
    cta: "Choose Premium",
    highlighted: true,
  },
  {
    name: "Elite",
    price: "$120",
    period: "/year",
    description: "Maximum protection & insights",
    credits: "250 AI credits/month",
    features: ["Everything in Premium, plus:", "Unlimited protected family members", "Advanced analytics dashboard", "Priority support (< 4hr response)", "Early access to experimental AI tools", "Custom risk thresholds & rules", "Unlimited CSV/PDF exports", "Exclusive scam trend reports"],
    notIncluded: [],
    cta: "Choose Elite",
    highlighted: false,
  },
];

const testimonials = [
  { name: "Sarah M.", role: "Protecting her parents", quote: "My 78-year-old father was getting bombarded with scam texts. ScamGuard's alerts let me intervene before he sent money to anyone. This is peace of mind.", rating: 5 },
  { name: "James K.", role: "Tech professional", quote: "The AI analysis is shockingly accurate. It caught a sophisticated phishing attempt that I almost fell for. The tactic breakdowns are genuinely educational.", rating: 5 },
  { name: "Linda R.", role: "Family caregiver", quote: "The Senior Guardian feature is exactly what I needed. My mother submits suspicious messages and I get an instant assessment. It's changed how she uses her phone.", rating: 5 },
];

const faqs = [
  { q: "How does ScamGuard detect scams?", a: "ScamGuard uses advanced AI models to analyze suspicious messages for manipulation tactics, urgency cues, impersonation patterns, and payment red flags. Each analysis includes a risk score (0-100), plain-English explanation, and recommended next steps." },
  { q: "Is my data private?", a: "Yes. Messages are analyzed in real-time and only stored to your account history. We auto-redact phone numbers and wallet addresses on premium plans. Your data is never sold to third parties." },
  { q: "Can I protect my elderly parents?", a: "Yes! ScamGuard's Senior Guardian feature lets family members monitor and receive alerts on suspicious activity submitted by their elderly relatives. You can set alert preferences (all, high-risk only, or financial only) for each protected senior." },
  { q: "What is the Chrome extension?", a: "The ScamGuard Chrome Extension lets you right-click any message or email on any website and analyze it instantly without leaving your browser. It's available on Plus plans and above." },
  { q: "What happens when I run out of credits?", a: "Free users get 10 credits per month. When you run out, you can upgrade to a paid plan for more credits. Credits reset automatically on the first of each month." },
  { q: "Can I cancel anytime?", a: "Yes. You can cancel your subscription at any time and your plan will remain active until the end of your billing period. No questions asked." },
  { q: "How accurate is the AI?", a: "Our AI models are trained on thousands of verified scam patterns and continuously updated with new threat intelligence. While no system is 100% accurate, ScamGuard provides highly reliable risk assessments with transparent explanations so you can make informed decisions." },
];

const stats = [
  { value: "12,847", label: "Scams detected" },
  { value: "$2.3M", label: "Losses prevented" },
  { value: "4.9/5", label: "User rating" },
  { value: "98%", label: "Accuracy rate" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">ScamGuard</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/register">
              <Button size="sm" className="bg-gradient-to-r from-primary to-primary/80">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-30 dark:opacity-10"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/20 dark:bg-primary/10 blur-[120px] rounded-full"></div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered Scam Protection
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-balance max-w-3xl mx-auto animate-slide-up">
            Protect Your Family from{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Scams & Fraud
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance animate-slide-up">
            Paste any suspicious message and get an instant AI-powered risk assessment.
            Educate yourself, protect your loved ones, and stay one step ahead of scammers.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up">
            <Link to="/register">
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20">
                Start Free — 10 Credits
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base">
                See How It Works
              </Button>
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border/50 bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Everything You Need to Stay Safe
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From instant message analysis to family-wide protection, ScamGuard has you covered.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl border border-border/50 bg-card hover:shadow-lg hover:border-border transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 border-y border-border/50 bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">How It Works</h2>
            <p className="mt-4 text-lg text-muted-foreground">Three simple steps to stay protected.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", icon: AlertTriangle, title: "Spot Something Fishy", description: "You receive a suspicious text, email, or message that doesn't feel right." },
              { step: "2", icon: Search, title: "Paste & Analyze", description: "Forward or paste the message into ScamGuard. Our AI analyzes it instantly for scam patterns." },
              { step: "3", icon: Shield, title: "Get Clear Guidance", description: "Receive a risk score, explanation of tactics used, and actionable next steps to protect yourself." },
            ].map((item, i) => (
              <div key={i} className="relative text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
                  <item.icon className="w-8 h-8 text-primary-foreground" />
                </div>
                <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Choose the plan that fits your family's needs. Upgrade or downgrade anytime.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-2xl p-6 border transition-all duration-300 ${
                  plan.highlighted
                    ? "border-primary bg-gradient-to-b from-primary/10 to-transparent shadow-lg shadow-primary/10 scale-[1.02]"
                    : "border-border/50 bg-card hover:border-border hover:shadow-md"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="font-bold text-lg">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-sm font-medium text-primary mt-1">{plan.credits}</p>
                <Link to="/register" className="block mt-6">
                  <Button
                    className={`w-full ${plan.highlighted ? "bg-gradient-to-r from-primary to-primary/80" : ""}`}
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
                <div className="mt-6 space-y-2.5">
                  {plan.features.map((feature, j) => (
                    <div key={j} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                  {plan.notIncluded.map((feature, j) => (
                    <div key={j} className="flex items-start gap-2 opacity-50">
                      <span className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground">—</span>
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 border-y border-border/50 bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Loved by Families Everywhere</h2>
            <p className="mt-4 text-lg text-muted-foreground">Real stories from real users who stayed safe.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl border border-border/50 bg-card">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
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
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Frequently Asked Questions</h2>
            <p className="mt-4 text-lg text-muted-foreground">Everything you need to know about ScamGuard.</p>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="p-5 rounded-xl border border-border/50 bg-card">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-border/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 mb-6">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Start Protecting Your Family Today
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Join thousands of families who use ScamGuard to stay safe from scams. Free to start, no credit card required.
          </p>
          <Link to="/register" className="inline-block mt-8">
            <Button size="lg" className="h-12 px-8 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20">
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/50 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-medium">ScamGuard</span>
            <span>© 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-foreground transition-colors">Log in</Link>
            <Link to="/register" className="hover:text-foreground transition-colors">Sign up</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}