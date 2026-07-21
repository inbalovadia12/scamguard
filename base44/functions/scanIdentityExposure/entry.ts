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

    if (!full_name || !full_name.trim()) return Response.json({ error: 'Full name is required' }, { status: 400 });

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';
    const name = full_name.trim().slice(0, 100);

    const hasImage = !!image_url;

    const prompt = `You are an expert identity exposure analyst. ${hasImage ? 'A user has uploaded a photo of their own face and provided their name.' : 'A user has provided their name.'} Your job is to find WEBSITES AND DATABASES THAT ALREADY STORE AND PUBLISH this person's personal information to the public — so they can request removal.

IMPORTANT: Respond entirely in ${languageName}.

User's name: ${name}
${age ? `Age: ${age}` : ''}
${emails && emails.length > 0 ? `Email addresses: ${emails.join(', ')}` : ''}

=== WHAT TO RETURN (data_brokers array) ===
List WEBSITES THAT ALREADY HAVE THIS PERSON'S DATA STORED AND PUBLICLY SEARCHABLE. These are:
- Data brokers: companies that collect, package, and SELL consumer data (e.g., Spokeo, Whitepages, BeenVerified, Intelius, TruthFinder, Instant Checkmate, Radaris, MyLife, US Search, PeopleSmart, FamilyTreeNow, PeopleFinder, BeenVerified, CheckPeople, SpyDialer, That's Them, FastPeopleSearch, TruePeopleSearch, Addresses.com, 411.com, YellowPages, ZoomInfo, Apollo.io)
- People search engines: sites where anyone can type a name and see personal details
- Public records aggregators: sites that publish court records, property records, marriage/divorce records, criminal records

For EACH site provide:
   - name: The site's brand name (e.g., "Spokeo")
   - info_exposed: What personal information this site typically stores and displays about people (full name, age, current/past addresses, phone numbers, email, relatives, court records, property records, etc.)
   - website_url: The DIRECT LINK to the specific search results page or profile page for THIS PERSON on that site — NOT the homepage. For example:
     * Spokeo: https://www.spokeo.com/John-Smith (name in URL path)
     * Whitepages: https://www.whitepages.com/name/John-Smith
     * BeenVerified: https://www.beenverified.com/people/John-Smith
     * Intelius: https://www.intelius.com/people-search/John-Smith/
     * Radaris: https://radaris.com/p/John/Smith/
     * FastPeopleSearch: https://www.fastpeoplesearch.com/John-Smith
     * TruePeopleSearch: https://www.truepeoplesearch.com/results?name=John%20Smith
     * MyLife: https://www.mylife.com/John-Smith/
     Use the site's actual URL pattern for name searches. If you are not confident of the exact URL pattern, provide the site's people-search page URL (e.g., https://www.spokeo.com/people-search) rather than the homepage.

=== DO NOT INCLUDE (these are WRONG answers) ===
- Identity theft protection or monitoring services (LifeLock, IdentityForce, etc.)
- Privacy tools or VPNs
- Apps that help YOU search for people (that is the opposite of what we want)
- Generic search engines (Google, Bing)
- Social media apps (Facebook, LinkedIn, Instagram) — those go in public_profiles instead
- Credit bureaus (Experian, Equifax) unless their public-facing people search product exposes data
- Any site whose PURPOSE is to protect identity rather than publish it

The data_brokers array must ONLY contain sites whose business model is collecting and publishing/selling ordinary people's personal data so that anyone can look it up.

${emails && emails.length > 0 ? `Also search for the email address(es) on data breach databases and people search sites.` : ''}

=== OTHER SECTIONS ===
PERSONAL INFO FOUND: List what types of personal information are publicly available about this person online (addresses, phone numbers, email, relatives, employment, education, court records, etc.)

PUBLIC PROFILES: List any public social media profiles or professional profiles found (LinkedIn, Facebook, Instagram, Twitter/X, etc.)

RECOMMENDED ACTIONS: Give specific, actionable steps to reduce identity exposure (which opt-outs to prioritize, privacy settings to change, accounts to lock down, etc.)

SOURCES: List the actual URLs you checked or found during your search.

CRITICAL RULES:
- Every entry in data_brokers must be a REAL site that STORES and PUBLISHES people's personal data.
- Each website_url must be a DIRECT link to this person's search/profile page on that site — never the bare homepage.
- Use the real URL pattern each site uses for name searches. If unsure of the exact pattern, use the site's people-search page URL instead of the homepage.
- Do not invent sites or URLs.
- Aim for 10-15 real data broker sites.`;

    let result;
    try {
      result = await base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: 'gemini_3_1_pro',
        ...(image_url ? { file_urls: [image_url] } : {}),
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
                website_url: { type: 'string', description: 'Direct link to the search results or profile page for this person on this site, NOT the homepage' },
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