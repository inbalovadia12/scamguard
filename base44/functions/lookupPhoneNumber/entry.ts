import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { upsertPhoneReputation } from '../../shared/phoneReputation.ts';

// Phone-number reputation lookup backed by IPQualityScore's Phone Number
// Validation API + Reddit r/ScamNumbers community reports.
// Combines IPQS automated fraud scoring with crowdsourced community data.

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

    const cleaned = phoneInput.replace(/[^\d]/g, '');
    if (cleaned.length < 7) return Response.json({ error: 'Please enter a valid phone number.' }, { status: 400 });

    let tenDigit: string;
    if (cleaned.length === 10) tenDigit = cleaned;
    else if (cleaned.length === 11 && cleaned.startsWith('1')) tenDigit = cleaned.slice(1);
    else if (cleaned.length > 10) tenDigit = cleaned.slice(-10);
    else tenDigit = cleaned;

    const isValidNANP = tenDigit.length === 10 && !tenDigit.startsWith('0') && !tenDigit.startsWith('1');
    const displayFormat = isValidNANP
      ? `${tenDigit.slice(0, 3)}-${tenDigit.slice(3, 6)}-${tenDigit.slice(6)}`
      : phoneInput;
    const cacheKey = isValidNANP ? `+1${tenDigit}` : `+${cleaned}`;

    // ---- Fast path: return the canonical reputation index if this number is already known and fresh ----
    try {
      const cached = await base44.asServiceRole.entities.PhoneReputation.filter({ normalized_number: cacheKey });
      const STALE_MS = 1000 * 60 * 60 * 24 * 30;
      const r = cached[0];
      if (r && r.last_external_check_at && (Date.now() - new Date(r.last_external_check_at).getTime() < STALE_MS)) {
        const result = {
          country: r.country || '',
          carrier: r.carrier || '',
          reputation_score: r.reputation_score ?? 0,
          risk_level: r.risk_level || 'low',
          user_reports: [],
          scam_categories: r.scam_categories || [],
          summary: r.summary || '',
          sources: r.sources || [],
          report_count: r.report_count || 0,
          scam_report_count: r.scam_report_count || 0,
          spam_report_count: r.spam_report_count || 0,
          suspicious_report_count: r.suspicious_report_count || 0,
          safe_report_count: r.safe_report_count || 0,
          caller_id_status: r.caller_id_status || 'UNKNOWN',
          confidence_score: r.confidence_score || 0,
          verified_business: r.verified_business || false,
          business_name: r.business_name || '',
          caller_id_label: r.caller_id_label || '',
          last_checked_at: r.last_checked_at || r.last_updated_at || '',
        };
        return Response.json({
          result,
          lookup: { id: r.id, phone_number: r.phone_number, cached: true, status: 'complete' },
          cached: true,
        });
      }
    } catch {}

    // ---- Live IPQS lookup ----
    const ipqsKey = Deno.env.get('IPQS_API_KEY');
    if (!ipqsKey) {
      return Response.json({ error: 'Phone lookup is not configured. Missing IPQS_API_KEY.' }, { status: 500 });
    }

    const ipqsUrl = `https://www.ipqualityscore.com/api/json/phone/${encodeURIComponent(ipqsKey)}/${encodeURIComponent(cleaned)}?country[]=US&country[]=CA&country[]=IL`;

    let ipqs: any = null;
    try {
      const resp = await fetch(ipqsUrl, { signal: AbortSignal.timeout(8000) });
      ipqs = await resp.json();
    } catch (fetchError) {
      console.error('IPQS request failed', fetchError);
      return Response.json({ error: 'The phone lookup service is temporarily unavailable. Please try again.' }, { status: 502 });
    }

    if (!ipqs || ipqs.success === false) {
      const msg = ipqs?.message || 'Phone lookup failed.';
      return Response.json({ error: msg }, { status: 502 });
    }

    if (ipqs.valid === false) {
      const notInService = {
        country: ipqs.country || '',
        carrier: '',
        reputation_score: 0,
        risk_level: 'low',
        user_reports: [],
        scam_categories: [],
        summary: 'This does not appear to be a valid, in-service phone number.',
        sources: [],
        report_count: 0, scam_report_count: 0, spam_report_count: 0, suspicious_report_count: 0, safe_report_count: 0,
        caller_id_status: 'UNKNOWN',
        confidence_score: 0,
        verified_business: false,
        business_name: '',
        caller_id_label: '',
        last_checked_at: new Date().toISOString(),
      };
      return Response.json({ result: notInService, lookup: { phone_number: displayFormat, cached: false, status: 'complete' }, cached: false });
    }

    const fraudScore = Math.max(0, Math.min(100, Number(ipqs.fraud_score) || 0));
    const recentAbuse = !!ipqs.recent_abuse;
    const isSpammer = !!ipqs.spammer;
    const isDoNotCall = !!ipqs.do_not_call;
    const isVoip = !!ipqs.VOIP;
    const isLeaked = !!ipqs.leaked;

    // ---- Pull Reddit community reports for this number ----
    let redditMatches: any[] = [];
    try {
      redditMatches = await base44.asServiceRole.entities.RedditScamNumber.filter({ normalized_number: cacheKey });
    } catch (redditError) {
      console.error('Reddit index lookup failed', redditError);
    }

    const redditReportCount = redditMatches.length;
    const redditCategories = [...new Set(redditMatches.map((item: any) => item.scam_category).filter(Boolean))];
    const redditSources = redditMatches.map((item: any) => item.post_url).filter(Boolean);

    // Risk level and score: community/Reddit evidence takes priority over IPQS
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let effectiveScore = fraudScore;
    
    if (redditReportCount > 0 || recentAbuse) {
      riskLevel = 'high';
      effectiveScore = Math.max(effectiveScore, 75); // Boost score for confirmed scam reports
    } else if (fraudScore >= 71) {
      riskLevel = 'high';
    } else if (fraudScore >= 41 || isSpammer || isDoNotCall || isLeaked) {
      riskLevel = 'medium';
    }

    // Combine categories from both sources
    const scamCategories: string[] = [];
    if (recentAbuse) scamCategories.push('Recent Abuse Reports');
    if (isSpammer) scamCategories.push('Known Spammer');
    if (isDoNotCall) scamCategories.push('Do Not Call List');
    if (isVoip) scamCategories.push('VOIP Number');
    if (isLeaked) scamCategories.push('Leaked/Breached Number');
    scamCategories.push(...redditCategories);

    // Build summary incorporating both IPQS and Reddit data (once, not repeated)
    const summaryParts: string[] = [];
    summaryParts.push(`IPQS fraud score: ${fraudScore}/100.`);
    if (redditReportCount > 0) {
      summaryParts.push(`Community evidence: ${redditReportCount} report${redditReportCount === 1 ? '' : 's'} from r/ScamNumbers.`);
    }
    if (ipqs.line_type) summaryParts.push(`Line type: ${ipqs.line_type}.`);
    if (ipqs.active === false) summaryParts.push('This line appears inactive/disconnected.');
    if (recentAbuse) summaryParts.push('Recent abuse has been reported for this number.');
    if (isSpammer) summaryParts.push('This number is flagged as a known spammer.');
    if (isDoNotCall) summaryParts.push('This number is on the Do Not Call list.');
    if (scamCategories.length === 0 && effectiveScore < 41 && redditReportCount === 0) summaryParts.push('No significant fraud signals found.');

    const businessName = ipqs.name && ipqs.name !== 'N/A' ? ipqs.name : '';

    // Combine sources from IPQS and Reddit
    const allSources = [...redditSources];

    const fullResult = {
      country: ipqs.country || '',
      carrier: ipqs.carrier || '',
      reputation_score: effectiveScore,
      risk_level: riskLevel,
      user_reports: [] as string[],
      scam_categories: scamCategories,
      summary: summaryParts.join(' '),
      sources: allSources,
      report_count: redditReportCount,
      scam_report_count: redditReportCount,
      spam_report_count: 0,
      suspicious_report_count: 0,
      safe_report_count: 0,
      caller_id_status: 'UNKNOWN',
      confidence_score: 0,
      verified_business: false,
      business_name: businessName,
      caller_id_label: '',
      last_checked_at: new Date().toISOString(),
    };

    // Persist to the canonical reputation index
    const rep = await upsertPhoneReputation(base44, {
      normalized_number: cacheKey,
      phone_number: displayFormat,
      country: fullResult.country,
      carrier: fullResult.carrier,
      reputation_score: fullResult.reputation_score,
      risk_level: fullResult.risk_level,
      scam_categories: fullResult.scam_categories,
      summary: fullResult.summary,
      sources: fullResult.sources,
      last_external_check_at: new Date().toISOString(),
      verified_business: fullResult.verified_business,
      business_name: fullResult.business_name,
    });

    fullResult.caller_id_status = rep?.caller_id_status || 'UNKNOWN';
    fullResult.confidence_score = rep?.confidence_score || 0;
    fullResult.caller_id_label = rep?.caller_id_label || '';

    let lookup: any = null;
    try {
      lookup = await base44.entities.PhoneLookup.create({
        phone_number: displayFormat,
        status: 'complete',
        country: fullResult.country,
        carrier: fullResult.carrier,
        reputation_score: fullResult.reputation_score,
        risk_level: fullResult.risk_level,
        user_reports: fullResult.user_reports,
        scam_categories: fullResult.scam_categories,
        summary: fullResult.summary,
        sources: fullResult.sources,
        report_count: fullResult.report_count,
        scam_report_count: fullResult.scam_report_count,
        spam_report_count: fullResult.spam_report_count,
        suspicious_report_count: fullResult.suspicious_report_count,
        safe_report_count: fullResult.safe_report_count,
        caller_id_status: fullResult.caller_id_status,
        confidence_score: fullResult.confidence_score,
        verified_business: fullResult.verified_business,
        business_name: fullResult.business_name,
        caller_id_label: fullResult.caller_id_label,
      });
    } catch (saveError) {
      console.error('PhoneLookup save failed', saveError);
    }

    return Response.json({
      result: fullResult,
      lookup: lookup ? { id: lookup.id, phone_number: displayFormat, cached: false, status: 'complete' } : { phone_number: displayFormat, cached: false, status: 'complete' },
      cached: false,
    });
  } catch (error) {
    console.error('lookupPhoneNumber error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Lookup failed' }, { status: 500 });
  }
});
