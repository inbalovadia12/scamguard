import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium') {
      return Response.json({ error: 'Premium subscription required', upgrade_url: 'https://vardin.base44.app/pricing' }, { status: 403 });
    }

    const body = await req.json();
    const { image_url, language, session_context } = body;

    if (!image_url) {
      return Response.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const contextPrompt = session_context
      ? `\n\nPREVIOUS CONTEXT from earlier screenshots:\n${session_context}\n`
      : '';

    const prompt = `You are a real-time scam detection agent analyzing a screenshot of the user's screen.

This is a SCREEN CAPTURE from an ongoing session. The user may be viewing SMS, WhatsApp, email, social media, websites, or any app. Analyze the visible text and content for scam, fraud, or social engineering patterns.
${contextPrompt}
Analyze for these scam indicators:
- Phishing messages (fake bank alerts, delivery notices, government messages)
- Romance scam patterns (love bombing, requests for money/gift cards)
- Investment/crypto scam messages (guaranteed returns, "act now")
- Tech support scams (fake virus alerts, requests for remote access)
- Marketplace scams (overpayment, fake escrow, shipping tricks)
- Social media scams (fake profiles, giveaway scams, impersonation)
- Urgency or pressure tactics ("act now", "limited time", "don't tell anyone")
- Requests for personal info (SSN, bank details, passwords, OTP codes)
- Requests for payment via gift cards, wire transfer, crypto
- Fake job offers or lottery/prize notifications

Return:
- is_scam: true if scam indicators are present, false if this is clearly legitimate/normal content
- red_flags: Specific concerning text or elements detected in THIS screenshot (empty array if none)
- risk_level: "low" (normal content), "medium" (some concerning elements), "high" (clear scam indicators)
- warnings: Short, actionable warning messages for the user
- tactics_detected: Named tactics if any (e.g., "Phishing", "Urgency", "Impersonation")
- analysis: Brief 1-2 sentence assessment. If NOT a scam, explicitly say so ("This appears to be a normal [app/message]. No scam indicators detected.")

If the screen shows normal, non-suspicious content, return risk_level: "low", is_scam: false, with empty arrays.
Respond entirely in ${languageName}.`;

    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [image_url],
      response_json_schema: {
        type: 'object',
        properties: {
          is_scam: { type: 'boolean' },
          red_flags: { type: 'array', items: { type: 'string' } },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          warnings: { type: 'array', items: { type: 'string' } },
          tactics_detected: { type: 'array', items: { type: 'string' } },
          analysis: { type: 'string' },
        },
        required: ['risk_level', 'red_flags', 'warnings', 'is_scam'],
      },
    });

    return Response.json({
      is_scam: analysis.is_scam ?? false,
      red_flags: analysis.red_flags || [],
      risk_level: analysis.risk_level || 'low',
      warnings: analysis.warnings || [],
      tactics_detected: analysis.tactics_detected || [],
      analysis: analysis.analysis || '',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});