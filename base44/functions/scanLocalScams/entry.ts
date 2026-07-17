import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json();
    const { location_name, latitude, longitude, language } = body;

    if (!location_name || !location_name.trim()) {
      return Response.json({ error: 'Location is required' }, { status: 400 });
    }

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const prompt = `You are a scam intelligence analyst. Research common scams targeting people in: ${location_name}

Using web search, find:
1. The most common scams in this specific location (city, country, region). Include locally-specific scams unique to this area.
2. Seasonal patterns — which months do certain scams peak? For each scam, specify which months (1-12) it's most active.
3. Local scam reporting resources — government agencies, consumer protection hotlines, cybercrime units, official websites specific to this country/region. Include real phone numbers and URLs where possible.
4. Current trending scams — what's actively circulating right now in this area?
5. Cultural or regional factors — local holidays, tax seasons, festivals, events that attract scammers.

IMPORTANT: Respond entirely in ${languageName}. All text must be in ${languageName}.

Be specific and actionable. Include real agency names, phone numbers, and websites where possible. Do not invent resources — if you're unsure about a specific hotline, omit it.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          country: { type: 'string', description: 'Country name' },
          summary: { type: 'string', description: 'Overall assessment of scam activity in this area' },
          common_scams: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Scam name' },
                description: { type: 'string', description: 'How the scam works and who it targets' },
                peak_season: { type: 'string', description: 'When this scam is most active (e.g. Tax season Jan-Apr)' },
                peak_months: { type: 'array', items: { type: 'number' }, description: 'Months 1-12 when this scam peaks' },
              },
            },
          },
          seasonal_patterns: { type: 'array', items: { type: 'string' }, description: 'Time-of-year patterns for scams' },
          local_resources: { type: 'array', items: { type: 'string' }, description: 'Local authorities, hotlines, and websites for reporting scams' },
          current_trends: { type: 'string', description: 'Current trending scams in this area' },
        },
        required: ['risk_level', 'summary', 'common_scams', 'seasonal_patterns'],
      },
    });

    const saved = await base44.entities.LocalScamScan.create({
      location_name: location_name.trim(),
      latitude: latitude || null,
      longitude: longitude || null,
      country: result.country || '',
      risk_level: result.risk_level,
      summary: result.summary,
      scam_details: JSON.stringify(result.common_scams || []),
      seasonal_patterns: result.seasonal_patterns || [],
      local_resources: result.local_resources || [],
      current_trends: result.current_trends || '',
    });

    return Response.json({ analysis: result, scan: saved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});