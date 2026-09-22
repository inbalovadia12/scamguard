import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { upsertPhoneReputation, normalizePhoneNumber } from '../../shared/phoneReputation.ts';
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from '../../shared/credits.ts';
import { matchOfficialNumber, computePhoneAssessment } from '../../shared/phoneEvidence.ts';

const CREDIT_COST = 5;

// A stored report may only be attached to a number when its own phone_number
// normalizes to the EXACT scanned number. This prevents merging reports from
// similar numbers, neighboring digits, or impersonating numbers.
function reportMatchesNumber(reportPhone: any, cacheKey: string): boolean {
  return normalizePhoneNumber(reportPhone) === cacheKey;
}

function parseJsonFromText(text: string): any {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  return null;
}

// Known fictional/reserved number ranges (555-0100..555-0199) — instant safe result.
function checkKnownFictional(cleaned: string): any {
  if (cleaned.length >= 10) {
    const last4 = cleaned.slice(-4);
    const exchanges = cleaned.slice(-7, -4);
    if (exchanges === '555' && last4.startsWith('01')) {
      return {
        country: 'USA',
        carrier: 'None (Fictional Number)',
        reputation_score: 15,
        risk_level: 'low',
        confidence_score: 100,
        scam_categories: [],
        summary: 'This number is officially reserved for fictional use. It is not assigned to a real subscriber.',
      };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const available = getAvailableCredits(user);
    if (available.remaining < CREDIT_COST) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: available.remaining,
        credits_limit: getMonthlyCreditLimit(user),
        credit_cost: CREDIT_COST,
      }, { status: 402 });
    }

    const chargeCredits = async () => {
      const usage = applyCreditUsage(user, CREDIT_COST);
      if (!usage) throw new Error('Credit balance changed during lookup. Please try again.');
      await base44.auth.updateMe(usage);
      return getAvailableCredits({ ...user, ...usage }).remaining;
    };

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium' && plan !== 'plus') {
      return Response.json({ error: 'Premium subscription required', upgrade_url: '/pricing' }, { status: 403 });
    }

    const body = await req.json();
    const { phone_number, language } = body;
    if (!phone_number || !phone_number.trim()) {
      return Response.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const cleaned = phone_number.trim().replace(/[^\d]/g, '');
    if (cleaned.length < 7) return Response.json({ error: 'Please enter a valid phone number.' }, { status: 400 });

    let tenDigit: string;
    if (cleaned.length === 10) tenDigit = cleaned;
    else if (cleaned.length === 11 && cleaned.startsWith('1')) tenDigit = cleaned.slice(1);
    else if (cleaned.length > 10) tenDigit = cleaned.slice(-10);
    else tenDigit = cleaned;

    const isValidNANP = tenDigit.length === 10 && !tenDigit.startsWith('0') && !tenDigit.startsWith('1');
    const displayFormat = isValidNANP
      ? `${tenDigit.slice(0, 3)}-${tenDigit.slice(3, 6)}-${tenDigit.slice(6)}`
      : phone_number.trim();
    const cacheKey = isValidNANP ? `+1${tenDigit}` : `+${cleaned}`;

    // Official / verified business registry (exact match only).
    const officialMatch = matchOfficialNumber(cacheKey);

    // ---- Fetch stored community evidence (EXACT match only) ----
    const fetchCommunityEvidence = async (): Promise<any> => {
      try {
        const rows = await base44.asServiceRole.entities.PhoneCommunityReport.filter({ normalized_number: cacheKey });
        const verified = (rows || []).filter((r: any) =>
          r.status === 'active' && reportMatchesNumber(r.phone_number, cacheKey)
        );
        return {
          matched: verified.length > 0,
          report_count: verified.length,
          scam_reports: verified.filter((r: any) => r.report_type === 'scam').length,
          spam_reports: verified.filter((r: any) => r.report_type === 'spam').length,
          suspicious_reports: verified.filter((r: any) => r.report_type === 'suspicious').length,
          safe_reports: verified.filter((r: any) => r.report_type === 'safe').length,
          reports: verified.map((r: any) => ({
            type: r.report_type,
            category: r.scam_category,
            summary: r.summary,
            created: r.created_date_label,
            created_date: r.created_date,
            sources: Array.isArray(r.sources) ? r.sources : ['Vardin Community'],
          })),
        };
      } catch (e) {
        console.error('Community evidence fetch failed:', e);
        return { matched: false, report_count: 0, scam_reports: 0, spam_reports: 0, suspicious_reports: 0, safe_reports: 0, reports: [] };
      }
    };

    // ---- Fetch indexed public evidence (EXACT match only) ----
    const fetchRedditEvidence = async (): Promise<any> => {
      try {
        const rows = await base44.asServiceRole.entities.RedditScamNumber.filter({ normalized_number: cacheKey });
        const verified = (rows || []).filter((r: any) => reportMatchesNumber(r.phone_number, cacheKey));
        return {
          matched: verified.length > 0,
          report_count: verified.length,
          sources: verified.map((r: any) => r.post_url).filter(Boolean),
          reports: verified.map((r: any) => ({
            title: r.title,
            summary: r.summary,
            category: r.scam_category,
            url: r.post_url,
            posted_at: r.posted_at,
          })),
        };
      } catch (e) {
        console.error('Reddit evidence fetch failed:', e);
        return { matched: false, report_count: 0, sources: [], reports: [] };
      }
    };

    // Known fictional number — instant safe result (still charge + persist).
    const knownFictional = checkKnownFictional(cleaned);
    if (knownFictional) {
      const communityEvidence = await fetchCommunityEvidence();
      const redditEvidence = await fetchRedditEvidence();
      await upsertPhoneReputation(base44, {
        normalized_number: cacheKey, phone_number: displayFormat,
        country: knownFictional.country, carrier: knownFictional.carrier,
        reputation_score: knownFictional.reputation_score, risk_level: knownFictional.risk_level,
        scam_categories: [], summary: knownFictional.summary, sources: [],
        verified_business: false, last_external_check_at: new Date().toISOString(),
      });
      let lookup: any = null;
      try {
        lookup = await base44.entities.PhoneLookup.create({
          phone_number: displayFormat, status: 'complete',
          country: knownFictional.country, carrier: knownFictional.carrier,
          reputation_score: knownFictional.reputation_score, risk_level: knownFictional.risk_level,
          user_reports: [], scam_categories: [], summary: knownFictional.summary, sources: [],
          caller_id_status: 'UNKNOWN', confidence_score: knownFictional.confidence_score,
          verified_business: false, business_name: '', caller_id_label: '',
        });
      } catch (e) { console.error('PhoneLookup save failed', e); }

      const creditsRemaining = await chargeCredits();
      return Response.json({
        result: {
          ...knownFictional,
          user_reports: [],
          caller_id_status: 'UNKNOWN',
          caller_id_label: '',
          last_checked_at: new Date().toISOString(),
          community: communityEvidence,
          reddit: redditEvidence,
          evidence: { official_match: officialMatch, total_scam_indicators: 0, assessment_basis: 'known reserved/fictional number range' },
        },
        lookup: lookup ? { id: lookup.id, phone_number: displayFormat, cached: false } : { phone_number: displayFormat, cached: false },
        cached: false,
        credits_used: CREDIT_COST, credits_remaining: creditsRemaining, credits_limit: getMonthlyCreditLimit(user),
      });
    }

    // ---- Fetch stored evidence (exact match) ----
    const communityEvidence = await fetchCommunityEvidence();
    const redditEvidence = await fetchRedditEvidence();

    // ---- LLM: identify the number AND gather traceable web evidence ----
    // The LLM identifies country/carrier/business and searches the web for pages
    // that EXPLICITLY mention this exact number in a scam/fraud/spam context. Web
    // findings are returned with source URLs and validated (exact-number mention +
    // valid URL). They are traceable per-source evidence — never fabricated counts.
    let llmInfo: any = { country: '', carrier: '', business_name: '' };
    let webFindings: any[] = [];
    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';
    const digitKey = cacheKey.replace(/\D/g, '');
    const isNanp = digitKey.length === 11 && digitKey.startsWith('1');
    const matchKeys = isNanp ? [digitKey, digitKey.slice(-10)] : [digitKey];
    const prompt = `Analyze the phone number ${displayFormat}.

Return ONLY valid JSON:
{
  "country": "",
  "carrier": "",
  "is_known_business": false,
  "business_name": "",
  "business_source_url": "",
  "web_notes": "",
  "findings": [{ "url": "", "title": "", "snippet": "", "category": "" }]
}

PART 1 — IDENTIFICATION:
- Identify the country and telecom carrier from official/public data.
- "is_known_business" = true ONLY if an official company/government source explicitly lists THIS EXACT number. Provide the official source URL in business_source_url.
- web_notes: brief factual identification context (max 200 chars). Never infer scam activity.

PART 2 — WEB EVIDENCE (scam/fraud/spam findings):
- Search the web for pages that EXPLICITLY mention the exact number ${displayFormat} (or its digits ${digitKey}) and associate it with scams, fraud, spam, or unwanted calls.
- Include a finding ONLY when the EXACT number is explicitly written on the page. Do NOT include pages about a different number, or generic scam discussions that do not name this exact number.
- Every finding MUST have a real, verifiable URL where the exact number appears, plus a short title and a snippet quoted/paraphrased from the page.
- category: one of phishing, smishing, romance, crypto_investment, tech_support, government_impersonation, bank_impersonation, marketplace, delivery, other.
- Do NOT invent URLs, titles, snippets, or counts. If no page explicitly names this exact number, return findings: [].
- Never guess. Empty arrays/strings if unsure.

Respond in ${languageName}.`;
    try {
      const llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            country: { type: 'string' },
            carrier: { type: 'string' },
            is_known_business: { type: 'boolean' },
            business_name: { type: 'string' },
            business_source_url: { type: 'string' },
            web_notes: { type: 'string' },
            findings: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  title: { type: 'string' },
                  snippet: { type: 'string' },
                  category: { type: 'string' },
                },
              },
            },
          },
        },
      });
      const parsed = parseJsonFromText(typeof llmResponse === 'string' ? llmResponse : JSON.stringify(llmResponse)) || {};
      llmInfo = { country: parsed.country || '', carrier: parsed.carrier || '', business_name: parsed.business_name || '' };
      const rawFindings = Array.isArray(parsed.findings) ? parsed.findings : [];
      webFindings = rawFindings
        .filter((f: any) => f && typeof f.url === 'string' && /^https?:\/\//i.test(f.url))
        .filter((f: any) => {
          // Defensive: the finding must relate to the exact number — its URL,
          // title, or snippet must contain the number's digit string (full
          // international form, or the 10-digit NANP national form).
          const blob = `${f.url} ${f.title || ''} ${f.snippet || ''}`.replace(/\D/g, '');
          return matchKeys.some((k) => blob.includes(k));
        })
        .slice(0, 10)
        .map((f: any) => ({
          url: f.url,
          title: String(f.title || '').slice(0, 200),
          snippet: String(f.snippet || '').slice(0, 400),
          category: f.category || 'other',
        }));
    } catch (e) {
      console.error('LLM identification/web evidence failed:', e);
      llmInfo = { country: '', carrier: '', business_name: '' };
      webFindings = [];
    }

    // ---- Evidence-weighted assessment ----
    const assessment = computePhoneAssessment({
      normalizedNumber: cacheKey,
      officialMatch,
      communityReports: communityEvidence.reports || [],
      redditReports: redditEvidence.reports || [],
      webFindings,
      llmInfo,
    });

    // ---- Persist canonical reputation (precomputed values are authoritative) ----
    const rep = await upsertPhoneReputation(base44, {
      normalized_number: cacheKey, phone_number: displayFormat,
      country: llmInfo.country, carrier: llmInfo.carrier,
      reputation_score: assessment.reputation_score, risk_level: assessment.risk_level,
      scam_categories: assessment.scam_categories, summary: assessment.summary, sources: assessment.sources,
      verified_business: assessment.verified_business, business_name: assessment.business_name,
      last_external_check_at: new Date().toISOString(),
      caller_id_status: assessment.caller_id_status,
      confidence_score: assessment.confidence_score,
      report_counts: {
        scam: assessment.scam_report_count, spam: assessment.spam_report_count,
        suspicious: assessment.suspicious_report_count, safe: assessment.safe_report_count,
      },
    });

    const fullResult = {
      country: llmInfo.country || '',
      carrier: llmInfo.carrier || '',
      reputation_score: assessment.reputation_score,
      risk_level: assessment.risk_level,
      user_reports: [], // never LLM-invented; real reports live in `community` / `reddit`
      scam_categories: assessment.scam_categories,
      summary: assessment.summary,
      sources: assessment.sources,
      report_count: assessment.report_count,
      scam_report_count: assessment.scam_report_count,
      spam_report_count: assessment.spam_report_count,
      suspicious_report_count: assessment.suspicious_report_count,
      safe_report_count: assessment.safe_report_count,
      caller_id_status: assessment.caller_id_status,
      confidence_score: assessment.confidence_score,
      verified_business: assessment.verified_business,
      business_name: assessment.business_name,
      caller_id_label: rep?.caller_id_label || '',
      last_checked_at: new Date().toISOString(),
      community: communityEvidence,
      reddit: redditEvidence,
      web: { matched: webFindings.length > 0, report_count: webFindings.length, sources: webFindings.map((f) => f.url), reports: webFindings },
      evidence: assessment.evidence,
    };

    let lookup: any = null;
    try {
      lookup = await base44.entities.PhoneLookup.create({
        phone_number: displayFormat, status: 'complete',
        country: fullResult.country, carrier: fullResult.carrier,
        reputation_score: fullResult.reputation_score, risk_level: fullResult.risk_level,
        user_reports: [], scam_categories: fullResult.scam_categories,
        summary: fullResult.summary, sources: fullResult.sources,
        report_count: fullResult.report_count, scam_report_count: fullResult.scam_report_count,
        spam_report_count: fullResult.spam_report_count, suspicious_report_count: fullResult.suspicious_report_count,
        safe_report_count: fullResult.safe_report_count,
        caller_id_status: fullResult.caller_id_status, confidence_score: fullResult.confidence_score,
        verified_business: fullResult.verified_business, business_name: fullResult.business_name,
        caller_id_label: fullResult.caller_id_label,
      });
    } catch (e) {
      console.error('PhoneLookup save failed:', e);
    }

    const creditsRemaining = await chargeCredits();
    return Response.json({
      result: fullResult,
      lookup: lookup ? { id: lookup.id, phone_number: displayFormat, cached: false } : { phone_number: displayFormat, cached: false },
      cached: false,
      credits_used: CREDIT_COST, credits_remaining: creditsRemaining, credits_limit: getMonthlyCreditLimit(user),
    });
  } catch (error) {
    console.error('lookupPhoneNumber error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Lookup failed' }, { status: 500 });
  }
});