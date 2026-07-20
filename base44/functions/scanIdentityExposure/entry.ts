import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

const PLAN_LIMITS: Record<string, number> = { starter: 15, plus: 150, premium: 400 };
const CREDIT_COST = 35;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    // Premium verification
    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium' && plan !== 'plus') {
      return Response.json({ error: 'Premium subscription required', upgrade_url: 'https://vardin.base44.app/pricing' }, { status: 403 });
    }

    // Credit check
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
    const { image_url, full_name, age, emails, language } = body;

    if (!image_url) return Response.json({ error: 'Face photo is required' }, { status: 400 });
    if (!full_name || !full_name.trim()) return Response.json({ error: 'Full name is required' }, { status: 400 });

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';
    const name = full_name.trim().slice(0, 100);

    const prompt = `You are an expert identity exposure analyst and privacy investigator. A user has uploaded a photo of their own face and provided their name. Search the internet thoroughly and report on their identity exposure.

IMPORTANT: Respond entirely in ${languageName}.

User's name: ${name}
${age ? `Age: ${age}` : ''}
${emails && emails.length > 0 ? `Email addresses: ${emails.join(', ')}` : ''}

Using the uploaded face photo AND web search:

1. FACE ANALYSIS: Look at the uploaded face photo. Use it to help identify the person. Search for this person by name online.

2. DATA BROKERS & PEOPLE SEARCH SITES: Search for "${name}" on the internet. For every major data broker and people search site where this person's information is exposed (or would be exposed based on your search), list it. For EACH site provide:
   - name: The site's name (e.g., "Spokeo", "Whitepages", "BeenVerified", "Intelius", "TruthFinder", "Instant Checkmate", "Radaris", "MyLife", "US Search", "PeopleSmart", "FamilyTreeNow")
   - info_exposed: What personal information is exposed (full name, age, addresses, phone numbers, email, relatives, court records, property records, etc.)
   - website_url: The main homepage URL of the site (e.g., 'https://www.spokeo.com', 'https://www.whitepages.com'). Must be a real URL you know exists.

3. PERSONAL INFO FOUND: List what types of personal information are publicly available about this person online (addresses, phone numbers, email, relatives, employment, education, court records, etc.)

4. PUBLIC PROFILES: List any public social media profiles, professional profiles, or public records found (LinkedIn, Facebook, Instagram, Twitter/X, public registries, etc.)

5. RECOMMENDED ACTIONS: Give specific, actionable steps to reduce identity exposure (which opt-outs to prioritize, privacy settings to change, accounts to lock down, etc.)

CRITICAL RULES:
- Only include REAL data broker sites with their ACTUAL main website URLs.
- Do not invent sites or URLs. Each website_url must be a real, clickable URL starting with https:// that you know exists.
- If you are not confident a site exists or you know its URL, do NOT include it.
- Be thorough — check at least 10-15 major data broker sites.`;

    let result;
    try {
      result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: 'gemini_3_1_pro',
        file_urls: [image_url],
        response_json_schema: {
        type: 'object',
        properties: {
          exposure_level: { type: 'string', enum: ['low', 'medium', 'high'], description: 'How exposed the user identity is' },
          exposure_score: { type: 'number', description: '0-100 identity exposure score (100 = fully exposed)' },
          summary: { type: 'string', description: 'Overall assessment of identity exposure' },
          data_brokers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Data broker or people search site name' },
                info_exposed: { type: 'string', description: 'What personal info is exposed on this site' },
                website_url: { type: 'string', description: 'Main homepage URL of the site' },
              },
            },
            description: 'Data brokers and people search sites exposing the user personal info',
          },
          personal_info_found: { type: 'array', items: { type: 'string' }, description: 'Types of personal info found online' },
          public_profiles: { type: 'array', items: { type: 'string' }, description: 'Public profiles found' },
          recommended_actions: { type: 'array', items: { type: 'string' }, description: 'Steps to reduce exposure' },
          sources: { type: 'array', items: { type: 'string' }, description: 'Source URLs checked' },
        },
        required: ['exposure_level', 'exposure_score', 'summary', 'data_brokers'],
      },
    });
    } catch (llmError) {
      console.error('LLM invocation failed:', llmError?.message || llmError);
      return Response.json({ error: 'AI analysis service is temporarily unavailable. Please try again in a moment.' }, { status: 503 });
    }

    if (!result || typeof result !== 'object') {
      return Response.json({ error: 'AI analysis returned an unexpected response. Please try again.' }, { status: 502 });
    }
    const saved = await base44.entities.IdentityExposureScan.create({
      full_name: name,
      face_image_url: image_url,
      age: age || null,
      emails: emails || [],
      exposure_level: result.exposure_level || 'low',
      exposure_score: result.exposure_score || 0,
      summary: result.summary || '',
      data_brokers_json: JSON.stringify(result.data_brokers || []),
      personal_info_found: result.personal_info_found || [],
      public_profiles: result.public_profiles || [],
      recommended_actions: result.recommended_actions || [],
      sources: result.sources || [],
    });

    // Deduct credits
    const newCreditsUsed = creditsUsed + CREDIT_COST;
    await base44.auth.updateMe({ credits_used: newCreditsUsed, credits_reset_month: currentMonth });

    return Response.json({
      result,
      scan: saved,
      credits_used: CREDIT_COST,
      credits_remaining: Math.max(0, creditLimit - newCreditsUsed),
      credits_limit: creditLimit,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});