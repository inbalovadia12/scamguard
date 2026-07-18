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

    // Clean to digits only
    const cleaned = phone_number.trim().replace(/[^\d]/g, '');

    // Format for PhoneRegistry.org: 10 digits, NOT starting with 1
    // US/NANP numbers: strip leading country code 1, take 10 digits
    let tenDigit: string;
    if (cleaned.length === 10) {
      tenDigit = cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      tenDigit = cleaned.slice(1);
    } else if (cleaned.length > 10) {
      tenDigit = cleaned.slice(-10);
    } else {
      tenDigit = cleaned;
    }

    // Validate NANP format: 10 digits, not starting with 0 or 1
    const isValidNANP = tenDigit.length === 10 && !tenDigit.startsWith('0') && !tenDigit.startsWith('1');

    // Display format: XXX-XXX-XXXX
    const displayFormat = isValidNANP
      ? `${tenDigit.slice(0, 3)}-${tenDigit.slice(3, 6)}-${tenDigit.slice(6)}`
      : phone_number.trim();

    // International format for broader search
    const intlFormat = isValidNANP ? `+1${tenDigit}` : `+${cleaned}`;

    // PhoneRegistry.org direct lookup URL
    const phoneregistryUrl = `https://www.phoneregistry.org/?phone=${tenDigit}`;

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const prompt = `You are a phone number reputation analyst. Research the phone number: ${displayFormat} (international: ${intlFormat})

CRITICAL RULES — VIOLATING THESE INVALIDATES YOUR RESPONSE:

1. You must ONLY report information that is SPECIFICALLY and DIRECTLY about THIS EXACT phone number in the context of scam calls, robocalls, spam, or caller reputation.

2. You must ONLY include a source URL if that page's PRIMARY TOPIC is this phone number being discussed as a scam/spam caller. Do NOT include:
   - URLs where the number appears as part of a Reddit comment ID (e.g., /comments/1dd2k3e/...)
   - URLs where the number appears coincidentally in a post, comment, or unrelated discussion
   - URLs where the number is part of another longer number
   - Social media posts unrelated to scam calls from this number
   - Any source you did not actually verify discusses THIS number

3. If you cannot find any legitimate, specific reports about this exact number, you MUST:
   - Set reputation_score to a LOW value (5-15)
   - Set risk_level to "low"
   - Return EMPTY arrays for user_reports, scam_categories, and sources
   - State in summary: "No scam reports found for this number. It appears to be unreported."

SOURCES TO CHECK (search these specifically):
1. PhoneRegistry.org — ${phoneregistryUrl} — check for carrier and reputation data
2. 800notes.com — search for "${displayFormat}" or "${tenDigit}"
3. WhoCallsMe — whocallsme.com
4. CallerComplaints — callercomplaints.com
5. FTC — reportfraud.ftc.gov, donotcall.gov
6. Nomorobo — nomorobo.com phone lookup
7. Truecaller — truecaller.com search for this number
8. Reddit — ONLY r/scams, r/phonescams, r/ScamNumbers — search for the EXACT number "${displayFormat}" — the post TITLE or BODY must mention this number

AREA CODE ANALYSIS:
- Area code ${tenDigit.slice(0, 3)} — determine the geographic region and carrier type
- Use this for the country and carrier fields even if no scam reports exist

RETURN:
- country: Where the number is registered (from area code analysis)
- carrier: Telecom provider if known
- reputation_score: 0-100 (0=safe/unreported, 100=confirmed scam). If no reports: use 5-15.
- risk_level: "low" (0-30), "medium" (31-70), "high" (71-100)
- user_reports: ONLY verified reports from real users who received calls from this number. Empty array if none.
- scam_categories: Scam types if any found. Empty array if none.
- summary: Honest assessment. If unreported, say so clearly.
- sources: ONLY URLs specifically about this phone number. Empty array if none found.

Respond entirely in ${languageName}.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_1_pro',
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
          sources: { type: 'array', items: { type: 'string' }, description: 'URLs where information was found — only pages specifically about this phone number' },
        },
        required: ['reputation_score', 'risk_level', 'summary'],
      },
    });

    const saved = await base44.entities.PhoneLookup.create({
      phone_number: displayFormat,
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