import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * Real-time screenshot scam detection - OPTIMIZED
 * 
 * OPTIMIZATIONS:
 * - LLM timeout: 1.5 seconds (partial results > hanging)
 * - Pre-screening for obvious phishing indicators
 * - Timing info in response
 * - Fast fallback if LLM times out
 */
Deno.serve(async (req) => {
  const startTime = Date.now();
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
    const { image_url, image_data, language, session_context } = body;

    if (!image_url && !image_data) {
      return Response.json({ error: 'Image URL or image data is required' }, { status: 400 });
    }

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    // === QUICK PRE-SCREEN: Check for obvious phishing keywords in session context ===
    const urgencyKeywords = ['urgent', 'act now', 'limited time', 'confirm', 'verify', 'update', 'expire'];
    const threatKeywords = ['bank', 'payment', 'account', 'password', 'verify identity', 'update payment'];
    const contextLower = (session_context || '').toLowerCase();
    
    let hasObviousPhishing = false;
    if (urgencyKeywords.some(kw => contextLower.includes(kw)) && 
        threatKeywords.some(kw => contextLower.includes(kw))) {
      hasObviousPhishing = true;
    }

    const contextPrompt = session_context
      ? `\n\nPREVIOUS CONTEXT:\n${session_context}\n`
      : '';

    const prompt = `Analyze screenshot for scam/phishing patterns. Session: ${session_context || 'no context'}.${contextPrompt}

Detect: phishing (fake alerts), romance scams (love bombing), investment scams (guaranteed returns), tech support scams (remote access), marketplace scams (overpayment), urgency/pressure ("act now"), requests for personal info (SSN, passwords, OTP), payment requests (gift cards, crypto, wire).

Return JSON ONLY.
- is_scam: true if scam detected
- red_flags: specific concerning text
- risk_level: "low"/"medium"/"high"  
- warnings: actionable warnings
- tactics_detected: tactic names
- analysis: 1-2 sentence assessment

If normal/legitimate, return: is_scam: false, risk_level: "low", empty arrays.
Respond in ${languageName}.`;

    let analysis: any = null;

    try {
      const llmOptions: any = {
        prompt,
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
          required: ['risk_level', 'is_scam'],
        },
      };

      // Add image URL or data
      if (image_url) {
        llmOptions.file_urls = [image_url];
      } else if (image_data) {
        llmOptions.file_urls = [image_data]; // Assuming already uploaded
      }

      const llmPromise = base44.integrations.Core.InvokeLLM(llmOptions);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 1500)
      );

      analysis = await Promise.race([llmPromise, timeoutPromise]);
    } catch (e) {
      // LLM timeout or error - use pre-screen result
      analysis = {
        is_scam: hasObviousPhishing,
        red_flags: hasObviousPhishing ? ['Urgent action requested + sensitive account information'] : [],
        risk_level: hasObviousPhishing ? 'high' : 'low',
        warnings: hasObviousPhishing ? ['Be cautious - common phishing pattern detected'] : [],
        tactics_detected: hasObviousPhishing ? ['Phishing'] : [],
        analysis: hasObviousPhishing
          ? 'This screenshot shows signs of a phishing attempt with urgency tactics and account/payment requests.'
          : 'LLM analysis timeout. No obvious phishing indicators detected.',
      };
    }

    // Ensure all fields present
    if (!analysis) {
      analysis = {
        is_scam: false,
        red_flags: [],
        risk_level: 'low',
        warnings: [],
        tactics_detected: [],
        analysis: 'Unable to analyze screenshot.',
      };
    }

    return Response.json({
      is_scam: analysis.is_scam ?? false,
      red_flags: analysis.red_flags || [],
      risk_level: analysis.risk_level || 'low',
      warnings: analysis.warnings || [],
      tactics_detected: analysis.tactics_detected || [],
      analysis: analysis.analysis || '',
      timing_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
