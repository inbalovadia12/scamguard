import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

// === Phone format generation ===

function normalizePhoneDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function detectCallingCode(digits: string): string {
  for (const code of ["971", "44", "61", "81", "1"]) {
    if (digits.startsWith(code) && digits.length > code.length + 6) return code;
  }
  return "";
}

function generateFormats(rawPhone: string) {
  const digits = normalizePhoneDigits(rawPhone);
  const callingCode = detectCallingCode(digits);
  const nationalDigits = callingCode ? digits.slice(callingCode.length) : digits;
  const hasTrunkZero = ["44", "61", "81", "971"].includes(callingCode);
  const nationalWithTrunk = hasTrunkZero ? "0" + nationalDigits : nationalDigits;

  // Extract the national format from the original phone string (preserves user spacing)
  const originalNoCc = rawPhone.replace(/^\+?\d{1,3}\s*/, "").trim();
  const nationalSpacedRaw = /\s/.test(originalNoCc) && originalNoCc.length >= 7
    ? originalNoCc
    : nationalWithTrunk;

  // For countries with trunk zeros, ensure the spaced format starts with 0
  const nationalSpaced = hasTrunkZero && !nationalSpacedRaw.startsWith("0")
    ? "0" + nationalSpacedRaw
    : nationalSpacedRaw;

  const nationalHyphenated = nationalSpaced.replace(/\s/g, "-");

  return {
    digits,
    callingCode,
    nationalDigits,
    nationalWithTrunk,
    nationalSpaced,
    nationalHyphenated,
    hasTrunkZero,
  };
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

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// === Search engines ===

async function searchBingRss(query: string, timeoutMs = 8000) {
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "application/rss+xml,text/xml,application/xml,*/*",
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

async function searchDuckDuckGo(query: string, timeoutMs = 8000) {
  // Try the lite endpoint with a browser UA — the html endpoint returns HTTP 202 (CAPTCHA)
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,*/*",
      },
    });
    const html = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const results: any[] = [];
    // DDG lite puts results in <a class="result-link" href="..."> tags
    // and snippets in <td class="result-snippet"> tags
    const linkRegex = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

    const links: RegExpExecArray[] = [];
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) links.push(linkMatch);
    const snippets: string[] = [];
    let snippetMatch;
    while ((snippetMatch = snippetRegex.exec(html)) !== null) {
      snippets.push(decodeHtml(snippetMatch[1]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    }

    for (let i = 0; i < Math.min(links.length, 10); i++) {
      const rawHref = decodeHtml(links[i][1]).trim();
      const title = decodeHtml(links[i][2]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const snippet = (snippets[i] || "").slice(0, 500);
      if (title && rawHref) results.push({ title: title.slice(0, 300), snippet, url: rawHref, engine: "duckduckgo" });
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

// === Phone number verification ===

function extractPhoneLikeTokens(text: string) {
  const cleaned = String(text || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  const tokens: string[] = [];

  // 1. Match phone numbers without spaces (hyphens, dots, parens only).
  //    This cannot cross multiple space-separated numbers.
  const noSpace = cleaned.match(/\+?\(?\d[\d().-]{5,}\d/g) || [];
  for (const m of noSpace) {
    const d = m.replace(/\D/g, "");
    if (d.length >= 7 && d.length <= 15) tokens.push(m);
  }

  // 2. For spaced formats, split on double spaces (which typically separate
  //    different content blocks on a page) and match within each chunk.
  const chunks = cleaned.split(/\s{2,}/);
  for (const chunk of chunks) {
    const spaced = chunk.match(/\+?\(?\d[\d\s().-]{5,}\d/g) || [];
    for (const m of spaced) {
      const d = m.replace(/\D/g, "");
      if (d.length >= 7 && d.length <= 15) tokens.push(m);
    }
  }

  return tokens;
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

// === Main handler ===

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone ?? body?.phone_number ?? "").trim();
    if (!phone) return Response.json({ error: "Phone number is required." }, { status: 400 });

    const formats = generateFormats(phone);
    const { digits, callingCode, nationalDigits, nationalWithTrunk, nationalSpaced, nationalHyphenated, hasTrunkZero } = formats;

    // Target forms for exact-number verification (digit-based)
    const targetForms = Array.from(new Set([
      digits,                                                    // "18006927753"
      nationalDigits,                                            // "8006927753"
      nationalWithTrunk,                                         // "08000480408" (UK) or "8006927753" (US)
      "00" + digits,                                             // "0018006927753"
      hasTrunkZero ? callingCode + nationalWithTrunk : null,    // "4408000480408" (UK, cc+trunk+national)
    ].filter((value) => Boolean(value) && value.length >= 7)));

    // Search queries — NO quotes around digits, NO OR-suffix on primary queries.
    // Bing RSS ignores quoted digit phrases and treats OR-suffix as the main query,
    // returning irrelevant results. Using plain digits + single keyword gives
    // AND semantics so Bing only returns pages that actually contain the number.
    const searches = [
      nationalSpaced,                              // "800 692 7753" or "0800 048 0408" — common written format
      nationalHyphenated,                          // "800-692-7753" or "0800-048-0408" — hyphenated format
      nationalWithTrunk + " scam",                 // "8006927753 scam" — scam reports
      digits + " scam",                            // "18006927753 scam" — full international digits + scam
      nationalWithTrunk + " who called",           // "8006927753 who called" — who-called sites
      nationalWithTrunk + " support",              // "8006927753 support" — official support pages
      "site:reddit.com " + nationalWithTrunk,     // "site:reddit.com 8006927753" — Reddit
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

    // Round-robin across queries so one broad query cannot fill the limit
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
    const unique = roundRobin.slice(0, 16);

    const verified = await Promise.all(unique.map(async (r) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        try {
          const page = await fetch(r.url, {
            signal: controller.signal,
            headers: {
              "User-Agent": BROWSER_UA,
              "Accept-Language": "en-US,en;q=0.9",
              "Accept": "text/html,application/xhtml+xml,*/*",
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

    // LLM-based supplementary search: if direct search found too few verified
    // results, use Gemini's web search (add_context_from_internet) to find
    // official support pages and scam reports that Bing RSS missed.
    // Gemini has access to Google Search, which indexes pages far more
    // effectively than the Bing RSS endpoint for specific phone numbers.
    let llmSupplementary: any = { used: false, candidates_found: 0, candidates_verified: 0, error: null };
    const directVerifiedCount = verified.filter((r) => r.verified_exact_number).length;
    if (directVerifiedCount < 2) {
      try {
        const llmResult = await base44.integrations.Core.InvokeLLM({
          prompt: `Search the web for the exact phone number "${phone}" (digits: ${digits}). Find pages that contain this exact phone number:\n1. Official support or contact pages (e.g., Apple, Microsoft, Beats support pages)\n2. Scam report or "who called" pages that mention this exact number\n3. Reddit or community discussions about this number\n\nFor each page you found that contains the exact phone number, return the full URL, a brief title, and the business name if it is an official support page. Only include pages where you actually found the exact phone number on the page.`,
          add_context_from_internet: true,
          model: "gemini_3_flash",
          response_json_schema: {
            type: "object",
            properties: {
              candidates: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    title: { type: "string" },
                    business_name: { type: "string" },
                  },
                },
              },
            },
          },
        });

        const llmCandidates = Array.isArray(llmResult?.candidates) ? llmResult.candidates : [];
        llmSupplementary.used = true;
        llmSupplementary.candidates_found = llmCandidates.length;

        // Verify each LLM-returned URL by fetching the page and checking for the exact number
        const llmVerified = await Promise.all(llmCandidates.slice(0, 6).map(async (c: any) => {
          const url = String(c?.url || "").trim();
          if (!url || seenUrls.has(url)) return null;
          seenUrls.add(url);
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 6000);
            try {
              const page = await fetch(url, {
                signal: controller.signal,
                headers: {
                  "User-Agent": BROWSER_UA,
                  "Accept-Language": "en-US,en;q=0.9",
                  "Accept": "text/html,application/xhtml+xml,*/*",
                },
              });
              const html = await page.text();
              const pageExact = page.ok && containsExactPhone(html, targetForms);
              const searchExact = containsExactPhone(String(c?.title || ""), targetForms);
              return {
                title: String(c?.title || "").slice(0, 300),
                snippet: "",
                url,
                engine: "llm_supplementary",
                matched_query: "llm_web_search",
                business_name_hint: c?.business_name || null,
                verified_exact_number: pageExact || searchExact,
                verification_method: pageExact ? "page" : searchExact ? "search_result" : "none",
                verification_status: pageExact || searchExact ? "verified" : "not_verified",
              };
            } finally {
              clearTimeout(timer);
            }
          } catch (error: any) {
            return {
              title: String(c?.title || "").slice(0, 300),
              snippet: "",
              url,
              engine: "llm_supplementary",
              matched_query: "llm_web_search",
              business_name_hint: c?.business_name || null,
              verified_exact_number: false,
              verification_status: "verification_failed",
              verification_error: error?.message || "Page fetch failed",
            };
          }
        }));

        const validLlmResults = llmVerified.filter((r) => r !== null);
        llmSupplementary.candidates_verified = validLlmResults.filter((r) => r.verified_exact_number).length;
        verified.push(...validLlmResults);
      } catch (error: any) {
        llmSupplementary.error = error?.message || "LLM supplementary search failed";
      }
    }

    return Response.json({
      phone,
      query_variants: [nationalSpaced, nationalHyphenated, nationalWithTrunk, digits],
      searches,
      results: verified,
      result_count: verified.length,
      raw_search_result_count: roundRobin.length,
      page_checked_count: verified.length,
      verified_result_count: verified.filter((r) => r.verified_exact_number).length,
      search_query_count: searches.length,
      search_engine_diagnostics: engineDiagnostics,
      llm_supplementary_search: llmSupplementary,
      verification_failure_count: verified.filter((r) => r.verification_status === "verification_failed" || r.verification_status === "not_verified").length,
      note: "Web results count as evidence only when the fetched page or the direct search result title/snippet contains an exact normalized phone-number token. Queries use plain digits (no quotes, no OR-suffix) so Bing applies AND semantics. If direct search finds <2 verified results, an LLM-based supplementary web search (Gemini) is used to find official support pages and scam reports. International, national-trunk, and optional-trunk formats are normalized before comparing.",
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Web phone evidence search failed" }, { status: 500 });
  }
});