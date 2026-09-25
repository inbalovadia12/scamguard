import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const LANGUAGE = 'English';

const COUNTRY_CODES: Record<string, string> = {
  'united states': '1', 'usa': '1', 'us': '1', 'canada': '1',
  'united kingdom': '44', 'uk': '44', 'great britain': '44',
  'australia': '61', 'new zealand': '64', 'ireland': '353', 'france': '33',
  'germany': '49', 'spain': '34', 'italy': '39', 'netherlands': '31',
  'belgium': '32', 'switzerland': '41', 'austria': '43', 'sweden': '46',
  'norway': '47', 'denmark': '45', 'finland': '358', 'poland': '48',
  'portugal': '351', 'israel': '972', 'south africa': '27', 'india': '91',
  'japan': '81', 'south korea': '82', 'china': '86', 'singapore': '65',
  'malaysia': '60', 'philippines': '63', 'thailand': '66', 'mexico': '52',
  'brazil': '55', 'argentina': '54', 'colombia': '57', 'turkey': '90',
  'uae': '971', 'united arab emirates': '971',
};

function normalizePhone(raw: string, countryHint = ''): string | null {
  const text = String(raw || '').trim();
  const digits = text.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;

  // Explicit international formats are authoritative.
  if (text.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('00') && digits.length > 8) return `+${digits.slice(2)}`;

  const hint = String(countryHint || '').toLowerCase().trim();
  const code = COUNTRY_CODES[hint] || Object.entries(COUNTRY_CODES).find(([name]) => hint.includes(name))?.[1];
  if (code) {
    let national = digits;
    if (code !== '1' && national.startsWith('0')) national = national.slice(1);
    if (code === '1' && national.length === 11 && national.startsWith('1')) national = national.slice(1);
    if (code === '1' && national.length === 10) return `+1${national}`;
    if (national.length >= 6) return `+${code}${national}`;
  }

  // Only assume NANP for an unqualified 10/11 digit number. Other lengths
  // remain unresolved instead of becoming a false international number.
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function classify(title: string, summary: string): string {
  const text = `${title}\n${summary}`.toLowerCase();
  if (/crypto|bitcoin|usdt|investment|wallet/.test(text)) return 'crypto_investment';
  if (/paypal|bank|account|refund|payment|invoice/.test(text)) return 'financial_impersonation';
  if (/delivery|package|fedex|ups|usps/.test(text)) return 'delivery';
  if (/government|irs|police|tax|social security/.test(text)) return 'government_impersonation';
  if (/job|recruit|employment|hiring/.test(text)) return 'job_scam';
  if (/romance|dating|girlfriend|boyfriend/.test(text)) return 'romance';
  if (/tech support|microsoft|apple|computer/.test(text)) return 'tech_support';
  return 'other';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Privileged service-role writes — never allow anonymous execution.
    // Scheduled workflows invoke this with admin auth, so strict admin here
    // secures the public HTTP endpoint without blocking the workflow.
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const research = await base44.integrations.Core.InvokeLLM({
      prompt: `Use web search to find publicly indexed pages from the Reddit subreddit r/ScamNumbers. Do NOT directly open, fetch, or call Reddit URLs or Reddit's API, because direct Reddit access may be denied. Use search-result snippets and other publicly indexed search information only. Find recent posts that contain phone numbers associated with scams or spam. Return ONLY real, verifiable matches where the phone number is explicitly present in the indexed search result and the Reddit post URL is provided by the search result. Do not invent phone numbers, reports, post URLs, authors, or dates. Prefer the newest 50 relevant posts. Extract every distinct phone number found in each relevant post. Respond in ${LANGUAGE}.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          posts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                post_url: { type: 'string' },
                post_id: { type: 'string' },
                title: { type: 'string' },
                summary: { type: 'string' },
                posted_at: { type: 'string' },
                country: { type: 'string' },
                phones: { type: 'array', items: { type: 'string' } },
              },
              required: ['post_url', 'title', 'phones'],
            },
          },
        },
        required: ['posts'],
      },
    });

    let createdRecords = 0;
    let phoneMatches = 0;
    const posts = Array.isArray(research?.posts) ? research.posts.slice(0, 50) : [];

    for (const post of posts) {
      const postUrl = String(post?.post_url || '').trim();
      if (!/^https?:\/\/(www\.)?reddit\.com\/r\/ScamNumbers\//i.test(postUrl)) continue;

      const phones = Array.isArray(post?.phones) ? post.phones : [];
      for (const rawPhone of phones) {
        const normalized = normalizePhone(rawPhone, String(post?.country || ''));
        if (!normalized) continue;
        phoneMatches += 1;

        const postId = String(post?.post_id || postUrl);
        const existing = await base44.asServiceRole.entities.RedditScamNumber.filter({
          post_id: postId,
          normalized_number: normalized,
        });
        if (existing.length > 0) {
          // Refresh source metadata instead of permanently freezing the first
          // version seen by the sync job.
          await base44.asServiceRole.entities.RedditScamNumber.update(existing[0].id, {
            title: String(post?.title || existing[0].title || '').slice(0, 500),
            summary: String(post?.summary || existing[0].summary || '').slice(0, 4000),
            scam_category: classify(String(post?.title || ''), String(post?.summary || '')),
            post_url: postUrl,
            posted_at: (() => {
              const parsed = new Date(String(post?.posted_at || ''));
              return Number.isNaN(parsed.getTime()) ? (existing[0].posted_at || new Date().toISOString()) : parsed.toISOString();
            })(),
            synced_at: new Date().toISOString(),
            source_confidence: Math.max(Number(existing[0].source_confidence) || 0, 85),
          });
          continue;
        }

        await base44.asServiceRole.entities.RedditScamNumber.create({
          normalized_number: normalized,
          phone_number: normalized,
          title: String(post?.title || '').slice(0, 500),
          summary: String(post?.summary || '').slice(0, 4000),
          scam_category: classify(String(post?.title || ''), String(post?.summary || '')),
          subreddit: 'ScamNumbers',
          post_url: postUrl,
          post_id: postId,
          author: '',
          // Preserve the Reddit post's publication time when supplied.
          posted_at: (() => {
            const parsed = new Date(String(post?.posted_at || ''));
            return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
          })(),
          synced_at: new Date().toISOString(),
          source_confidence: 85,
        });
        createdRecords += 1;
      }
    }

    return Response.json({
      success: true,
      subreddit: 'r/ScamNumbers',
      scanned_posts: posts.length,
      phone_matches: phoneMatches,
      created_records: createdRecords,
      synced_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('syncRedditScamNumbers error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Reddit sync failed' }, { status: 500 });
  }
});