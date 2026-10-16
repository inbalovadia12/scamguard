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
  // UAE (971) does not use a trunk zero — national format is the same as
  // the digits after the country code (e.g., 800 444 1849, not 0800 444 1849).
  const hasTrunkZero = ["44", "61", "81"].includes(callingCode);
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

  // Generate additional spaced formats for numbers that don't have spaces in
  // the original. Search engines often index phone numbers with specific
  // spacing (e.g., Apple's support page shows "8000 444 1849"), and a plain
  // digit query like "80004441849" won't match those pages.
  const spacedVariants: string[] = [];
  if (!/\s/.test(originalNoCc) && nationalWithTrunk.length >= 8) {
    const nd = nationalWithTrunk;
    if (nd.length === 11) {
      spacedVariants.push(`${nd.slice(0, 4)} ${nd.slice(4, 7)} ${nd.slice(7)}`);  // 4-3-4
      spacedVariants.push(`${nd.slice(0, 3)} ${nd.slice(3, 7)} ${nd.slice(7)}`);  // 3-4-4
    } else if (nd.length === 10) {
      spacedVariants.push(`${nd.slice(0, 3)} ${nd.slice(3, 6)} ${nd.slice(6)}`);  // 3-3-4
      spacedVariants.push(`${nd.slice(0, 4)} ${nd.slice(4, 7)} ${nd.slice(7)}`);  // 4-3-3
    } else if (nd.length === 9) {
      spacedVariants.push(`${nd.slice(0, 3)} ${nd.slice(3, 6)} ${nd.slice(6)}`);  // 3-3-3
    }
  }

  return {
    digits,
    callingCode,
    nationalDigits,
    nationalWithTrunk,
    nationalSpaced,
    nationalHyphenated,
    spacedVariants,
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

// Phone directory / scam-report sites that aggregate numbers but are NOT
// official business sources. If all verified results come from these, the
// LLM supplementary search is triggered to find official support pages.
const DIRECTORY_DOMAINS = [
  "jpnumber", "800notes", "whocalls", "whocallsme", "callercomplaints",
  "whocalledus", "callcontrol", "nomorobo", "robocaller", "robokiller",
  "truecaller", "sync.me", "shouldianswer", "phoneowner", "reversephone",
  "yellowpages", "whitepages", "who-called", "callercheck", "numlookup",
  "411.com", "scamadviser", "scamchecker", "bizapedia", "whocall",
  "phonebook", "tel-directory", "numberguru", "spydialer", "usphonebook",
  "callfilter", "unknownphone",
];

function isDirectoryUrl(url: string): boolean {
  const host = String(url || "").toLowerCase();
  return DIRECTORY_DOMAINS.some((d) => host.includes(d));
}

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
    const { digits, callingCode, nationalDigits, nationalWithTrunk, nationalSpaced, nationalHyphenated, spacedVariants, hasTrunkZero } = formats;

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
      ...spacedVariants,                           // "8000 444 1849" — alternative spacings for numbers without spaces
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
    const directVerifiedResults = verified.filter((r) => r.verified_exact_number);
    const directVerifiedCount = directVerifiedResults.length;
    // Trigger LLM supplementary search when:
    // 1. Few verified results at all (< 2), OR
    // 2. All verified results are from phone directory sites (no official business page found)
    const allVerifiedFromDirectories = directVerifiedCount > 0 &&
      directVerifiedResults.every((r) => isDirectoryUrl(r.url));
    if (directVerifiedCount < 2 || allVerifiedFromDirectories) {
      try {
        // Generate common hyphenated formats so Gemini can find pages that
        // list the number with hyphens (e.g., "0120-435-500" for Japan 0120).
        // Use nationalWithTrunk (includes trunk zero) as it's the standard
        // national format that appears on official pages.
        const nd = nationalWithTrunk;
        const hyphenatedFormats = nd.length === 10
          ? [`${nd.slice(0, 4)}-${nd.slice(4, 7)}-${nd.slice(7)}`, `${nd.slice(0, 3)}-${nd.slice(3, 6)}-${nd.slice(6)}`]
          : nd.length === 11
            ? [`${nd.slice(0, 4)}-${nd.slice(4, 7)}-${nd.slice(7)}`, `${nd.slice(0, 3)}-${nd.slice(3, 7)}-${nd.slice(7)}`]
            : nd.length === 9
              ? [`${nd.slice(0, 3)}-${nd.slice(3, 6)}-${nd.slice(6)}`, `${nd.slice(0, 4)}-${nd.slice(4, 7)}-${nd.slice(7)}`]
              : [];
        const formatList = [phone, ...targetForms, ...hyphenatedFormats].filter((v, i, a) => v && a.indexOf(v) === i);
        const countryHint = callingCode
          ? { "971": "United Arab Emirates (UAE)", "44": "United Kingdom", "61": "Australia", "81": "Japan", "1": "United States" }[callingCode] || ""
          : "";
        const countryLine = countryHint ? `This phone number is from ${countryHint}. ` : "";
        const llmResult = await base44.integrations.Core.InvokeLLM({
          prompt: `${countryLine}Who does the phone number "${phone}" belong to? Search the web for this number (it may appear as ${formatList.join(", ")}). Tell me:\n1. The business or organization name associated with this number\n2. The URL of the official support or contact page where this number is listed (e.g., on apple.com, beatsbydre.com, microsoft.com, google.com, amazon.com)\n3. Any scam report or community discussion pages about this number\n\nReturn the business name, the official page URL, and any scam report URLs you found. Only include pages where you actually found the exact phone number. If you can identify the business but cannot find the exact URL, still return the business name.`,
          add_context_from_internet: true,
          model: "gemini_3_flash",
          response_json_schema: {
            type: "object",
            properties: {
              business_name: { type: "string" },
              official_url: { type: "string" },
              official_title: { type: "string" },
              scam_reports: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    url: { type: "string" },
                    title: { type: "string" },
                  },
                },
              },
            },
          },
        });

        // Build a unified candidate list from Gemini's structured response.
        // Filter out placeholder values like "Not found", "N/A", "Unknown".
        const INVALID_URL_VALUES = ["not found", "n/a", "na", "unknown", "none", "null", ""];
        function isValidLlmUrl(url: string): boolean {
          const u = String(url || "").trim().toLowerCase();
          return u.startsWith("http") && !INVALID_URL_VALUES.includes(u);
        }
        const llmCandidates: any[] = [];
        if (isValidLlmUrl(llmResult?.official_url)) {
          llmCandidates.push({
            url: llmResult.official_url,
            title: llmResult.official_title || "",
            business_name: llmResult.business_name || "",
          });
        }
        if (Array.isArray(llmResult?.scam_reports)) {
          for (const sr of llmResult.scam_reports) {
            if (isValidLlmUrl(sr?.url)) llmCandidates.push({ url: sr.url, title: sr.title || "", business_name: "" });
          }
        }
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

        // If the LLM identified a business name but returned no valid URL (or
        // the URL failed verification), still add a synthetic unverified result
        // carrying the business_name_hint. normalizePhoneEvidence uses this hint
        // as a fallback when no official page can be verified — the LLM has web
        // search context and can correctly identify the business even when the
        // exact phone number isn't on the page it found.
        const llmBusinessName = String(llmResult?.business_name || "").trim();
        const hasLlmHintResult = validLlmResults.some((r) => r.business_name_hint);
        if (llmBusinessName && !hasLlmHintResult) {
          verified.push({
            title: "",
            snippet: "",
            url: "",
            engine: "llm_supplementary",
            matched_query: "llm_web_search",
            business_name_hint: llmBusinessName,
            verified_exact_number: false,
            verification_method: "none",
            verification_status: "not_verified",
          });
        }
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