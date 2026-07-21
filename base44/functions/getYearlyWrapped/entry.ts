import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const [analyses, imageScans, phoneLookups, identityScans, localScans] = await Promise.all([
      base44.entities.ScamAnalysis.filter({ created_by_id: user.id }, '-created_date', 500),
      base44.entities.ImageScan.filter({ created_by_id: user.id }, '-created_date', 500),
      base44.entities.PhoneLookup.filter({ created_by_id: user.id }, '-created_date', 500),
      base44.entities.IdentityExposureScan.filter({ created_by_id: user.id }, '-created_date', 500),
      base44.entities.LocalScamScan.filter({ created_by_id: user.id }, '-created_date', 500),
    ]);

    const totalScans = analyses.length + imageScans.length + phoneLookups.length + identityScans.length + localScans.length;

    let highRisk = 0, mediumRisk = 0, lowRisk = 0;
    const scamTypes = {};

    analyses.forEach((a) => {
      if (a.risk_level === 'high') highRisk++;
      else if (a.risk_level === 'medium') mediumRisk++;
      else if (a.risk_level === 'low') lowRisk++;
      if (a.message_type) {
        scamTypes[a.message_type] = (scamTypes[a.message_type] || 0) + 1;
      }
    });

    imageScans.forEach((s) => {
      if (s.risk_level === 'high') highRisk++;
      else if (s.risk_level === 'medium') mediumRisk++;
      else if (s.risk_level === 'low') lowRisk++;
    });

    phoneLookups.forEach((p) => {
      if (p.risk_level === 'high') highRisk++;
      else if (p.risk_level === 'medium') mediumRisk++;
      else if (p.risk_level === 'low') lowRisk++;
    });

    const topScamTypeEntry = Object.entries(scamTypes).sort((a, b) => b[1] - a[1])[0];
    const topScamType = topScamTypeEntry ? topScamTypeEntry[0] : null;

    const allDates = [...analyses, ...imageScans, ...phoneLookups, ...identityScans, ...localScans]
      .map((r) => r.created_date)
      .filter(Boolean)
      .sort();
    const firstScanDate = allDates[0] || null;
    const uniqueDays = new Set(allDates.map((d) => String(d).slice(0, 10)));
    const daysActive = uniqueDays.size;

    const scansByType = {
      message: analyses.length,
      image: imageScans.length,
      phone: phoneLookups.length,
      identity: identityScans.length,
      local: localScans.length,
    };

    const userName = user.full_name || (user.email ? user.email.split('@')[0] : 'Friend');
    const creditsUsed = user.credits_used || 0;

    return Response.json({
      total_scans: totalScans,
      scams_blocked: highRisk,
      risk_breakdown: { high: highRisk, medium: mediumRisk, low: lowRisk },
      scam_types: scamTypes,
      top_scam_type: topScamType,
      top_scam_type_count: topScamTypeEntry ? topScamTypeEntry[1] : 0,
      credits_used: creditsUsed,
      first_scan_date: firstScanDate,
      days_active: daysActive,
      scans_by_type: scansByType,
      user_name: userName,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});