import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    // Premium check
    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium' && plan !== 'plus') {
      return Response.json({ error: 'Premium subscription required', upgrade_url: 'https://vardin.base44.app/pricing' }, { status: 403 });
    }

    const body = await req.json();
    const { phone_number, language } = body;

    if (!phone_number || !phone_number.trim()) {
      return Response.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Basic formatting — keep + and digits only
    const cleaned = phone_number.trim().replace(/[^\d+]/g, '');
    const formatted = cleaned.startsWith('+') ? cleaned : '+' + cleaned;

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const prompt = `You are a phone number reputation analyst. Research the phone number: ${formatted}

Using web search, investigate this phone number on:
- Scam reporting websites (who-called-me sites, scam databases, reverse lookup directories)
- Consumer complaint forums and community reports
- Telecom carrier databases

Provide:
1. Country: Which country is this number registered in?
2. Carrier: The telecom provider (if identifiable from public sources)
3. Reputation score: 0-100 where 0 is definitely safe and 100 is definitely a scam
4. Risk level: low (0-30), medium (31-70), or high (71-100)
5. User reports: Summarized reports from people who received calls from this number
6. Scam categories: Types of scams this number is associated with (e.g., IRS impersonation, tech support, robocalls, telemarketing, romance scam, fake charity)
7. Summary: Overall assessment

If the number has no scam reports, assign a low reputation score and note it appears to be unreported or potentially safe.
Do not invent reports — only report what you can find through web search.

IMPORTANT: Respond entirely in ${languageName}. All text must be in ${languageName}.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          country: { type: 'string', description: 'Country where the number is registered' },
          carrier: { type: 'string', description: 'Telecom carrier/provider if identifiable' },
          reputation_score: { type: 'number', description: '0-100 scam risk score, 100 = definitely a scam' },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          user_reports: { type: 'array', items: { type: 'string' }, description: 'Summarized user reports about this number' },
          scam_categories: { type: 'array', items: { type: 'string' }, description: 'Types of scams associated with this number' },
          summary: { type: 'string', description: 'Overall assessment' },
        },
        required: ['reputation_score', 'risk_level', 'summary'],
      },
    });

    // Save to entity
    const saved = await base44.entities.PhoneLookup.create({
      phone_number: formatted,
      country: result.country || '',
      carrier: result.carrier || '',
      reputation_score: result.reputation_score || 0,
      risk_level: result.risk_level || 'low',
      user_reports: result.user_reports || [],
      scam_categories: result.scam_categories || [],
      summary: result.summary || '',
    });

    return Response.json({ result, lookup: saved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});