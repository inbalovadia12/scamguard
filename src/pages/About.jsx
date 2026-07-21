import React from "react";
import { ShieldCheck, Eye, Users, Mail, Globe, Lock, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function About() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background luxury-mesh">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div className="text-center mb-12 animate-slide-up">
          <div className="w-16 h-16 rounded-2xl luxury-gradient-btn flex items-center justify-center mx-auto shadow-lg shadow-primary/20 mb-6">
            <ShieldCheck className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-heading mb-4">
            About Vardin
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Vardin is an AI-powered scam detection and digital safety platform built to protect
            people from the growing threat of online fraud.
          </p>
        </div>

        <div className="prose prose-lg max-w-none space-y-6 text-foreground/90 animate-slide-up" style={{ animationDelay: "100ms" }}>
          <p className="text-base leading-relaxed">
            Vardin was created to address one of the most urgent problems of the digital age: scams
            are becoming increasingly sophisticated, and anyone can fall victim. Phishing emails,
            smishing texts, romance scams, fake job offers, crypto investment fraud, marketplace
            scams, and tech support impostors cost ordinary people billions every year. Vardin uses
            artificial intelligence to analyze suspicious messages, URLs, phone numbers, images,
            and entire web pages in real time, giving users an instant risk assessment before they
            engage.
          </p>
          <p className="text-base leading-relaxed">
            Vardin is designed for everyone, but it pays special attention to those who are most
            vulnerable. Seniors and their families can use Vardin's family protection features to
            monitor for high-risk scam encounters and receive guardian alerts when something
            dangerous is detected. Everyday internet users benefit from the Chrome extension, the
            scam feed, local scam intelligence maps, phone number lookups, identity exposure scans,
            and interactive lessons that teach the warning signs of fraud in plain language. Whether
            you are a digital native helping an elderly parent, a cautious shopper checking a
            marketplace listing, or someone who just received a suspicious text, Vardin gives you
            the tools to verify before you trust.
          </p>
          <p className="text-base leading-relaxed">
            Vardin is built by a small, dedicated team of engineers, designers, and security
            researchers who believe that digital safety should be accessible to everyone. Our
            mission is simple: make the internet a safer place, one scan at a time. We combine
            AI-driven analysis with real-time community reports, VirusTotal reputation data, and
            up-to-date scam intelligence to deliver accurate, actionable guidance. We are committed
            to continuous improvement and welcome feedback from the community we serve.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 animate-slide-up" style={{ animationDelay: "200ms" }}>
          <div className="bg-card rounded-2xl border border-border/50 p-5 text-center">
            <Eye className="w-6 h-6 text-primary mx-auto mb-2" />
            <h3 className="font-semibold text-sm">AI Scam Detection</h3>
            <p className="text-xs text-muted-foreground mt-1">Real-time analysis of messages, URLs, and images</p>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 p-5 text-center">
            <Users className="w-6 h-6 text-primary mx-auto mb-2" />
            <h3 className="font-semibold text-sm">Family Protection</h3>
            <p className="text-xs text-muted-foreground mt-1">Guardian alerts for seniors and loved ones</p>
          </div>
          <div className="bg-card rounded-2xl border border-border/50 p-5 text-center">
            <Globe className="w-6 h-6 text-primary mx-auto mb-2" />
            <h3 className="font-semibold text-sm">Community Intelligence</h3>
            <p className="text-xs text-muted-foreground mt-1">Shared scam reports and local risk maps</p>
          </div>
        </div>

        <div className="mt-8 bg-warning/10 rounded-2xl border border-warning/30 p-5 sm:p-6 flex gap-4 animate-slide-up" style={{ animationDelay: "300ms" }}>
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h2 className="font-semibold text-sm">AI Accuracy Disclaimer</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Vardin's analyses are generated by artificial intelligence. While we strive for high
              accuracy, AI is not always right — it may produce incorrect risk assessments or miss
              subtle indicators. Always use your own judgment, verify suspicious content through
              multiple sources, and contact official authorities directly if you are unsure.
              Vardin's assessments are for informational and educational purposes only and should not
              be your sole basis for any decision.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}