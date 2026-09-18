import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { getUrlhausReport } from '../../shared/urlhaus.ts';
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from '../../shared/credits.ts';
import { safeFetchText } from '../../shared/ssrf.ts';
import { matchKnownLegitimateDomain } from '../../shared/legitimateDomains.ts';

const CREDIT_COST = 7;

// Kept for backward compatibility with any internal callers; the hardened
// validation now lives in shared/ssrf.ts.
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
  if (isPrivateIp(hostname)) {
    return { ok: false, error: 'Private/internal IP address blocked' };
  }

  let resolvedIp: string | null = null;
  try {
    const addrs = await Deno.resolveDns(hostname, 'A');
    for (const ip of addrs) {
      if (isPrivateIp(ip)) return { ok: false, error: 'Private/internal IP address blocked' };
    }
    if (addrs.length > 0) resolvedIp = addrs[0];
    if (!resolvedIp) {
      const addrs6 = await Deno.resolveDns(hostname, 'AAAA');
      for (const ip of addrs6) {
        if (isPrivateIp(ip)) return { ok: false, error: 'Private/internal IP address blocked' };
      }
      if (addrs6.length > 0) resolvedIp = addrs6[0];
    }
  } catch {}

  return { ok: true, resolvedIp: resolvedIp || undefined, hostname };
}

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
      signal: AbortSignal.timeout(8000),
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
  } catch (_e) {
    return null;
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    let incognitoAllowed = false;
    try {
      const protectedMembers = await base44.entities.ProtectedSenior.filter({ senior_user_id: user.id });
      incognitoAllowed = protectedMembers.some((member: any) => member.incognito_allowed === true);
    } catch {}
    const body = await req.json();
    const privateScan = body.private_scan === true;
    if (!privateScan && plan !== 'plus' && plan !== 'premium') {
      return Response.json({ error: 'Paid plan required', upgrade_url: '/pricing' }, { status: 403 });
    }
    if (privateScan && !incognitoAllowed && plan !== 'plus' && plan !== 'premium') {
      return Response.json({ error: 'Incognito Search requires Plus or Premium unless enabled by a guardian.' }, { status: 403 });
    }

    const available = getAvailableCredits(user);
    if (available.remaining < CREDIT_COST) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: available.remaining,
        credits_limit: getMonthlyCreditLimit(user),
        credit_cost: CREDIT_COST,
      }, { status: 402 });
    }

    const chargeCredits = async () => {
      const usage = applyCreditUsage(user, CREDIT_COST);
      if (!usage) throw new Error('Credit balance changed during scan. Please try again.');
      await base44.auth.updateMe(usage);
      return getAvailableCredits({ ...user, ...usage }).remaining;
    };

    const { url } = body;
    if (!url) return Response.json({ error: 'URL is required' }, { status: 400 });

    let targetUrl = url.trim();
    if (!targetUrl.match(/^https?:\/\//)) {
      targetUrl = 'https://' + targetUrl;
    }

    const marketplace = detectMarketplace(targetUrl);

    let vtReport: any = null;
    let websiteContent = '';
    let httpStatus = 0;
    let finalUrl = targetUrl;
    let fetchError = null;
    let redirectCount = 0;

    // === PARALLEL: VT + URLhaus (don't wait for fetch) ===
    const vtPromise = getVirusTotalReport(targetUrl);
    const urlhausPromise = getUrlhausReport(targetUrl);

    try {
      const result = await safeFetchText(targetUrl, {
        timeoutMs: 6000,
        maxBytes: 2 * 1024 * 1024,
        maxRedirects: 3,
      });
      if (result.ok) {
        httpStatus = result.status;
        finalUrl = result.finalUrl;
        redirectCount = result.redirectCount;
        websiteContent = extractContent(result.text, marketplace);
        if (websiteContent.length > 6000) {
          websiteContent = websiteContent.substring(0, 6000) + '...[truncated]';
        }
      } else {
        fetchError = result.error || 'URL validation failed';
      }
    } catch (e) {
      fetchError = e.message;
    }

    // Get threat intel
    vtReport = await vtPromise;
    const urlhausReport = await urlhausPromise;

    // === EARLY EXIT: URLhaus malware ===
    if (urlhausReport?.listed) {
      const creditsRemaining = await chargeCredits();
      return Response.json({
        risk_level: 'high',
        risk_score: 95,
        explanation: `URLhaus: Active malware distribution site. ${urlhausReport.threat || 'malware'}. DO NOT VISIT.`,
        tactics_detected: ['Malware distribution'],
        next_steps: ['Do NOT visit', 'Do NOT download files', 'Report to URLhaus'],
        why_scammers_do_this: 'To infect devices with malicious software',
        what_they_want: 'Unauthorized device access and control',
        what_to_say: 'This is a confirmed malware distribution site.',
        marketplace_platform: marketplace || '',
        urlhaus: urlhausReport,
        credits_used: CREDIT_COST,
        credits_remaining: creditsRemaining,
        credits_limit: getMonthlyCreditLimit(user),
        timing_ms: Date.now() - startTime,
      });
    }

    // === EARLY EXIT: VirusTotal high malicious count ===
    if (vtReport && vtReport.malicious >= 5) {
      const creditsRemaining = await chargeCredits();
      return Response.json({
        risk_level: 'high',
        risk_score: 85,
        explanation: `VirusTotal: ${vtReport.malicious}/${vtReport.total_engines} security vendors flag malware/phishing. DO NOT VISIT.`,
        tactics_detected: ['Malware / Phishing Detection'],
        next_steps: ['Do NOT visit', 'Report to antivirus vendor'],
        why_scammers_do_this: 'Credential theft or device compromise',
        what_they_want: 'Your credentials or device control',
        what_to_say: 'Multiple antivirus vendors flag this as dangerous.',
        marketplace_platform: marketplace || '',
        virustotal: vtReport,
        credits_used: CREDIT_COST,
        credits_remaining: creditsRemaining,
        credits_limit: getMonthlyCreditLimit(user),
        timing_ms: Date.now() - startTime,
      });
    }

    // === KNOWN-LEGITIMATE SHORTCUT ===
    // Famous brands dominate the LLM's web-search context with brand-impersonation
    // scam articles, which biases it toward a generic scam narrative even for the
    // real official domain. When the target is a well-known official domain and
    // both threat-intel feeds are clean, return a safe verdict directly.
    const legitApex = matchKnownLegitimateDomain(targetUrl);
    if (legitApex && !urlhausReport?.listed && (!vtReport || vtReport.malicious === 0)) {
      const brand = legitApex.split('.')[0] || legitApex;
      const creditsRemaining = await chargeCredits();
      return Response.json({
        risk_level: 'low',
        risk_score: 4,
        explanation: `This is the official ${brand} website (${legitApex}). VirusTotal and URLhaus report no malware or phishing activity. Safe to visit.`,
        tactics_detected: [],
        next_steps: [],
        why_scammers_do_this: '',
        what_they_want: '',
        what_to_say: '',
        marketplace_platform: marketplace || '',
        virustotal: vtReport,
        urlhaus: urlhausReport,
        credits_used: CREDIT_COST,
        credits_remaining: creditsRemaining,
        credits_limit: getMonthlyCreditLimit(user),
        timing_ms: Date.now() - startTime,
      });
    }

    // === Build LLM prompt (only if not obviously malicious) ===
    const marketplaceContext = marketplace
      ? `\n\nMARKETPLACE: ${marketplace}. Analyze: seller reputation, pricing vs market value, stock photos, payment methods (gift cards/crypto = red flag), return policy.`
      : '';

    const redirectInfo = redirectCount > 0
      ? `\n\nURL REDIRECT: ${targetUrl} → ${finalUrl}. Redirects can indicate cloaking.`
      : '';

    const vtInfo = vtReport
      ? `\n\nVT: ${vtReport.malicious} malicious, ${vtReport.suspicious} suspicious, ${vtReport.harmless} harmless out of ${vtReport.total_engines} vendors. Reputation: ${vtReport.reputation}.`
      : '';

    const urlhausInfo = urlhausReport && !urlhausReport.listed
      ? '\n\nURLHAUS: Not listed (clean history)'
      : '';

    const prompt = `Analyze this URL for scam/phishing risk.

URL: ${targetUrl} → ${finalUrl} (Status: ${httpStatus})
${fetchError ? `Fetch error: ${fetchError}` : ''}

Content:
${websiteContent || '(Could not fetch)'}
${marketplaceContext}${redirectInfo}${vtInfo}${urlhausInfo}

CRITICAL EVIDENCE RULES:
- Only report scam indicators that are actually present in the URL, redirect chain, fetched page content, or the supplied threat-intelligence results.
- Never invent a scam scenario, victim request, attacker goal, credentials being requested, payment request, urgency, or manipulation tactic.
- Do NOT treat the existence of phishing sites that impersonate a legitimate brand as evidence that this exact official domain is malicious.
- The exact domain matters. A real official domain is not the same as a lookalike or unrelated domain.
- Only say that a page asks for credentials, payment, personal information, or access when the supplied evidence actually shows that request.
- "what_they_want" must describe what THIS PAGE is actually requesting. For a benign page, return an empty string.
- "what_to_say" is for suspicious/scam situations only. For a benign page, return an empty string.
- "why_scammers_do_this" is for explaining an actual suspicious pattern. For a benign page, return an empty string.
- "tactics_detected" must be an empty array when no manipulation tactic is actually present.
- For an ordinary official/legitimate page with no concrete scam indicators, use a low risk score and keep all scam-specific fields empty.
- If the URL is the official/primary domain of a well-known company (e.g. amazon.com, google.com, paypal.com, microsoft.com, apple.com) and the threat-intel results above show no malicious reports, you MUST return risk_level "low", a low risk_score, and leave tactics_detected, why_scammers_do_this, what_they_want, and what_to_say EMPTY. Do NOT produce generic educational content about how scammers impersonate that brand.

Check: typosquatting, suspicious TLDs, phishing forms, brand impersonation, urgency tactics, payment method red flags. risk_score 0-100 integer only.`;

    const llmOptions: any = {
      prompt,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
          risk_score: { type: 'number', description: '0-100' },
          explanation: { type: 'string' },
          tactics_detected: { type: 'array', items: { type: 'string' } },
          next_steps: { type: 'array', items: { type: 'string' } },
          why_scammers_do_this: { type: 'string' },
          what_they_want: { type: 'string' },
          what_to_say: { type: 'string' },
          marketplace_platform: { type: 'string' },
        },
      },
    };

    let result;
    try {
      const llmPromise = base44.integrations.Core.InvokeLLM(llmOptions);
      // Give the AI enough time to inspect the fetched page and threat-intel
      // context. A 1.5s timeout caused legitimate scans to fall back before
      // the model could actually analyze the destination.
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 15000)
      );
      result = await Promise.race([llmPromise, timeoutPromise]);
    } catch (e) {
      result = {
        risk_level: vtReport?.malicious ? 'medium' : 'low',
        risk_score: vtReport?.malicious ? 55 : 25,
        explanation: 'LLM timeout. Check reports above.',
        tactics_detected: [],
        next_steps: ['Review VirusTotal/URLhaus reports'],
        why_scammers_do_this: '',
        what_they_want: '',
        what_to_say: '',
        marketplace_platform: marketplace || '',
      };
    }

    // Prevent low-risk scans from displaying invented scam narratives.
    if (result && result.risk_level === 'low') {
      result.is_scam = false;
      result.tactics_detected = [];
      result.why_scammers_do_this = '';
      result.what_they_want = '';
      result.what_to_say = '';
    }

    if (marketplace && !result.marketplace_platform) {
      result.marketplace_platform = marketplace;
    }

    if (urlhausReport) {
      (result as any).urlhaus = urlhausReport;
    }
    if (vtReport) {
      (result as any).virustotal = vtReport;
    }

    const creditsRemaining = await chargeCredits();
    (result as any).credits_used = CREDIT_COST;
    (result as any).credits_remaining = creditsRemaining;
    (result as any).credits_limit = getMonthlyCreditLimit(user);
    (result as any).timing_ms = Date.now() - startTime;

    return Response.json(result);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function detectMarketplace(url: string): string | null {
  const lower = url.toLowerCase();
  const marketplaces: Array<{ pattern: string; name: string }> = [
    { pattern: 'ebay.', name: 'eBay' },
    { pattern: 'aliexpress.', name: 'AliExpress' },
    { pattern: 'facebook.com/marketplace', name: 'Facebook Marketplace' },
    { pattern: 'etsy.', name: 'Etsy' },
    { pattern: 'craigslist.', name: 'Craigslist' },
    { pattern: 'amazon.', name: 'Amazon' },
    { pattern: 'walmart.', name: 'Walmart' },
    { pattern: 'mercadolibre.', name: 'MercadoLibre' },
  ];
  for (const m of marketplaces) {
    if (lower.includes(m.pattern)) return m.name;
  }
  return null;
}

function extractContent(html: string, marketplace: string | null): string {
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const title = titleMatch ? titleMatch[1].trim() : '';

  const descMatch = html.match(/<meta[^>]+description=["']([^"']*)["']/i);
  const description = descMatch ? descMatch[1].trim() : '';

  const hasLoginForm = /<(?:form|input)[^>]*(?:password|login|signin)/i.test(html);
  const hasPaymentForm = /<(?:form|input|button)[^>]*(?:payment|credit|card|paypal|stripe|checkout)/i.test(html);

  let priceInfo = '';
  if (marketplace) {
    const prices = html.match(/\$\s?\d+[,.]?\d{0,2}/g);
    if (prices && prices.length > 0) {
      priceInfo = `\nPrices detected: ${prices.slice(0, 3).join(', ')}\n`;
    }
  }

  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  let result = '';
  if (title) result += `Title: ${title}\n`;
  if (description) result += `Desc: ${description}\n`;
  result += `Login form: ${hasLoginForm}, Payment form: ${hasPaymentForm}\n`;
  if (priceInfo) result += priceInfo;
  result += `\n${text.substring(0, 3000)}`;

  return result;
}