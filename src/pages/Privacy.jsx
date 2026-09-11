import React from "react";

const EFFECTIVE_DATE = "September 11, 2026";

function Section({ number, title, children }) {
  return (
    <section id={`privacy-${number}`} className="border-b border-border/60 py-7 sm:py-9 last:border-b-0 scroll-mt-24">
      <div className="flex gap-3 sm:gap-5">
        <div className="hidden sm:block w-9 shrink-0 pt-1 text-xs font-semibold text-muted-foreground tabular-nums">{String(number).padStart(2, "0")}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{title}</h2>
          <div className="mt-3 sm:mt-4 space-y-4 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground break-words [overflow-wrap:anywhere]">{children}</div>
        </div>
      </div>
    </section>
  );
}

function BulletList({ items }) {
  return <ul className="list-disc pl-5 space-y-2">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

const providerLinks = [
  ["Base44", "https://base44.com/privacy-policy"],
  ["Google Gemini API", "https://ai.google.dev/gemini-api/docs/logs-policy"],
  ["Groq", "https://groq.com/privacy-policy"],
  ["ElevenLabs", "https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode"],
  ["PayPal", "https://www.paypal.com/us/legalhub/paypal/privacy-full?redirect=false"],
  ["Google Workspace / Gmail API", "https://developers.google.com/workspace/workspace-api-user-data-developer-policy"],
  ["VirusTotal", "https://docs.virustotal.com/docs/private-scanning"],
];

export default function Privacy() {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-16 break-words [overflow-wrap:anywhere]">
      <header className="border-b border-border/60 pb-7 sm:pb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Legal · Privacy</p>
        <h1 className="mt-3 text-[2rem] leading-tight sm:text-4xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last Updated: {EFFECTIVE_DATE}</p>
        <p className="mt-5 max-w-4xl text-sm sm:text-base leading-7 text-muted-foreground">
          This Privacy Policy describes the Vardin application and website as they are currently implemented. It explains what information Vardin receives, what Vardin stores, what Vardin sends to service providers, how automated analysis works, and the controls currently available to users.
        </p>
        <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 text-sm leading-6 text-foreground">
          <strong>Important:</strong> This Policy is written to describe Vardin's current data practices as accurately as the application and configured providers can be verified. It does not promise that a provider retains data for a particular period when Vardin cannot control that provider setting, and it does not claim legal compliance in every jurisdiction. The operator should have qualified privacy counsel review the final policy, contracts, transfer mechanisms, children's-privacy controls and retention settings before launch.
        </div>
      </header>

      <nav aria-label="Privacy Policy sections" className="my-6 rounded-xl border border-border bg-card p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">On this page</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
          {[
            [1, "Introduction"], [2, "Who Vardin Is"], [3, "Scope"], [4, "Information We Collect"], [5, "Automatic Collection"],
            [6, "User-Provided Content"], [7, "Call Guard"], [8, "Speaker Diarization"], [9, "AI Processing"], [10, "Scam Detection"],
            [11, "Messages & Media"], [12, "Family Protection"], [13, "Community Reports"], [14, "Uses"], [15, "Legal Bases"],
            [16, "Sharing"], [17, "Third Parties"], [18, "AI Providers"], [19, "International Transfers"], [20, "Retention"],
            [21, "Security"], [22, "Privacy Rights"], [23, "Access & Export"], [24, "Account Deletion"], [25, "Cookies"],
            [26, "Age Suitability"], [27, "Non-Users"], [28, "Changes"], [29, "Contact"], [30, "Requests & Complaints"],
          ].map(([n, label]) => <a key={n} href={`#privacy-${n}`} className="rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">{n}. {label}</a>)}
        </div>
      </nav>

      <Section number={1} title="Introduction">
        <p>Vardin is an AI-assisted scam-awareness and consumer-safety service. It is currently in beta, so features and data flows may change as the product is tested and improved. This Policy applies to the Vardin website, web application, browser-extension functionality, scam scanners, phone-reputation features, Live Guard, family-protection features, educational features, subscriptions, credit purchases, and related services.</p>
        <p>Because users can submit communications and media belonging to other people, Vardin may process information about people who do not have Vardin accounts. The person submitting that information is responsible for having the authority required to do so.</p>
      </Section>

      <Section number={2} title="Who Vardin Is">
        <p>The Service is operated under the Vardin name. The current application identifies <a className="text-primary underline underline-offset-2 break-all" href="mailto:inbal5252@gmail.com">inbal5252@gmail.com</a> as its privacy and support contact.</p>
        <p>The application code does not establish a verified legal entity name, registered office, telephone number, jurisdiction of incorporation, or formal data-protection-officer identity. This Policy therefore does not invent any of those details.</p>
      </Section>

      <Section number={3} title="Scope">
        <p>This Policy covers personal information processed through Vardin's current application architecture. It does not govern independent third-party services that Vardin does not control, including external payment-provider accounts, Google accounts, websites reached through links, or other services that you use separately.</p>
        <p>Where a third party processes information directly under its own terms, its own privacy policy may apply in addition to this Policy.</p>
      </Section>

      <Section number={4} title="Information We Collect">
        <p>The current application can process the following categories:</p>
        <BulletList items={[
          "Account information: email address, name, role, subscription plan and status, onboarding choices, alert preferences, notification preferences, language and other account settings.",
          "Submitted content: messages, emails, chat transcripts, URLs, website text, marketplace content, screenshots, images, files, QR-code content, crypto-investment messages, phone numbers, and uploaded call recordings.",
          "Call information: live microphone or system-audio chunks, uploaded call recordings, transcripts, speaker labels such as 'you' and 'caller', detected tactics, warnings, risk levels, coaching/feedback, duration and segment counts.",
          "Analysis information: risk scores, classifications, explanations, detected tactics, recommended actions, false-positive flags, sources and other AI-generated results.",
          "Phone information: phone numbers searched by users, country/carrier information, reputation results, community reports and caller-ID classifications. Vardin also maintains administrator-managed reputation and caller-ID datasets.",
          "Family information: names, email addresses, phone numbers, guardian/member identifiers, consent status, alert preferences, protection settings, notes and family-alert information.",
          "Community information: scam reports, community stories, display names, country, scam type, channel, likes and moderation status.",
          "Education and usage information: lesson progress, scores, XP, scan activity, credit usage, referrals and subscription-related activity.",
          "Payment information: subscription and credit-purchase transaction information. Payment processing is performed through PayPal; Vardin's code does not request a full payment-card number.",
          "Support and feedback information: feedback content, ratings, name and email when supplied, support communications and administrative responses.",
          "Technical information: information available to the application platform and service providers as part of authentication, requests, security, hosting and normal web operation. Vardin's application code does not intentionally collect precise GPS location except when you actively request Local Scam Intelligence and grant browser location permission."
        ]} />
      </Section>

      <Section number={5} title="Information Collected Automatically">
        <p>Vardin uses browser storage for functional purposes such as session restoration, language, theme, accessibility settings, referrals, dismissed notices, privacy preferences and other local application state. The UI also writes a sidebar preference cookie.</p>
        <p>The current source code does not contain a dedicated third-party advertising analytics SDK such as Google Analytics, Mixpanel, PostHog or Sentry. This Policy therefore does not claim that Vardin operates one.</p>
        <p>Base44, the application platform, and other infrastructure providers may independently process technical information such as IP address, device/browser information, request metadata and security logs. Their own policies apply to their processing.</p>
      </Section>

      <Section number={6} title="User-Provided Information and Submitted Content">
        <p>When you use a scanner, you choose what to submit. Vardin's scanners can receive text, URLs, screenshots, images, files, phone numbers, marketplace material, social-profile material, QR codes and other content. Uploaded files may be placed in Vardin/Base44-managed file storage so the requested analysis can be performed.</p>
        <p>Some records are stored in Vardin's database. Examples include scam analyses, conversation analyses, image scans, phone lookups, local scam scans, community reports, family alerts, lesson progress and Live Guard sessions.</p>
        <p>Vardin has an optional automatic-redaction setting for certain stored messages. Redaction is not a guarantee that personal information will be removed, and it does not prevent the original content from being transmitted to a provider when transmission is required to perform the requested analysis.</p>
      </Section>

      <Section number={7} title="Call Guard, Audio, and Transcripts">
        <p><strong>Call Guard does capture audio.</strong> In microphone mode, the browser requests microphone access and records short audio chunks locally before sending them to Vardin's backend for analysis. In system-audio/phone-call modes, the browser uses display-media capture when supported. In upload mode, the user selects an existing audio recording and Vardin uploads it for analysis.</p>
        <p>For uploaded recordings, the current application sends the recording through Base44-managed file handling and passes the resulting file URL to the Vardin <code>analyzeCallChunk</code> function. The backend downloads the audio bytes and sends them to Groq's speech-to-text API. Groq is currently the <strong>only</strong> speech-to-text provider used by Call Guard.</p>
        <p>The current Vardin database does <strong>not</strong> contain a field for storing the original call-audio bytes. It does store <code>LiveGuardSession</code> records containing transcript/analysis segments, risk level, warnings, tactics, duration and segment count. Audio handled through Base44 file storage is not covered by a Vardin-controlled automatic deletion schedule in the current code, so Vardin does not promise that uploaded audio is automatically deleted after a fixed number of days.</p>
        <p>Live audio is therefore not “local only,” “never transmitted,” or “never stored.” Audio is transmitted to Vardin's backend and, for transcription, to Groq. Groq's current documentation says inference customer data is not retained by default, but inputs/outputs may be temporarily retained for reliability or abuse monitoring for up to 30 days unless Zero Data Retention is enabled. Groq also states that customer data is not used to train or fine-tune its models unless the customer explicitly permits or instructs it. Vardin's application code does not itself prove that Groq Zero Data Retention is enabled for the production account, so this Policy does not claim that it is.</p>
      </Section>

      <Section number={8} title="Speaker Diarization and 'You' vs. 'Caller'">
        <p>Call Guard attempts to label transcript segments as <strong>you</strong>, <strong>caller</strong>, or <strong>unknown</strong>. The current implementation uses Groq's language model to classify speakers based on transcript text and recent conversation context, with a heuristic fallback when that classification fails.</p>
        <p>These labels are probabilistic and can be wrong. Vardin does not use a biometric voiceprint or claim that its speaker labels identify a person with certainty. Speaker labels and confidence information are part of the in-memory processing state and the resulting transcript/analysis shown to the user; stored Live Guard session records include speaker labels in their transcript JSON.</p>
      </Section>

      <Section number={9} title="AI Processing">
        <p>Vardin uses automated AI processing for scam detection, website analysis, image analysis, crypto-message analysis, local scam intelligence, conversation analysis, emergency guidance, educational features, Scam Exposer and other features. Depending on the feature, content may be processed through Base44's Core AI integration, Google Gemini, Groq, or another provider explicitly described in this Policy.</p>
        <p>Vardin does not claim that AI output is always accurate. AI results are assessments, not guarantees, professional advice or proof of fraud.</p>
        <p>Vardin's current code does not state that customer content is used to train Vardin's own models. Provider-specific retention and training terms can differ, and the operator must maintain the provider settings and contracts needed to support any promises made in this Policy.</p>
      </Section>

      <Section number={10} title="Scam Detection, Risk Scores, and Automated Results">
        <p>Vardin generates risk levels, numeric scores, scam categories, warnings, tactics, explanations and recommendations from submitted content and external threat information. These outputs may affect what warnings or family alerts you see, but Vardin's code does not make legal, credit, employment, insurance or other regulated eligibility decisions about users.</p>
        <p>Risk scores can be wrong or stale. A low-risk result is not proof that content is safe, and a high-risk result is not by itself a legal finding that a person or business committed fraud.</p>
      </Section>

      <Section number={11} title="Messages, Emails, Screenshots, Links, Websites, and Marketplace Content">
        <p>Message and conversation scanners process text you provide, including SMS, email, WhatsApp/social-style chat, dating conversations, job offers, delivery notices, bank/government impersonation and crypto-investment messages.</p>
        <p>URL and Universal Scanner features can fetch a submitted URL, follow redirects, inspect page content, decode QR codes, and query threat-intelligence sources. URL scanning currently uses URLhaus and, when configured, VirusTotal. Website text and screenshots may be sent to AI processing.</p>
        <p>Marketplace analysis can process seller/listing content and URLs. Image Scanner uploads the image to Vardin/Base44 storage and sends it to AI analysis with web-search context when enabled. Vardin may return public source URLs found during analysis.</p>
        <p>Because these materials can contain information about other people, do not submit content you are not authorized to process.</p>
      </Section>

      <Section number={12} title="Family Protection">
        <p>Family Protection stores relationships between guardians and protected members, including names, emails, phone numbers, guardian identifiers, consent status, protection settings and alert preferences. A protected member can have a Vardin account linked to the family record.</p>
        <p>When enabled, high-risk or configured scans can create a Family Alert. Alerts can contain a short excerpt, risk level, scam type and a member note. Guardian notifications can be sent by email through Vardin's Gmail integration. The current email implementation may include the member's name, risk level, risk score, message type and AI explanation, and Ask Family alerts can include the excerpt and member note.</p>
        <p>Family Protection is permission-based, not unrestricted surveillance. A guardian must have the authorization required by applicable law to add and monitor another person. The protected member's consent field is part of the data model.</p>
      </Section>

      <Section number={13} title="Community Reports and Public-Facing Information">
        <p>Users can submit scam reports and community stories. A community story can include a title, the user's story, scam type, delivery channel, country, an anonymous setting and an author display name. Community content is readable by users through the Community/Scam Feed features according to the application's access rules.</p>
        <p>Phone community reports are administrator-readable and may be incorporated into Vardin's phone reputation results. Reddit-derived phone intelligence is imported from publicly indexed information and stored in an administrator-managed dataset.</p>
        <p>Do not publish personal information about another person in a community report unless you have a lawful reason and appropriate authorization.</p>
      </Section>

      <Section number={14} title="How We Use Information">
        <BulletList items={[
          "Provide and operate the requested Vardin features.",
          "Analyze submitted content and produce scam-risk assessments, warnings and explanations.",
          "Provide Call Guard transcription, speaker labeling and scam detection.",
          "Provide family alerts and guardian/member workflows.",
          "Maintain accounts, authentication, subscriptions, credits and referrals.",
          "Process payments and subscription changes through PayPal.",
          "Send requested or configured email notifications through Gmail or Vardin's email facilities.",
          "Prevent abuse, troubleshoot failures, protect the Service and investigate security incidents.",
          "Maintain threat-intelligence and community datasets.",
          "Provide educational content, lesson progress and product functionality.",
          "Comply with legal obligations and respond to lawful requests."
        ]} />
        <p>Vardin does not currently describe a separate advertising-business purpose for submitted scam content.</p>
      </Section>

      <Section number={15} title="Legal Bases for Processing">
        <p>Where the GDPR, UK GDPR or another law requiring a lawful basis applies, the appropriate basis depends on the processing. Potential bases include performance of a contract or requested service; legitimate interests such as security and fraud prevention; consent for processing that requires consent; and compliance with legal obligations.</p>
        <p>Call audio, transcripts and other communications may contain sensitive or special-category information depending on their content. Vardin does not claim that every such processing activity is automatically lawful under every jurisdiction. The operator should document the applicable Article 6 and, where relevant, Article 9 conditions before serving users in those jurisdictions.</p>
      </Section>

      <Section number={16} title="How We Share Information">
        <p>Vardin shares information only as needed for the feature or purpose involved, subject to applicable law. Recipients can include:</p>
        <BulletList items={[
          "Base44 and its infrastructure providers for application hosting, authentication, database, file storage and platform operations.",
          "AI and speech providers used for requested analysis, including Google Gemini and Groq.",
          "PayPal for subscriptions and credit purchases.",
          "Google/Gmail for configured guardian and family notification email delivery.",
          "VirusTotal and URLhaus for URL threat intelligence when the relevant scanner is used.",
          "QR Server for server-side QR decoding when QR analysis uses the server decoder.",
          "ElevenLabs for text-to-speech when Vardin's voice features are used.",
          "Professional advisers, regulators, courts, law enforcement or other parties when required or permitted by law.",
          "A successor or transaction counterparty if Vardin is involved in a merger, acquisition, financing, reorganization or sale of relevant assets, subject to applicable law."
        ]} />
        <p>The current code does not contain a dedicated advertising-data sale/sharing system. Vardin therefore does not represent that it sells personal information for money.</p>
      </Section>

      <Section number={17} title="Third-Party Providers">
        <p>The current code identifies the following external services or provider families as part of the data flows:</p>
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          {providerLinks.map(([name, url]) => <div key={name} className="flex items-center justify-between gap-4 border-b last:border-b-0 border-border px-4 py-3 text-sm"><span className="font-medium text-foreground">{name}</span><a className="text-primary underline underline-offset-2 break-all" href={url} target="_blank" rel="noreferrer">Provider documentation</a></div>)}
        </div>
        <p>Provider terms and retention settings can change. This Policy describes Vardin's current code-level integrations, not a guarantee that a provider's practices will remain unchanged.</p>
      </Section>

      <Section number={18} title="AI Providers and Training/Retention Controls">
        <p><strong>Groq:</strong> Call Guard sends audio to Groq's <code>audio/transcriptions</code> endpoint and sends transcript text to Groq's language model for speaker classification. Groq's current data documentation says inference inputs and outputs are not retained by default. It also says Groq may temporarily retain inputs/outputs for system reliability or abuse investigations for up to 30 days, unless Zero Data Retention is enabled. Groq states that customer inputs and outputs are not used to train or fine-tune its models unless the customer explicitly grants permission or gives an instruction to do so. Groq also states that retained customer data is stored in Google Cloud Platform buckets in the United States. Vardin does not claim that production Groq ZDR is enabled unless that setting has been separately verified. <a className="text-primary underline underline-offset-2" href="https://console.groq.com/docs/your-data" target="_blank" rel="noreferrer">Groq data controls</a> · <a className="text-primary underline underline-offset-2" href="https://console.groq.com/docs/legal/services-agreement" target="_blank" rel="noreferrer">Groq Services Agreement</a></p>
        <p><strong>Google Gemini / Base44 AI:</strong> Vardin uses Base44's Core AI integration for many analyses. Provider-side logging and retention can depend on the Base44 and Google configuration used for a particular request. Vardin does not make a blanket promise about provider-side AI retention beyond the settings it can verify. <a className="text-primary underline underline-offset-2" href="https://ai.google.dev/gemini-api/docs/logs-policy" target="_blank" rel="noreferrer">Google Gemini API logging policy</a></p>
        <p><strong>ElevenLabs:</strong> Where Vardin's voice-generation features are used, ElevenLabs receives the text/configuration needed to generate speech. It is not the Call Guard speech-to-text provider, and Call Guard audio is not sent to ElevenLabs for transcription.</p>
      </Section>

      <Section number={19} title="International Data Transfers">
        <p>Vardin's provider architecture can involve processing outside the country where you live. Groq states that customer data retained by Groq is stored in Google Cloud Platform buckets in the United States. Other global providers may also process information internationally. Vardin will use applicable transfer mechanisms where required by law, but the exact mechanism can depend on the provider, service, account configuration and jurisdiction.</p>
        <p>Where a jurisdiction requires a lawful transfer mechanism, Vardin should use the mechanism applicable to the relevant transfer, such as an adequacy decision or appropriate contractual safeguards. Vardin does not claim that every international transfer is currently compliant in every jurisdiction.</p>
      </Section>

      <Section number={20} title="Data Retention">
        <p><strong>Current Vardin retention position:</strong> the codebase does not implement one universal, automated deletion schedule by data type. Stored records can remain until the user deletes the account/data, an administrator removes them, or another application process removes them. Vardin should not represent that all scan history, uploaded files or provider logs are automatically deleted after a particular number of days unless that control is actually configured.</p>
        <p>Current database records include scan histories, conversation analyses, image scans, phone lookups, local scam scans, Live Guard sessions, family alerts, lesson progress, community stories/reports, feedback and referral information. Live Guard session records contain transcripts and analysis metadata.</p>
        <p>Third-party providers have their own retention rules. Groq states that inference customer data is not retained by default, but may be retained for up to 30 days for reliability or abuse monitoring unless Zero Data Retention is enabled. Vardin does not treat that provider-side period as a promise about the separate Base44 file-storage or Vardin database retention of the same content.</p>
        <p>Backups may retain deleted information for a limited period under a provider's backup cycle. Vardin's application code does not expose a backup-deletion control.</p>
      </Section>

      <Section number={21} title="Data Security">
        <p>Vardin uses platform authentication, entity-level access controls, service-role separation for selected backend operations, HTTPS/API transport to the external services inspected, and browser permission controls for microphone and location features. The application also uses access rules intended to limit records to their owner, guardian, protected member or administrators depending on the entity.</p>
        <p>However, the code audit does not establish a formal security certification, penetration-test result, encryption-at-rest configuration, incident-response program, or comprehensive security-management system. Vardin therefore makes no certification or absolute-security claim.</p>
        <p>If a security incident creates a legal notification obligation, Vardin will follow the requirements applicable to the incident and affected individuals.</p>
      </Section>

      <Section number={22} title="Privacy Rights">
        <p>Depending on where you live, you may have rights to access, correct, delete, restrict, object to or otherwise control processing of personal information. Depending on applicable law, you may also have rights to portability, withdrawal of consent, appeal of a privacy-rights decision, and to opt out of certain sale/sharing or targeted-advertising activities.</p>
        <p>EU/EEA and UK users may have GDPR/UK GDPR rights including access, rectification, erasure, restriction, portability and objection, subject to the legal conditions and exceptions that apply to the request. California residents may have CCPA/CPRA rights including access/know, deletion, correction, limitation of certain sensitive-information uses, and opt-out rights where the statutory requirements apply.</p>
        <p>Israeli privacy law applies to personal information processed in the circumstances covered by the law. Amendment 13, which took effect in 2025, changed the framework for database registration, notification and accountability, including rules relevant to large databases containing specially sensitive information. Vardin will apply the requirements that actually govern its processing rather than assuming that one registration or legal basis applies to every dataset.</p>
      </Section>

      <Section number={23} title="Access, Correction, Export, and Deletion Requests">
        <p>To request access, correction, deletion, portability/export, restriction, objection or another privacy right, email <a className="text-primary underline underline-offset-2 break-all" href="mailto:inbal5252@gmail.com">inbal5252@gmail.com</a>.</p>
        <p>The current application has an account-deletion workflow but does not provide a self-service personal-data export tool. Vardin may need to manually respond to an access or export request and may need to verify identity before doing so.</p>
        <p>Requests are subject to lawful exceptions. For example, information may need to be retained to comply with law, establish or defend legal claims, prevent fraud, maintain security, or satisfy a payment provider's legal obligations.</p>
      </Section>

      <Section number={24} title="Account Deletion">
        <p>Profile settings currently provide a “Delete Account &amp; Data” workflow. The backend deletion function attempts to delete user-owned records including scam analyses, image scans, phone lookups, Live Guard sessions, conversation analyses, lesson progress, feedback, community stories, story likes, local scam scans, scam reports and family-member records associated with the user. It also clears selected profile fields.</p>
        <p><strong>Important implementation limitation:</strong> the current deletion function does not prove deletion of the underlying Vardin/Base44 authentication identity, uploaded files, every possible related family alert/referral record, administrator audit records, provider-side logs, or backups. Account deletion therefore should not currently be described as instant erasure from every system.</p>
        <p>Vardin is expected to process a valid deletion request within the period required by applicable law, subject to verification and lawful exceptions. The operator should implement a complete deletion ledger and provider/file-storage deletion workflow before promising comprehensive erasure.</p>
      </Section>

      <Section number={25} title="Cookies, Local Storage, and Analytics">
        <p>Vardin uses local storage for essential application state such as authentication-session restoration, language, theme, accessibility, referrals, dismissed broadcasts, community preferences and local UI history. The sidebar component also writes a functional cookie that remembers its open/closed state.</p>
        <p>The inspected Vardin source does not include a dedicated third-party behavioral advertising or analytics SDK. The Analytics page is an in-app dashboard built from Vardin scan records, not a third-party analytics service.</p>
        <p>Base44 and external providers may use their own cookies, logs or technical identifiers when their services are involved. Review their policies for details about their independent processing.</p>
      </Section>

      <Section number={26} title="Age Suitability">
        <p>Vardin is a general consumer scam-awareness service and does not currently offer a dedicated child or kid mode. The Service is not designed as a child-directed service.</p>
        <p>If a person is below the age required to enter a binding agreement or use a particular feature under the law that applies to them, they should use Vardin only with the involvement or authorization required by that law.</p>
        <p>Vardin does not knowingly market the Service as a children's service. If the product later introduces child-directed features or intentionally targets children, this Policy and the product's consent, age-assurance and data-protection controls should be updated before that launch.</p>
      </Section>

      <Section number={27} title="Information About Other People and Non-Users">
        <p>Vardin can process information belonging to people who are not Vardin users. Examples include the other participant in a recorded call, the sender of a suspicious message, a phone-number owner, a family member, a marketplace seller, or a person depicted in an uploaded image.</p>
        <p>Vardin does not have a direct account relationship with every person whose information may appear in submitted content. Users must therefore avoid submitting unnecessary third-party information and must have the authority or lawful basis required to submit it.</p>
        <p>Call recording and interception laws can apply differently depending on where the participants are located. Vardin does not determine whether a particular recording is lawful. Users are responsible for complying with applicable consent and communications laws before recording or uploading a call.</p>
      </Section>

      <Section number={28} title="Changes to This Policy">
        <p>Vardin may update this Policy when its features, data practices, providers or legal obligations change. The Last Updated date will change when the Policy is replaced.</p>
        <p>For material changes where notice, consent or another process is required by applicable law, Vardin will use the legally required method. Continued use of the Service is not intended to waive rights that cannot lawfully be waived.</p>
      </Section>

      <Section number={29} title="Contact Information">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 text-foreground">
          <p className="font-semibold">Vardin — Privacy</p>
          <p className="mt-1 break-all">Email: <a className="text-primary underline underline-offset-2" href="mailto:inbal5252@gmail.com">inbal5252@gmail.com</a></p>
        </div>
        <p>Because the application's verified legal-entity details are not present in the codebase, this Policy intentionally does not invent a corporate address or jurisdiction.</p>
      </Section>

      <Section number={30} title="Privacy Requests and Complaints">
        <p>Send privacy requests or complaints to <a className="text-primary underline underline-offset-2 break-all" href="mailto:inbal5252@gmail.com">inbal5252@gmail.com</a>. Please state the request, the account email where applicable, the jurisdiction you are making the request under, and enough information for Vardin to identify the relevant data without sending unnecessary sensitive information.</p>
        <p>If you are not satisfied with Vardin's response, you may have the right to complain to the privacy or data-protection regulator in your country or region. For EU/EEA and UK users, this generally means the supervisory authority with jurisdiction over the relevant processing or your place of residence, subject to the applicable rules.</p>
      </Section>

      <div className="mt-7 rounded-xl border border-warning/30 bg-warning/5 p-4 sm:p-5 text-sm leading-6 text-foreground">
        <p className="font-semibold">Implementation items requiring review</p>
        <BulletList items={[
          "Create and enforce a documented retention schedule for database records and uploaded files rather than relying mainly on account deletion.",
          "Complete the deletion workflow for Base44 authentication identity, uploaded files, related FamilyAlert/Referral records, backups and provider-side data where deletion is available.",
          "Verify Base44/Google Gemini logging and retention configuration; the application cannot establish every platform-level setting from source code alone.",
          
          "Determine and document the lawful basis and any special-category safeguards/DPIA requirements for Call Guard and family protection in each target jurisdiction.",
          "Confirm Israeli database, information-security, transfer and sensitive-information obligations under the current Protection of Privacy Law and regulations.",
          "Verify Google Gmail OAuth verification requirements because the application uses Gmail send access for guardian/family notifications.",
          "Confirm the commercial/legal status and permitted use of every threat-intelligence provider used by production traffic, including VirusTotal and URLhaus."
        ]} />
      </div>
    </div>
  );
}
