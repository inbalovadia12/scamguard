import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { secrets } from 'base44:runtime';
import { upsertPhoneReputation } from '../../shared/phoneReputation.ts';

const IPQS_TIMEOUT_MS = 10_000;

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

function deriveReputation(fraudScore: number): number {
  const score = Math.round(100 - Math.max(0, Math.min(100, Number(fraudScore) || 0)));
  return Math.max(0, Math.min(100, score));
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
    const ipqsKey = secrets.get('IPQS_API_KEY');
    if (!ipqsKey) return Response.json({ error: 'Phone intelligence service is not configured' }, { status: 500 });

    try {
      const cached = await base44.asServiceRole.entities.PhoneReputation.filter({ normalized_number: normalized });
      const cachedRecord = cached[0];
      const staleMs = 30 * 24 * 60 * 60 * 1000;
      if (cachedRecord?.last_external_check_at && Date.now() - new Date(cachedRecord.last_external_check_at).getTime() < staleMs) {
        return Response.json({
          cached: true,
          result: {
            country: cachedRecord.country || '',
            carrier: cachedRecord.carrier || '',
            reputation_score: cachedRecord.reputation_score ?? 0,
            risk_level: cachedRecord.risk_level || 'low',
            user_reports: [],
            scam_categories: cachedRecord.scam_categories || [],
            summary: cachedRecord.summary || 'No additional report data is available.',
            sources: cachedRecord.sources || [],
            report_count: cachedRecord.report_count || 0,
            scam_report_count: cachedRecord.report_counts?.scam || 0,
            spam_report_count: cachedRecord.report_counts?.spam || 0,
            suspicious_report_count: cachedRecord.report_counts?.suspicious || 0,
            safe_report_count: cachedRecord.report_counts?.safe || 0,
            caller_id_status: cachedRecord.caller_id_status || 'UNKNOWN',
            confidence_score: cachedRecord.confidence_score || 0,
            verified_business: cachedRecord.verified_business || false,
            business_name: cachedRecord.business_name || '',
            caller_id_label: cachedRecord.caller_id_label || '',
            last_checked_at: cachedRecord.last_external_check_at || '',
            line_type: cachedRecord.line_type || '',
            voip: cachedRecord.voip ?? null,
            prepaid: cachedRecord.prepaid ?? null,
            active: cachedRecord.active ?? null,
            recent_abuse: cachedRecord.recent_abuse ?? null,
            risky: cachedRecord.risky ?? null,
            spammer: cachedRecord.spammer ?? null,
            fraud_score: cachedRecord.fraud_score ?? null,
          },
          lookup: { id: cachedRecord.id, phone_number: cachedRecord.phone_number, cached: true },
        });
      }
    } catch {}

    const encodedPhone = encodeURIComponent(normalized);
    const url = `https://www.ipqualityscore.com/api/json/phone/${encodeURIComponent(ipqsKey)}/${encodedPhone}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(IPQS_TIMEOUT_MS),
    });

    const ipqs = await response.json().catch(() => null);
    if (!response.ok || !ipqs || ipqs.success !== true) {
      const message = ipqs?.message || `Phone validation failed (${response.status})`;
      return Response.json({ error: message }, { status: 502 });
    }

    const fraudScore = Math.max(0, Math.min(100, Number(ipqs.fraud_score) || 0));
    const reputationScore = deriveReputation(fraudScore);
    const riskLevel = deriveRisk(fraudScore, ipqs.risky ?? null, ipqs.recent_abuse ?? null, ipqs.spammer ?? null);
    const summary = buildSummary(ipqs);
    const displayNumber = ipqs.formatted || normalized;
    const reportCounts = { scam: 0, spam: 0, suspicious: 0, safe: 0 };

    const result = {
      country: ipqs.country || '',
      carrier: ipqs.carrier || '',
      reputation_score: reputationScore,
      risk_level: riskLevel,
      user_reports: [],
      scam_categories: [],
      summary,
      sources: [],
      report_count: 0,
      scam_report_count: 0,
      spam_report_count: 0,
      suspicious_report_count: 0,
      safe_report_count: 0,
      caller_id_status: ipqs.valid === true ? 'VALIDATED' : 'INVALID',
      confidence_score: ipqs.success === true ? 85 : 0,
      verified_business: Boolean(ipqs.name && ipqs.name !== 'N/A' && ipqs.name !== 'IPQualityScore'),
      business_name: ipqs.name && ipqs.name !== 'N/A' && ipqs.name !== 'IPQualityScore' ? ipqs.name : '',
      caller_id_label: '',
      last_checked_at: new Date().toISOString(),
      line_type: ipqs.line_type || '',
      voip: ipqs.VOIP ?? null,
      prepaid: ipqs.prepaid ?? null,
      active: ipqs.active ?? null,
      recent_abuse: ipqs.recent_abuse ?? null,
      risky: ipqs.risky ?? null,
      spammer: ipqs.spammer ?? null,
      fraud_score: fraudScore,
    };

    try {
      const rep = await upsertPhoneReputation(base44, {
        normalized_number: normalized,
        phone_number: displayNumber,
        country: result.country,
        carrier: result.carrier,
        reputation_score: result.reputation_score,
        risk_level: result.risk_level,
        scam_categories: result.scam_categories,
        summary: result.summary,
        sources: result.sources,
        last_external_check_at: result.last_checked_at,
        verified_business: result.verified_business,
        business_name: result.business_name,
        report_counts: reportCounts,
        line_type: result.line_type,
        voip: result.voip,
        prepaid: result.prepaid,
        active: result.active,
        recent_abuse: result.recent_abuse,
        risky: result.risky,
        spammer: result.spammer,
        fraud_score: result.fraud_score,
      });

      result.caller_id_status = rep?.caller_id_status || result.caller_id_status;
      result.confidence_score = rep?.confidence_score || result.confidence_score;
      result.caller_id_label = rep?.caller_id_label || result.caller_id_label;
    } catch (persistError) {
      console.error('Phone reputation persistence failed', persistError);
    }

    const lookup = await base44.entities.PhoneLookup.create({
      phone_number: displayNumber,
      country: result.country,
      carrier: result.carrier,
      reputation_score: result.reputation_score,
      risk_level: result.risk_level,
      user_reports: result.user_reports,
      scam_categories: result.scam_categories,
      summary: result.summary,
      sources: result.sources,
      report_count: result.report_count,
      scam_report_count: result.scam_report_count,
      spam_report_count: result.spam_report_count,
      suspicious_report_count: result.suspicious_report_count,
      safe_report_count: result.safe_report_count,
      caller_id_status: result.caller_id_status,
      confidence_score: result.confidence_score,
      verified_business: result.verified_business,
      business_name: result.business_name,
      caller_id_label: result.caller_id_label,
    });

    return Response.json({ result, lookup: { id: lookup.id, phone_number: displayNumber, cached: false }, cached: false });
  } catch (error) {
    console.error('lookupPhoneNumber error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Lookup failed' }, { status: 500 });
  }
});
