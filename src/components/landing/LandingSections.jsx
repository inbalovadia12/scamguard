import { Search, Users, Bell, Bot, Globe, Phone, Mail, ShoppingCart, Share2, BarChart3, ShieldCheck, AlertTriangle, Link2, MessageSquare, Eye } from "lucide-react";

const demos = [
  { icon: MessageSquare, title: "SMS Scam Detection", desc: "Paste a suspicious text message and get an instant risk score with tactic breakdown.", color: "bg-primary/10 text-primary" },
  { icon: ShoppingCart, title: "Marketplace Verification", desc: "Check if a listing on Facebook, eBay, or Craigslist is a scam before you buy.", color: "bg-chart-2/10 text-chart-2" },
  { icon: Mail, title: "Email Analysis", desc: "Forward suspicious emails to detect phishing, fake invoices, and impersonation attempts.", color: "bg-chart-3/10 text-chart-3" },
  { icon: Phone, title: "Phone Number Reputation", desc: "Look up any phone number to see if it's been reported as a scam or spam caller.", color: "bg-chart-4/10 text-chart-4" },
  { icon: Globe, title: "Website Reputation", desc: "Check if a website is legitimate before entering your personal or payment information.", color: "bg-chart-5/10 text-chart-5" },
  { icon: Eye, title: "Social Profile Verification", desc: "Verify if a social media account is real or a catfish/impersonation profile.", color: "bg-primary/10 text-primary" },
];

const features = [
  { icon: Search, title: "AI Scam Analysis", desc: "Advanced AI models analyze messages, links, and content for manipulation tactics." },
  { icon: Link2, title: "Link Verification", desc: "Check any URL for phishing, malware, and reputation before you click." },
  { icon: Mail, title: "Email Protection", desc: "Detect phishing emails, fake invoices, and impersonation attempts instantly." },
  { icon: MessageSquare, title: "SMS Detection", desc: "Identify scam texts including package delivery, bank fraud, and OTP theft attempts." },
  { icon: Phone, title: "Phone Number Reputation", desc: "Look up caller reputation and check if a number is associated with scams." },
  { icon: ShoppingCart, title: "Marketplace Safety Checks", desc: "Verify marketplace listings and sellers before making a purchase." },
  { icon: Users, title: "Family Safety Network", desc: "Invite family members, share alerts, and protect your loved ones collectively." },
  { icon: Bell, title: "Shared Scam Alerts", desc: "Get notified the moment a family member encounters a suspicious message." },
  { icon: Share2, title: "Community Reports", desc: "Crowdsourced scam reports keep everyone informed about the latest threats." },
  { icon: ShieldCheck, title: "Real-Time Risk Scores", desc: "Every analysis includes a 0-100 risk score with a plain-English explanation." },
];

const steps = [
  { icon: Search, title: "Paste or Upload", desc: "Share a suspicious link, message, phone number, or screenshot." },
  { icon: Bot, title: "AI Analyzes", desc: "Vardin's AI evaluates credibility signals, tactics, and threat patterns." },
  { icon: AlertTriangle, title: "Get Risk Score", desc: "Receive a clear risk score with explanations and recommended next steps." },
  { icon: Users, title: "Protect Family", desc: "Share findings with your family network and stay protected together." },
];

export default function LandingSections() {
  return (
    <>
      {/* Product Demo */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">One Tool. Total Protection.</h2>
            <p className="mt-4 text-lg text-muted-foreground">Vardin analyzes every type of scam across every channel.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {demos.map((demo, i) => (
              <div key={i} className="group p-6 rounded-2xl border border-border/50 bg-card hover:shadow-lg hover:border-border transition-all duration-300">
                <div className={`w-12 h-12 rounded-xl ${demo.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <demo.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-lg mb-2 font-heading">{demo.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{demo.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section id="features" className="py-24 border-y border-border/50 bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">Everything You Need to Stay Safe</h2>
            <p className="mt-4 text-lg text-muted-foreground">From instant message analysis to family-wide protection networks.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div key={i} className="p-5 rounded-2xl border border-border/50 bg-background hover:border-primary/30 transition-all duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm font-heading">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading">How Vardin Works</h2>
            <p className="mt-4 text-lg text-muted-foreground">Four simple steps to stay protected.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="relative text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
                  <step.icon className="w-8 h-8 text-primary-foreground" />
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-base mb-2 font-heading">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}