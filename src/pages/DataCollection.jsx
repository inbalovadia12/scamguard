import React from "react";
import { Link } from "react-router-dom";

const EFFECTIVE_DATE = "September 10, 2026";

const rows = [
  ["Account information", "Name, email address, authentication and account settings", "Create and secure your account; provide the Services; support you"],
  ["Submitted content", "Messages, URLs, screenshots, images, documents and other content you submit", "Perform requested scam detection, analysis and related features"],
  ["Analysis information", "Risk scores, classifications, explanations, tactics, scan type and usage/credit activity", "Return results, maintain your account, provide history and improve reliability"],
  ["Family-protection information", "Names, emails, consent status, relationships, protection settings and alerts", "Provide consent-based family protection and notifications"],
  ["Subscription information", "Plan, subscription status and payment-related transaction information", "Provide paid features and manage billing; payment details are handled by payment providers"],
  ["Device and technical information", "IP address, browser/device information, timestamps, referring pages and security diagnostics", "Security, fraud prevention, troubleshooting and service operation"],
  ["Support communications", "Messages, feedback and support records", "Respond to requests and maintain support records"],
];

export default function DataCollection() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-16 break-words [overflow-wrap:anywhere]">
      <header className="border-b border-border/60 pb-7 sm:pb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Legal notice</p>
        <h1 className="mt-3 text-[2rem] leading-tight sm:text-4xl font-bold tracking-tight">Data Collection Notice</h1>
        <p className="mt-3 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>
        <p className="mt-6 max-w-3xl text-sm sm:text-base leading-7 text-muted-foreground">
          This Notice is intended to provide the concise, point-of-collection description of the categories of personal information Vardin collects, the purposes for collection, and the principal categories of recipients. For the full policy and privacy rights, see the <Link className="text-primary underline underline-offset-2" to="/privacy">Privacy Policy</Link>.
        </p>
      </header>

      <section className="py-7 sm:py-8 border-b border-border/60 min-w-0">
        <h2 className="text-lg sm:text-xl font-semibold">What we collect</h2>
        <div className="mt-4 sm:mt-5 space-y-3 md:hidden">
          {rows.map(([category, examples, purpose]) => (
            <article key={category} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h3 className="font-semibold text-foreground">{category}</h3>
              <div className="mt-3 space-y-3 text-sm leading-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Examples</p>
                  <p className="mt-1 text-muted-foreground">{examples}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Primary purpose</p>
                  <p className="mt-1 text-muted-foreground">{purpose}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-4 hidden md:block overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Examples</th>
                <th className="px-4 py-3 font-semibold">Primary purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(([category, examples, purpose]) => (
                <tr key={category} className="align-top">
                  <td className="px-4 py-4 font-medium text-foreground">{category}</td>
                  <td className="px-4 py-4 text-muted-foreground">{examples}</td>
                  <td className="px-4 py-4 text-muted-foreground">{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="py-7 sm:py-8 border-b border-border/60 space-y-4 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground break-words [overflow-wrap:anywhere]">
        <h2 className="text-xl font-semibold text-foreground">How information is collected</h2>
        <p>Information may be collected directly from you when you register, configure your account, submit content, use family features, contact support, or purchase a subscription. Technical information may be collected automatically when you use the Services. Information may also be received from service providers or from another user when a family-protection or consent workflow involves you.</p>
        <p>Vardin may use browser storage and similar technologies for authentication, security, preferences, and essential functionality. Third-party providers may use their own technologies when they provide integrated services.</p>
      </section>

      <section className="py-7 sm:py-8 border-b border-border/60 space-y-4 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground break-words [overflow-wrap:anywhere]">
        <h2 className="text-xl font-semibold text-foreground">Submitted messages, images, files and URLs</h2>
        <p>When you ask Vardin to analyze content, the content is processed to provide the requested result. Submitted material may contain personal information belonging to you or another person. You are responsible for having the authority to submit information about other people.</p>
        <p>Some analysis features use third-party AI, cloud, file-storage, or infrastructure providers. Content may therefore be transmitted to those providers as necessary to perform the requested feature. Vardin applies automated redaction in certain storage workflows, but redaction is not perfect and is not a guarantee that sensitive information will never be processed or stored.</p>
      </section>

      <section className="py-7 sm:py-8 border-b border-border/60 space-y-4 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground break-words [overflow-wrap:anywhere]">
        <h2 className="text-xl font-semibold text-foreground">Sharing and recipients</h2>
        <p>Depending on the feature you use, information may be disclosed to hosting and infrastructure providers, authentication and file-storage providers, AI providers, payment processors such as PayPal, email or notification providers, security and operational vendors, professional advisers, and authorities where legally required.</p>
        <p>Vardin does not sell personal information for money. If a future practice constitutes a sale or sharing under an applicable privacy law, Vardin will provide the disclosures and choices required by that law.</p>
      </section>

      <section className="py-7 sm:py-8 border-b border-border/60 space-y-4 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground break-words [overflow-wrap:anywhere]">
        <h2 className="text-xl font-semibold text-foreground">Retention</h2>
        <p>Information is retained for as long as reasonably necessary for the purposes described in the Privacy Policy, including service delivery, security, legal obligations, dispute resolution, and legitimate operational needs. Exact retention periods vary by data type and feature.</p>
      </section>

      <section className="py-7 sm:py-8 border-b border-border/60 space-y-4 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground break-words [overflow-wrap:anywhere]">
        <h2 className="text-xl font-semibold text-foreground">Your choices and rights</h2>
        <p>Depending on applicable law, you may have rights to access, delete, correct, export, restrict, object to, or otherwise control certain uses of your personal information. You may also have rights concerning the sale or sharing of personal information and targeted advertising.</p>
        <p>To exercise a privacy right, contact <a className="text-primary underline underline-offset-2" href="mailto:inbal5252@gmail.com">inbal5252@gmail.com</a>. We may verify your identity as permitted or required by law.</p>
      </section>

      <section className="py-7 sm:py-8 space-y-4 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground break-words [overflow-wrap:anywhere]">
        <h2 className="text-xl font-semibold text-foreground">Children</h2>
        <p>Because family and educational features may involve younger users, Vardin takes child privacy seriously. Where a law requires parental authorization or additional safeguards before collecting a child’s personal information, Vardin will use the required process or will not knowingly collect that information in the prohibited circumstances. Parents or guardians can contact us about a child’s information at <a className="text-primary underline underline-offset-2" href="mailto:inbal5252@gmail.com">inbal5252@gmail.com</a>.</p>
      </section>

      <div className="mt-7 sm:mt-8 rounded-xl border border-border bg-muted/30 p-4 sm:p-5 text-xs leading-6 text-muted-foreground overflow-hidden">
        This Notice is intended to satisfy transparency and notice-at-collection objectives where applicable; it does not replace the full Privacy Policy or jurisdiction-specific notices that may be required. The Vardin operator should obtain legal review of the company identity, applicable jurisdictions, retention schedule, vendor list, cookie practices, and children’s privacy controls before relying on this Notice as a compliance document.
      </div>
    </div>
  );
}
