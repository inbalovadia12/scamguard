import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

function digitsVariants(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const withoutUsCountry = digits.startsWith("1") && digits.length === 11 ? digits.slice(1) : digits;
  const countryNational = digits.startsWith("44") || digits.startsWith("61") || digits.startsWith("81") || digits.startsWith("971")
    ? "0" + digits.slice(digits.startsWith("971") ? 3 : 2)
    : null;
  return Array.from(new Set([
    phone,
    digits,
    "+" + digits,
    withoutUsCountry,
    "+" + withoutUsCountry,
    countryNational,
  ].filter(Boolean))).filter(Boolean);
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
  const targets = new Set(targetForms.map(normalizePhoneDigits).filter(Boolean));
  return tokens.some((token) => {
    let digits = normalizePhoneDigits(token);
    if (digits.startsWith("00")) digits = digits.slice(2);
    if (targets.has(digits)) return true;
    for (const code of ["971", "44", "61", "81"]) {
      for (const target of targets) {
        if (!target.startsWith(code) || target.length <= code.length + 6) continue;
        const national = target.slice(code.length);
        if (digits === code + "0" + national) return true;
        if (digits === "0" + national || digits === national) return true;
      }
    }
    return Array.from(targets).some((target) =>
      target.startsWith("1") && digits === target.slice(1)
    );
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
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    for (const item of items.slice(0, 10)) {
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/i);
      const descMatch = item.match(/<description>([\s\S]*?)<\/description>/i);
      const title = decodeHtml(titleMatch?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const urlValue = decodeHtml(linkMatch?.[1] || "").trim();
      const snippet = decodeHtml(descMatch?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
      const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>|class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
      const title = decodeHtml(titleMatch?.[1] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const rawHref = decodeHtml(hrefMatch?.[1] || "").trim();
      const snippet = decodeHtml(snippetMatch?.[1] || snippetMatch?.[2] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
  const describe = (item: PromiseSettledResult<any[]>) => item.status === "fulfilled"
    ? { ok: true, result_count: item.value.length, error: null, results: item.value }
    : { ok: false, result_count: 0, error: (item.reason as any)?.message || String(item.reason || "Search failed"), results: [] as any[] };
  const bing = describe(settled[0]);
  const duckduckgo = describe(settled[1]);
  const results: any[] = [];
  for (let index = 0; index < Math.max(bing.results.length, duckduckgo.results.length); index += 1) {
    if (bing.results[index]) results.push(bing.results[index]);
    if (duckduckgo.results[index]) results.push(duckduckgo.results[index]);
  }
  return {
    results,
    engines: {
      bing: { ok: bing.ok, result_count: bing.result_count, error: bing.error },
      duckduckgo: { ok: duckduckgo.ok, result_count: duckduckgo.result_count, error: duckduckgo.error },
    },
  };
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
    const targetDigits = normalizePhoneDigits(phone);
    const callingCode = ["971", "44", "61", "81", "1"].find((code) => targetDigits.startsWith(code)) || "";
    const targetNational = callingCode ? targetDigits.slice(callingCode.length) : targetDigits;
    const targetWithoutCountry = targetDigits.startsWith("1") && targetDigits.length == 11 ? targetDigits.slice(1) : targetDigits;
    const nationalFormatted = callingCode && callingCode !== "1" ? "0" + targetNational : null;
    const targetForms = Array.from(new Set([
      targetDigits,
      targetWithoutCountry,
      "00" + targetDigits,
      targetNational,
      nationalFormatted,
      callingCode ? callingCode + "0" + targetNational : null,
    ].filter((value) => Boolean(value) && value.length >= 7)));

    const searches = [
      '"' + variants[0] + '" scam OR fraud OR spam OR robocall',
      '"' + variants[1] + '" scam OR fraud OR spam OR robocall',
      '"' + (nationalFormatted || variants[variants.length - 1]) + '" scam OR fraud OR spam',
      '"' + variants[0] + '" review OR "who called" OR "customer service" OR support',
      'site:who-called.co.uk OR site:who-calls.co.uk OR site:phonely.co.uk "' + digitsOnly + '"',
      'site:reddit.com/r/ScamNumbers OR site:reddit.com/r/scams "' + digitsOnly + '" phone',
      '"' + variants[0] + '" official OR support OR company',
    ];

    const searchRuns = await Promise.all(searches.map(async (query) => {
      try {
        const outcome = await searchWeb(query);
        return { query, results: outcome.results, engines: outcome.engines };
      } catch (error: any) {
        const message = error?.message || "Search failed";
        return { query, results: [], engines: {
          bing: { ok: false, result_count: 0, error: message },
          duckduckgo: { ok: false, result_count: 0, error: message },
        }};
      }
    }));

    const engineDiagnostics: any = {
      bing: { attempted_queries: searches.length, successful_queries: 0, results_returned: 0, errors: [] as string[] },
      duckduckgo: { attempted_queries: searches.length, successful_queries: 0, results_returned: 0, errors: [] as string[] },
    };
    for (const run of searchRuns) {
      for (const engine of ["bing", "duckduckgo"] as const) {
        const detail = run.engines[engine];
        if (detail?.ok) engineDiagnostics[engine].successful_queries += 1;
        engineDiagnostics[engine].results_returned += Number(detail?.result_count || 0);
        if (detail?.error && engineDiagnostics[engine].errors.length < 5) engineDiagnostics[engine].errors.push(detail.error);
      }
    }

    const roundRobin: any[] = [];
    const seenUrls = new Set<string>();
    for (let rank = 0; rank < 12; rank += 1) {
      for (const run of searchRuns) {
        const candidate = run.results[rank];
        if (!candidate?.url || seenUrls.has(candidate.url)) continue;
        seenUrls.add(candidate.url);
        roundRobin.push({ ...candidate, matched_query: run.query });
      }
    }
    const unique = roundRobin.slice(0, 14);

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
          const pageExact = page.ok && containsExactPhone(html, targetForms);
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
      raw_search_result_count: roundRobin.length,
      page_checked_count: verified.length,
      verified_result_count: verified.filter((r) => r.verified_exact_number).length,
      search_query_count: searches.length,
      search_engine_diagnostics: engineDiagnostics,
      verification_failure_count: verified.filter((r) => r.verification_status === "verification_failed" || r.verification_status === "not_verified").length,
      note: "Web results count as evidence only when the fetched page or the direct search result title/snippet contains an exact normalized phone-number token. International, national-trunk, and optional-trunk formats are normalized before comparing; search-result-only evidence is retained with a lower verification method.",

    });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Web phone evidence search failed" }, { status: 500 });
  }
});
