import { getUrlhausReport } from "./urlhaus.ts";

export interface VirusTotalReport {
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  total_engines: number;
  reputation: number;
  categories: Record<string, string>;
}

export interface ThreatIntelResult {
  virustotal: VirusTotalReport | null;
  urlhaus: any | null;
  cached: boolean;
}

export function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return raw.trim();
  }
}

export function shouldCheckThreatIntel(url: string, finalUrl: string = url, content: string = ""): boolean {
  const lowerUrl = url.toLowerCase();
  const lowerFinal = finalUrl.toLowerCase();
  const hostname = (() => {
    try { return new URL(finalUrl).hostname.toLowerCase(); } catch { return ""; }
  })();

  // Strong URL-level signals: these are cheap local checks and intentionally
  // conservative so ordinary URLs avoid paid threat-intel calls.
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) return true;
  if (hostname.includes("xn--")) return true;
  if (lowerUrl !== lowerFinal) return true;
  if (/[?&](?:token|session|auth|password|redirect|next)=/i.test(lowerUrl)) return true;
  if (/(login|signin|verify|verification|secure|account|payment|checkout|wallet|recovery|claim|gift|crypto|password|otp|invoice)/i.test(lowerUrl)) return true;

  // Page-level signals from the already-fetched HTML/text. These do not make a
  // verdict themselves; they only decide whether the expensive reputation
  // databases are worth consulting.
  if (/(password|one[- ]time code|verification code|credit card|bank account|seed phrase|recovery phrase|connect wallet|send crypto|gift card|remote access)/i.test(content)) return true;
  if (/(urgent|act now|expires today|account suspended|account will be closed|confirm immediately)/i.test(content)) return true;

  return false;
}

async function getVirusTotalReport(url: string): Promise<VirusTotalReport | null> {
  const apiKey = Deno.env.get("VIRUSTOTAL_API_KEY");
  if (!apiKey) return null;

  try {
    const urlBytes = new TextEncoder().encode(url);
    let binary = "";
    for (let i = 0; i < urlBytes.length; i++) binary += String.fromCharCode(urlBytes[i]);
    const base64 = btoa(binary);
    const urlId = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const response = await fetch(`https://www.virustotal.com/api/v3/urls/${urlId}`, {
      headers: { "x-apikey": apiKey },
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
      total_engines:
        (stats.malicious || 0) +
        (stats.suspicious || 0) +
        (stats.harmless || 0) +
        (stats.undetected || 0),
      reputation: attrs.reputation || 0,
      categories: attrs.categories || {},
    };
  } catch {
    return null;
  }
}

export async function getThreatIntel(base44: any, url: string, ttlHours = 24): Promise<ThreatIntelResult> {
  const key = canonicalizeUrl(url);
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    const cached = await base44.asServiceRole.entities.UrlThreatCache.filter({ normalized_url: key });
    const fresh = cached?.[0] && new Date(cached[0].expires_at).getTime() > now.getTime();
    if (fresh) {
      return {
        virustotal: cached[0].virustotal || null,
        urlhaus: cached[0].urlhaus || null,
        cached: true,
      };
    }
  } catch {
    // Cache is an optimization only. Never make scanning fail because it is unavailable.
  }

  const [virustotal, urlhaus] = await Promise.all([
    getVirusTotalReport(key),
    getUrlhausReport(key),
  ]);

  const expires = new Date(now.getTime() + ttlHours * 60 * 60 * 1000).toISOString();
  try {
    const existing = await base44.asServiceRole.entities.UrlThreatCache.filter({ normalized_url: key });
    const payload = {
      normalized_url: key,
      virustotal,
      urlhaus,
      checked_at: nowIso,
      expires_at: expires,
    };
    if (existing?.[0]) {
      await base44.asServiceRole.entities.UrlThreatCache.update(existing[0].id, payload);
    } else {
      await base44.asServiceRole.entities.UrlThreatCache.create(payload);
    }
  } catch {
    // Best effort; the fresh lookup result is still returned.
  }

  return { virustotal, urlhaus, cached: false };
}

export function hasKnownThreat(intel: ThreatIntelResult): boolean {
  return !!intel.urlhaus?.listed || !!intel.virustotal && intel.virustotal.malicious >= 5;
}
