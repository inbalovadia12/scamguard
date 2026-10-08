import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

function digitsVariants(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withoutUsCountry = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
  return Array.from(new Set([
    phone,
    digits,
    "+" + digits,
    withoutUsCountry,
    "+" + withoutUsCountry,
  ])).filter(Boolean);
}

function normalizePhoneDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function extractPhoneLikeTokens(text: string) {
  return String(text || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .match(/\+?\d[\d\s().-]{5,}\d/g) || [];
}

function containsExactPhone(text: string, targetForms: string[]) {
  const tokens = extractPhoneLikeTokens(text);
  return tokens.some((token) => {
    const digits = normalizePhoneDigits(token);
    return targetForms.some((target) => {
      if (digits === target) return true;
      return digits.startsWith("1") && digits.slice(1) === target;
    });
  });
}

function decodeHtml(value: string) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/");
}

async function searchBingRss(query: string, timeoutMs = 7000) {
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VardinScamGuard/1.0)",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const xml = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const results: any[] = [];
    const items = xml.match(/<item>[\\s\\S]*?<\\/item>/gi) || [];
    for (const item of items.slice(0, 10)) {
      const titleMatch = item.match(/<title>([\\s\\S]*?)<\\/title>/i);
      const linkMatch = item.match(/<link>([\\s\\S]*?)<\\/link>/i);
      const descMatch = item.match(/<description>([\\s\\S]*?)<\\/description>/i);
      const title = decodeHtml(titleMatch?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
      const urlValue = decodeHtml(linkMatch?.[1] || "").trim();
      const snippet = decodeHtml(descMatch?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
      if (title && urlValue) results.push({ title: title.slice(0, 300), snippet: snippet.slice(0, 500), url: urlValue, engine: "bing" });
    }
    return results;
  } finally {
    clearTimeout(timer);
  }
}

async function searchDuckDuckGo(query: string, timeoutMs = 7000) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VardinScamGuard/1.0)",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const results: any[] = [];
    const blocks = html.split(/<div[^>]+class="result[^"]*"[^>]*>/i).slice(1);
    for (const block of blocks.slice(0, 10)) {
      const hrefMatch = block.match(/class="result__a"[^>]+href="([^"]+)"/i);
      const titleMatch = block.match(/class="result__a"[^>]*>([\\s\\S]*?)<\\/a>/i);
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\\s\\S]*?)<\\/a>|class="result__snippet"[^>]*>([\\s\\S]*?)<\\/div>/i);
      const title = decodeHtml(titleMatch?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
      const rawHref = decodeHtml(hrefMatch?.[1] || "").trim();
      const snippet = decodeHtml(snippetMatch?.[1] || snippetMatch?.[2] || "").replace(/<[^>]+>/g, " ").replace(/\\s+/g, " ").trim();
      let resultUrl = rawHref;
      try {
        const parsed = new URL(rawHref, "https://html.duckduckgo.com");
        const uddg = parsed.searchParams.get("uddg");
        if (uddg) resultUrl = decodeURIComponent(uddg);
      } catch {}
      if (title && resultUrl) results.push({ title: title.slice(0, 300), snippet: snippet.slice(0, 500), url: resultUrl, engine: "duckduckgo" });
    }
    return results;
  } finally {
    clearTimeout(timer);
  }
}

async function searchWeb(query: string) {
  const settled = await Promise.allSettled([
    searchBingRss(query),
    searchDuckDuckGo(query),
  ]);
  return settled.flatMap((item) => item.status === "fulfilled" ? item.value : []);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone ?? body?.phone_number ?? "").trim();
    if (!phone) return Response.json({ error: "Phone number is required." }, { status: 400 });

    const variants = digitsVariants(phone);
    const digitsOnly = normalizePhoneDigits(phone);
    const searches = [
      `"${variants[0]}" scam OR fraud OR spam OR robocall`,
      `"${variants[1]}" scam OR fraud OR spam OR robocall`,
      `"${variants[0]}" review OR "who called"`,
      `"${variants[0]}" "customer service" OR business OR company`,
      `site:who-called.co.uk/Number "${variants[1]}"`,
      `site:truecaller.com/who-called-me "${digitsOnly}"`,
      `site:reddit.com/r/ScamNumbers "${digitsOnly}"`,
      `site:reddit.com/r/scams "${digitsOnly}" phone`,
    ];

    const searchResults = await Promise.all(searches.map((q) => searchWeb(q).catch(() => [])));
    const results = searchResults.flat();
    const unique = Array.from(new Map(results.map((r) => [r.url, r])).values()).slice(0, 16);

    const targetDigits = normalizePhoneDigits(phone);
    const targetWithoutCountry = targetDigits.startsWith("1") && targetDigits.length === 11 ? targetDigits.slice(1) : targetDigits;
    const targetForms = Array.from(new Set([targetDigits, targetWithoutCountry].filter((v) => v.length >= 7)));

    const verified = await Promise.all(unique.map(async (r) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        try {
          const page = await fetch(r.url, {
            signal: controller.signal,
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; VardinScamGuard/1.0)",
              "Accept-Language": "en-US,en;q=0.9",
            },
          });
          const html = await page.text();
          const pageExact = containsExactPhone(html, targetForms);
          const searchExact = containsExactPhone([r.title, r.snippet].filter(Boolean).join(" "), targetForms);
          return {
            ...r,
            verified_exact_number: pageExact || searchExact,
            verification_method: pageExact ? "page" : searchExact ? "search_result" : "none",
            verification_status: pageExact || searchExact ? "verified" : "not_verified",
          };
        } finally {
          clearTimeout(timer);
        }
      } catch (error: any) {
        return { ...r, verified_exact_number: false, verification_status: "verification_failed", verification_error: error?.message || "Page fetch failed" };
      }
    }));

    return Response.json({
      phone,
      query_variants: variants,
      searches,
      results: verified,
      result_count: verified.length,
      verified_result_count: verified.filter((r) => r.verified_exact_number).length,
      note: "Web results count as evidence only when the fetched page or the direct search result title/snippet contains an exact normalized phone-number token. Search-result-only evidence is retained with a lower verification method."
    ",
    
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Web phone evidence search failed" }, { status: 500 });
  }
});
