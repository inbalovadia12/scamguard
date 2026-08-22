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

    let provisional: any;

    try {
      provisional = await base44.integrations.Core.InvokeLLM({
        prompt: `Give a fast provisional scam-risk assessment of the phone number ${normalized}. Do not claim that you verified facts you did not verify. Return a useful assessment based on known patterns. Respond in ${languageName}.`,
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
    } catch (llmError) {
      console.error('Phone provisional lookup failed', llmError);
      provisional = {
        country: '',
        carrier: '',
        reputation_score: 50,
        risk_level: 'medium',
        summary: 'Vardin could not complete the automated phone reputation lookup. Treat this number cautiously and verify the caller independently.',
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
    }

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
