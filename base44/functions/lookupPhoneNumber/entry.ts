import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { secrets } from 'base44:runtime';

function normalizePhone(raw: string): string {
  const cleaned = raw.trim().replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return '+' + cleaned.slice(1).replace(/\D/g, '');
  return '+' + cleaned.replace(/\D/g, '');
}

function deriveRisk(fraudScore: number, risky: boolean | null, recentAbuse: boolean | null, spammer: boolean | null): 'low' | 'medium' | 'high' {
  if (fraudScore >= 71 || recentAbuse === true || spammer === true) return 'high';
  if (fraudScore >= 36 || risky === true) return 'medium';
  return 'low';
}

function buildSummary(data: any): string {
  const facts: string[] = [];
  if (data.valid === false) facts.push('The number appears invalid or nonexistent.');
  if (data.active === false) facts.push('The line appears inactive.');
  if (data.recent_abuse === true) facts.push('Recent abuse has been reported for this number.');
  if (data.spammer === true) facts.push('IPQS flags the number as associated with spam activity.');
  if (data.risky === true) facts.push('IPQS flags elevated risk signals.');
  if (data.VOIP === true) facts.push('The number is a VoIP line.');
  if (data.prepaid === true) facts.push('The number is prepaid.');
  if (data.line_type) facts.push(`Line type: ${data.line_type}.`);
  if (data.carrier && data.carrier !== 'N/A') facts.push(`Carrier: ${data.carrier}.`);
  if (data.country && data.country !== 'N/A') facts.push(`Country: ${data.country}.`);
  if (facts.length === 0) return 'IPQS returned no major risk signals for this number.';
  return facts.join(' ');
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
    const apiKey = secrets.get('IPQS_API_KEY');
    if (!apiKey) {
      return Response.json({ error: 'IPQS_API_KEY is not configured' }, { status: 500 });
    }

    const params = new URLSearchParams({ key: apiKey, phone: normalized });
    const response = await fetch(`https://ipqualityscore.com/api/json/phone?${params.toString()}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return Response.json({
        error: data?.message || `IPQS request failed (${response.status})`,
        provider: 'IPQS',
        provider_status: response.status,
        request_id: data?.request_id || null,
      }, { status: 200 });
    }

    if (!data || data.success !== true) {
      return Response.json({
        error: data?.message || 'IPQS could not complete the lookup.',
        provider: 'IPQS',
        provider_status: response.status,
        request_id: data?.request_id || null,
      }, { status: 200 });
    }

    const fraudScore = Math.max(0, Math.min(100, Number(data.fraud_score) || 0));
    let redditMatches: any[] = [];
    try {
      redditMatches = await base44.asServiceRole.entities.RedditScamNumber.filter({ normalized_number: normalized });
    } catch (redditError) {
      console.error('Reddit index lookup failed', redditError);
    }

    const redditReportCount = redditMatches.length;
    const redditSources = redditMatches.map((item: any) => item.post_url).filter(Boolean);
    const redditCategories = [...new Set(redditMatches.map((item: any) => item.scam_category).filter(Boolean))];
    const redditSummary = redditMatches.length
      ? `Community evidence found: ${redditReportCount} Reddit ScamNumbers report${redditReportCount === 1 ? '' : 's'} match this phone number.`
      : '';
    const result = {
      phone_number: data.formatted || normalized,
      country: data.country || '',
      carrier: data.carrier || '',
      reputation_score: Math.max(0, 100 - fraudScore),
      risk_level: redditReportCount > 0 ? 'high' : deriveRisk(fraudScore, data.risky ?? null, data.recent_abuse ?? null, data.spammer ?? null),
      user_reports: redditMatches.map((item: any) => item.summary || item.title).filter(Boolean),
      scam_categories: redditCategories,
      summary: [buildSummary(data), redditSummary].filter(Boolean).join(' '),
      sources: [...new Set(redditSources)],
      report_count: redditReportCount,
      scam_report_count: redditReportCount,
      spam_report_count: data.spammer === true ? 1 : 0,
      suspicious_report_count: data.risky === true ? 1 : 0,
      safe_report_count: redditReportCount === 0 && data.valid === true && data.risky !== true && data.spammer !== true ? 1 : 0,
      caller_id_status: redditReportCount > 0 ? 'SCAM' : (data.spammer === true ? 'SPAM' : (fraudScore >= 71 ? 'SCAM' : (fraudScore >= 36 || data.risky === true ? 'SUSPICIOUS' : 'SAFE'))),
      confidence_score: redditReportCount > 0 ? Math.min(100, 90 + Math.min(10, redditReportCount)) : 85,
      verified_business: Boolean(data.name && data.name !== 'N/A' && data.name !== 'IPQualityScore'),
      business_name: data.name && data.name !== 'N/A' && data.name !== 'IPQualityScore' ? data.name : '',
      caller_id_label: redditReportCount > 0 ? 'Vardin: Scam Likely' : '',
      created_date: new Date().toISOString(),
    };

    let lookup: any = null;
    try {
      lookup = await base44.asServiceRole.entities.PhoneLookup.create(result);
    } catch (saveError) {
      console.error('PhoneLookup save failed', saveError);
    }

    return Response.json({
      result,
      lookup: lookup ? { id: lookup.id, phone_number: result.phone_number, cached: false } : { phone_number: result.phone_number, cached: false },
      cached: false,
    });
  } catch (error) {
    console.error('lookupPhoneNumber error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Lookup failed' }, { status: 500 });
  }
});