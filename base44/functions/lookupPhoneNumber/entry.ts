import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

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
    const { phone_number, language } = body;

    if (!phone_number || !phone_number.trim()) {
      return Response.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const cleaned = phone_number.trim().replace(/[^\d+]/g, '');
    const formatted = cleaned.startsWith('+') ? cleaned : '+' + cleaned;

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const prompt = `You are a phone number reputation analyst. Research: ${formatted}

Search these sources thoroughly:
1. Reddit — search site:reddit.com for this number (subreddits: r/scams, r/personalfinance, r/phonescams, r/ScamNumbers)
2. Caller complaint sites — 800notes.com, whocallsme.com, callercomplaints.com, whocalled.us, nomorobo.com
3. PhoneRegistry.org — phoneregistry.org for carrier and reputation data
4. FTC and government scam databases (reportfraud.ftc.gov, donotcall.gov)
5. Social blogs and community forums discussing scam calls
6. General "who called me" + the number searches

Return:
- country: Where the number is registered
- carrier: Telecom provider (if known)
- reputation_score: 0-100 (0=safe, 100=definitely scam)
- risk_level: low(0-30), medium(31-70), high(71-100)
- user_reports: Summarized reports from real users who received calls
- scam_categories: Scam types associated with this number (e.g. "IRS impersonation", "tech support", "robocall")
- summary: Overall assessment
- sources: URLs where you found information about this number

Only report verifiable findings. If no reports exist, score low and note it's unreported.
Do not invent reports or sources.

Respond entirely in ${languageName}.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          country: { type: 'string' },
          carrier: { type: 'string' },
          reputation_score: { type: 'number', description: '0-100 scam risk score' },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          user_reports: { type: 'array', items: { type: 'string' } },
          scam_categories: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
          sources: { type: 'array', items: { type: 'string' }, description: 'URLs where information was found' },
        },
        required: ['reputation_score', 'risk_level', 'summary'],
      },
    });

    const saved = await base44.entities.PhoneLookup.create({
      phone_number: formatted,
      country: result.country || '',
      carrier: result.carrier || '',
      reputation_score: result.reputation_score || 0,
      risk_level: result.risk_level || 'low',
      user_reports: result.user_reports || [],
      scam_categories: result.scam_categories || [],
      summary: result.summary || '',
      sources: result.sources || [],
    });

    return Response.json({ result, lookup: saved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});