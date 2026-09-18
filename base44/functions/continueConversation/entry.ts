import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from '../../shared/credits.ts';

// Each follow-up turn costs a small, fixed number of credits so the feature
// stays consistent with the rest of the app's server-authoritative billing.
const CREDIT_COST = 2;

const PERSONAS: Record<string, string> = {
  scam_exposer:
    "You are Vardin, an AI scam-detection assistant. The user described a situation (e.g., a marketplace seller, an online buyer, a dating/investment contact) and already received a list of questions to ask the other party. Now they are following up — the other party replied, or the situation changed. Help them interpret the new response and decide what to ask or do next. Be practical, specific and calm. If the new information clearly indicates a scam, say so and explain why. If it seems legitimate, say so. If uncertain, give measured guidance and suggest one or two clarifying questions. Never ask the user for sensitive personal data.",
  recovery:
    "You are Vardin, an AI scam-recovery assistant. The user already received a personalized recovery plan for their situation. Now they are following up — they may have taken some of the steps and something new happened, or they have a question about the plan. Continue guiding them calmly and practically. Reference their original situation and the steps already given. Prioritize minimizing further loss. If they should contact a specific institution (bank, exchange, credit bureau, police), remind them. If they mention a new loss, give immediate next steps. Never ask the user for sensitive personal data.",
  default:
    "You are Vardin, an AI scam-safety assistant. Continue helping the user with their follow-up questions based on the original context provided. Be practical, specific and calm. Never ask the user for sensitive personal data.",
};

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json();
    const personaKey = typeof body.persona === 'string' ? body.persona : 'default';
    const context = typeof body.context === 'string' ? body.context.slice(0, 6000) : '';
    const history = Array.isArray(body.history)
      ? body.history.slice(-10).map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: String(m.content || '').slice(0, 2000),
        }))
      : [];
    const question = typeof body.question === 'string' ? body.question.slice(0, 2000) : '';
    const language = typeof body.language === 'string' ? body.language : 'en';

    if (!question) return Response.json({ error: 'No question provided.' }, { status: 400 });

    const available = getAvailableCredits(user);
    if (available.remaining < CREDIT_COST) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: available.remaining,
        credits_limit: getMonthlyCreditLimit(user),
        credit_cost: CREDIT_COST,
        upgrade_url: '/pricing',
      }, { status: 402 });
    }

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const langName = LANGUAGE_NAMES[language] || 'English';
    const personaPrompt = PERSONAS[personaKey] || PERSONAS.default;

    let prompt = personaPrompt + '\n\nRespond entirely in ' + langName + '.\n\n';
    prompt += '=== ORIGINAL CONTEXT ===\n' + context + '\n\n';
    prompt += '=== CONVERSATION SO FAR ===\n';
    if (history.length === 0) {
      prompt += '(none yet)\n';
    } else {
      for (const m of history) prompt += (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content + '\n';
    }
    prompt += '\n=== NEW QUESTION ===\nUser: ' + question + '\n\n';
    prompt += 'Reply with a helpful, concise, practical answer. Use plain text (no markdown headings). Keep it focused and actionable.';

    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    const reply = typeof result === 'string' ? result : (result as any)?.reply || (result as any)?.text || JSON.stringify(result);

    // Charge credits only after a successful generation.
    const usage = applyCreditUsage(user, CREDIT_COST);
    if (usage) await base44.auth.updateMe(usage);
    const remaining = getAvailableCredits({ ...user, ...usage }).remaining;

    return Response.json({
      reply,
      credits_used: CREDIT_COST,
      credits_remaining: remaining,
      credits_limit: getMonthlyCreditLimit(user),
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}