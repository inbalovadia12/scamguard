// Shared PayPal REST client. Reads credentials server-side only and never
// exposes them. Used by subscription + credit-purchase + webhook functions so
// token retrieval + error handling is consistent.

import { secrets } from "base44:runtime";

const PAYPAL_API_BASE = readSecret("PAYPAL_ENV") === "sandbox"
  ? "https://api-m.sandbox.paypal.com"
  : "https://api-m.paypal.com";

function readSecret(name: string): string | undefined {
  // Prefer the platform secrets API; fall back to env. Both are server-side
  // only; the value is never returned or logged.
  try {
    const v = secrets?.get?.(name);
    if (v) return v as string;
  } catch {
    /* fall through */
  }
  // @ts-ignore — Deno is available in function runtime
  if (typeof Deno !== "undefined" && Deno.env) {
    return Deno.env.get(name);
  }
  return undefined;
}

export function getPaypalCredentials(): { clientId: string; clientSecret: string } {
  const clientId = readSecret("PAYPAL_CLIENT_ID");
  const clientSecret = readSecret("PAYPAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }
  return { clientId, clientSecret };
}

export function getPaypalWebhookId(): string | null {
  return readSecret("PAYPAL_WEBHOOK_ID") || null;
}

export async function getPaypalAccessToken(): Promise<string> {
  const { clientId, clientSecret } = getPaypalCredentials();
  const auth = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`PayPal token error: ${res.status}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

export const PAYPAL_API = PAYPAL_API_BASE;