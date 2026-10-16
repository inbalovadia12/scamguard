import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { checkEmergencyFromRaw } from "../../shared/emergencyNumbers.ts";

function normalizePhone(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  const digits = value.replace(/\D/g, "");
  // Allow short emergency/government numbers (3-6 digits) as well as standard
  // phone numbers (7-15 digits). Emergency numbers are validated separately.
  if (!digits) return null;
  if (digits.length < 3 || digits.length > 15) return null;
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
    const rawPhone = String(body?.phone_number ?? body?.phone ?? "").trim();
    const normalized = normalizePhone(rawPhone);
    if (!normalized) {
      return Response.json({ error: "Enter a valid phone number." }, { status: 400 });
    }

    // Check for known emergency/government short codes (911, 100, 999, etc.)
    const emergency = checkEmergencyFromRaw(rawPhone);
    if (emergency) {
      return Response.json({
        normalized_number: normalized,
        is_emergency_number: true,
        emergency_info: {
          number: emergency.number,
          service: emergency.service,
          type: emergency.type,
          countries: emergency.countries,
        },
        sources: {
          numbers_online: { status: "not_applicable" },
          scamcallcheck: { status: "not_applicable" },
          usa_caller_lookup: { status: "not_applicable" },
        },
        source_errors: [],
      });
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

    // Run independent sources concurrently so one slow provider does not block the others.
    const jobs: Promise<void>[] = [];

    if (numbersOnlineKey) {
      jobs.push((async () => {
        try {
          const data = await fetchJson(
            `https://numbers.online/api/v1/lookup/${encodeURIComponent(normalized)}`,
            { headers: { "X-API-Key": numbersOnlineKey } },
            7000
          );
          results.sources.numbers_online = {
            status: "ok",
            data,
            source_url: "https://numbers.online"
          };
        } catch (error: any) {
          const message = error?.message || "Lookup failed";
          results.sources.numbers_online = { status: "error", error: message };
          results.source_errors.push({ source: "numbers_online", error: message });
        }
      })());
    }

    jobs.push((async () => {
      try {
        const data = await fetchJson(
          `https://scamcallcheck.com/api/number/${encodeURIComponent(numberDigits(normalized))}`,
          {},
          7000
        );
        results.sources.scamcallcheck = {
          status: "ok",
          data,
          source_url: `https://scamcallcheck.com/number/${encodeURIComponent(numberDigits(normalized))}`
        };
      } catch (error: any) {
        const message = error?.message || "Lookup failed";
        results.sources.scamcallcheck = { status: "error", error: message };
        results.source_errors.push({ source: "scamcallcheck", error: message });
      }
    })());

    if (isUsNumber(normalized)) {
      jobs.push((async () => {
        try {
          const usDigits = normalized.slice(2);
          const data = await fetchJson(
            `https://www.usacallerlookup.com/wp-json/ucl/v1/number/${encodeURIComponent(usDigits)}`,
            {},
            7000
          );
          results.sources.usa_caller_lookup = {
            status: "ok",
            data,
            source_url: data?.page || `https://www.usacallerlookup.com/${usDigits}/`
          };
        } catch (error: any) {
          const message = error?.message || "Lookup failed";
          results.sources.usa_caller_lookup = { status: "error", error: message };
          results.source_errors.push({ source: "usa_caller_lookup", error: message });
        }
      })());
    }

    await Promise.allSettled(jobs);

    // Return only source data. No Vardin verdict or score is generated here.
    return Response.json(results);
  } catch (error: any) {
    return Response.json({ error: error?.message || "Phone source lookup failed" }, { status: 500 });
  }
});