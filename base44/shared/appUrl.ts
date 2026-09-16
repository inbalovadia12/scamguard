// Canonical production URL + safe return-URL helper.
//
// The app is published at vardin.base44.app and may also be served from a
// custom domain (e.g. vardin.base44.app). PayPal return/cancel URLs must point to
// a domain the user is actually on, otherwise the post-approval redirect
// breaks. We therefore trust the request origin when it is on our allowlist,
// and fall back to the canonical public URL otherwise.

export const CANONICAL_APP_URL = "https://vardin.base44.app";

// Domains we consider "ours" for return-URL construction. Keep this in sync
// with any custom domain connected to the app.
const ALLOWED_ORIGINS = new Set<string>([
  "https://vardin.base44.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

// Returns a safe base URL for building return/cancel URLs. Prefers the
// verified request origin, falls back to the canonical public URL.
export function safeAppOrigin(requestOrigin: string | null): string {
  if (requestOrigin) {
    const normalized = requestOrigin.replace(/\/$/, "");
    if (ALLOWED_ORIGINS.has(normalized)) return normalized;
  }
  return CANONICAL_APP_URL;
}

export function buildReturnUrl(requestOrigin: string | null, path: string): string {
  return `${safeAppOrigin(requestOrigin)}${path}`;
}