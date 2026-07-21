import React from "react";
import { ShieldCheck, Lock, Eye, Database, Mail, Users, Trash2, AlertTriangle } from "lucide-react";

export default function Privacy() {
  const sections = [
    {
      icon: Database,
      title: "Information We Collect",
      body: "When you use Vardin, we collect the following types of information:\n\n• Account information: Your email address and name (provided during registration).\n• Message content: When you submit a suspicious message or URL for analysis, the text is processed by our AI to assess scam risk. Personal information within messages (names, phone numbers, addresses) is automatically redacted before storage.\n• Usage data: We track the number of analyses you perform against your monthly credit allowance.\n• Family protection data: If you use the Family feature, we store the names and emails of protected seniors you add, along with your alert preferences.",
    },
    {
      icon: Eye,
      title: "How We Use Your Information",
      body: "Your information is used to:\n\n• Analyze suspicious messages and URLs for scam indicators using AI.\n• Send guardian alerts when a protected senior submits a high-risk message.\n• Track lesson progress and award XP in the Learning Center.\n• Process subscription payments through PayPal.\n• Improve our scam detection accuracy and educational content.\n• Send you email notifications about family alerts (if enabled in your profile).",
    },
    {
      icon: Lock,
      title: "How We Protect Your Data",
      body: "We take your privacy seriously:\n\n• Auto-redaction: Before storing any submitted message, we automatically remove personal information such as names, phone numbers, email addresses, and credit card numbers.\n• Encryption: All data is transmitted over HTTPS (TLS 1.2+).\n• Access control: Only you can see your own analyses and family data. Admins can access system data for support purposes only.\n• No selling: We never sell your personal data to third parties.",
    },
    {
      icon: Users,
      title: "Family Protection & Consent",
      body: "When you add a family member to your protection circle:\n\n• You provide their name and optional email address.\n• If they create a Vardin account, they can grant consent for you to receive alerts about their scam analyses.\n• Seniors must explicitly consent before their analyses are shared with their guardian.\n• You control which alerts you receive (all, high-risk only, or financial-only) in your profile settings.\n• You can remove a protected senior at any time, which deletes their association with your account.",
    },
    {
      icon: Mail,
      title: "Email Communications",
      body: "We may send you emails for:\n\n• Guardian alerts when a protected senior submits a high-risk message (if enabled).\n• Account verification and password reset.\n• Subscription confirmations and payment receipts.\n• Occasional product updates.\n\nYou can control email notifications in your Profile settings under Notifications.",
    },
    {
      icon: AlertTriangle,
      title: "AI Accuracy Disclaimer",
      body: "Vardin's scam detection is powered by artificial intelligence. While we strive for high accuracy, AI is not infallible and may produce incorrect assessments. A result indicating \"low risk\" does not guarantee that a message, URL, or image is safe, and a \"high risk\" result does not definitively prove malicious intent. Vardin's analyses are for informational and educational purposes only and should not be relied upon as the sole basis for any decision. Always use your own judgment, verify suspicious content through multiple sources, and contact official authorities or the relevant organization directly if you are unsure. Vardin is not liable for any losses or damages resulting from reliance on AI-generated assessments.",
    },
    {
      icon: Trash2,
      title: "Your Rights & Data Deletion",
      body: "You have the right to:\n\n• Access: View all data associated with your account.\n• Delete: Request deletion of your account and all associated data (analyses, family members, lesson progress).\n• Export: Request a copy of your data in a portable format.\n• Opt-out: Disable email notifications at any time in your Profile.\n\nTo exercise any of these rights, contact us through the Feedback page in the app.",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-3 animate-slide-up">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <ShieldCheck className="w-7 h-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Privacy & Data Policy</h1>
        <p className="text-muted-foreground text-sm">
          Last updated: July 2026
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-5 sm:p-6 space-y-3 animate-slide-up anim-delay-1">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Vardin is a scam detection and education platform designed to protect you and your family from online fraud. This policy explains what data we collect, how we use it, and the choices you have.
        </p>
      </div>

      {sections.map((section, i) => (
        <div
          key={i}
          className="bg-card rounded-2xl border border-border/50 p-5 sm:p-6 space-y-3 animate-slide-up"
          style={{ animationDelay: `${(i + 2) * 80}ms` }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <section.icon className="w-4.5 h-4.5 text-primary" />
            </div>
            <h2 className="font-semibold text-base">{section.title}</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {section.body}
          </p>
        </div>
      ))}

      <div className="bg-muted/30 rounded-2xl border border-border/30 p-5 text-center animate-fade-in">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Vardin is built on the Base44 platform. Your data is stored securely in compliance with applicable data protection regulations. If you have questions about your privacy, reach out through the Feedback page.
        </p>
      </div>
    </div>
  );
}