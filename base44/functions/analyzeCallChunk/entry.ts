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

This is a CHUNK (segment) of an ongoing conversation.

CRITICAL CONTEXT: The user is the person being protected (the potential victim). They are using this tool to stay safe during calls. The "other party" is whoever they're talking to — could be a scammer OR a legitimate caller.

Your job:
1. Identify WHO is speaking in this chunk — the USER (the protected person) or the OTHER PARTY (the person they're talking to)?
2. If the OTHER PARTY is speaking, analyze for scam indicators.
3. If the USER is speaking, evaluate their response — are they handling it well? Are they accidentally sharing sensitive info?
4. Clearly state when this is NOT a scam (legitimate conversation).

TRANSCRIPT CHUNK:
"${transcript}"
${contextPrompt}
When the OTHER PARTY speaks, analyze for:
- Urgency or pressure tactics ("act now", "don't hang up", "limited time")
- Requests for gift cards, wire transfers, crypto, or unusual payment methods
- Requests for personal info (SSN, bank details, passwords, OTP codes)
- Impersonation (government, bank, tech support, family member in distress)
- Too-good-to-be-true offers (lottery, prizes, investment returns)
- Threats or intimidation (arrest, fines, account closure)
- Requests to install software or grant remote access
- Romance/investment scam patterns
- Requests to stay on the line or not tell anyone

When the USER speaks, evaluate:
- Are they giving out sensitive info they shouldn't? (warning needed)
- Are they pushing back appropriately? (encourage them!)
- Are they asking good verification questions? (encourage them!)
- Are they staying calm and not being pressured? (encourage them!)

Return:
- speaker: "scammer" if the other party is speaking, "victim" if the user is speaking, "unknown" if unclear
- feedback: If the victim is speaking, give them direct, personal feedback — encouragement ("Great job not sharing your info!") or a warning ("Be careful — you just shared your address"). Empty string if the scammer is speaking.
- is_scam: true if scam indicators are present, false if this is clearly a legitimate/normal conversation
- red_flags: Specific concerning phrases or behaviors detected in THIS chunk (empty array if none)
- risk_level: "low" (normal/legitimate conversation OR no concerns), "medium" (some concerning elements), "high" (clear scam indicators)
- warnings: Short, actionable warning messages for the user (e.g., "Caller is pressuring you to act immediately — common scam tactic")
- tactics_detected: Named tactics if any (e.g., "Urgency", "Impersonation", "Payment via Gift Cards")
- analysis: Brief 1-2 sentence assessment. If NOT a scam, explicitly say so ("This appears to be a legitimate call about [topic]. No scam indicators detected.")

Respond entirely in ${languageName}.`;

    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          speaker: { type: 'string', enum: ['scammer', 'victim', 'unknown'] },
          feedback: { type: 'string' },
          is_scam: { type: 'boolean' },
          red_flags: { type: 'array', items: { type: 'string' } },
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          warnings: { type: 'array', items: { type: 'string' } },
          tactics_detected: { type: 'array', items: { type: 'string' } },
          analysis: { type: 'string' },
        },
        required: ['risk_level', 'red_flags', 'warnings', 'speaker', 'is_scam'],
      },
    });

    return Response.json({
      transcript,
      speaker: analysis.speaker || 'unknown',
      feedback: analysis.feedback || '',
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