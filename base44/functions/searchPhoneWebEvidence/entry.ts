import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

function digitsVariants(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return Array.from(new Set([
    phone,
    digits,
    digits.startsWith("1") ? "+" + digits : "+" + digits,
    digits.startsWith("1") ? digits.slice(1) : digits,
  ])).filter(Boolean);
}

async function searchWeb(query: string, timeoutMs = 9000) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`;
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
    const blocks = html.split(/<div[^>]*>/i);
    for (const block of blocks) {
      const link = block.match(/href="(https?:\/\/[^"]+)"/i)?.[1];
      const title = block.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
      if (!link || !title) continue;
      if (/google\./i.test(link) || link.startsWith("/")) continue;
      results.push({ title, url: link });
      if (results.length >= 10) break;
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
    const searches = [
      `"${variants[0]}" scam OR fraud OR spam OR robocall`,
      `"${variants[0]}" review OR "who called"`,
      `"${variants[0]}" Reddit scam`,
      `"${variants[1]}" scam OR fraud OR spam`,
    ];

    const settled = await Promise.allSettled(searches.map((q) => searchWeb(q)));
    const results = settled.flatMap((r) => r.status === "fulfilled" ? r.value : []);
    const unique = Array.from(new Map(results.map((r) => [r.url, r])).values()).slice(0, 30);
    const targetDigits = phone.replace(/\D/g, "");
    const targetWithoutCountry = targetDigits.startsWith("1") ? targetDigits.slice(1) : targetDigits;

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
          const bodyDigits = html.replace(/\D/g, "");
          const exact = bodyDigits.includes(targetDigits) ||
            (targetWithoutCountry.length >= 7 && bodyDigits.includes(targetWithoutCountry));
          return { ...r, verified_exact_number: exact, verification_status: exact ? "verified" : "not_verified" };
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
      note: "Web results are counted as evidence only when the fetched page contains the exact normalized phone number (or its national digits for NANP numbers). Search-result titles alone never establish evidence.",
    });
  } catch (error: any) {
    return Response.json({ error: error?.message || "Web phone evidence search failed" }, { status: 500 });
  }
});
