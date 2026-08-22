import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const SUBREDDIT_URL = 'https://www.reddit.com/r/ScamNumbers/new.rss';
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

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRss(xml: string) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  return items.map((item, index) => {
    const get = (tag: string) => {
      const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return match ? decodeXml(match[1]) : '';
    };
    const link = get('link');
    const guid = get('guid');
    const id = (guid.match(/comments\/([a-z0-9]+)/i) || [])[1] || guid || link || `rss-${index}`;
    const pubDate = get('pubDate');
    const description = get('description');
    const title = get('title');
    return { id, title, description, link, pubDate };
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const response = await fetch(SUBREDDIT_URL, {
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        'user-agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(15000),
    });

    const raw = await response.text();
    if (!response.ok) {
      return Response.json({ error: `Reddit returned HTTP ${response.status}` }, { status: 502 });
    }

    const posts = parseRss(raw).slice(0, 50);
    let scannedPosts = 0;
    let createdRecords = 0;
    let phoneMatches = 0;

    for (const child of posts) {
      const post = child;
      if (!post?.id) continue;
      scannedPosts += 1;

      const body = [post.title, post.description].filter(Boolean).join('\n');
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
          summary: String(post.description || '').slice(0, 4000),
          scam_category: classify(post.title || '', post.description || ''),
          subreddit: 'ScamNumbers',
          post_url: post.link || '',
          post_id: post.id,
          author: '[rss]',
          posted_at: post.pubDate ? new Date(post.pubDate).toISOString() : new Date().toISOString(),
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