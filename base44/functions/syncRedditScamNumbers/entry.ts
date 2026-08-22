import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const SUBREDDIT_URL = 'https://www.reddit.com/r/ScamNumbers/new.json?limit=100';
const USER_AGENT = 'VardinScamGuard/1.0';

function normalizePhone(raw: string): string | null {
  const value = String(raw || '').trim();
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  return null;
}

function extractPhones(text: string): string[] {
  const matches = String(text || '').match(/(?:\+?\d[\d\s().-]{6,}\d)/g) || [];
  const normalized = new Set<string>();
  for (const match of matches) {
    const phone = normalizePhone(match);
    if (phone) normalized.add(phone);
  }
  return [...normalized];
}

function classify(title: string, text: string): string {
  const haystack = `${title}\n${text}`.toLowerCase();
  if (/crypto|bitcoin|usdt|investment|wallet/.test(haystack)) return 'crypto_investment';
  if (/paypal|bank|account|refund|payment|invoice/.test(haystack)) return 'financial_impersonation';
  if (/delivery|package|fedex|ups|usps/.test(haystack)) return 'delivery';
  if (/government|irs|police|tax|social security/.test(haystack)) return 'government_impersonation';
  if (/job|recruit|employment|hiring/.test(haystack)) return 'job_scam';
  if (/romance|dating|girlfriend|boyfriend/.test(haystack)) return 'romance';
  if (/tech support|microsoft|apple|computer/.test(haystack)) return 'tech_support';
  return 'other';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const response = await fetch(SUBREDDIT_URL, {
      headers: {
        accept: 'application/json',
        'user-agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return Response.json({ error: `Reddit returned HTTP ${response.status}` }, { status: 502 });
    }

    const payload = await response.json();
    const posts = payload?.data?.children || [];
    let scannedPosts = 0;
    let createdRecords = 0;
    let phoneMatches = 0;

    for (const child of posts) {
      const post = child?.data;
      if (!post?.id) continue;
      scannedPosts += 1;

      const body = [post.title, post.selftext].filter(Boolean).join('\n');
      const phones = extractPhones(body);
      if (!phones.length) continue;

      for (const normalized of phones) {
        phoneMatches += 1;

        const existing = await base44.asServiceRole.entities.RedditScamNumber.filter({
          post_id: post.id,
          normalized_number: normalized,
        });

        if (existing.length > 0) continue;

        await base44.asServiceRole.entities.RedditScamNumber.create({
          normalized_number: normalized,
          phone_number: normalized,
          title: post.title || '',
          summary: String(post.selftext || '').slice(0, 4000),
          scam_category: classify(post.title || '', post.selftext || ''),
          subreddit: 'ScamNumbers',
          post_url: `https://www.reddit.com${post.permalink || ''}`,
          post_id: post.id,
          author: post.author || '[deleted]',
          posted_at: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : new Date().toISOString(),
          synced_at: new Date().toISOString(),
          source_confidence: 90,
        });

        createdRecords += 1;
      }
    }

    return Response.json({
      success: true,
      subreddit: 'r/ScamNumbers',
      scanned_posts: scannedPosts,
      phone_matches: phoneMatches,
      created_records: createdRecords,
      synced_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('syncRedditScamNumbers error', error);
    return Response.json({ error: error instanceof Error ? error.message : 'Reddit sync failed' }, { status: 500 });
  }
});