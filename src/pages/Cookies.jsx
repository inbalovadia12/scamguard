import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Cookie } from "lucide-react";

const EFFECTIVE_DATE = "September 11, 2026";

export default function Cookies() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-16">
      <header className="border-b border-border pb-7 sm:pb-8 mb-7 sm:mb-8">
        <div className="flex items-center gap-3 text-primary mb-5">
          <Cookie className="w-6 h-6" />
          <span className="text-sm font-semibold tracking-wide uppercase">Legal</span>
        </div>
        <h1 className="text-[2rem] leading-tight sm:text-4xl font-bold tracking-tight font-heading">Cookie Policy</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {EFFECTIVE_DATE}</p>
          <Link to="/dashboard" className="mt-3 inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            Back to Dashboard
          </Link>
        </div>
        <p className="mt-4 max-w-3xl text-[14px] sm:text-base leading-6 sm:leading-7 text-muted-foreground">
          This Cookie Policy explains how Vardin uses cookies and similar browser storage technologies in the current application.
        </p>
      </header>

      <div className="space-y-0">
        <Section title="1. What we use">
          <p>Vardin currently uses browser storage and a limited functional cookie to keep the application working and remember user preferences. Examples include authentication/session restoration, language, theme, accessibility settings, referral attribution, dismissed notices, community preferences and other local interface state.</p>
          <p>The application also writes a functional sidebar-preference cookie. These technologies are used for application functionality rather than for selling advertising profiles.</p>
        </Section>

        <Section title="2. What we do not currently claim">
          <p>The inspected Vardin source does not contain a dedicated third-party behavioral advertising or analytics SDK such as Google Analytics, Mixpanel, PostHog or Sentry. Vardin therefore does not claim to use those services for tracking users across websites.</p>
          <p>The in-app Analytics page is built from Vardin application records; it is not the same thing as a third-party analytics tracker.</p>
        </Section>

        <Section title="3. Third-party cookies and technologies">
          <p>When Vardin embeds, calls or redirects to a third-party service, that provider may use its own cookies, local storage, logs, pixels or other technical identifiers under its own terms. Vardin does not control those independent technologies.</p>
          <p>Examples of integrated providers can include Base44, payment services and other technology providers described in the Privacy Policy. Their policies should be reviewed for their own handling of browser and device information.</p>
        </Section>

        <Section title="4. Your choices">
          <p>You can generally clear cookies and local storage through your browser settings. Doing so may sign you out, remove saved preferences, or affect functionality. Some browser storage is necessary for the application to operate correctly and is not presented as an optional advertising tracker.</p>
          <p>If Vardin introduces optional analytics, advertising, or other non-essential tracking technologies in the future, this Policy should be updated before those technologies are deployed where applicable law requires notice or consent.</p>
        </Section>

        <Section title="5. Beta service and changes">
          <p>Vardin is currently in beta. The application's storage and tracking behavior may change as features are added or removed. Material changes to privacy or tracking practices will be reflected in the applicable notices where required.</p>
        </Section>

        <Section title="6. Questions">
          <p>Questions about cookies or browser storage can be sent to <a className="text-primary underline underline-offset-2" href="mailto:inbal5252@gmail.com">inbal5252@gmail.com</a>.</p>
        </Section>
      </div>

      <footer className="mt-7 pt-6 border-t border-border text-sm flex flex-wrap gap-x-5 gap-y-2">
        <Link to="/privacy" className="text-primary hover:underline inline-flex items-center gap-1">Privacy Policy <ArrowRight className="w-3.5 h-3.5" /></Link>
        <Link to="/data-collection" className="text-primary hover:underline inline-flex items-center gap-1">Data Collection <ArrowRight className="w-3.5 h-3.5" /></Link>
        <Link to="/terms" className="text-primary hover:underline inline-flex items-center gap-1">Terms <ArrowRight className="w-3.5 h-3.5" /></Link>
      </footer>
    </div>
  );
}

function Section({ title, children }) {
  return <section className="border-b border-border/70 py-7 sm:py-8 last:border-0"><h2 className="text-lg sm:text-xl font-semibold tracking-tight">{title}</h2><div className="mt-3 space-y-4 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground">{children}</div></section>;
}
