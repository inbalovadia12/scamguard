import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Generates a personalized emergency scam-recovery action plan. Moves the
// InvokeLLM call behind an authenticated backend function so anonymous
// callers cannot consume the app owner's LLM credits.

// Rate limiting: 10 emergency responses per user per hour.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    if (!checkRateLimit(user.id)) {
      return Response.json({ error: 'Rate limit exceeded. Please try again shortly.' }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const elaboration = String(body.elaboration || '').trim().slice(0, 4000);
    const scenarioTitle = String(body.scenario_title || '');
    const scenarioSubtitle = String(body.scenario_subtitle || '');

    if (!elaboration) return Response.json({ error: 'Please describe your situation' }, { status: 400 });

    const scenarioLine = scenarioTitle
      ? `Situation category: "${scenarioTitle}" — ${scenarioSubtitle}`
      : 'No specific category selected — infer the situation from their description.';

    const prompt = `You are Vardin, an AI scam recovery assistant. A user may have already been scammed and needs immediate, personalized help.

${scenarioLine}

The user described their exact situation:
"${elaboration}"

Analyze their specific situation and provide a tailored, step-by-step action plan. Be calm, practical, and actionable. Reference any specific services, banks, apps, websites, or phone numbers they mentioned by name. Prioritize steps that minimize immediate damage.

Respond with:
- situation_summary: a 1-2 sentence assessment of what happened and the potential impact
- severity: "moderate", "serious", or "critical" based on the potential for financial loss or identity theft
- do_now: 3-6 specific immediate steps tailored to THEIR situation (include estimated time for each, e.g. "Call your bank's fraud line (5 min)")
- follow_up: 2-4 steps for the coming days
- contacts: specific organizations, services, or hotlines to contact (with WHY they should contact each)
- warning_signs: 2-4 signs to watch for in the coming days/weeks that indicate the scam is still affecting them
- reassurance: a brief, calming 1-2 sentence message`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          situation_summary: { type: "string" },
          severity: { type: "string", enum: ["moderate", "serious", "critical"] },
          do_now: { type: "array", items: { type: "string" } },
          follow_up: { type: "array", items: { type: "string" } },
          contacts: { type: "array", items: { type: "string" } },
          warning_signs: { type: "array", items: { type: "string" } },
          reassurance: { type: "string" },
        },
      },
    });

    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});