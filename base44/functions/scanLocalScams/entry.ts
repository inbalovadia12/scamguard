import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  const startTime = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json();
    const { location_name, latitude, longitude, language, skip_cache } = body;

    if (!location_name || !location_name.trim()) {
      return Response.json({ error: 'Location is required' }, { status: 400 });
    }

    const normalizedLocation = location_name.trim().toLowerCase();
    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    // === CHECK CACHE (7-day freshness) ===
    let cached = null;
    if (!skip_cache) {
      try {
        const results = await base44.entities.LocalScamScan.query({
          filters: {
            location_name_normalized: normalizedLocation,
            created_at: { '$gte': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 7 days
          },
          limit: 1,
        });
        if (results && results.length > 0) {
          cached = results[0];
        }
      } catch (e) {
        // Cache lookup failed, continue without cache
      }
    }

    // === RETURN CACHED RESULT (INSTANT) ===
    if (cached) {
      return Response.json({
        analysis: {
          risk_level: cached.risk_level,
          country: cached.country,
          summary: cached.summary,
          common_scams: cached.scam_details ? JSON.parse(cached.scam_details) : [],
          seasonal_patterns: cached.seasonal_patterns || [],
          local_resources: cached.local_resources || [],
          current_trends: cached.current_trends,
          sources: cached.sources || [],
        },
        scan: cached,
        cached: true,
        timing_ms: Date.now() - startTime,
      });
    }

    // === FRESH LOOKUP (LLM WITH WEB SEARCH) ===
    const prompt = `Research scams targeting: ${location_name}

Find: common scams (including locally-specific), seasonal peak months, local reporting resources (real agency names/phones/URLs), current trends, and cultural factors.

Prioritize high-signal results — do not search exhaustively. Do not invent resources. Include source URLs.

Respond in ${languageName}.`;

    let result;
    try {
      const llmPromise = base44.integrations.Core.InvokeLLM({
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
            sources: { type: 'array', items: { type: 'string' } },
          },
          required: ['risk_level', 'summary', 'common_scams', 'seasonal_patterns'],
        },
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000)
      );

      result = await Promise.race([llmPromise, timeoutPromise]);
    } catch (e) {
      // LLM timeout or error - return generic result
      result = {
        risk_level: 'medium',
        country: '',
        summary: 'Unable to analyze location. Check with local law enforcement.',
        common_scams: [],
        seasonal_patterns: [],
        local_resources: ['Contact local police department', 'FTC scam report: reportfraud.ftc.gov'],
        current_trends: 'Unknown',
        sources: [],
      };
    }

    // === SAVE TO CACHE ===
    try {
      await base44.entities.LocalScamScan.create({
        location_name: location_name.trim(),
        location_name_normalized: normalizedLocation,
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
    } catch (e) {
      // Cache save failed, but still return result
    }

    return Response.json({
      analysis: result,
      scan: {
        location_name: location_name.trim(),
        country: result.country,
        risk_level: result.risk_level,
      },
      cached: false,
      timing_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
