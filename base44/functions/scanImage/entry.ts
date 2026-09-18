import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { isPrivateIp } from '../../shared/ssrf.ts';
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from '../../shared/credits.ts';

const CREDIT_COST = 8;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    // Credit check (shared server-side helper)
    const available = getAvailableCredits(user);
    if (available.remaining < CREDIT_COST) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: available.remaining,
        credits_limit: getMonthlyCreditLimit(user),
        credit_cost: CREDIT_COST,
        upgrade_url: '/pricing',
      }, { status: 402 });
    }
    const chargeCredits = async () => {
      const usage = applyCreditUsage(user, CREDIT_COST);
      if (!usage) throw new Error('Credit balance changed during analysis. Please try again.');
      await base44.auth.updateMe(usage);
      return getAvailableCredits({ ...user, ...usage }).remaining;
    };

    const body = await req.json();
    const { image_url, use_case, language } = body;

    if (!image_url) {
      return Response.json({ error: 'Image is required' }, { status: 400 });
    }

    // SSRF guard: block private/internal hosts before handing the URL to the
    // LLM provider. Data URLs (uploaded images) are always allowed.
    if (/^https?:\/\//i.test(image_url)) {
      try {
        const parsed = new URL(image_url);
        if (parsed.username || parsed.password) {
          return Response.json({ error: 'Invalid image URL' }, { status: 400 });
        }
        if (isPrivateIp(parsed.hostname)) {
          return Response.json({ error: 'Image URL must be a public address' }, { status: 400 });
        }
      } catch {
        return Response.json({ error: 'Invalid image URL' }, { status: 400 });
      }
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
NO FABRICATION: Only report red_flags and similar_images_found you can actually verify from the image or web results. Never invent sources, URLs, or scam indicators that are not evident. If the image is a normal personal or business photo with no scam indicators, return risk_level "low", a low risk_score, is_likely_scam_profile false, and EMPTY red_flags. Do not generate generic scam-education content for benign images.
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

    // Deduct credits (shared server-side helper)
    const creditsRemaining = await chargeCredits();

    return Response.json({
      result,
      scan: saved,
      credits_used: CREDIT_COST,
      credits_remaining: creditsRemaining,
      credits_limit: getMonthlyCreditLimit(user),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});