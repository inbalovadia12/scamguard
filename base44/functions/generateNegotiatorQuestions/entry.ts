import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const PLAN_LIMITS: Record<string, number> = { starter: 15, plus: 150, premium: 400 };
const CREDIT_COST = 3;

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
    const creditLimit = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
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
    const { situation, language, image_url } = body;

    if (!situation || !situation.trim()) {
      return Response.json({ error: 'Situation description is required' }, { status: 400 });
    }

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    const prompt = `You are a scam detection expert. A user suspects a scammer. Generate 5 questions that will expose them.

Situation: ${situation.slice(0, 2000)}
${image_url ? '\nAn image is attached (screenshot of a listing, chat, or profile). Analyze it for additional scam indicators and tailor your questions to what you see.' : ''}

Generate 5 strategic questions that:
1. Are tailored to this specific situation
2. Would be difficult for a scammer to answer convincingly
3. Test for inconsistencies in the scammer's story
4. Probe areas where scammers slip up (identity verification, payment methods, urgency, specificity)
5. Are phrased naturally — the user can ask them without sounding accusatory

For each question provide: the question, why it works, a red flag answer (scam), and a green flag answer (legitimate).

Respond entirely in ${languageName}.`;

    const llmOptions: any = {
      prompt,
      model: image_url ? 'gemini_3_flash' : 'gpt_5_mini',
      response_json_schema: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string', description: 'The question to ask' },
                why_it_works: { type: 'string', description: 'Why this question exposes a scammer' },
                red_flag_answer: { type: 'string', description: 'Answer that indicates a scam' },
                green_flag_answer: { type: 'string', description: 'Answer that indicates legitimacy' },
              },
              required: ['question', 'why_it_works', 'red_flag_answer'],
            },
          },
        },
        required: ['questions'],
      },
    };
    if (image_url) llmOptions.file_urls = [image_url];

    const result = await base44.integrations.Core.InvokeLLM(llmOptions);

    // Deduct credits
    const newCreditsUsed = creditsUsed + CREDIT_COST;
    await base44.auth.updateMe({ credits_used: newCreditsUsed, credits_reset_month: currentMonth });

    return Response.json({
      questions: result.questions || [],
      credits_used: CREDIT_COST,
      credits_remaining: Math.max(0, creditLimit - newCreditsUsed),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});