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

    const prompt = `Research scams targeting: ${location_name}

Find: common scams (including locally-specific), seasonal peak months, local reporting resources (real agency names/phones/URLs), current trends, and cultural factors (holidays, tax seasons, events).

Prioritize high-signal results — do not search exhaustively. Do not invent resources. Include source URLs.

Respond in ${languageName}.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          country: { type: 'string' },
          summary: { type: 'string' },
          common_scams: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                peak_season: { type: 'string' },
                peak_months: { type: 'array', items: { type: 'number' } },
              },
            },
          },
          seasonal_patterns: { type: 'array', items: { type: 'string' } },
          local_resources: { type: 'array', items: { type: 'string' } },
          current_trends: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' }, description: 'URLs of sources used' },
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
      sources: result.sources || [],
    });

    return Response.json({ analysis: result, scan: saved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});