import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, AlertTriangle, Scale, Lock, Ban, CheckCircle2 } from "lucide-react";

const sections = [
  {
    icon: AlertTriangle,
    title: "AI and Scam-Detection Limitations",
    body: `Vardin uses automated systems, including artificial intelligence, statistical pattern recognition, reputation data, and other automated signals. These systems can make mistakes, miss relevant information, rely on incomplete or outdated data, or produce results that are misleading in a particular situation.

A Vardin risk score, risk level, warning, classification, recommendation, explanation, confidence indicator, or other AI-generated output is a prediction or assessment — not a guarantee, certification, determination of fact, or professional opinion.

Vardin does not guarantee that any call, message, link, website, image, wallet, transaction, business, account, or person is safe, legitimate, fraudulent, malicious, or trustworthy. A low-risk or "safe" result must not be treated as proof of safety. A high-risk or "scam" result is not, by itself, proof of fraud or malicious intent.`
  },
  {
    icon: Scale,
    title: "No Professional Advice",
    body: `Vardin provides general informational and educational assistance. It is not a substitute for professional advice. Do not rely solely on Vardin for financial, legal, medical, cybersecurity, identity-theft, tax, insurance, investment, employment, or other high-stakes decisions.

When the consequences of a decision could be significant, independently verify the relevant facts and contact the appropriate bank, merchant, platform, government authority, security professional, lawyer, doctor, financial professional, or other qualified professional.`
  },
  {
    icon: CheckCircle2,
    title: "Independent Verification",
    body: `You are responsible for evaluating information before acting on it. Verify important requests through an independent channel that you find yourself rather than using contact details supplied by a suspicious message or caller. When appropriate, seek confirmation from the organization or person through a known, trusted contact method.`
  },
  {
    icon: Ban,
    title: "Emergency and Recovery Situations",
    body: `Vardin may provide suggested recovery steps, but those suggestions may be incomplete, jurisdiction-specific, delayed, or inappropriate to your circumstances. If you believe money, credentials, identity information, devices, or accounts are at immediate risk, contact the relevant institution or competent authority directly and promptly.`
  },
  {
    icon: Lock,
    title: "User Responsibility and Inputs",
    body: `You are responsible for the information you choose to submit and for complying with applicable laws and third-party terms. Do not submit information you are not authorized to share. You should remove unnecessary sensitive information before uploading content whenever practical.`
  },
  {
    icon: ShieldCheck,
    title: "Service Provided As Is",
    body: `To the maximum extent permitted by applicable law, Vardin is provided on an "as is" and "as available" basis. We do not promise uninterrupted availability, complete accuracy, error-free operation, or that every scam, threat, fraud attempt, or unsafe situation will be detected. To the maximum extent permitted by applicable law, Vardin and its providers disclaim liability for losses arising from reliance on automated assessments or recommendations, except where such liability cannot lawfully be excluded.`
  },
];

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      <div className="text-center space-y-3 animate-slide-up">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
          <ShieldCheck className="w-7 h-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-heading">Terms of Service</h1>
        <p className="text-muted-foreground text-sm">Last updated: September 2026</p>
      </div>

      <div className="bg-warning/5 rounded-2xl border border-warning/25 p-5 sm:p-6 animate-slide-up">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold">Important AI notice</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1">
              Vardin's AI analyses are automated predictions and may be inaccurate or incomplete. No Vardin result guarantees that something is safe or fraudulent. Independently verify important information and do not rely solely on Vardin for high-stakes decisions.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border/50 p-5 sm:p-6 space-y-3 animate-slide-up">
        <h2 className="font-semibold">Acceptance</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          By creating or using a Vardin account, you agree to these Terms of Service and acknowledge the limitations of automated scam detection described below. If you do not agree, do not use the service.
        </p>
      </div>

      {sections.map((section, i) => (
        <section key={i} className="bg-card rounded-2xl border border-border/50 p-5 sm:p-6 space-y-3 animate-slide-up" style={{ animationDelay: `${(i + 1) * 60}ms` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <section.icon className="w-4.5 h-4.5 text-primary" />
            </div>
            <h2 className="font-semibold text-base">{section.title}</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{section.body}</p>
        </section>
      ))}

      <div className="text-center text-xs text-muted-foreground leading-relaxed px-4">
        These Terms are intended to describe the service's limitations and are not a guarantee that any particular limitation of liability is enforceable in every jurisdiction. If you have a legal question about your circumstances, consult a qualified lawyer.
        <div className="mt-3"><Link to="/privacy" className="text-primary hover:underline">Privacy & Data Policy</Link></div>
      </div>
    </div>
  );
}