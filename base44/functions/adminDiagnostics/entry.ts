import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from "base44:runtime";

// Admin-only secrets/configuration diagnostic. Reports whether each required
// external-service secret is PRESENT or MISSING without ever revealing the
// value. Only authenticated admins can call it.

const REQUIRED_SECRETS = [
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "ASSEMBLYAI_API_KEY",
  "URLHAUS_AUTH_KEY",
  "VIRUSTOTAL_API_KEY",
  "LIVE_CALLER_ID_TOKEN_ISSUER_KEY",
];

function readSecret(name: string): boolean {
  try {
    const v = secrets?.get?.(name);
    if (v) return true;
  } catch {
    /* fall through */
  }
  // @ts-ignore Deno available in function runtime
  if (typeof Deno !== "undefined" && Deno.env) {
    return !!Deno.env.get(name);
  }
  return false;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const secrets = REQUIRED_SECRETS.map((name) => ({
      name,
      status: readSecret(name) ? "SET" : "MISSING",
    }));

    const missing = secrets.filter((s) => s.status === "MISSING").map((s) => s.name);

    return Response.json({
      checked_at: new Date().toISOString(),
      secrets,
      all_set: missing.length === 0,
      missing,
      note: "Values are never exposed. Only presence is reported.",
    });
  } catch (error: any) {
    return Response.json({ error: "Diagnostic failed" }, { status: 500 });
  }
});