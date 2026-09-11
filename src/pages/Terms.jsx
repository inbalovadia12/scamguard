import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";

const sections = [
  {
    title: "1. About These Terms",
    body: `These Terms of Service ("Terms") govern your access to and use of Vardin, including the Vardin website, web application, account features, scam-detection tools, family-protection features, AI-assisted analysis, educational content, paid subscriptions, credit purchases, and related services (collectively, the "Service").

The Service is operated under the Vardin name. References to "Vardin," "we," "us," or "our" mean the operator of the Service. "You" means the individual or organization using the Service.

By creating an account, purchasing a subscription or credits, or otherwise accessing or using the Service, you agree to these Terms and our Privacy Policy and Data Collection Notice. If you do not agree, do not use the Service.`
  },
  {
    title: "2. Eligibility and Accounts",
    body: `You must provide accurate information when creating an account and keep your account information reasonably current. You are responsible for maintaining the confidentiality of your credentials and for activity occurring through your account, except to the extent caused by Vardin's failure to use reasonable security measures.

You may not create an account for another person without authorization, impersonate another person, or use the Service where doing so would violate applicable law or another person's rights.

If you use Vardin on behalf of an organization, you represent that you have authority to bind that organization to these Terms.`
  },
  {
    title: "3. What Vardin Does — and What It Does Not Do",
    body: `Vardin is a consumer safety and scam-awareness service. Vardin is currently in beta, so features may change, be limited, or be removed during testing. It may analyze messages, URLs, images, conversations, phone numbers, files, calls, screen content, or other information that you choose to submit or authorize the Service to process. Vardin may use automated systems, artificial intelligence, statistical methods, reputation information, and other signals to generate assessments, explanations, alerts, recommendations, or educational information.

Vardin is not an emergency service, law-enforcement service, bank, insurer, credit-reporting agency, financial adviser, lawyer, medical provider, cybersecurity incident-response provider, or identity-theft recovery provider. The Service does not replace professional judgment or direct confirmation with the relevant institution.

You remain responsible for decisions you make after receiving a Vardin result.`
  },
  {
    title: "4. AI, Automated Decisions, and Accuracy",
    body: `AI and automated detection systems are probabilistic and can be wrong. Vardin may incorrectly identify legitimate content as suspicious, fail to identify fraudulent or malicious content, misunderstand context, rely on incomplete or outdated information, or generate an explanation that is incomplete or inaccurate.

A Vardin score, warning, classification, label, recommendation, confidence level, explanation, or other output is an automated assessment and is not a guarantee, certification, finding of fact, or professional opinion. A result indicating low risk or safety is not proof that a person, message, website, transaction, caller, business, wallet, account, or other item is legitimate. A result indicating high risk or a scam is not, by itself, conclusive proof of fraud.

Do not use Vardin as the sole basis for a decision involving substantial financial loss, personal safety, medical care, legal rights, access to an account, employment, housing, insurance, investment, or another high-stakes matter. Independently verify important information through a trusted channel.`
  },
  {
    title: "5. User Content and Your Responsibility",
    body: `You may submit text, messages, URLs, images, screenshots, files, audio or video, conversation content, phone numbers, and other information to the Service ("User Content"). You retain whatever ownership rights you have in User Content.

You represent that you have the rights and permissions necessary to submit User Content and to permit Vardin to process it for the purposes described in these Terms and the Privacy Policy. You must not submit information that you are prohibited from sharing or that would cause Vardin to violate another person's rights.

You should avoid submitting unnecessary sensitive information. Before uploading content, consider removing passwords, authentication codes, payment-card numbers, government identification numbers, private medical information, or other information that is not necessary for the requested analysis.

You grant Vardin a limited, non-exclusive, worldwide license to host, reproduce, process, transmit, and otherwise use User Content only as reasonably necessary to provide, secure, maintain, troubleshoot, support, and improve the Service and as otherwise described in the Privacy Policy. This license ends when the relevant User Content is deleted, except to the extent retention is required by law, necessary for security or legal claims, or reasonably included in backups that are subsequently overwritten in the ordinary course.`
  },
  {
    title: "6. AI Processing and Third-Party Providers",
    body: `Some Service functions may use third-party infrastructure, AI models, payment processors, hosting providers, communications providers, analytics services, or other technology providers. User Content may therefore be transmitted to or processed by service providers acting on Vardin's behalf.

Vardin will handle personal information according to its Privacy Policy and Data Collection Notice. We do not promise that every automated model or third-party provider will produce correct results, and we do not represent that every third-party provider is under Vardin's direct control.

Vardin will not make a promise in these Terms or elsewhere about data use that conflicts with the actual practices described in our Privacy Policy. Material changes to data practices will be handled in accordance with applicable law and the notice requirements described in the Privacy Policy.`
  },
  {
    title: "7. Family Protection and Guardian Features",
    body: `Vardin may allow an account holder to connect or protect another person, receive family alerts, or manage certain protection settings. You may only create or manage a family connection when you have the authority and permission required to do so.

Guardian features are communication and safety-assistance tools. They do not guarantee that every event will be detected, that every alert will be delivered, or that an alert will arrive before a person takes action. Network failures, device settings, third-party services, incorrect information, and other circumstances can delay or prevent notifications.

If you use Vardin to protect another person, you are responsible for using the feature lawfully and for providing any notices or obtaining any consent that applicable law requires.`
  },
  {
    title: "8. Age Suitability",
    body: `Vardin is a general consumer scam-awareness service and does not currently offer a child-directed mode. The Service is not designed as a child-directed service.

If a person is below the age required to enter a binding agreement or use a particular feature under the law that applies to them, they should use Vardin only with the involvement or authorization required by that law. If the product later introduces child-directed features or intentionally targets children, Vardin should update these Terms, its Privacy Policy and its product safeguards before doing so.`
  },
  {
    title: "9. Acceptable Use",
    body: `You may use Vardin only for lawful purposes and in accordance with these Terms. You may not:

• use the Service to commit, facilitate, conceal, or plan fraud, harassment, abuse, identity theft, unauthorized surveillance, or other unlawful activity;
• attempt to gain unauthorized access to the Service, another account, or any system connected to the Service;
• probe, scan, test, reverse engineer, decompile, or circumvent security or access controls except where applicable law expressly permits it;
• interfere with the Service, overload infrastructure, introduce malicious code, or attempt to bypass usage or credit limits;
• use automated scraping, bots, or other automated access methods except where Vardin expressly permits them;
• use Vardin outputs to make decisions that unlawfully discriminate against another person;
• submit content that you do not have permission to submit; or
• use Vardin in a way that violates applicable law or the rights of others.`
  },
  {
    title: "10. Paid Plans, Credits, and Billing",
    body: `Vardin offers a free Starter plan and paid plans that may include recurring subscriptions and additional AI credits. Current prices, included features, credit allocations, family-member pricing, and billing frequency are displayed at the time of purchase and may change prospectively.

Paid subscriptions currently use annual billing through PayPal. The Service may display a monthly equivalent for comparison while charging the applicable annual amount. Additional family members may incur additional annual charges as displayed during checkout.

Credit purchases are separate from subscriptions unless expressly stated otherwise. Credits are for use within the Service, are non-transferable, and have no cash value except where applicable law requires otherwise. Credit consumption varies by feature and may change when Vardin changes or adds features; the applicable credit cost is displayed or communicated by the Service.

Cancellation stops future renewal but does not necessarily create a refund for a period that has already been paid. Refunds, where available, are governed by applicable law, the terms presented at checkout, and any mandatory consumer rights. Nothing in these Terms limits a refund right that cannot lawfully be excluded.

If a payment is reversed, disputed, charged back, refunded, or otherwise not successfully completed, Vardin may suspend or limit paid features associated with that payment, subject to applicable law.`
  },
  {
    title: "11. Intellectual Property",
    body: `The Service, including its software, interface, branding, designs, text, graphics, audiovisual materials, databases, compilations, and other Vardin-provided content, is owned by or licensed to Vardin and is protected by applicable intellectual-property laws.

Subject to these Terms, Vardin grants you a limited, non-exclusive, non-transferable, revocable right to access and use the Service for its intended purpose. No ownership rights are transferred to you.

You may not copy, reproduce, distribute, sell, sublicense, publicly display, commercially exploit, or create derivative works from Vardin's proprietary materials except as permitted by law or with written authorization.`
  },
  {
    title: "12. Third-Party Services and Links",
    body: `The Service may contain links to or integrations with third-party websites and services, including payment providers and technology providers. Third-party services are governed by their own terms and privacy practices. Vardin is not responsible for third-party services that it does not control.

A link, integration, or reference does not constitute an endorsement or guarantee of a third party's products, services, security, accuracy, availability, or conduct.`
  },
  {
    title: "13. Availability, Changes, and Beta Features",
    body: `Vardin may add, modify, suspend, or discontinue features. Some features may be experimental, in testing, or subject to limits. We may perform maintenance, security updates, or other changes that temporarily affect availability.

We do not guarantee that the Service will always be available, uninterrupted, timely, secure, or error-free. We will use reasonable efforts to maintain the Service and address material technical problems, but outages and failures can occur.`
  },
  {
    title: "14. Suspension and Termination",
    body: `You may stop using the Service at any time. Subject to applicable law and any surviving contractual obligations, you may request account deletion through the methods described in the Privacy Policy.

Vardin may suspend or terminate access where reasonably necessary to prevent abuse, protect users or the Service, investigate suspected fraud or security incidents, comply with law, enforce these Terms, or address non-payment. Where reasonably practicable and legally permitted, we will provide notice and an opportunity to resolve the issue.

Termination does not eliminate obligations that by their nature should survive, including provisions concerning intellectual property, disclaimers, limitations of liability, dispute resolution, payment obligations already incurred, and User Content rights necessary to comply with law or resolve disputes.`
  },
  {
    title: "15. Disclaimers",
    body: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE." VARDIN DISCLAIMS WARRANTIES AND CONDITIONS, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, NON-INFRINGEMENT, ACCURACY, RELIABILITY, AND UNINTERRUPTED OR ERROR-FREE OPERATION.

VARDIN DOES NOT WARRANT THAT THE SERVICE WILL DETECT EVERY SCAM, FRAUD, THREAT, MALICIOUS WEBSITE, COMPROMISED ACCOUNT, OR OTHER HARMFUL EVENT; THAT ALERTS WILL ALWAYS BE DELIVERED; THAT INFORMATION WILL ALWAYS BE CURRENT; OR THAT USE OF THE SERVICE WILL PREVENT FINANCIAL LOSS, IDENTITY THEFT, CYBERATTACK, OR OTHER HARM.

NOTHING IN THESE TERMS EXCLUDES A WARRANTY OR RIGHT THAT APPLICABLE LAW DOES NOT PERMIT US TO EXCLUDE.`
  },
  {
    title: "16. Limitation of Liability",
    body: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, VARDIN AND ITS AFFILIATES, SERVICE PROVIDERS, LICENSORS, OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOSS OF PROFITS, REVENUE, DATA, GOODWILL, BUSINESS OPPORTUNITY, OR ANTICIPATED SAVINGS, ARISING OUT OF OR RELATED TO THE SERVICE OR THESE TERMS.

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, VARDIN'S TOTAL AGGREGATE LIABILITY FOR CLAIMS ARISING OUT OF OR RELATING TO THE SERVICE OR THESE TERMS WILL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID TO VARDIN FOR THE SERVICE DURING THE TWELVE MONTHS BEFORE THE EVENT GIVING RISE TO THE CLAIM OR (B) US $100.

THESE LIMITATIONS APPLY ONLY TO THE EXTENT PERMITTED BY LAW. THEY DO NOT LIMIT LIABILITY THAT CANNOT LAWFULLY BE LIMITED OR EXCLUDED, INCLUDING LIABILITY THAT A JURISDICTION PROHIBITS A CONTRACT FROM EXCLUDING.`
  },
  {
    title: "17. Indemnification",
    body: `To the maximum extent permitted by applicable law, you agree to defend, indemnify, and hold harmless Vardin and its affiliates, service providers, licensors, officers, directors, employees, and agents from claims, liabilities, damages, losses, and reasonable expenses arising from your unlawful use of the Service, your violation of these Terms, your infringement or misappropriation of another person's rights, or User Content that you submit without the necessary rights or permissions.

This obligation does not apply to the extent a claim results from Vardin's own unlawful conduct or from a matter that cannot lawfully be allocated to you.`
  },
  {
    title: "18. Disputes and Applicable Law",
    body: `Before starting formal proceedings, you agree to give Vardin a reasonable opportunity to investigate and resolve a dispute by contacting inbal5252@gmail.com with a description of the issue and the requested resolution. Nothing in this section prevents you from contacting a regulator or exercising a consumer right that applicable law makes non-waivable.

These Terms are governed by the laws applicable to the jurisdiction in which Vardin's operating entity is established, without regard to conflict-of-law principles, except where mandatory consumer-protection law requires otherwise. Subject to mandatory law, disputes that cannot be resolved informally will be brought before a court with appropriate jurisdiction over the parties and the dispute.

If the law of your country or state gives you mandatory rights that conflict with this section, those rights prevail.`
  },
  {
    title: "19. Changes to These Terms",
    body: `We may update these Terms when the Service, law, or our business practices change. We will not rely on a material change to these Terms merely by quietly changing a page after you have already agreed to materially different terms.

For material changes, Vardin will provide notice through a reasonable method, which may include an in-product notice, email, or a prominent notice on the Service. Where applicable law requires affirmative acceptance or additional notice, we will provide it. The "Last updated" date at the top of this page identifies the current version.

Your continued use after the effective date of a properly notified change constitutes acceptance only to the extent permitted by applicable law.`
  },
  {
    title: "20. General Contract Terms",
    body: `If any provision of these Terms is found unenforceable, it will be modified or severed to the minimum extent necessary, and the remaining provisions will remain in effect. A failure to enforce a provision is not a waiver of the right to enforce it later.

You may not assign your rights or obligations under these Terms without Vardin's written consent, except where applicable law permits an assignment connected with a merger, acquisition, reorganization, or sale of substantially all relevant assets. Vardin may assign these Terms in connection with such a transaction.

These Terms, together with the Privacy Policy, Data Collection Notice, and any additional terms expressly presented for a particular feature or purchase, constitute the agreement between you and Vardin concerning the Service and supersede prior agreements concerning the same subject matter, except where applicable law provides otherwise.`
  },
  {
    title: "21. Contact",
    body: `Questions, legal notices, privacy requests, and complaints concerning these Terms may be sent to inbal5252@gmail.com. Please include enough information for us to identify the relevant account or issue without unnecessarily sending sensitive personal information.`
  },
];

export default function Terms() {
  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-10 sm:pb-16 break-words [overflow-wrap:anywhere]">
      <header className="border-b border-border pb-7 sm:pb-8 mb-7 sm:mb-8">
        <div className="flex items-center gap-3 text-primary mb-5">
          <FileText className="w-6 h-6" />
          <span className="text-sm font-semibold tracking-wide uppercase">Legal</span>
        </div>
        <h1 className="text-[2rem] leading-tight sm:text-4xl font-bold tracking-tight font-heading">Terms of Service</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: September 2026</p>
        <p className="mt-4 sm:mt-5 max-w-3xl text-[14px] sm:text-base leading-6 sm:leading-7 text-muted-foreground break-words">
          These Terms govern your use of Vardin and explain the rules, limitations, payment terms, AI limitations, and legal responsibilities that apply when you use the Service. Vardin is currently in beta and may change as it is tested and improved.
        </p>
      </header>

      <div className="mb-7 sm:mb-8 border border-primary/20 bg-primary/5 rounded-xl p-4 sm:p-6 overflow-hidden">
        <div className="flex items-start gap-3 min-w-0">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold">Please read before using Vardin</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Vardin is a scam-detection and safety-assistance service. Its automated results can be wrong and must not be treated as guarantees or as professional advice. You remain responsible for independently verifying important information before acting on it.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-0">
        {sections.map((section) => (
          <section key={section.title} className="border-b border-border/70 py-7 sm:py-8 last:border-0">
            <h2 className="text-lg sm:text-xl leading-6 sm:leading-7 font-semibold tracking-tight">{section.title}</h2>
            <p className="mt-3 text-[14px] sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground whitespace-pre-line break-words [overflow-wrap:anywhere]">{section.body}</p>
          </section>
        ))}
      </div>

      <footer className="mt-7 sm:mt-8 pt-6 border-t border-border text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-x-5 sm:gap-y-2">
          <Link to="/privacy" className="text-primary hover:underline inline-flex items-center gap-1">
            Privacy Policy <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link to="/data-collection" className="text-primary hover:underline inline-flex items-center gap-1">
            Data Collection Notice <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link to="/cookies" className="text-primary hover:underline inline-flex items-center gap-1">
            Cookie Policy <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <p className="mt-4 text-xs leading-5">
          These Terms are intended to be comprehensive, but no online terms can guarantee that every provision will be enforceable in every jurisdiction. Mandatory rights under applicable law remain unaffected.
        </p>
      </footer>
    </div>
  );
}
