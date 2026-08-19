import { secrets } from "base44:runtime";

export const PAYPAL_API_BASE = "https://api-m.paypal.com";

export async function getAccessToken(): Promise<string> {
  const clientId = secrets.get("PAYPAL_CLIENT_ID");
  const clientSecret = secrets.get("PAYPAL_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("PayPal credentials not configured");
  const auth = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PayPal token error: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return data.access_token;
}

export function findApprovalLink(subscription: any): string | null {
  const link = (subscription.links || []).find((l: any) => l.rel === "approve" || l.rel === "payer-action");
  return link?.href || null;
}