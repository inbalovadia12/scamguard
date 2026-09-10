import React from "react";

const EFFECTIVE_DATE = "September 10, 2026";

function Section({ number, title, children }) {
  return (
    <section className="border-b border-border/60 py-7 sm:py-8 last:border-b-0">
      <div className="flex gap-5">
        <div className="hidden sm:block w-8 shrink-0 pt-1 text-xs font-semibold text-muted-foreground tabular-nums">{String(number).padStart(2, "0")}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{title}</h2>
          <div className="mt-3 sm:mt-4 space-y-4 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground break-words [overflow-wrap:anywhere]">{children}</div>
        </div>
      </div>
    </section>
  );
}

function BulletList({ items }) {
  return (
    <ul className="list-disc pl-5 space-y-2">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

export default function Privacy() {
  return (
    <div className="w-full max-w-4xl mx-auto pb-10 sm:pb-16 break-words">
      <header className="border-b border-border/60 pb-7 sm:pb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Legal</p>
        <h1 className="mt-3 text-[2rem] leading-tight sm:text-4xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
        <p className="mt-3 text-sm text-muted-foreground">Effective date: {EFFECTIVE_DATE}</p>
        <p className="mt-6 max-w-3xl text-sm sm:text-base leading-7 text-muted-foreground">
          This Privacy Policy explains how Vardin collects, uses, discloses, retains, and protects personal information when you use the Vardin website, applications, scam-detection tools, family-protection features, browser extension, and related services (collectively, the “Services”).
        </p>
        <div className="mt-5 sm:mt-6 rounded-xl border border-border bg-muted/30 p-4 sm:p-5 text-sm leading-6 text-foreground overflow-hidden">
          <strong>Important:</strong> This policy describes Vardin’s actual data practices as currently implemented. Privacy law varies by jurisdiction and depends on factors including where you live, the nature and scale of the business, and how the Services are used. No privacy policy can guarantee that a business will never face a claim or regulatory action. Vardin should have this policy and its underlying data practices reviewed by qualified privacy counsel before commercial launch.
        </div>
      </header>

      <Section number={1} title="Who We Are and Scope">
        <p>Vardin is the operator of the Services. In this Policy, “Vardin,” “we,” “us,” and “our” refer to the Vardin service and its operator. “You” means the person using the Services.</p>
        <p>For privacy-law purposes, Vardin may act as a controller, business, or similar responsible party for information about its users. Where another organization processes information on Vardin’s behalf, that organization may act as a processor or service provider.</p>
        <p>Questions and privacy requests can be sent to <a className="text-primary underline underline-offset-2 break-all" href="mailto:inbal5252@gmail.com">inbal5252@gmail.com</a>.</p>
      </Section>

      <Section number={2} title="Information We Collect">
        <p>We collect information that you provide, information generated when you use the Services, and information received from service providers or other sources necessary to operate the Services.</p>
        <BulletList items={[
          "Account and identity information, such as name, email address, authentication information, subscription status, preferences, and account settings.",
          "Content you submit for analysis, including messages, URLs, screenshots, images, documents, call-related files, and other material you choose to submit. Such material may contain personal or sensitive information about you or other people.",
          "Analysis and activity information, including scan type, risk results, explanations, detected tactics, usage and credit consumption, lesson progress, and related account activity.",
          "Family-protection information, such as the name, email address, relationship, consent status, protection settings, alert preferences, and identifiers of people you add to family-protection features.",
          "Payment and subscription information. Payments are processed through third-party payment providers such as PayPal. Vardin does not need to receive or store your full payment-card number to provide subscription services.",
          "Device, browser, and technical information, which may include IP address, browser type, operating system, device characteristics, approximate location derived from IP address, timestamps, referring pages, and security or diagnostic information.",
          "Communications and support information, including messages you send to us, feedback, support requests, and records needed to respond to you.",
          "Information provided by others where the Services support family protection, invitations, consent workflows, or other features involving another person."
        ]} />
        <p>We do not intentionally require you to submit sensitive information that is unnecessary for the requested feature. You should avoid submitting unnecessary passwords, authentication codes, full payment-card details, government identification numbers, medical records, or other highly sensitive information.</p>
      </Section>

      <Section number={3} title="How We Use Personal Information">
        <p>We use information for specific business and service purposes, including:</p>
        <BulletList items={[
          "Providing, operating, maintaining, and securing the Services.",
          "Authenticating accounts, preventing abuse, detecting fraud, troubleshooting, and protecting users and the Services.",
          "Processing submitted content through automated analysis systems and returning scam-risk assessments, educational explanations, and suggested next steps.",
          "Providing family-protection features, including alerts and consent-based sharing where those features are enabled.",
          "Managing subscriptions, credits, billing status, refunds, and payment-related support through our payment providers.",
          "Remembering settings such as language, accessibility, privacy preferences, and other account choices.",
          "Providing customer support and responding to communications.",
          "Measuring product performance, diagnosing technical problems, improving reliability, and developing the Services.",
          "Complying with legal obligations, enforcing our agreements, resolving disputes, and protecting the rights, safety, and property of Vardin, users, and others."
        ]} />
        <p>We do not use submitted scam-analysis content for a purpose materially different from the purpose disclosed to you without providing any notice or consent required by applicable law.</p>
      </Section>

      <Section number={4} title="AI Processing and Submitted Content">
        <p>Vardin uses automated systems, including artificial-intelligence models and related services, to analyze content you submit. Depending on the feature, submitted content may be transmitted to infrastructure operated by Vardin and its technology providers so that the requested analysis can be performed.</p>
        <p>For some scam-analysis workflows, Vardin applies automated redaction before saving analysis records. Redaction is not perfect and should never be treated as a guarantee that personal information has been removed. Content may also be processed before storage to produce the requested result.</p>
        <p>Vardin does not represent that AI output is always accurate. A result may be wrong, incomplete, outdated, or based on information that changes. Do not submit information that you are prohibited from sharing or that you do not have authority to process.</p>
      </Section>

      <Section number={5} title="How We Share Information">
        <p>We may disclose personal information only as reasonably necessary to provide the Services, operate the business, comply with law, or protect users and the Services. Categories of recipients may include:</p>
        <BulletList items={[
          "Cloud hosting, database, authentication, file-storage, infrastructure, and application-platform providers, including Base44 and its underlying service providers.",
          "AI and automated-processing providers used to provide requested analysis features.",
          "Payment and subscription providers, including PayPal, for billing and payment processing.",
          "Email, notification, customer-support, security, analytics, and operational vendors where needed for the Services.",
          "Professional advisers such as lawyers, accountants, auditors, insurers, and security advisers where appropriate.",
          "Government authorities, courts, regulators, or other parties when disclosure is required by law or reasonably necessary to prevent fraud, abuse, or harm.",
          "A successor or transaction counterparty in connection with a merger, acquisition, financing, reorganization, sale of assets, or similar business transaction, subject to applicable law."
        ]} />
        <p>We do not sell personal information for money. If our practices change in a way that constitutes a “sale” or “sharing” of personal information under an applicable privacy law, we will provide the notices and choices required by that law.</p>
      </Section>

      <Section number={6} title="Cookies, Local Storage, and Similar Technologies">
        <p>The Services may use browser storage, cookies, session mechanisms, and similar technologies to keep you signed in, remember settings, provide security, support navigation, and maintain service functionality.</p>
        <p>Some third-party services may use their own technologies when they provide functionality such as authentication, payment processing, embedded services, or security. Browser controls may allow you to block some technologies, but doing so can interfere with essential functionality.</p>
      </Section>

      <Section number={7} title="Data Retention and Deletion">
        <p>We retain personal information for as long as reasonably necessary for the purposes described in this Policy, including to provide the Services, maintain account records, meet contractual and legal obligations, resolve disputes, prevent abuse, and enforce agreements.</p>
        <p>Retention periods vary by data type and purpose. When information is no longer required, we may delete it, anonymize it, or securely isolate it where deletion is not immediately possible because of backups, security controls, legal obligations, or legitimate operational needs.</p>
        <p>Deleting an account does not necessarily cause immediate deletion from every backup or third-party system. Where applicable law gives you a right to deletion, we will process a valid request subject to lawful exceptions.</p>
      </Section>

      <Section number={8} title="Your Privacy Rights">
        <p>Depending on where you live and the laws that apply to you, you may have rights to:</p>
        <BulletList items={[
          "Access or know what personal information we hold about you and how it is used.",
          "Request correction of inaccurate personal information.",
          "Request deletion of personal information, subject to legal exceptions.",
          "Request a portable copy of certain information.",
          "Object to or restrict certain processing, where applicable.",
          "Withdraw consent where processing is based on consent, without affecting processing that occurred before withdrawal.",
          "Opt out of certain sale, sharing, targeted-advertising, or profiling activities where applicable.",
          "Appeal a privacy-rights decision where required by applicable law.",
          "Lodge a complaint with a competent data-protection or privacy regulator."
        ]} />
        <p>To submit a request, email <a className="text-primary underline underline-offset-2 break-all" href="mailto:inbal5252@gmail.com">inbal5252@gmail.com</a>. We may need to verify your identity before fulfilling a request. We will not discriminate against you for exercising privacy rights that apply to you.</p>
        <p>For California residents, rights may include the rights to know, delete, correct, opt out of sale or sharing, limit certain uses of sensitive personal information, and receive equal treatment as provided by the California Consumer Privacy Act and applicable regulations. California rights apply only where the business and processing are within the law’s scope.</p>
        <p>For individuals in the European Economic Area, United Kingdom, Switzerland, or other jurisdictions with comprehensive data-protection laws, additional rights and requirements may apply, including rights concerning lawful bases, international transfers, objection, restriction, and complaints to a supervisory authority.</p>
      </Section>

      <Section number={9} title="Lawful Bases for EEA/UK Processing">
        <p>Where the GDPR, UK GDPR, or a similar law applies, we may process personal information on one or more of these legal bases: performance of a contract or steps requested before entering a contract; compliance with a legal obligation; our legitimate interests, balanced against your rights; your consent; or another lawful basis permitted by applicable law.</p>
        <p>Where consent is the legal basis, you may withdraw it as described in the relevant feature or by contacting us. Withdrawal does not affect processing that was lawful before withdrawal.</p>
      </Section>

      <Section number={10} title="International Data Transfers">
        <p>Vardin and its service providers may process information in countries other than the country where you live. Where applicable law requires safeguards for international transfers, we will use an appropriate lawful transfer mechanism, such as an adequacy decision, standard contractual clauses, or another legally recognized safeguard.</p>
      </Section>

      <Section number={11} title="Children and Family Features">
        <p>The Services include family and educational features. Privacy obligations relating to children vary significantly by jurisdiction. We do not intend to collect personal information from children in circumstances where parental authorization is legally required unless the required authorization and safeguards are in place.</p>
        <p>Parents or guardians who believe a child has provided personal information to Vardin without appropriate authorization should contact <a className="text-primary underline underline-offset-2 break-all" href="mailto:inbal5252@gmail.com">inbal5252@gmail.com</a>. We will evaluate and respond in accordance with applicable law.</p>
        <p>Family-protection features are designed around consent and account permissions. Adding another person to a protection feature does not itself create unlimited permission to access that person’s information. Users must have a lawful basis and appropriate authorization to submit or share another person’s information.</p>
      </Section>

      <Section number={12} title="Security">
        <p>We use reasonable administrative, technical, and organizational safeguards appropriate to the nature of the information we process. Depending on the system, safeguards may include encrypted transmission, authentication controls, access controls, logging, least-privilege practices, and secure service-provider configurations.</p>
        <p>No internet service can guarantee absolute security. You are responsible for protecting your credentials and for using the Services on devices and networks you trust.</p>
      </Section>

      <Section number={13} title="Third-Party Services and Links">
        <p>The Services may link to or integrate with third-party services. Those providers operate under their own privacy policies and terms. Vardin is not responsible for privacy practices outside its control. Review third-party policies before providing information directly to those providers.</p>
      </Section>

      <Section number={14} title="Changes to This Policy">
        <p>We may update this Policy when our Services, data practices, or legal obligations change. We will update the effective date when the Policy changes. Where applicable law requires advance notice, consent, or another form of communication for a material change, we will provide it.</p>
      </Section>

      <Section number={15} title="Contact and Privacy Requests">
        <p>Privacy questions, requests, complaints, and notices should be sent to:</p>
        <div className="rounded-lg border border-border bg-muted/20 p-4 text-foreground">
          <p className="font-semibold">Vardin — Privacy</p>
          <p className="mt-1 break-all">Email: <a className="text-primary underline underline-offset-2" href="mailto:inbal5252@gmail.com">inbal5252@gmail.com</a></p>
        </div>
      </Section>

      <div className="pt-8 text-xs leading-6 text-muted-foreground">
        This Policy is written to provide a comprehensive public description of Vardin’s privacy practices. It is not a substitute for advice from a qualified attorney. If Vardin is marketed or made available in additional jurisdictions, its operator should confirm the applicable local requirements and update this Policy and the underlying product controls accordingly.
      </div>
    </div>
  );
}
