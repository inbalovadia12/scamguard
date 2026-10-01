import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";

function normalizePhone(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  const digits = value.replace(/\D/g, "");
  if (!digits || digits.length < 7 || digits.length > 15) return null;
  return "+" + digits;
}

function isUsNumber(e164: string): boolean {
  return /^\+1\d{10}$/.test(e164);
}

async function fetchJson(url: string, init: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function numberDigits(e164: string): string {
  return e164.replace(/^\+/, "");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const normalized = normalizePhone(body?.phone_number ?? body?.phone);
    if (!normalized) {
      return Response.json({ error: "Enter a valid phone number." }, { status: 400 });
    }

    const numbersOnlineKey = secrets.get("Numbers_Online");
    const results: any = {
      normalized_number: normalized,
      sources: {
        numbers_online: { status: "not_configured" },
        scamcallcheck: { status: "not_run" },
        usa_caller_lookup: { status: "not_applicable" },
      },
      source_errors: [],
    };

    // Source 1: Numbers Online. The key stays server-side.
    if (numbersOnlineKey) {
      try {
        const data = await fetchJson(
          `https://numbers.online/api/v1/lookup/${encodeURIComponent(normalized)}`,
          { headers: { "X-API-Key": numbersOnlineKey } }
        );
        results.sources.numbers_online = {
          status: "ok",
          data,
          source_url: "https://numbers.online"
        };
      } catch (error: any) {
        results.sources.numbers_online = { status: "error", error: error?.message || "Lookup failed" };
        results.source_errors.push({ source: "numbers_online", error: error?.message || "Lookup failed" });
      }
    }

    // Source 2: ScamCallCheck. Public single-number endpoint; no key.
    try {
      const data = await fetchJson(
        `https://scamcallcheck.com/api/number/${encodeURIComponent(numberDigits(normalized))}`
      );
      results.sources.scamcallcheck = {
        status: "ok",
        data,
        source_url: `https://scamcallcheck.com/number/${encodeURIComponent(numberDigits(normalized))}`
      };
    } catch (error: any) {
      results.sources.scamcallcheck = { status: "error", error: error?.message || "Lookup failed" };
      results.source_errors.push({ source: "scamcallcheck", error: error?.message || "Lookup failed" });
    }

    // Source 3: USACallerLookup. Only applicable to NANP +1 numbers.
    if (isUsNumber(normalized)) {
      try {
        const usDigits = normalized.slice(2);
        const data = await fetchJson(
          `https://www.usacallerlookup.com/wp-json/ucl/v1/number/${encodeURIComponent(usDigits)}`
        );
        results.sources.usa_caller_lookup = {
          status: "ok",
          data,
          source_url: data?.page || `https://www.usacallerlookup.com/${usDigits}/`
        };
      } catch (error: any) {
        results.sources.usa_caller_lookup = { status: "error", error: error?.message || "Lookup failed" };
        results.source_errors.push({ source: "usa_caller_lookup", error: error?.message || "Lookup failed" });
      }
    }

    // Return only source data. No Vardin verdict or score is generated here.
    return Response.json(results);
  } catch (error: any) {
    return Response.json({ error: error?.message || "Phone source lookup failed" }, { status: 500 });
  }
});
