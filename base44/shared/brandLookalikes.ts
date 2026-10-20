// Brand-impersonation check for scanned addresses.
//
// WHY THIS EXISTS: an address that imitates a brand IS the scam attempt, whether
// or not it currently serves a page. A dead lookalike (paypal1.com, a parked
// domain, a DNS error page) used to reach the model as "no content", and the
// model reasonably concluded "nothing malicious here" — so the scan came back
// SAFE. That is backwards. The address question is deterministic, so it is
// answered here, with no LLM and no network call, before the model is consulted.
//
// The rules mirror src/lib/extensionSharedSource.js (same brands, same
// normalisation, same affix words) so the browser extension and the backend
// never disagree about what a lookalike is. Both are deliberately conservative:
// a domain is flagged only when it is a one-character edit of a distinctive
// brand, a brand next to a security-sounding word, a brand joined by a
// separator to another word, or when a brand's own domain appears inside
// somebody else's host. "applebees.com" and "amazon.co.uk" are left alone.

import { matchOwnAppDomain } from './legitimateDomains.ts';

const TWO_LEVEL_TLDS = new Set<string>([
  'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'co.il', 'org.il', 'ac.il', 'com.au',
  'net.au', 'org.au', 'co.nz', 'co.za', 'com.br', 'com.mx', 'com.ar', 'co.jp',
  'com.sg', 'com.hk', 'co.in', 'com.tw', 'co.kr', 'com.cn', 'com.tr', 'com.ua',
  'co.ke', 'com.ng', 'com.ph', 'com.my', 'com.vn',
]);

// Distinctive brand tokens (5+ characters) with their real address. Ordinary
// English words that are also brands (bank, target, chase, wise, prime, steam,
// booking) are excluded: one character off a dictionary word flags real sites.
const BRAND_OFFICIAL: Record<string, string> = {
  paypal: 'paypal.com', coinbase: 'coinbase.com', metamask: 'metamask.io',
  binance: 'binance.com', cashapp: 'cash.app', venmo: 'venmo.com',
  zelle: 'zellepay.com', revolut: 'revolut.com', stripe: 'stripe.com',
  shopify: 'shopify.com', amazon: 'amazon.com', google: 'google.com',
  microsoft: 'microsoft.com', apple: 'apple.com', netflix: 'netflix.com',
  facebook: 'facebook.com', instagram: 'instagram.com', whatsapp: 'whatsapp.com',
  telegram: 'telegram.org', linkedin: 'linkedin.com', dropbox: 'dropbox.com',
  icloud: 'icloud.com', outlook: 'outlook.com', gmail: 'gmail.com',
  yahoo: 'yahoo.com', spotify: 'spotify.com', snapchat: 'snapchat.com',
  tiktok: 'tiktok.com', discord: 'discord.com', twitch: 'twitch.tv',
  airbnb: 'airbnb.com', aliexpress: 'aliexpress.com', alibaba: 'alibaba.com',
  docusign: 'docusign.com', adobe: 'adobe.com', zoom: 'zoom.us',
  walmart: 'walmart.com', costco: 'costco.com', tesco: 'tesco.com',
  fedex: 'fedex.com', santander: 'santander.com', hapoalim: 'bankhapoalim.co.il',
  robinhood: 'robinhood.com', fidelity: 'fidelity.com', vanguard: 'vanguard.com',
  schwab: 'schwab.com', wellsfargo: 'wellsfargo.com',
  bankofamerica: 'bankofamerica.com', citibank: 'citibank.com',
  barclays: 'barclays.co.uk',
};

const BRANDS = Object.keys(BRAND_OFFICIAL);

// Brands where the name sitting next to another word is almost always an
// imitation ("paypal-secure", "coinbase-help"), and where the harm is money
// leaving an account. Kept deliberately narrow.
const SEPARATOR_BRANDS = new Set<string>([
  'paypal', 'coinbase', 'metamask', 'binance', 'cashapp', 'venmo', 'zelle',
  'wellsfargo', 'bankofamerica', 'citibank', 'santander', 'hapoalim',
  'amazon', 'apple', 'netflix', 'google', 'microsoft', 'whatsapp',
  'instagram', 'facebook', 'tiktok', 'docusign', 'icloud', 'outlook', 'gmail',
]);

// A brand joined to one of these words is an imitation. A brand inside an
// ordinary word ("applebees", "amazonia") is not.
const AFFIX_WORDS = new Set<string>([
  'secure', 'security', 'login', 'signin', 'verify', 'verification', 'account',
  'support', 'service', 'update', 'alert', 'billing', 'payment', 'help', 'auth',
  'confirm', 'official', 'center', 'centre', 'team', 'online', 'safe', 'protection',
]);

// Brand names as people write them, so a warning can read "Fake PayPal address"
// instead of "Fake paypal address".
const BRAND_TITLES: Record<string, string> = {
  paypal: 'PayPal', coinbase: 'Coinbase', metamask: 'MetaMask',
  binance: 'Binance', cashapp: 'Cash App', venmo: 'Venmo', zelle: 'Zelle',
  bankofamerica: 'Bank of America', wellsfargo: 'Wells Fargo',
  citibank: 'Citibank', hapoalim: 'Bank Hapoalim', schwab: 'Charles Schwab',
  tiktok: 'TikTok', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', icloud: 'iCloud',
  aliexpress: 'AliExpress', docusign: 'DocuSign', gmail: 'Gmail',
  outlook: 'Outlook', fedex: 'FedEx', adobe: 'Adobe',
};

export interface BrandLookalike {
  brand: string;
  official: string;
  kind: 'lookalike' | 'imitation' | 'nested';
}

function parseHost(url: string): string {
  if (!url || typeof url !== 'string') return '';
  try {
    const withProto = url.startsWith('http') ? url : 'https://' + url;
    return (new URL(withProto).hostname || '').toLowerCase();
  } catch {
    return '';
  }
}

function isIpHost(host: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

function rootDomain(host: string): string {
  const parts = host.replace(/\.$/, '').split('.');
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join('.');
  if (TWO_LEVEL_TLDS.has(lastTwo) && parts.length >= 3) return parts.slice(-3).join('.');
  return lastTwo;
}

function mainLabel(root: string): string {
  const parts = root.split('.');
  return parts.length > 1 ? parts[0] : root;
}

// Digit/letter lookalikes plus the classic two-letter swaps.
function normalizeLabel(label: string): string {
  return label
    .replace(/0/g, 'o')
    .replace(/1/g, 'l')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w')
    .replace(/cl/g, 'd');
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 99;
  let prev: number[] = [];
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    for (let k = 1; k <= b.length; k++) {
      const cost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
      cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * Returns the imitated brand when the address pretends to be a brand, otherwise
 * null. Deterministic and offline — no scan, no credits, no AI.
 */
export function findBrandLookalike(url: string): BrandLookalike | null {
  const host = parseHost(url);
  if (!host || host === 'localhost' || isIpHost(host) || matchOwnAppDomain(host)) return null;
  if (!host.includes('.')) return null;

  const root = rootDomain(host);
  const label = mainLabel(root);
  if (label.length < 5) return null;

  // The brand's own domain, or a subdomain of it, is never an imitation.
  for (const official of Object.values(BRAND_OFFICIAL)) {
    if (host === official || host.endsWith('.' + official)) return null;
  }

  // A brand's real address buried inside a longer host:
  // paypal.com.login-user.xyz
  for (const [brand, official] of Object.entries(BRAND_OFFICIAL)) {
    if (host.includes(official + '.')) return { brand, official, kind: 'nested' };
  }

  // A brand's own name on another TLD (paypal.co.uk, amazon.ca) proves nothing,
  // and flagging it would produce false positives.
  if (BRANDS.includes(label)) return null;

  const normalized = normalizeLabel(label);
  if (normalized !== label && BRANDS.includes(normalized)) {
    return { brand: normalized, official: BRAND_OFFICIAL[normalized], kind: 'lookalike' };
  }

  for (const [brand, official] of Object.entries(BRAND_OFFICIAL)) {
    // A brand next to a security-sounding word: paypalverify, secure-paypal.
    if (label.startsWith(brand)) {
      if (AFFIX_WORDS.has(label.slice(brand.length))) {
        return { brand, official, kind: 'imitation' };
      }
    } else if (label.endsWith(brand)) {
      const prefix = label.slice(0, label.length - brand.length);
      if (prefix && AFFIX_WORDS.has(prefix)) return { brand, official, kind: 'imitation' };
    }

    // One character away from the brand: paypal1.com, arnazon.com.
    if (brand[0] !== label[0]) continue;
    if (editDistance(label, brand) === 1) return { brand, official, kind: 'lookalike' };
  }

  // A brand used as a token with a separator: paypal-secure.com
  const tokens = label.split(/[^a-z0-9]+/).filter((t) => t.length > 0);
  if (tokens.length >= 2) {
    for (const token of tokens) {
      if (SEPARATOR_BRANDS.has(token)) {
        return { brand: token, official: BRAND_OFFICIAL[token] || token + '.com', kind: 'imitation' };
      }
    }
  }

  return null;
}

export function brandDisplayName(brand: string): string {
  return BRAND_TITLES[brand] || brand.charAt(0).toUpperCase() + brand.slice(1);
}

/**
 * The verdict for an imitated brand: high risk, plain English, and the real
 * address to use instead. Unconditionally a scam attempt — the address is the
 * evidence, so an empty or unreachable page changes nothing.
 */
export function lookalikeAnalysis(look: BrandLookalike, answerType: string): Record<string, any> {
  const brand = brandDisplayName(look.brand);
  const headline = `This address imitates ${brand}. The real ${brand} website is ${look.official}.`;
  const advice = `Do not enter a password, card number or personal detail on this page. Open ${look.official} by typing it into your browser yourself.`;

  if (answerType === 'quick') {
    return { is_scam: true, verdict: `${headline} ${advice}` };
  }
  if (answerType === 'risk_score') {
    return { risk_score: 88, risk_level: 'high', summary: `${headline} ${advice}` };
  }

  return {
    page_summary: `This is not the real ${brand} website — the address was changed to look like it.`,
    risk_level: 'high',
    risk_score: 88,
    confidence: 90,
    is_scam: true,
    scam_category: 'Brand Impersonation (Phishing)',
    overall_risk: 'high',
    explanation: `${headline} ${advice}`,
    tactics_detected: ['Brand impersonation', 'Imitation website address'],
    red_flags: [
      `The website address imitates ${brand}`,
      `The real address is ${look.official}`,
    ],
    evidence_found: [`Address check: the domain imitates ${brand} (${look.official})`],
    sources_checked: ['Vardin address check', 'VirusTotal', 'URLhaus'],
    next_steps: [
      'Do not enter a password or card details here',
      `Open ${look.official} by typing it into your browser yourself`,
      'Report the message that sent you this link',
    ],
    what_they_want: 'Your password, card details or money',
    what_to_say: `This is not the real ${brand}. Do not use this page.`,
  };
}