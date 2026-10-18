// Shared PayPal REST client. Reads credentials server-side only and never
// exposes them. Used by subscription + credit-purchase + webhook functions so
// token retrieval + error handling is consistent.

import { secrets } from "base44:runtime";

// Production PayPal API. If sandbox testing is needed, add a PAYPAL_ENV
// secret set to "sandbox" — but it's not required for normal operation.
const PAYPAL_API_BASE = (() => {
  try {
    if (secrets?.get?.("PAYPAL_ENV") === "sandbox") return "https://api-m.sandbox.paypal.com";
  } catch {}
  return "https://api-m.paypal.com";
})();

export function getPaypalCredentials(): { clientId: string; clientSecret: string } {
  const clientId = secrets.get("PAYPAL_CLIENT_ID") as string | undefined;
  const clientSecret = secrets.get("PAYPAL_CLIENT_SECRET") as string | undefined;
  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }
  return { clientId, clientSecret };
}

export function getPaypalWebhookId(): string | null {
  return (secrets.get("PAYPAL_WEBHOOK_ID") as string | undefined) || null;
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