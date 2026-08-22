import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function normalizePhone(raw: unknown): { key: string; display: string } | null {
  const input = String(raw ?? '').trim();
  const digits = input.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;

  if (digits.length === 10) {
    return {
      key: `+1${digits}`,
      display: `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`,
    };
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    const ten = digits.slice(1);
    return {
      key: `+${digits}`,
      display: `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`,
    };
  }

  return { key: `+${digits}`, display: input };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    let plan = String(user.subscription_plan || 'starter').toLowerCase();
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium' && plan !== 'plus') {
      return Response.json({
        error: 'Premium subscription required',
        upgrade_url: 'https://vardin.base44.app/pricing',
      }, { status: 403 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const phone = normalizePhone(body?.phone_number);
    if (!phone) return Response.json({ error: 'Please enter a valid phone number.' }, { status: 400 });

    let canonical: any = null;
    let redditMatches: any[] = [];
    let communityMatches: any[] = [];

    try {
      const rows = await base44.asServiceRole.entities.PhoneReputation.filter({
        normalized_number: phone.key,
      });
      canonical = rows?.[0] || null;
    } catch (error) {
      console.error('PhoneReputation lookup failed', error);
    }

    try {
      redditMatches = await base44.asServiceRole.entities.RedditScamNumber.filter({
        normalized_number: phone.key,
      });
    } catch (error) {
      console.error('Reddit index lookup failed', error);
    }

    try {
      communityMatches = await base44.asServiceRole.entities.PhoneCommunityReport.filter({
        normalized_number: phone.key,
        status: 'active',
      });
    } catch (error) {
      console.error('Vardin Community lookup failed', error);
    }

    const redditCategories = [...new Set(
      redditMatches.map((item: any) => String(item?.scam_category || '').trim()).filter(Boolean),
    )];
    const communityCategories = [...new Set(
      communityMatches.map((item: any) => String(item?.scam_category || '').trim()).filter(Boolean),
    )];

    const redditSources = [...new Set(
      redditMatches.map((item: any) => String(item?.post_url || '').trim()).filter(Boolean),
    )];

    const redditSummaries = redditMatches
      .map((item: any) => String(item?.summary || '').trim())
      .filter(Boolean)
      .slice(0, 3);

    const communitySummaries = communityMatches
      .map((item: any) => String(item?.summary || '').trim())
      .filter(Boolean)
      .slice(0, 3);

    const communityScam = communityMatches.filter((item: any) => item?.report_type === 'scam').length;
    const communitySpam = communityMatches.filter((item: any) => item?.report_type === 'spam').length;
    const communitySuspicious = communityMatches.filter((item: any) => item?.report_type === 'suspicious').length;
    const communitySafe = communityMatches.filter((item: any) => item?.report_type === 'safe').length;

    const confirmedScam = redditMatches.length > 0 || communityScam > 0;
    const baseScore = Number(canonical?.reputation_score);
    const score = confirmedScam ? 100 : (Number.isFinite(baseScore) ? Math.max(0, Math.min(100, baseScore)) : 0);

    const summaryParts: string[] = [];
    if (confirmedScam) summaryParts.push('Likely scam based on community evidence.');
    if (communityMatches.length > 0) summaryParts.push(`Vardin Community: ${communityMatches.length} report${communityMatches.length === 1 ? '' : 's'}.`);
    if (redditMatches.length > 0) summaryParts.push(`Reddit r/ScamNumbers: ${redditMatches.length} indexed report${redditMatches.length === 1 ? '' : 's'}.`);
    if (communitySummaries[0]) summaryParts.push(communitySummaries[0]);
    if (redditSummaries[0]) summaryParts.push(redditSummaries[0]);
    if (summaryParts.length === 0) summaryParts.push('No community scam reports are currently indexed for this number.');

    const result = {
      phone_number: phone.display,
      country: canonical?.country || '',
      carrier: canonical?.carrier || '',
      reputation_score: score,
      risk_level: confirmedScam ? 'high' : (canonical?.risk_level || 'low'),
      user_reports: [...communitySummaries, ...redditSummaries],
      scam_categories: [...new Set([
        ...(Array.isArray(canonical?.scam_categories) ? canonical.scam_categories : []),
        ...communityCategories,
        ...redditCategories,
      ])],
      summary: summaryParts.join(' '),
      sources: [...new Set([
        ...(Array.isArray(canonical?.sources) ? canonical.sources : []),
        ...redditSources,
        'Vardin Community',
      ])],
      report_count: Number(canonical?.report_count || 0) + communityMatches.length + redditMatches.length,
      scam_report_count: Number(canonical?.scam_report_count || 0) + communityScam + redditMatches.length,
      spam_report_count: Number(canonical?.spam_report_count || 0) + communitySpam,
      suspicious_report_count: Number(canonical?.suspicious_report_count || 0) + communitySuspicious,
      safe_report_count: Number(canonical?.safe_report_count || 0) + communitySafe,
      caller_id_status: confirmedScam ? 'SCAM' : (canonical?.caller_id_status || 'UNKNOWN'),
      confidence_score: confirmedScam ? 100 : Number(canonical?.confidence_score || 0),
      verified_business: !!canonical?.verified_business,
      business_name: canonical?.business_name || '',
      caller_id_label: confirmedScam ? 'Vardin: Scam Likely' : (canonical?.caller_id_label || ''),
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
    };

    return Response.json({
      result,
      lookup: { phone_number: phone.display, cached: !!canonical, status: 'complete' },
      cached: !!canonical,
    });
  } catch (error) {
    console.error('lookupPhoneNumber error', error);
    return Response.json({
      error: error instanceof Error ? error.message : 'Lookup failed',
    }, { status: 500 });
  }
});