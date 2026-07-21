import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// === SSRF protection: block private/internal IP ranges ===
function isPrivateIp(ip: string): boolean {
  if (ip === '::1' || ip === '::' || ip === '0.0.0.0') return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('0.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip)) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  if (ip.startsWith('fe80')) return true;
  return false;
}

async function validateUrlSafe(urlStr: string): Promise<{ ok: boolean; error?: string; resolvedIp?: string; hostname?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http/https protocols allowed' };
  }

  const hostname = parsed.hostname;

  // Block IP literals directly
  if (isPrivateIp(hostname)) {
    return { ok: false, error: 'Private/internal IP address blocked' };
  }

  // Resolve hostname, validate all IPs, and pin to the first safe IP
  // Pinning prevents DNS rebinding: the fetch uses this exact IP, not a fresh DNS lookup
  let resolvedIp: string | null = null;
  try {
    const addrs = await Deno.resolveDns(hostname, 'A');
    for (const ip of addrs) {
      if (isPrivateIp(ip)) return { ok: false, error: 'Private/internal IP address blocked' };
    }
    if (addrs.length > 0) {
      resolvedIp = addrs[0];
    }
    if (!resolvedIp) {
      const addrs6 = await Deno.resolveDns(hostname, 'AAAA');
      for (const ip of addrs6) {
        if (isPrivateIp(ip)) return { ok: false, error: 'Private/internal IP address blocked' };
      }
      if (addrs6.length > 0) {
        resolvedIp = addrs6[0];
      }
    }
  } catch {
    // DNS resolution failed — let the fetch fail naturally
  }

  return { ok: true, resolvedIp: resolvedIp || undefined, hostname };
}

// === VirusTotal URL reputation check ===
async function getVirusTotalReport(url: string): Promise<any | null> {
  const apiKey = Deno.env.get("VIRUSTOTAL_API_KEY");
  if (!apiKey) return null;
  try {
    const urlBytes = new TextEncoder().encode(url);
    let binary = '';
    for (let i = 0; i < urlBytes.length; i++) binary += String.fromCharCode(urlBytes[i]);
    const base64 = btoa(binary);
    const urlId = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const response = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { 'x-apikey': apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const attrs = data?.data?.attributes;
    if (!attrs) return null;
    const stats = attrs.last_analysis_stats || {};
    return {
      malicious: stats.malicious || 0,
      suspicious: stats.suspicious || 0,
      harmless: stats.harmless || 0,
      undetected: stats.undetected || 0,
      total_engines: (stats.malicious || 0) + (stats.suspicious || 0) + (stats.harmless || 0) + (stats.undetected || 0),
      reputation: attrs.reputation || 0,
      categories: attrs.categories || {},
    };
  } catch (_e) { return null; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { url } = await req.json();
    if (!url) return Response.json({ error: 'URL is required' }, { status: 400 });

    let targetUrl = url.trim();
    if (!targetUrl.match(/^https?:\/\//)) {
      targetUrl = 'https://' + targetUrl;
    }

    const marketplace = detectMarketplace(targetUrl);
    const vtReport = await getVirusTotalReport(targetUrl);

    let websiteContent = '';
    let httpStatus = 0;
    let finalUrl = targetUrl;
    let fetchError = null;
    let redirectCount = 0;

    try {
      let currentUrl = targetUrl;
      let response: Response | null = null;
      const maxRedirects = 5;

      for (let i = 0; i <= maxRedirects; i++) {
        const validation = await validateUrlSafe(currentUrl);
        if (!validation.ok) {
          fetchError = validation.error || 'URL validation failed';
          break;
        }

        // Pin the fetch to the validated IP to prevent DNS rebinding SSRF
        // The fetch connects to the resolved IP directly, eliminating the TOCTOU window
        // where a malicious DNS server could return a different (private) IP at fetch time
        let fetchUrl = currentUrl;
        const fetchHeaders: Record<string, string> = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        };
        if (validation.resolvedIp && validation.hostname) {
          const pinned = new URL(currentUrl);
          pinned.hostname = validation.resolvedIp;
          fetchUrl = pinned.href;
          fetchHeaders['Host'] = validation.hostname;
        }

        response = await fetch(fetchUrl, {
          headers: fetchHeaders,
          redirect: 'manual',
          signal: AbortSignal.timeout(15000),
        });

        // Handle redirects manually to validate each jump
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (!location) break;
          currentUrl = new URL(location, currentUrl).href;
          redirectCount++;
          continue;
        }
        break;
      }

      if (response && !fetchError) {
        httpStatus = response.status;
        finalUrl = currentUrl;
        const html = await response.text();
        websiteContent = extractContent(html, marketplace);
        if (websiteContent.length > 8000) {
          websiteContent = websiteContent.substring(0, 8000) + '...[truncated]';
        }
      }
    } catch (e) {
      fetchError = e.message;
    }

    const marketplaceContext = marketplace
      ? `\n\nMARKETPLACE DETECTED: ${marketplace}\nThis is a listing from ${marketplace}. Provide marketplace-specific analysis:\n- Seller reputation indicators (ratings, reviews, account age if visible)\n- Pricing anomalies (price significantly below market value = red flag)\n- Listing description quality and consistency\n- Common ${marketplace} scam patterns\n- Payment method red flags (gift cards, wire transfers, crypto)\n- Stock photos vs real photos\n- Return policy and buyer protection availability`
      : '';

    const redirectInfo = redirectCount > 0
      ? `\n\nREDIRECT DETECTED: Original URL ${targetUrl} redirected to ${finalUrl}. Redirects can sometimes indicate URL manipulation or cloaking.`
      : '';

    const vtInfo = vtReport
      ? `\n\nVIRUSTOTAL REPORT:\n- Malicious detections: ${vtReport.malicious}/${vtReport.total_engines} security engines\n- Suspicious detections: ${vtReport.suspicious}\n- Harmless: ${vtReport.harmless}\n- Community reputation: ${vtReport.reputation}\n${Object.keys(vtReport.categories).length > 0 ? '- Categories: ' + Object.values(vtReport.categories).join(', ') + '\n' : ''}`
      : '\n\n(VirusTotal report unavailable — analyze based on URL and content only)';

    const prompt = `You are a scam detection expert. Analyze this URL and its website content for scam/phishing risk.

URL: ${targetUrl}
Final URL (after redirects): ${finalUrl}
HTTP Status: ${httpStatus}
${fetchError ? `Website fetch error: ${fetchError}` : 'Website fetched successfully.'}

Website content extracted:
${websiteContent || '(Could not fetch website content — analyze based on URL structure and domain only)'}
${marketplaceContext}${redirectInfo}${vtInfo}

Analyze:
- Domain: typosquatting, suspicious TLDs, recently registered domains, non-matching brand domains, IDN homograph attacks
- URL structure: suspicious paths, excessive subdomains, URL shortener services, tracking parameters
- Website content: product listings, pricing anomalies (too good to be true), payment methods (gift cards, crypto, wire), contact info legitimacy, trust signals
- For marketplace listings: compare price vs market value, seller reputation, stock photos vs real photos, listing age indicators
- Phishing patterns: login forms, credential harvesting, fake payment portals, brand impersonation
- Urgency/scarcity tactics in the content
- Missing legal pages (terms, privacy, refund policy)
- Redirect chains: legitimate sites rarely chain multiple redirects
- Domain age and reputation indicators

${marketplace ? `Since this is a ${marketplace} listing, focus your explanation on marketplace-specific scam indicators and provide actionable advice for that platform.` : 'If this appears to be a marketplace listing (eBay, Amazon, Etsy, etc.), analyze it as such.'}

IMPORTANT: The risk_score MUST be a whole number between 0 and 100 (where 100 is most dangerous). Never use decimals like 0.98 — use 98 instead.

If this is NOT a marketplace listing, leave the marketplace_platform field empty (do not fill it with "N/A" or any text).

Rules: never say "definitely a scam" — use "likely" or "highly likely". Be educational and plain-English. Include concrete next steps. If the site is legitimate, say so clearly.`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          risk_score: { type: 'number', description: '0-100 risk score where 100 is most dangerous' },
          explanation: { type: 'string' },
          tactics_detected: { type: 'array', items: { type: 'string' } },
          next_steps: { type: 'array', items: { type: 'string' } },
          why_scammers_do_this: { type: 'string' },
          what_they_want: { type: 'string' },
          what_to_say: { type: 'string' },
          marketplace_platform: { type: 'string' },
        },
      },
    });

    if (marketplace && !result.marketplace_platform) {
      result.marketplace_platform = marketplace;
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function detectMarketplace(url) {
  const lower = url.toLowerCase();
  const marketplaces = [
    { pattern: 'ebay.', name: 'eBay' },
    { pattern: 'aliexpress.', name: 'AliExpress' },
    { pattern: 'facebook.com/marketplace', name: 'Facebook Marketplace' },
    { pattern: 'fb.com/marketplace', name: 'Facebook Marketplace' },
    { pattern: 'etsy.', name: 'Etsy' },
    { pattern: 'craigslist.', name: 'Craigslist' },
    { pattern: 'amazon.', name: 'Amazon' },
    { pattern: 'amzn.', name: 'Amazon' },
    { pattern: 'walmart.', name: 'Walmart' },
    { pattern: 'mercadolibre.', name: 'MercadoLibre' },
    { pattern: 'poshmark.', name: 'Poshmark' },
    { pattern: 'mercari.', name: 'Mercari' },
    { pattern: 'offerup.', name: 'OfferUp' },
    { pattern: 'depop.', name: 'Depop' },
    { pattern: 'vinted.', name: 'Vinted' },
  ];

  for (const m of marketplaces) {
    if (lower.includes(m.pattern)) return m.name;
  }
  return null;
}

function extractContent(html, marketplace) {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const descMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["']/is);
  const description = descMatch ? descMatch[1].trim() : '';

  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/is);
  const ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : '';

  const hasLoginForm = /<(?:form|input)[^>]*(?:password|login|signin|log-in|sign-in)/i.test(html);
  const hasPaymentForm = /<(?:form|input|button)[^>]*(?:payment|credit|card|cvv|checkout|paypal|stripe)/i.test(html);

  // Extract price information for marketplace listings
  let priceInfo = '';
  if (marketplace) {
    const priceMatches = html.match(/\$\s?\d+[,.]?\d{0,2}/g);
    if (priceMatches && priceMatches.length > 0) {
      priceInfo = `\nDetected prices: ${priceMatches.slice(0, 5).join(', ')}\n`;
    }

    // Look for seller rating info
    const sellerMatch = html.match(/(?:seller|store|shop)[^>]*>([^<]*(?:rating|review|star|feedback)[^<]*)/gi);
    if (sellerMatch && sellerMatch.length > 0) {
      priceInfo += `Seller info: ${sellerMatch.slice(0, 2).join(' | ')}\n`;
    }
  }

  // Detect Shopify
  const isShopify = /cdn\.shopify\.com|Shopify\.theme|shopify\.cdn/i.test(html);
  if (isShopify && !marketplace) {
    priceInfo += '\nShopify store detected.\n';
  }

  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  let result = '';
  if (ogTitle) result += `Page Title: ${ogTitle}\n`;
  else if (title) result += `Page Title: ${title}\n`;
  if (description) result += `Meta Description: ${description}\n`;
  result += `Has Login Form: ${hasLoginForm}\n`;
  result += `Has Payment Form: ${hasPaymentForm}\n`;
  if (priceInfo) result += priceInfo;
  result += `\n--- Website Content ---\n${text}`;

  return result;
}
// VirusTotal integration + risk_score 0-100 fix