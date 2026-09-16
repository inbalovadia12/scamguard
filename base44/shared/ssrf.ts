// SSRF-safe HTTP fetch for server-side URL scanning.
//
// Blocks private/internal IP ranges, validates every redirect destination,
// enforces a streamed maximum response size, and applies timeouts. Used by
// scanUrl and scanWebpage so the scanner cannot be used as an SSRF proxy or
// to exhaust memory with huge responses.

const MAX_REDIRECTS = 4;
const DEFAULT_TIMEOUT_MS = 6000;
// Hard cap on bytes read from the network. The scanner only needs page text,
// so 2 MB is generous and prevents memory exhaustion.
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

// True if the literal string is a private/loopback/link-local address.
// Handles decimal/octal-less forms; octal/hex IP encodings are normalized by
// the DNS resolver (we resolve the hostname and inspect the returned IPs).
export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const v = ip.toLowerCase().trim();

  // IPv6 loopback / unspecified / IPv4-mapped IPv6
  if (v === "::1" || v === "::" || v === "0:0:0:0:0:0:0:1") return true;
  if (v.startsWith("::ffff:")) {
    const mapped = v.slice(7);
    return isPrivateIp(mapped);
  }

  // IPv6 unique-local + link-local
  if (v.startsWith("fc") || v.startsWith("fd")) return true;
  if (v.startsWith("fe80")) return true;

  // IPv4 numeric forms
  // Normalize: some hosts send decimal/octal/hex octets. Parse each octet.
  const parts = v.split(".");
  if (parts.length === 4 && parts.every((p) => /^0?x[0-9a-f]+$/i.test(p) || /^0?[0-7]+$/.test(p) || /^[0-9]{1,3}$/.test(p))) {
    const octets = parts.map((p) => {
      if (/^0?x[0-9a-f]+$/i.test(p)) return parseInt(p, 16);
      if (/^0[0-7]+$/.test(p) && p.length > 1) return parseInt(p, 8);
      return parseInt(p, 10);
    });
    if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return true;
    const [a, b] = octets;
    if (a === 0) return true;            // 0.0.0.0/8
    if (a === 10) return true;           // 10.0.0.0/8
    if (a === 127) return true;          // 127.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  }

  // Bare hostname localhost
  if (v === "localhost" || v.endsWith(".localhost")) return true;
  return false;
}

export interface SafeFetchResult {
  ok: boolean;
  status: number;
  finalUrl: string;
  contentType: string | null;
  text: string;
  error?: string;
  redirectCount: number;
}

export interface SafeFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
}

// Resolve hostname and reject if any resolved address is private (DNS-pinning
// guard against DNS rebinding to internal IPs).
async function assertPublicHost(hostname: string): Promise<{ ok: boolean; error?: string; resolvedIp?: string }> {
  if (isPrivateIp(hostname)) return { ok: false, error: "Private/internal host blocked" };

  let resolvedIp: string | undefined;
  try {
    // @ts-ignore Deno available in function runtime
    const a = await Deno.resolveDns(hostname, "A");
    for (const ip of a) {
      if (isPrivateIp(ip)) return { ok: false, error: "Private/internal host blocked" };
    }
    if (a.length) resolvedIp = a[0];
  } catch {
    /* may be IPv6-only */
  }
  try {
    // @ts-ignore Deno available in function runtime
    const aaaa = await Deno.resolveDns(hostname, "AAAA");
    for (const ip of aaaa) {
      if (isPrivateIp(ip)) return { ok: false, error: "Private/internal host blocked" };
    }
    if (!resolvedIp && aaaa.length) resolvedIp = aaaa[0];
  } catch {
    /* ignore */
  }
  return { ok: true, resolvedIp };
}

// Stream-read a response body up to maxBytes, then stop. Prevents huge
// responses from being buffered into memory.
async function readBoundedText(res: Response, maxBytes: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    // No streaming reader available — fall back but slice to the limit.
    const t = await res.text();
    return t.length > maxBytes ? t.slice(0, maxBytes) : t;
  }
  const decoder = new TextDecoder();
  let received = 0;
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    out += decoder.decode(value, { stream: true });
    if (received >= maxBytes) {
      try { await reader.cancel(); } catch {}
      break;
    }
  }
  out += decoder.decode();
  return out.length > maxBytes ? out.slice(0, maxBytes) : out;
}

export async function safeFetchText(
  urlStr: string,
  opts: SafeFetchOptions = {}
): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? MAX_RESPONSE_BYTES;
  const maxRedirects = opts.maxRedirects ?? MAX_REDIRECTS;
  const baseHeaders = opts.headers ?? {
    "User-Agent": "Mozilla/5.0 (compatible; VardinScanner/1.0)",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  let currentUrl = urlStr;
  for (let i = 0; i <= maxRedirects; i++) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      return { ok: false, status: 0, finalUrl: currentUrl, contentType: null, text: "", error: "Invalid URL" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, status: 0, finalUrl: currentUrl, contentType: null, text: "", error: "Unsupported protocol" };
    }
    // Block credentials in the URL (user:pass@host)
    if (parsed.username || parsed.password) {
      return { ok: false, status: 0, finalUrl: currentUrl, contentType: null, text: "", error: "URL credentials not allowed" };
    }

    const hostCheck = await assertPublicHost(parsed.hostname);
    if (!hostCheck.ok) {
      return { ok: false, status: 0, finalUrl: currentUrl, contentType: null, text: "", error: hostCheck.error };
    }

    // DNS-pinning: fetch with the resolved IP and set Host header so we don't
    // re-resolve on the fetch itself (mitigates DNS rebinding).
    let fetchUrl = currentUrl;
    const fetchHeaders: Record<string, string> = { ...baseHeaders };
    if (hostCheck.resolvedIp) {
      const pinned = new URL(currentUrl);
      pinned.hostname = hostCheck.resolvedIp;
      fetchUrl = pinned.href;
      fetchHeaders["Host"] = parsed.hostname;
    }

    let res: Response;
    try {
      res = await fetch(fetchUrl, {
        headers: fetchHeaders,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e: any) {
      return { ok: false, status: 0, finalUrl: currentUrl, contentType: null, text: "", error: `Fetch failed: ${e?.message ?? "timeout"}` };
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        return { ok: false, status: res.status, finalUrl: currentUrl, contentType: null, text: "", error: "Redirect without location" };
      }
      currentUrl = new URL(location, currentUrl).href;
      continue;
    }

    if (!res.ok) {
      return { ok: false, status: res.status, finalUrl: currentUrl, contentType: res.headers.get("content-type"), text: "", error: `HTTP ${res.status}` };
    }

    // Enforce Content-Length when present.
    const contentLength = parseInt(res.headers.get("content-length") || "", 10);
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      try { await res.body?.cancel(); } catch {}
      return { ok: false, status: res.status, finalUrl: currentUrl, contentType: res.headers.get("content-type"), text: "", error: "Response too large" };
    }

    const text = await readBoundedText(res, maxBytes);
    return {
      ok: true,
      status: res.status,
      finalUrl: currentUrl,
      contentType: res.headers.get("content-type"),
      text,
      redirectCount: i,
    };
  }
  return { ok: false, status: 0, finalUrl: currentUrl, contentType: null, text: "", error: "Too many redirects" };
}