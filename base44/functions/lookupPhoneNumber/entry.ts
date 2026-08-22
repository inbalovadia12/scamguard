import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

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

    // Return immediately without a synchronous LLM dependency. This keeps the
    // phone-lookup endpoint fast and avoids proxy/function timeouts. The existing
    // Vardin analysis stack can enrich this record asynchronously later.
    const provisional = {
      country: '',
      carrier: '',
      reputation_score: 50,
      risk_level: 'medium',
      summary: `Phone number ${displayNumber} was received. Vardin has not independently verified this number yet; treat unexpected callers cautiously.`,
      scam_categories: [],
      sources: [],
      report_count: 0,
      scam_report_count: 0,
      spam_report_count: 0,
      suspicious_report_count: 0,
      safe_report_count: 0,
      caller_id_status: 'UNKNOWN',
      confidence_score: 0,
      verified_business: false,
      business_name: '',
      caller_id_label: '',
    };

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

    let lookup: any = null;
    try {
      lookup = await base44.asServiceRole.entities.PhoneLookup.create(result);
    } catch (saveError) {
      console.error('PhoneLookup save failed', saveError);
    }

    return Response.json({
      result,
      lookup: lookup
        ? { id: lookup.id, phone_number: displayNumber, cached: false }
        : { phone_number: displayNumber, cached: false },
      cached: false,
    });
  } catch (error) {
    console.error('lookupPhoneNumber error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Lookup failed' }, { status: 500 });
  }
});
