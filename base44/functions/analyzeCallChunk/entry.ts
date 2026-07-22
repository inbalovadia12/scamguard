import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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
    const { audio_url, language, session_context } = body;

    if (!audio_url) {
      return Response.json({ error: 'Audio URL is required' }, { status: 400 });
    }

    const transcriptionResult = await base44.integrations.Core.TranscribeAudio({
      audio_url: audio_url,
    });

    const transcript: string = typeof transcriptionResult === 'string' ? transcriptionResult : '';

    if (!transcript.trim()) {
      return Response.json({
        transcript: '',
        red_flags: [],
        risk_level: 'low',
        warnings: [],
        tactics_detected: [],
        analysis: '',
      });
    }

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const contextPrompt = session_context
      ? `\n\nPREVIOUS CONTEXT from earlier in this call:\n${session_context}\n`
      : '';

    const prompt = `You are a real-time scam detection agent analyzing a live phone call or meeting transcript.

This is a CHUNK (segment) of an ongoing conversation. Analyze it for scam, fraud, or social engineering patterns.

TRANSCRIPT CHUNK:
"${transcript}"
${contextPrompt}
Analyze for these scam indicators:
- Urgency or pressure tactics ("act now", "don't hang up", "limited time")
- Requests for gift cards, wire transfers, crypto, or unusual payment methods
- Requests for personal info (SSN, bank details, passwords, OTP codes)
- Impersonation (government, bank, tech support, family member in distress)
- Too-good-to-be-true offers (lottery, prizes, investment returns)
- Threats or intimidation (arrest, fines, account closure)
- Requests to install software or grant remote access
- Romance/investment scam patterns
- Requests to stay on the line or not tell anyone

Return:
- red_flags: Specific concerning phrases or behaviors detected in THIS chunk (empty array if none)
- risk_level: "low" (normal conversation), "medium" (some concerning elements), "high" (clear scam indicators)
- warnings: Short, actionable warning messages for the user (e.g., "Caller is pressuring you to act immediately — common scam tactic")
- tactics_detected: Named tactics if any (e.g., "Urgency", "Impersonation", "Payment via Gift Cards")
- analysis: Brief 1-2 sentence assessment

Respond entirely in ${languageName}.`;

    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          red_flags: { type: 'array', items: { type: 'string' } },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          warnings: { type: 'array', items: { type: 'string' } },
          tactics_detected: { type: 'array', items: { type: 'string' } },
          analysis: { type: 'string' },
        },
        required: ['risk_level', 'red_flags', 'warnings'],
      },
    });

    return Response.json({
      transcript,
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