import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { upsertPhoneReputation } from '../../shared/phoneReputation.ts';

// Fast phone reputation lookup.
// Sources: Vardin's canonical PhoneReputation index + locally indexed
// r/ScamNumbers reports. No paid external phone-validation API is required.

function normalizePhone(raw: string): { key: string; display: string } | null {
  const input = String(raw || '').trim();
  const digits = input.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;

  let key: string;
  let display = input;
  if (digits.length === 10) {
    key = `+1${digits}`;
    display = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    key = `+${digits}`;
    const ten = digits.slice(1);
    display = `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`;
  } else {
    key = `+${digits}`;
  }

  return { key, display };
}

function riskFromReports(count: number, score = 0): 'low' | 'medium' | 'high' {
  if (count > 0 || score >= 71) return 'high';
  if (score >= 41) return 'medium';
  return 'low';
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
      return Response.json({
        error: 'Premium subscription required',
        upgrade_url: 'https://vardin.base44.app/pricing',
      }, { status: 403 });
    }

    const body = await req.json();
    const normalized = normalizePhone(body?.phone_number);
    if (!normalized) {
      return Response.json({ error: 'Please enter a valid phone number.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // 1. Canonical Vardin reputation index.
    let canonical: any = null;
    try {
      const rows = await base44.asServiceRole.entities.PhoneReputation.filter({
        normalized_number: normalized.key,
      });
      canonical = rows?.[0] || null;
    } catch (error) {
      console.error('PhoneReputation lookup failed', error);
    }

    // 2. Local r/ScamNumbers index. This is local and does not contact Reddit.
    let redditMatches: any[] = [];
    try {
      redditMatches = await base44.asServiceRole.entities.RedditScamNumber.filter({
        normalized_number: normalized.key,
      });
    } catch (error) {
      console.error('Reddit index lookup failed', error);
    }

    let communityMatches: any[] = [];
    try {
      communityMatches = await base44.asServiceRole.entities.PhoneCommunityReport.filter({
        normalized_number: normalized.key,
        status: 'active',
      });
    } catch (error) {
      console.error('Vardin community phone-report lookup failed', error);
    }

    const redditCategories = [...new Set(
      redditMatches.map((item: any) => String(item?.scam_category || '').trim()).filter(Boolean),
    )];
    const redditSources = [...new Set(
      redditMatches.map((item: any) => String(item?.post_url || '').trim()).filter(Boolean),
    )];
    const redditSummaries = redditMatches
      .map((item: any) => String(item?.summary || '').trim())
      .filter(Boolean)
      .slice(0, 5);
    const communitySummaries = communityMatches
      .map((item: any) => String(item?.summary || '').trim())
      .filter(Boolean)
      .slice(0, 5);
    const communityScam = communityMatches.filter((item: any) => item.report_type === 'scam').length;
    const communitySpam = communityMatches.filter((item: any) => item.report_type === 'spam').length;
    const communitySuspicious = communityMatches.filter((item: any) => item.report_type === 'suspicious').length;
    const communitySafe = communityMatches.filter((item: any) => item.report_type === 'safe').length;

    const reportCount = redditMatches.length + communityMatches.length + Number(canonical?.report_count || 0);
    const scamReportCount = redditMatches.length + communityScam + Number(canonical?.scam_report_count || 0);
    const baseScore = Number(canonical?.reputation_score || 0);
    const score = Math.max(0, Math.min(100, redditMatches.length > 0 ? Math.max(baseScore, 85) : baseScore));
    const riskLevel = riskFromReports(redditMatches.length + communityScam, score);

    const scamCategories = [...new Set([
      ...(Array.isArray(canonical?.scam_categories) ? canonical.scam_categories : []),
      ...redditCategories,
      ...communityMatches.map((item: any) => String(item?.scam_category || '').trim()).filter(Boolean),
    ])];

    let summary = String(canonical?.summary || '').trim();
    if (redditMatches.length > 0) {
      const redditEvidence = `Reddit evidence: ${redditMatches.length} report${redditMatches.length === 1 ? '' : 's'} from r/ScamNumbers.`;
      summary = summary ? `${summary} ${redditEvidence}` : redditEvidence;
      if (redditSummaries.length > 0) summary += ` ${redditSummaries[0]}`;
    }
    if (communityMatches.length > 0) {
      const vardinEvidence = `Vardin Community evidence: ${communityMatches.length} report${communityMatches.length === 1 ? '' : 's'}.`;
      summary = summary ? `${summary} ${vardinEvidence}` : vardinEvidence;
      if (communitySummaries.length > 0) summary += ` ${communitySummaries[0]}`;
    }
    if (!summary) {
      summary = redditMatches.length > 0
        ? 'This number has community scam reports indexed by Vardin from r/ScamNumbers.'
        : 'No Vardin community scam reports are currently indexed for this number.';
    }

    const sources = [...new Set([
      ...(Array.isArray(canonical?.sources) ? canonical.sources : []),
      ...redditSources,
    ])];

    const result = {
      country: canonical?.country || '',
      carrier: canonical?.carrier || '',
      reputation_score: score,
      risk_level: riskLevel,
      user_reports: redditSummaries,
      scam_categories: scamCategories,
      summary,
      sources,
      report_count: reportCount,
      scam_report_count: scamReportCount,
      spam_report_count: Number(canonical?.spam_report_count || 0) + communitySpam,
      suspicious_report_count: Number(canonical?.suspicious_report_count || 0) + communitySuspicious,
      safe_report_count: Number(canonical?.safe_report_count || 0) + communitySafe,
      caller_id_status: canonical?.caller_id_status || (redditMatches.length > 0 ? 'SCAM' : 'UNKNOWN'),
      confidence_score: Math.max(
        Number(canonical?.confidence_score || 0),
        redditMatches.length > 0 ? Math.min(95, 60 + redditMatches.length * 10) : 0,
      ),
      verified_business: !!canonical?.verified_business,
      business_name: canonical?.business_name || '',
      caller_id_label: canonical?.caller_id_label || (redditMatches.length > 0 ? 'Vardin: Scam Likely' : ''),
      last_checked_at: canonical?.last_checked_at || now,
    };

    // Keep the canonical index aligned with Reddit evidence.
    try {
      await upsertPhoneReputation(base44, {
        normalized_number: normalized.key,
        phone_number: normalized.display,
        reputation_score: result.reputation_score,
        risk_level: result.risk_level,
        report_count: result.report_count,
        scam_report_count: result.scam_report_count,
        scam_categories: result.scam_categories,
        summary: result.summary,
        sources: result.sources,
        caller_id_status: result.caller_id_status,
        confidence_score: result.confidence_score,
        caller_id_label: result.caller_id_label,
        last_checked_at: now,
        last_external_check_at: now,
      });
    } catch (error) {
      console.error('PhoneReputation upsert failed', error);
    }

    // Save the user's lookup without making this persistence step fatal.
    let lookup: any = null;
    try {
      lookup = await base44.entities.PhoneLookup.create({
        phone_number: normalized.display,
        status: 'complete',
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
    } catch (error) {
      console.error('PhoneLookup save failed', error);
    }

    return Response.json({
      result,
      lookup: lookup
        ? { id: lookup.id, phone_number: normalized.display, cached: !!canonical, status: 'complete' }
        : { phone_number: normalized.display, cached: !!canonical, status: 'complete' },
      cached: !!canonical,
      community: {
        matched: communityMatches.length > 0,
        report_count: communityMatches.length,
        scam_reports: communityScam,
        spam_reports: communitySpam,
        suspicious_reports: communitySuspicious,
        safe_reports: communitySafe,
      },
      reddit: {
        matched: redditMatches.length > 0,
        report_count: redditMatches.length,
        sources: redditSources,
      },
    });
  } catch (error) {
    console.error('lookupPhoneNumber error', error);
    return Response.json({
      error: error instanceof Error ? error.message : 'Lookup failed',
    }, { status: 500 });
  }
});