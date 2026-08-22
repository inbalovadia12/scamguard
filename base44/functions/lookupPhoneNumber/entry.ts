import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { waitUntil } from 'base44:runtime';

function normalizePhone(raw: string): string {
  const cleaned = raw.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return '+' + cleaned.slice(1).replace(/\D/g, '');
  return '+' + cleaned.replace(/\D/g, '');
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  he: 'Hebrew',
  es: 'Spanish',
};

async function deepLookupAndUpsert(base44: any, normalized: string, displayNumber: string, languageName: string) {
  try {
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Research the phone number ${normalized} for scam/spam reputation. Use current web information and high-signal sources such as scam-report databases, business listings, Reddit scam discussions, and official sources. Do not invent reports, identities, carriers, or sources. Explain uncertainty. Respond in ${languageName}.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          country: { type: 'string' },
          carrier: { type: 'string' },
          reputation_score: { type: 'number' },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          summary: { type: 'string' },
          scam_categories: { type: 'array', items: { type: 'string' } },
          sources: { type: 'array', items: { type: 'string' } },
          report_count: { type: 'number' },
          scam_report_count: { type: 'number' },
          spam_report_count: { type: 'number' },
          suspicious_report_count: { type: 'number' },
          safe_report_count: { type: 'number' },
          caller_id_status: { type: 'string', enum: ['SCAM', 'SPAM', 'SUSPICIOUS', 'SAFE', 'UNKNOWN'] },
          confidence_score: { type: 'number' },
          verified_business: { type: 'boolean' },
          business_name: { type: 'string' },
          caller_id_label: { type: 'string' },
        },
        required: ['risk_level', 'summary', 'reputation_score', 'confidence_score'],
      },
    });

    await base44.asServiceRole.entities.PhoneReputation.create({
      normalized_number: normalized,
      phone_number: displayNumber,
      country: result.country || '',
      carrier: result.carrier || '',
      reputation_score: Number(result.reputation_score) || 0,
      risk_level: result.risk_level || 'low',
      caller_id_status: result.caller_id_status || 'UNKNOWN',
      confidence_score: Number(result.confidence_score) || 0,
      report_count: Number(result.report_count) || 0,
      scam_report_count: Number(result.scam_report_count) || 0,
      spam_report_count: Number(result.spam_report_count) || 0,
      suspicious_report_count: Number(result.suspicious_report_count) || 0,
      safe_report_count: Number(result.safe_report_count) || 0,
      verified_business: Boolean(result.verified_business),
      business_name: result.business_name || '',
      scam_categories: result.scam_categories || [],
      summary: result.summary || '',
      sources: result.sources || [],
      caller_id_label: result.caller_id_label || '',
      last_checked_at: new Date().toISOString(),
      last_external_check_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Phone deep lookup failed', error);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium' && plan !== 'plus') {
      return Response.json({ error: 'Premium subscription required', upgrade_url: 'https://vardin.base44.app/pricing' }, { status: 403 });
    }

    const body = await req.json();
    const phoneInput = String(body?.phone_number || '').trim();
    if (!phoneInput) return Response.json({ error: 'Phone number is required' }, { status: 400 });

    const normalized = normalizePhone(phoneInput);
    const languageName = LANGUAGE_NAMES[String(body?.language || 'en')] || 'English';
    const displayNumber = phoneInput;

    const provisional = await base44.integrations.Core.InvokeLLM({
      prompt: `Give a fast provisional scam-risk assessment of the phone number ${normalized}. Do not claim that you verified facts you did not verify. Return a useful assessment based on known patterns and clearly state that a deeper web lookup is running. Respond in ${languageName}.`,
      add_context_from_internet: false,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          country: { type: 'string' },
          carrier: { type: 'string' },
          reputation_score: { type: 'number' },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          summary: { type: 'string' },
          scam_categories: { type: 'array', items: { type: 'string' } },
          sources: { type: 'array', items: { type: 'string' } },
          report_count: { type: 'number' },
          scam_report_count: { type: 'number' },
          spam_report_count: { type: 'number' },
          suspicious_report_count: { type: 'number' },
          safe_report_count: { type: 'number' },
          caller_id_status: { type: 'string', enum: ['SCAM', 'SPAM', 'SUSPICIOUS', 'SAFE', 'UNKNOWN'] },
          confidence_score: { type: 'number' },
          verified_business: { type: 'boolean' },
          business_name: { type: 'string' },
          caller_id_label: { type: 'string' },
        },
        required: ['risk_level', 'summary', 'reputation_score', 'confidence_score'],
      },
    });

    const result = {
      phone_number: displayNumber,
      country: provisional.country || '',
      carrier: provisional.carrier || '',
      reputation_score: Math.max(0, Math.min(100, Number(provisional.reputation_score) || 0)),
      risk_level: provisional.risk_level || 'low',
      user_reports: [],
      scam_categories: provisional.scam_categories || [],
      summary: provisional.summary || 'A deeper web lookup is running in the background.',
      sources: provisional.sources || [],
      report_count: Number(provisional.report_count) || 0,
      scam_report_count: Number(provisional.scam_report_count) || 0,
      spam_report_count: Number(provisional.spam_report_count) || 0,
      suspicious_report_count: Number(provisional.suspicious_report_count) || 0,
      safe_report_count: Number(provisional.safe_report_count) || 0,
      caller_id_status: provisional.caller_id_status || 'UNKNOWN',
      confidence_score: Math.max(0, Math.min(100, Number(provisional.confidence_score) || 0)),
      verified_business: Boolean(provisional.verified_business),
      business_name: provisional.business_name || '',
      caller_id_label: provisional.caller_id_label || '',
    };

    const lookup = await base44.entities.PhoneLookup.create(result);
    waitUntil(deepLookupAndUpsert(base44, normalized, displayNumber, languageName));

    return Response.json({ result, lookup: { id: lookup.id, phone_number: displayNumber, cached: false }, cached: false });
  } catch (error) {
    console.error('lookupPhoneNumber error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Lookup failed' }, { status: 500 });
  }
});
