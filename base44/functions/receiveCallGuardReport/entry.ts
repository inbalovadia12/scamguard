import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// Parse JSON from a free-text LLM response as a fallback.
function parseJsonFromText(text: string): any {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  return null;
}

// Webhook endpoint: receives completed call-screening data from the Retell
// voice agent, runs it through Vardin's scam-detection AI, and saves the
// combined record + final assessment.
//
// The Retell agent provides extracted call facts; Vardin's AI makes the
// final SAFE / SUSPICIOUS / SCAM determination.
export default async function(req: Request): Promise<Response> {
  try {
    // ---- 1. Authenticate the webhook request ----
    const webhookSecret = secrets.get("CALLGUARD_WEBHOOK_SECRET");
    if (!webhookSecret) {
      return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const headerSecret = bearerMatch
      ? bearerMatch[1]
      : (req.headers.get('x-webhook-secret') || '');
    const url = new URL(req.url);
    const querySecret = url.searchParams.get('secret') || '';

    if (headerSecret !== webhookSecret && querySecret !== webhookSecret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ---- 2. Parse and validate the request body ----
    const body = await req.json();
    const {
      call_id,
      caller_name,
      claimed_organization,
      reason_for_call,
      requested_action,
      sensitive_information_requested,
      payment_requested,
      urgency_or_threats,
      remote_access_requested,
      summary,
      transcript,
    } = body;

    if (!call_id || !String(call_id).trim()) {
      return Response.json({ error: 'call_id is required' }, { status: 400 });
    }
    if (!summary || !String(summary).trim()) {
      return Response.json({ error: 'summary is required' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // ---- 3. Save the raw call information ----
    const callRecord = await base44.asServiceRole.entities.CallGuardReport.create({
      call_id: String(call_id).trim(),
      caller_name: caller_name || '',
      claimed_organization: claimed_organization || '',
      reason_for_call: reason_for_call || '',
      requested_action: requested_action || '',
      sensitive_information_requested: sensitive_information_requested || '',
      payment_requested: payment_requested || '',
      urgency_or_threats: urgency_or_threats || '',
      remote_access_requested: remote_access_requested || '',
      summary: String(summary).trim(),
      transcript: transcript || '',
      vardin_verdict: 'SUSPICIOUS',
      confidence_score: 0,
      vardin_explanation: '',
      scam_signals: [],
    });

    // ---- 4. Build the Vardin AI assessment prompt ----
    const callFacts = [
      `Caller name: ${caller_name || 'not provided'}`,
      `Claimed organization: ${claimed_organization || 'not provided'}`,
      `Stated reason for call: ${reason_for_call || 'not provided'}`,
      `Requested action: ${requested_action || 'not provided'}`,
      `Sensitive information requested: ${sensitive_information_requested || 'none'}`,
      `Payment requested: ${payment_requested || 'none'}`,
      `Urgency or threats used: ${urgency_or_threats || 'none'}`,
      `Remote access requested: ${remote_access_requested || 'none'}`,
    ].join('\n');

    const prompt = `You are Vardin, an AI-powered scam detection system. A voice-agent just screened an incoming phone call and extracted structured information about the caller. Your job is to analyze this information and determine whether the call is SAFE, SUSPICIOUS, or a SCAM.

IMPORTANT: The voice agent's summary is provided for context, but the agent does NOT make the final scam determination. YOU (Vardin) are solely responsible for the final verdict.

=== CALL SUMMARY (from voice agent) ===
${summary}

=== EXTRACTED CALL FACTS ===
${callFacts}

=== FULL TRANSCRIPT ===
${transcript || '(no transcript provided)'}

=== ASSESSMENT INSTRUCTIONS ===
Analyze the call for well-known scam patterns including but not limited to:
- Impersonation of government agencies (IRS, SSA, police, immigration)
- Impersonation of banks, tech support, or well-known companies
- Requests for gift cards, wire transfers, crypto, or unusual payment methods
- Requests for sensitive information (SSN, passwords, OTPs, banking details)
- Urgency tactics or threats (arrest, account closure, legal action)
- Remote access requests (installation of software, screen sharing)
- Romance or investment scams
- Prize/lottery scams requiring upfront payment
- Caller-ID spoofing or inconsistent claims

VERDICT GUIDELINES:
- SAFE: The call appears legitimate — verified business, no sensitive requests, no threats, consistent claims.
- SUSPICIOUS: Some red flags present but not enough for a definitive scam determination — proceed with caution.
- SCAM: Clear scam indicators — requests for money/sensitive info, threats, impersonation, urgency tactics, or remote access demands.

CONFIDENCE SCORE (0-100):
- How confident Vardin is in the verdict based on the available evidence.
- 90-100: overwhelming evidence for the verdict
- 70-89: strong evidence
- 40-69: moderate evidence, some ambiguity
- 0-39: limited evidence, low confidence

Respond with ONLY a JSON object (no markdown, no backticks, no text outside JSON):
{
  "verdict": "SAFE" | "SUSPICIOUS" | "SCAM",
  "confidence_score": 0,
  "explanation": "concise plain-English explanation of the verdict (max 300 chars)",
  "scam_signals": ["short label for each key indicator detected"]
}`;

    // ---- 5. Run Vardin's scam-detection AI ----
    let verdict = 'SUSPICIOUS';
    let confidenceScore = 0;
    let explanation = '';
    let scamSignals: string[] = [];

    try {
      const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            verdict: { type: 'string', enum: ['SAFE', 'SUSPICIOUS', 'SCAM'] },
            confidence_score: { type: 'number' },
            explanation: { type: 'string' },
            scam_signals: { type: 'array', items: { type: 'string' } },
          },
          required: ['verdict', 'confidence_score', 'explanation', 'scam_signals'],
        },
      });

      const parsed = (typeof llmResponse === 'object' && llmResponse !== null)
        ? llmResponse
        : parseJsonFromText(typeof llmResponse === 'string' ? llmResponse : JSON.stringify(llmResponse));

      if (parsed) {
        const rawVerdict = String(parsed.verdict || '').toUpperCase();
        if (rawVerdict === 'SAFE' || rawVerdict === 'SUSPICIOUS' || rawVerdict === 'SCAM') {
          verdict = rawVerdict;
        }
        confidenceScore = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence_score) || 0)));
        explanation = String(parsed.explanation || '').slice(0, 500);
        if (Array.isArray(parsed.scam_signals)) {
          scamSignals = parsed.scam_signals.map(String).filter(Boolean).slice(0, 10);
        }
      }
    } catch {}

    // ---- 6. Save the final Vardin assessment to the call record ----
    await base44.asServiceRole.entities.CallGuardReport.update(callRecord.id, {
      vardin_verdict: verdict,
      confidence_score: confidenceScore,
      vardin_explanation: explanation,
      scam_signals: scamSignals,
      assessed_at: new Date().toISOString(),
    });

    // ---- 7. Return the result ----
    return Response.json({
      call_id: callRecord.call_id,
      report_id: callRecord.id,
      vardin_verdict: verdict,
      confidence_score: confidenceScore,
      explanation,
      scam_signals: scamSignals,
      assessed_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}