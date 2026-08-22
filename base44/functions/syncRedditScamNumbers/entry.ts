import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const LANGUAGE = 'English';

function normalizePhone(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;
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

    const research = await base44.integrations.Core.InvokeLLM({
      prompt: `Research the public Reddit subreddit r/ScamNumbers. Find recent posts from the subreddit that contain phone numbers associated with scams or spam. Return ONLY real, verifiable matches where the phone number is explicitly present in the post and the Reddit post URL is provided. Do not invent phone numbers, reports, post URLs, authors, or dates. Prefer the newest 50 relevant posts. Extract every distinct phone number found in each relevant post. Respond in ${LANGUAGE}.`,
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
        const normalized = normalizePhone(rawPhone);
        if (!normalized) continue;
        phoneMatches += 1;

        const postId = String(post?.post_id || postUrl);
        const existing = await base44.asServiceRole.entities.RedditScamNumber.filter({
          post_id: postId,
          normalized_number: normalized,
        });
        if (existing.length > 0) continue;

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
          posted_at: post?.posted_at ? new Date(post.posted_at).toISOString() : new Date().toISOString(),
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