import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Free follow-up chat for contexts where credits are not charged. This moves
// the InvokeLLM call behind an authenticated backend function so anonymous
// callers cannot consume the app owner's LLM credits.

const PERSONAS: Record<string, string> = {
  scam_exposer:
    "You are Vardin, an AI scam-detection assistant. The user described a situation and already received questions to ask the other party. Now they are following up — the other party replied, or the situation changed. Help them interpret the new response and decide what to ask or do next. Be practical, specific and calm. If the new information clearly indicates a scam, say so and explain why. If it seems legitimate, say so. If uncertain, give measured guidance and suggest one or two clarifying questions. Never ask the user for sensitive personal data.",
  recovery:
    "You are Vardin, an AI scam-recovery assistant. The user already received a personalized recovery plan. Now they are following up — they may have taken some steps and something new happened, or they have a question about the plan. Continue guiding them calmly and practically. Reference their original situation and the steps already given. Prioritize minimizing further loss. If they should contact a specific institution, remind them. If they mention a new loss, give immediate next steps. Never ask the user for sensitive personal data.",
  default:
    "You are Vardin, an AI scam-safety assistant. Continue helping the user with their follow-up questions based on the original context provided. Be practical, specific and calm. Never ask the user for sensitive personal data.",
};

const LANGUAGE_NAMES: Record<string, string> = { en: "English", he: "Hebrew", es: "Spanish" };

function buildPrompt(persona: string, context: string, history: any[], question: string, langName: string) {
  const p = PERSONAS[persona] || PERSONAS.default;
  let s = p + "\n\nRespond entirely in " + langName + ".\n\n";
  s += "=== ORIGINAL CONTEXT ===\n" + context + "\n\n";
  s += "=== CONVERSATION SO FAR ===\n";
  if (!history.length) s += "(none yet)\n";
  else history.forEach((m) => { s += (m.role === "user" ? "User: " : "Assistant: ") + m.content + "\n"; });
  s += "\n=== NEW QUESTION ===\nUser: " + question + "\n\nReply with a helpful, concise, practical answer. Use plain text (no markdown headings). Keep it focused and actionable.";
  return s;
}

// Rate limiting: 20 free follow-ups per user per minute.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
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
    const persona = String(body.persona || 'default');
    const context = String(body.context || '').slice(0, 8000);
    const history = Array.isArray(body.history) ? body.history.slice(-20) : [];
    const question = String(body.question || '').trim().slice(0, 4000);
    const language = String(body.language || 'en');

    if (!question) return Response.json({ error: 'Question is required' }, { status: 400 });

    const langName = LANGUAGE_NAMES[language] || 'English';
    const prompt = buildPrompt(persona, context, history, question, langName);

    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    const reply = typeof result === 'string' ? result : (result as any)?.reply || (result as any)?.text || JSON.stringify(result);

    return Response.json({ reply: reply || 'I could not generate a response. Please try rephrasing.' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});