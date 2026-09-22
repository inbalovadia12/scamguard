import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from '../../shared/credits.ts';

const CREDIT_COST = 5;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch {}
    const location = String(body.location || '').trim();
    const latitude = body.latitude != null ? Number(body.latitude) : null;
    const longitude = body.longitude != null ? Number(body.longitude) : null;
    const language = String(body.language || 'en');

    if (!location && (latitude == null || longitude == null)) {
      return Response.json({ error: 'Please provide a location or allow location access.' }, { status: 400 });
    }

    // Credit check (server-authoritative).
    const avail = getAvailableCredits(user);
    if (avail.remaining < CREDIT_COST) {
      return Response.json({
        error: 'Not enough credits for this scan.',
        credits_remaining: avail.remaining,
        credits_limit: getMonthlyCreditLimit(user),
      }, { status: 402 });
    }
    const charge = applyCreditUsage(user, CREDIT_COST);
    if (!charge) {
      return Response.json({ error: 'Not enough credits for this scan.' }, { status: 402 });
    }
    await base44.auth.updateMe({
      credits_used: charge.credits_used,
      admin_credit_balance: charge.admin_credit_balance,
      credits_reset_month: charge.credits_reset_month,
    });

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const where = location
      ? location
      : `coordinates ${latitude}, ${longitude} (identify the nearest city/region and research it)`;

    const prompt = `You are Vardin's local scam intelligence analyst. Research the scam landscape for: ${where}.

Using web search, find accurate, current information about:
1. Common scams targeting residents or visitors of this specific area (name each scam and describe how it works).
2. Seasonal patterns — when certain scams peak here (season or months).
3. Local authorities, official hotlines, and government/police websites where people in this region can report scams.
4. Current trending scams in this area.

Rules:
- Report only what you find from real sources. Do not invent data.
- Be specific to this location (city/region/country). If hyper-local data is scarce, provide the best country/region-level information and still name the location.
- risk_level: "low" (few reports), "medium" (notable scam activity), "high" (active scam hot zone).
- summary (max 300 chars): a plain-English overview of scam risk in this area.
- scam_details: array of { name, description, peak_season, peak_months } for the most common local scams.
- local_resources: official URLs/phone numbers/hotlines for reporting scams locally.
- sources: full URLs of the websites where you found this information. Always include source URLs.

Respond in ${languageName}.`;

    const RESPONSE_SCHEMA = {
      type: 'object' as const,
      properties: {
        location_name: { type: 'string' },
        country: { type: 'string' },
        risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
        summary: { type: 'string' },
        scam_details: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              peak_season: { type: 'string' },
              peak_months: { type: 'string' },
            },
            required: ['name', 'description'],
          },
        },
        seasonal_patterns: { type: 'array', items: { type: 'string' } },
        local_resources: { type: 'array', items: { type: 'string' } },
        current_trends: { type: 'string' },
        sources: { type: 'array', items: { type: 'string' } },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
      },
      required: ['location_name', 'risk_level', 'summary'],
    };

    let llmResponse: any = null;
    try {
      llmResponse = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: RESPONSE_SCHEMA,
      });
    } catch (llmError) {
      console.error('Local scam LLM failed', llmError);
      return Response.json({ error: 'Local scam analysis service temporarily unavailable. Please try again.' }, { status: 502 });
    }

    let result: any = {};
    if (llmResponse && typeof llmResponse === 'object' && !Array.isArray(llmResponse)) {
      result = llmResponse;
    } else {
      try {
        result = JSON.parse(typeof llmResponse === 'string' ? llmResponse : JSON.stringify(llmResponse || {}));
      } catch { result = {}; }
    }

    const locationName = String(result.location_name || location || '').trim();
    const riskLevel = (['low', 'medium', 'high'].includes(result.risk_level) ? result.risk_level : 'low');
    const lat = Number.isFinite(Number(result.latitude)) ? Number(result.latitude) : (latitude ?? 0);
    const lng = Number.isFinite(Number(result.longitude)) ? Number(result.longitude) : (longitude ?? 0);

    // Save to the user's LocalScamScan history.
    let saved: any = null;
    try {
      saved = await base44.entities.LocalScamScan.create({
        location_name: locationName,
        country: String(result.country || ''),
        latitude: lat,
        longitude: lng,
        risk_level: riskLevel,
        summary: String(result.summary || ''),
        scam_details: JSON.stringify(Array.isArray(result.scam_details) ? result.scam_details : []),
        seasonal_patterns: Array.isArray(result.seasonal_patterns) ? result.seasonal_patterns : [],
        local_resources: Array.isArray(result.local_resources) ? result.local_resources : [],
        current_trends: String(result.current_trends || ''),
        sources: Array.isArray(result.sources) ? result.sources : [],
      });
    } catch (e) {
      console.error('Failed to save LocalScamScan', e);
    }

    const availAfter = getAvailableCredits({ ...user, ...charge });

    return Response.json({
      result: {
        location_name: locationName,
        country: String(result.country || ''),
        latitude: lat,
        longitude: lng,
        risk_level: riskLevel,
        summary: String(result.summary || ''),
        scam_details: Array.isArray(result.scam_details) ? result.scam_details : [],
        seasonal_patterns: Array.isArray(result.seasonal_patterns) ? result.seasonal_patterns : [],
        local_resources: Array.isArray(result.local_resources) ? result.local_resources : [],
        current_trends: String(result.current_trends || ''),
        sources: Array.isArray(result.sources) ? result.sources : [],
      },
      scan_id: saved?.id || null,
      credits_used: CREDIT_COST,
      credits_remaining: availAfter.remaining,
      credits_limit: getMonthlyCreditLimit(user),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Local scam scan failed.' }, { status: 500 });
  }
}