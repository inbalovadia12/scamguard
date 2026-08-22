import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { secrets } from 'base44:runtime';

const IPQS_TIMEOUT_MS = 10000;

function normalizePhone(raw: unknown): string {
  const value = String(raw ?? '').trim();
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) throw new Error('Please enter a valid phone number.');
  return `+${digits}`;
}

function riskLevel(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function summaryFromIpqs(data: any): string {
  const facts: string[] = [];
  if (data.valid === false) facts.push('The number appears invalid or nonexistent.');
  if (data.recent_abuse === true) facts.push('Recent abuse has been reported for this number.');
  if (data.spammer === true) facts.push('IPQS flags this number as associated with spam activity.');
  if (data.risky === true) facts.push('IPQS reports elevated risk signals.');
  if (data.VOIP === true) facts.push('The number is classified as VoIP.');
  if (data.prepaid === true) facts.push('The number is prepaid.');
  if (data.line_type) facts.push(`Line type: ${data.line_type}.`);
  if (data.carrier && data.carrier !== 'N/A') facts.push(`Carrier: ${data.carrier}.`);
  if (data.country && data.country !== 'N/A') facts.push(`Country: ${data.country}.`);
  if (!facts.length) return 'No major phone-risk signals were returned by IPQS.';
  return facts.join(' ');
}

function toResult(ipqs: any, phone: string) {
  const fraudScore = Math.max(0, Math.min(100, Number(ipqs.fraud_score) || 0));
  const risk = riskLevel(fraudScore);
  const verifiedBusiness = Boolean(ipqs.name && ipqs.name !== 'N/A' && ipqs.name !== 'IPQualityScore');
  const businessName = verifiedBusiness ? String(ipqs.name) : '';
  const status = fraudScore >= 70 || ipqs.recent_abuse === true || ipqs.spammer === true
    ? 'SCAM'
    : fraudScore >= 40 || ipqs.risky === true
      ? 'SUSPICIOUS'
      : 'SAFE';

  return {
    phone_number: ipqs.formatted || phone,
    country: ipqs.country || '',
    carrier: ipqs.carrier || '',
    reputation_score: fraudScore,
    risk_level: risk,
    user_reports: [],
    scam_categories: [],
    summary: summaryFromIpqs(ipqs),
    sources: ['https://www.ipqualityscore.com/'],
    report_count: 0,
    scam_report_count: status === 'SCAM' ? 1 : 0,
    spam_report_count: ipqs.spammer === true ? 1 : 0,
    suspicious_report_count: status === 'SUSPICIOUS' ? 1 : 0,
    safe_report_count: status === 'SAFE' ? 1 : 0,
    caller_id_status: status,
    confidence_score: ipqs.success === true ? 85 : 0,
    verified_business: verifiedBusiness,
    business_name: businessName,
    caller_id_label: status === 'SCAM'
      ? 'Vardin: Scam Likely'
      : status === 'SUSPICIOUS'
        ? 'Vardin: Suspicious'
        : status === 'SAFE'
          ? 'Vardin: Safe'
          : '',
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const plan = String(user.subscription_plan || 'starter').toLowerCase();
    if (!['plus', 'premium', 'elite'].includes(plan)) {
      return Response.json({ error: 'Premium subscription required', upgrade_url: 'https://vardin.base44.app/pricing' }, { status: 403 });
    }

    const body = await req.json();
    const phone = normalizePhone(body?.phone_number);

    const apiKey = secrets.get('IPQS_API_KEY');
    if (!apiKey) {
      console.error('IPQS_API_KEY is missing');
      return Response.json({ error: 'Phone reputation service is not configured.' }, { status: 500 });
    }

    // Serve recent canonical results without spending another external lookup.
    try {
      const cached = await base44.asServiceRole.entities.PhoneReputation.filter({ normalized_number: phone });
      const existing = cached?.[0];
      const checkedAt = existing?.last_external_check_at || existing?.last_checked_at;
      if (existing && checkedAt) {
        const age = Date.now() - new Date(checkedAt).getTime();
        if (Number.isFinite(age) && age < 24 * 60 * 60 * 1000) {
          const result = {
            phone_number: existing.phone_number || phone,
            country: existing.country || '',
            carrier: existing.carrier || '',
            reputation_score: Number(existing.reputation_score) || 0,
            risk_level: existing.risk_level || 'low',
            user_reports: [],
            scam_categories: existing.scam_categories || [],
            summary: existing.summary || 'Cached Vardin phone reputation result.',
            sources: existing.sources || [],
            report_count: Number(existing.report_count) || 0,
            scam_report_count: Number(existing.scam_report_count) || 0,
            spam_report_count: Number(existing.spam_report_count) || 0,
            suspicious_report_count: Number(existing.suspicious_report_count) || 0,
            safe_report_count: Number(existing.safe_report_count) || 0,
            caller_id_status: existing.caller_id_status || 'UNKNOWN',
            confidence_score: Number(existing.confidence_score) || 0,
            verified_business: Boolean(existing.verified_business),
            business_name: existing.business_name || '',
            caller_id_label: existing.caller_id_label || '',
          };
          return Response.json({ success: true, result, cached: true, lookup: { phone_number: result.phone_number, cached: true } });
        }
      }
    } catch (cacheError) {
      console.error('PhoneReputation cache lookup failed', cacheError);
    }

    const encodedPhone = encodeURIComponent(phone);
    const url = `https://www.ipqualityscore.com/api/json/phone/${encodeURIComponent(apiKey)}/${encodedPhone}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(IPQS_TIMEOUT_MS),
      });
    } catch (error) {
      console.error('IPQS network failure', error);
      return Response.json({ error: 'Unable to reach the phone reputation service.' }, { status: 502 });
    }

    const text = await response.text();
    let ipqs: any;
    try {
      ipqs = JSON.parse(text);
    } catch {
      console.error('IPQS returned non-JSON', response.status);
      return Response.json({ error: 'Phone reputation service returned an invalid response.' }, { status: 502 });
    }

    if (!response.ok || ipqs?.success !== true) {
      // Preserve the provider's useful message instead of hiding it behind a generic 502.
      console.error('IPQS API error', { status: response.status, message: ipqs?.message, request_id: ipqs?.request_id });
      return Response.json({
        error: ipqs?.message || `Phone reputation lookup failed (${response.status}).`,
        provider_request_id: ipqs?.request_id || null,
      }, { status: 502 });
    }

    const result = toResult(ipqs, phone);

    let lookupId: string | null = null;
    try {
      const lookup = await base44.asServiceRole.entities.PhoneLookup.create(result);
      lookupId = lookup?.id || null;
    } catch (saveError) {
      console.error('PhoneLookup save failed', saveError);
    }

    try {
      const existing = await base44.asServiceRole.entities.PhoneReputation.filter({ normalized_number: phone });
      const patch = {
        phone_number: result.phone_number,
        country: result.country,
        carrier: result.carrier,
        reputation_score: result.reputation_score,
        risk_level: result.risk_level,
        caller_id_status: result.caller_id_status,
        confidence_score: result.confidence_score,
        report_count: result.report_count,
        scam_report_count: result.scam_report_count,
        spam_report_count: result.spam_report_count,
        suspicious_report_count: result.suspicious_report_count,
        safe_report_count: result.safe_report_count,
        verified_business: result.verified_business,
        business_name: result.business_name,
        scam_categories: result.scam_categories,
        summary: result.summary,
        sources: result.sources,
        caller_id_label: result.caller_id_label,
        last_checked_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString(),
        last_external_check_at: new Date().toISOString(),
      };
      if (existing?.[0]?.id) {
        await base44.asServiceRole.entities.PhoneReputation.update(existing[0].id, patch);
      } else {
        await base44.asServiceRole.entities.PhoneReputation.create({ normalized_number: phone, ...patch });
      }
    } catch (repError) {
      console.error('PhoneReputation save failed', repError);
    }

    return Response.json({
      success: true,
      result,
      cached: false,
      lookup: { id: lookupId, phone_number: result.phone_number, cached: false },
    });
  } catch (error) {
    console.error('lookupPhoneNumber fatal error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Lookup failed.' }, { status: 500 });
  }
});