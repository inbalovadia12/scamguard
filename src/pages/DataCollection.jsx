import React from "react";
import { Link } from "react-router-dom";

const EFFECTIVE_DATE = "September 11, 2026";

const rows = [
  ["Account", "Email, name, plan/status, settings, onboarding and preferences", "Authentication, account operation, subscriptions and requested features"],
  ["Submitted content", "Messages, emails, chats, URLs, screenshots, images, files, QR data and marketplace content", "Requested scam detection, analysis and explanations"],
  ["Call Guard", "Live audio chunks, uploaded recordings, transcripts, speaker labels and call-analysis metadata", "Speech-to-text, speaker labeling and scam detection"],
  ["Phone data", "Phone numbers, reputation results, country/carrier and community evidence", "Phone reputation and caller-risk checks"],
  ["Family protection", "Names, emails, phone numbers, consent status, settings, alerts and notes", "Family protection and guardian notifications"],
  ["Community", "Scam reports, stories, display names, categories, channels and country", "Community scam intelligence and feeds"],
  ["Payments", "Subscription and credit-purchase transaction information", "Billing and paid-feature management through PayPal"],
  ["Technical/local data", "Session tokens, browser storage, preferences, functional cookie and platform request/security metadata", "Authentication, security, preferences and service operation"],
];

export default function DataCollection() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-16 break-words [overflow-wrap:anywhere]">
      <header className="border-b border-border/60 pb-7 sm:pb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Legal notice</p>
        <h1 className="mt-3 text-[2rem] leading-tight sm:text-4xl font-bold tracking-tight">Data Collection Notice</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="mt-3 text-sm text-muted-foreground">Last Updated: {EFFECTIVE_DATE}</p>
          <Link to="/dashboard" className="mt-3 inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            Back to Dashboard
          </Link>
        </div>
        <p className="mt-5 max-w-4xl text-sm sm:text-base leading-7 text-muted-foreground">
          This is Vardin's concise notice of the principal categories of information processed by the current application. Vardin is currently in beta, so features and data flows may change as the product is tested and improved. It supplements, and does not replace, the <Link className="text-primary underline underline-offset-2" to="/privacy">Privacy Policy</Link>.
        </p>
      </header>

      <section className="py-7 border-b border-border/60">
        <h2 className="text-lg sm:text-xl font-semibold">Current data categories</h2>
        <div className="mt-4 space-y-3 md:hidden">
          {rows.map(([category, examples, purpose]) => (
            <article key={category} className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground">{category}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground"><strong>Examples:</strong> {examples}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground"><strong>Purpose:</strong> {purpose}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 hidden md:block overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50"><tr><th className="px-4 py-3">Category</th><th className="px-4 py-3">Examples</th><th className="px-4 py-3">Primary purpose</th></tr></thead>
            <tbody className="divide-y divide-border">{rows.map(([category, examples, purpose]) => <tr key={category} className="align-top"><td className="px-4 py-4 font-medium">{category}</td><td className="px-4 py-4 text-muted-foreground">{examples}</td><td className="px-4 py-4 text-muted-foreground">{purpose}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="py-7 border-b border-border/60 space-y-4 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">Call Guard</h2>
        <p>Call Guard is not local-only. Microphone/system-audio chunks and uploaded call recordings are sent to Vardin's backend for transcription and analysis. The current backend uses Groq as its sole speech-to-text provider, and Groq also classifies transcript segments for speaker labeling. Groq states that inference customer data is not retained by default, but inputs/outputs may be temporarily retained for reliability or abuse monitoring for up to 30 days unless Zero Data Retention is enabled. Vardin does not claim that production Groq ZDR is enabled unless that account setting has been separately verified.</p>
        <p>Vardin stores Live Guard transcript/analysis records. Uploaded audio passes through Base44-managed file handling, and the current application does not implement a Vardin-controlled automatic deletion schedule for those uploaded files or for every provider-side log.</p>
      </section>

      <section className="py-7 border-b border-border/60 space-y-4 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">AI and third parties</h2>
        <p>Depending on the feature, submitted content may be sent to Base44-managed AI services, Google Gemini, Groq, VirusTotal, URLhaus, QR Server, ElevenLabs, PayPal or Gmail. The exact recipient depends on the feature used. Call Guard audio is sent to Groq for speech-to-text; Call Guard audio is not sent to ElevenLabs for transcription. See the full <Link className="text-primary underline underline-offset-2" to="/privacy">Privacy Policy</Link> for the current data-flow description.</p>
      </section>

      <section className="py-7 border-b border-border/60 space-y-4 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">Retention and deletion</h2>
        <p>Vardin currently has an account-deletion workflow that attempts to remove many user-owned database records. It does not yet prove complete deletion of authentication identity, uploaded files, all related records, third-party logs or backups. Vardin therefore does not promise universal immediate deletion.</p>
      </section>

      <section className="py-7 space-y-4 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground">
        <h2 className="text-lg sm:text-xl font-semibold text-foreground">Privacy requests</h2>
        <p>Depending on applicable law, you may request access, correction, deletion, portability, restriction or objection. Contact <a className="text-primary underline underline-offset-2 break-all" href="mailto:inbal5252@gmail.com">inbal5252@gmail.com</a>. Identity verification may be required.</p>
      </section>
    </div>
  );
}
