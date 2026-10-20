// Curated set of well-known official/primary domains. When a scan target's
// registrable domain matches one of these AND the threat-intel feeds
// (VirusTotal + URLhaus) are clean, the scanner short-circuits to a safe
// verdict instead of asking the LLM.
//
// Why this exists: for famous brands the LLM's web-search context is
// dominated by brand-impersonation scam articles, which biases it toward a
// generic scam narrative even for the real official domain (e.g. scanning
// amazon.com returned Amazon gift-card scam education). Matching the exact
// official domain lets us return a reliable safe verdict and skip that bias.

const LEGITIMATE_APEX_DOMAINS = new Set([
  // Retail / marketplaces
  'amazon.com', 'ebay.com', 'walmart.com', 'etsy.com', 'aliexpress.com',
  'target.com', 'bestbuy.com', 'costco.com', 'homedepot.com', 'lowes.com',
  'mercadolibre.com', 'shopify.com', 'ikea.com',
  // Tech / platforms
  'google.com', 'youtube.com', 'microsoft.com', 'apple.com', 'github.com',
  'linkedin.com', 'twitter.com', 'x.com', 'instagram.com', 'facebook.com',
  'reddit.com', 'netflix.com', 'spotify.com', 'twitch.tv', 'pinterest.com',
  'tiktok.com', 'whatsapp.com', 'snapchat.com',
  // Productivity / cloud
  'adobe.com', 'zoom.us', 'slack.com', 'dropbox.com', 'atlassian.com',
  'salesforce.com', 'oracle.com', 'ibm.com', 'sap.com', 'cloudflare.com',
  // Finance / payments
  'paypal.com', 'stripe.com', 'wise.com', 'revolut.com',
  // Reference / news
  'wikipedia.org', 'britannica.com', 'nytimes.com', 'bbc.com', 'cnn.com',
  'reuters.com', 'theguardian.com', 'washingtonpost.com',
  // Dev / reference
  'stackoverflow.com', 'mozilla.org', 'w3.org', 'githubusercontent.com',
]);

// Vardin's own hosts (see shared/appUrl.ts CANONICAL_APP_URL). Keep in sync
// with any custom domain connected to the app.
const OWN_APP_HOSTS = new Set<string>([
  'vardin.base44.app',
  'vardin.com',
  'app.vardin.com',
  'www.vardin.com',
]);

/**
 * Returns the host when the URL points at Vardin itself, otherwise null.
 * Unlike matchKnownLegitimateDomain this IGNORES the path: our own app is safe
 * on every route. Without this, scanning our own dashboard returned a phantom
 * "medium risk" because web search surfaces "newly registered domain" articles
 * about base44.app.
 */
export function matchOwnAppDomain(url: string): string | null {
  try {
    const withProto = url && url.startsWith('http') ? url : 'https://' + url;
    const parsed = new URL(withProto);
    const hostname = (parsed.hostname || '').toLowerCase();
    if (!hostname) return null;
    if (OWN_APP_HOSTS.has(hostname)) return hostname;
    for (const h of OWN_APP_HOSTS) {
      if (hostname.endsWith('.' + h)) return hostname;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns the matched apex domain (e.g. "amazon.com") if the URL is an
 * official/known-legitimate domain or an official subdomain of one, otherwise
 * null. Safe against lookalikes: "evil-amazon.com" does not match "amazon.com"
 * because the check requires either an exact apex match or a ".<apex>" suffix.
 */
export function matchKnownLegitimateDomain(url: string): string | null {
  try {
    const withProto = url && url.startsWith('http') ? url : 'https://' + url;
    const parsed = new URL(withProto);
    const hostname = (parsed.hostname || '').toLowerCase();
    if (!hostname) return null;

    // Only short-circuit for the root domain (no meaningful path). Specific
    // paths (e.g. youtube.com/watch?v=xxx, pinterest.com/pin/123) can point to
    // user-generated content that needs actual analysis — a YouTube Rickroll
    // or a Pinterest scam pin must not be auto-dismissed as "safe" just because
    // the registrable domain is well-known.
    const path = parsed.pathname;
    if (path && path !== '/' && path.length > 1) return null;

    const apex = hostname.replace(/^www\./, '');
    if (LEGITIMATE_APEX_DOMAINS.has(apex)) return apex;
    for (const d of LEGITIMATE_APEX_DOMAINS) {
      if (hostname.endsWith('.' + d)) return d;
    }
    return null;
  } catch {
    return null;
  }
}