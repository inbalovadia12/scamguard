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

async function searchWeb(query: string, timeoutMs = 9000) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=10`;
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
    let cursor = 0;
    while (results.length < 10) {
      const marker = html.indexOf("b_algo", cursor);
      if (marker < 0) break;
      const blockEnd = html.indexOf("b_algo", marker + 6);
      const block = html.slice(marker, blockEnd > marker ? blockEnd : marker + 12000);
      const hrefPos = block.indexOf('href="');
      if (hrefPos >= 0) {
        const hrefStart = hrefPos + 6;
        const hrefEnd = block.indexOf('"', hrefStart);
        const link = hrefEnd > hrefStart ? block.slice(hrefStart, hrefEnd) : "";
        const h2Start = block.indexOf("<h2");
        const anchorStart = h2Start >= 0 ? block.indexOf(">", h2Start) + 1 : -1;
        const titleEnd = anchorStart > 0 ? block.indexOf("</a>", anchorStart) : -1;
        const title = titleEnd > anchorStart
          ? block.slice(anchorStart, titleEnd)
              .replace(/<[^>]+>/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/\s+/g, " ")
              .trim()
          : "";
        if (link && title) {
          results.push({ title: title.slice(0, 300), url: link });
        }
      }
      cursor = marker + 6;
    }
    return results;
  } finally {
    clearTimeout(timer);
  }
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

    const settled = await Promise.allSettled(searches.map((q) => searchWeb(q)));
    const results = settled.flatMap((r) => r.status === "fulfilled" ? r.value : []);
    const searchErrors = settled
      .map((r, index) => r.status === "rejected" ? { query: searches[index], error: r.reason?.message || "Search failed" } : null)
      .filter(Boolean);
    const unique = Array.from(new Map(results.map((r) => [r.url, r])).values()).slice(0, 30);

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
          const exact = containsExactPhone(html, targetForms);
          return {
            ...r,
            verified_exact_number: exact,
            verification_status: exact ? "verified" : "not_verified",
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
      search_errors: searchErrors,
      note: "Web results count as evidence only when the fetched page contains an exact normalized phone-number token. Search-result titles alone never establish evidence.",
    
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Web phone evidence search failed" }, { status: 500 });
  }
});
