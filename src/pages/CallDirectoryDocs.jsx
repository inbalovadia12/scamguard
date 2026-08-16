import React from "react";
import { BookOpen, ShieldCheck, KeyRound, Database, RefreshCw, CheckCircle2, Lock } from "lucide-react";
import { Link } from "react-router-dom";

const ENDPOINTS = [
  { name: "Entitlement", method: "getCallDirectoryEntitlement", desc: "Check whether the signed-in user's plan includes caller-ID.", body: "(empty)" },
  { name: "Snapshot", method: "getCallDirectorySnapshot", desc: "Full published dataset for initial load.", body: '{ "limit": 5000, "after": null }' },
  { name: "Changes", method: "getCallDirectoryChanges", desc: "Incremental ADD/UPDATE/REMOVE since a dataset version.", body: '{ "since": 12, "limit": 5000, "after": null }' },
];

function Section({ icon: Icon, title, children }) {
  return (
    <section className="bg-card rounded-2xl border border-border/50 p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold font-heading">{title}</h2>
      </div>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Code({ children }) {
  return <pre className="bg-muted/60 rounded-lg p-3 text-xs overflow-x-auto font-mono text-foreground border border-border/40">{children}</pre>;
}

export default function CallDirectoryDocs() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-heading">iOS Call Directory Integration</h1>
          <p className="text-sm text-muted-foreground">Internal developer documentation for the native iOS caller-identification component.</p>
        </div>
      </div>

      <div className="flex items-start gap-2 text-sm bg-warning/5 border border-warning/20 rounded-xl p-4">
        <Lock className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
        <p className="text-muted-foreground">
          This page documents Vardin's backend APIs. The Apple Call Directory Extension itself must be built
          in a native iOS app (outside Base44). This backend provides everything the extension needs:
          authentication, a versioned snapshot, incremental changes, labels, and entitlement.
        </p>
      </div>

      <Section icon={ShieldCheck} title="Overview">
        <p>Vardin maintains a canonical phone-number reputation index (<code>PhoneReputation</code>), fed by the existing Vardin number-lookup engine. The Call Directory dataset is a versioned, published view of that index.</p>
        <p>Labels such as <strong>“Vardin: Scam Likely”</strong> are configurable from the Admin → Call Directory tab and are returned per entry in the snapshot/changes payloads.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>SCAM</strong> → “Vardin: Scam Likely”</li>
          <li><strong>SPAM</strong> → “Vardin: Spam”</li>
          <li><strong>SUSPICIOUS</strong> → “Vardin: Suspicious”</li>
          <li><strong>SAFE</strong> → “Vardin: Safe” (verified businesses, or when enabled)</li>
          <li><strong>UNKNOWN</strong> → no entry (never auto-classified as a scam)</li>
        </ul>
      </Section>

      <Section icon={KeyRound} title="Authentication">
        <p>The iOS app authenticates against Vardin's existing auth system (email/password or a long-lived access token). Send the access token on every request. No second login system exists.</p>
        <Code>{`// All endpoints: send the Vardin access token
Authorization: Bearer <vardin_access_token>`}</Code>
        <p>The user must have a caller-ID entitled plan (Plus or Premium). Verify with the Entitlement endpoint before first sync, and again on plan changes.</p>
      </Section>

      <Section icon={Database} title="Endpoints">
        <p>All endpoints are Base44 backend functions invoked over HTTPS with a JSON body (Base44 functions use a single POST path with parameters in the body). The iOS app uses the Base44 function-invocation endpoint.</p>
        {ENDPOINTS.map((e) => (
          <div key={e.method} className="border border-border/40 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge>{e.name}</Badge>
              <code className="text-xs text-primary">{e.method}</code>
            </div>
            <p className="text-xs text-muted-foreground">{e.desc}</p>
            <p className="text-xs text-muted-foreground mt-1">Request body:</p>
            <Code>{e.body}</Code>
          </div>
        ))}
      </Section>

      <Section icon={RefreshCw} title="Synchronization procedure">
        <ol className="list-decimal pl-5 space-y-1.5">
          <li>On install / first launch: call <code>getCallDirectoryEntitlement</code>. Stop if not entitled.</li>
          <li>Call <code>getCallDirectorySnapshot</code> (paginate with <code>after</code> while <code>has_more</code>). Store all entries + the returned <code>version</code>. Write them into Apple's <code>CXCallDirectoryManager</code> Call Directory Extension data.</li>
          <li>Periodically (e.g. on app launch / push / background fetch): call <code>getCallDirectoryChanges</code> with <code>since</code> = the stored version. Apply ADD/UPDATE/REMOVE to the local Call Directory store. Update stored <code>version</code> when done.</li>
          <li>If <code>has_more</code> is true, page with <code>after</code> until false, then store the final <code>version</code>.</li>
        </ol>
      </Section>

      <Section icon={CheckCircle2} title="Response formats">
        <p className="text-foreground font-medium mb-1">Snapshot</p>
        <Code>{`{
  "version": 14,
  "generated_at": "2026-08-16T17:49:00.000Z",
  "entries": [
    { "phone_number": "+972501234567", "label": "Vardin: Scam Likely" },
    { "phone_number": "+972521234567", "label": "Vardin: Spam" }
  ],
  "has_more": false,
  "next_after": null
}`}</Code>
        <p className="text-foreground font-medium mb-1 mt-3">Changes</p>
        <Code>{`{
  "version": 15,
  "generated_at": "2026-08-16T18:00:00.000Z",
  "changes": [
    { "phone_number": "+972501234567", "operation": "UPDATE", "label": "Vardin: Scam Likely", "version": 15, "timestamp": "..." },
    { "phone_number": "+972533333333", "operation": "ADD", "label": "Vardin: Suspicious", "version": 15, "timestamp": "..." },
    { "phone_number": "+972544444444", "operation": "REMOVE", "label": "", "version": 15, "timestamp": "..." }
  ],
  "has_more": false,
  "next_after": null
}`}</Code>
        <p className="text-foreground font-medium mb-1 mt-3">Entitlement</p>
        <Code>{`{ "entitled": true, "caller_id_enabled": true, "plan": "premium", "entitled_plans": ["plus","premium"], "upgrade_url": "https://vardin.base44.app/pricing" }`}</Code>
      </Section>

      <Section icon={KeyRound} title="Versioning & error responses">
        <p>Versions are monotonically increasing integers. <code>since</code> is exclusive (returns changes with <code>version &gt; since</code>). Store the highest version seen; never go backwards.</p>
        <p className="text-foreground font-medium mb-1 mt-2">Errors</p>
        <Code>{`401 { "error": "Authentication required" }
403 { "error": "Caller identification requires a Vardin Plus or Premium plan", "upgrade_url": "..." }
500 { "error": "<message>" }`}</Code>
        <p>On 403, prompt the user to upgrade. On 500, retry with backoff.</p>
      </Section>

      <Section icon={Database} title="Subscription / entitlement">
        <p>Entitlement reuses Vardin's existing plan hierarchy stored on the user record (<code>subscription_plan</code>). Plans that include caller-ID are defined in <code>CallerIdConfig.entitled_plans</code> (default: <code>plus</code>, <code>premium</code>) — admin-configurable, never hard-coded in the iOS app. Prices are not duplicated; the iOS app only needs the boolean <code>entitled</code>.</p>
      </Section>

      <Section icon={ShieldCheck} title="Security">
        <p>All external API credentials (VirusTotal, etc.) and the reputation database remain server-side. The iOS client only receives published phone-number + label pairs. Admin endpoints (regenerate, config) require an admin role. Phone-number input is normalized/validated server-side before any lookup or storage.</p>
      </Section>

      <Section icon={BookOpen} title="What must be built outside Base44">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>A native iOS app with a <strong>Call Directory Extension</strong> target (Apple's <code>CallKit</code> / <code>CXCallDirectoryManager</code>).</li>
          <li>Local storage of the snapshot + applied changes (e.g. Core Data / SQLite).</li>
          <li>Mapping each entry's <code>phone_number</code> to <code>CXCallDirectoryPhoneNumber</code> and <code>label</code> to <code>label</code> in <code>CXCallDirectoryExtensionContext.addIdentificationEntry(...)</code>.</li>
          <li>Background sync scheduling (BGTaskScheduler) calling <code>getCallDirectoryChanges</code> and invoking <code>CXCallDirectoryManager.reloadExtension</code> after applying changes.</li>
          <li>Vardin sign-in (reuse Vardin auth) to obtain the access token sent to these endpoints.</li>
        </ul>
        <p className="pt-2">The backend, dataset model, labels, versioning, and entitlement are all complete here — no backend redesign is needed to generate the Swift app + extension.</p>
      </Section>

      <div className="text-center pt-2">
        <Link to="/admin" className="text-sm text-primary hover:underline">← Back to Admin</Link>
      </div>
    </div>
  );
}

function Badge({ children }) {
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{children}</span>;
}