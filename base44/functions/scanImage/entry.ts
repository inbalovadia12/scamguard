import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const PLAN_LIMITS: Record<string, number> = { starter: 15, plus: 150, premium: 400 };
const CREDIT_COST = 10;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    // Credit check
    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    const currentMonth = new Date().toISOString().slice(0, 7);
    let creditsUsed = user.credits_used || 0;
    if (user.credits_reset_month !== currentMonth) creditsUsed = 0;
    const creditLimit = (PLAN_LIMITS[plan] || PLAN_LIMITS.starter) + (user.referral_bonus_credits || 0);
    const creditsRemaining = Math.max(0, creditLimit - creditsUsed);

    if (creditsRemaining < CREDIT_COST) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: creditsRemaining,
        credits_limit: creditLimit,
        credit_cost: CREDIT_COST,
        upgrade_url: 'https://vardin.base44.app/pricing',
      }, { status: 402 });
    }

    const body = await req.json();
    const { image_url, use_case, language } = body;

    if (!image_url) {
      return Response.json({ error: 'Image is required' }, { status: 400 });
    }

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const USE_CASE_CONTEXT: Record<string, string> = {
      romance: 'The user is checking if this photo belongs to a romance scammer using fake photos on dating apps.',
      marketplace: 'The user is checking if this photo is used by a fake marketplace seller.',
      business: 'The user is checking if this photo belongs to a fake business or professional.',
      general: 'The user is checking if this photo is associated with scams.',
    };

    const prompt = `Analyze this uploaded photo for scam risk. Context: ${USE_CASE_CONTEXT[use_case] || USE_CASE_CONTEXT.general}

RULES:
- Analyze ONLY visible image pixels. Do NOT read file names or URL paths.
- The upload URL/domain (base44.app, googleusercontent, amazonaws, etc.) is private storage — NEVER cite it as a source.
- In "sources", include ONLY real public URLs where this image genuinely appears online. If none found, return empty array.
- Never fabricate URLs, sources, or findings. Only report what you can verify.

STEPS:
1. Describe what you see (real person, stock photo, AI-generated, etc.)
2. Search the web to find if this image appears elsewhere (stock photo sites, social media, scam reports)
3. Check for scam profile patterns (overly attractive people, military uniforms, generic headshots)
4. Identify red flags (stock photo indicators, AI artifacts, multiple unrelated profiles)

risk_score: 0-100 (100 = scam profile). Low 0-35, Medium 36-70, High 71-100.
Only report verifiable findings. Respond in ${languageName}.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      file_urls: [image_url],
      response_json_schema: {
        type: 'object',
        properties: {
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          risk_score: { type: 'number', description: '0-100 scam risk score' },
          is_likely_scam_profile: { type: 'boolean' },
          explanation: { type: 'string' },
          similar_images_found: { type: 'array', items: { type: 'string' } },
          sources: { type: 'array', items: { type: 'string' } },
          red_flags: { type: 'array', items: { type: 'string' } },
          methods_checked: { type: 'array', items: { type: 'string' } },
        },
        required: ['risk_level', 'risk_score', 'explanation'],
      },
    });

    const saved = await base44.entities.ImageScan.create({
      image_url,
      risk_level: result.risk_level || 'low',
      is_likely_scam_profile: result.is_likely_scam_profile || false,
      risk_score: result.risk_score || 0,
      explanation: result.explanation || '',
      similar_images_found: result.similar_images_found || [],
      sources: result.sources || [],
      red_flags: result.red_flags || [],
      use_case: use_case || 'general',
    });

    // Deduct credits
    const newCreditsUsed = creditsUsed + CREDIT_COST;
    await base44.auth.updateMe({ credits_used: newCreditsUsed, credits_reset_month: currentMonth });

    return Response.json({
      result,
      scan: saved,
      credits_used: CREDIT_COST,
      credits_remaining: Math.max(0, creditLimit - newCreditsUsed),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});