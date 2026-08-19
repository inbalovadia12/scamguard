import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// ---- Retell webhook signature verification (official method) ----
// X-Retell-Signature format: "v={unix_ms_timestamp},d={hex_digest}"
// The digest is HMAC-SHA256 of (rawBody + timestamp), keyed with the Retell API key.
// Returns { valid, reason } so the caller can log the failure cause without
// exposing the signature, timestamp, or digest values.
async function verifyRetellSignature(rawBody: string, apiKey: string, signature: string): Promise<{ valid: boolean; reason: string }> {
  const match = signature.match(/v=(\d+),d=(.*)/);
  if (!match) {
    return { valid: false, reason: 'signature_format_mismatch' };
  }

  const timestamp = match[1];
  const digest = match[2].trim();

  // Reject replays older than 5 minutes
  const now = Date.now();
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return { valid: false, reason: 'timestamp_not_numeric' };
  }
  if (Math.abs(now - ts) > 5 * 60 * 1000) {
    return { valid: false, reason: 'timestamp_out_of_range' };
  }

  // Compute HMAC-SHA256(rawBody + timestamp, apiKey)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const data = encoder.encode(rawBody + timestamp);
  const sigBuffer = await crypto.subtle.sign('HMAC', key, data);
  const expectedDigest = Array.from(new Uint8Array(sigBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (expectedDigest.length !== digest.length) {
    return { valid: false, reason: 'digest_length_mismatch' };
  }
  let result = 0;
  for (let i = 0; i < expectedDigest.length; i++) {
    result |= expectedDigest.charCodeAt(i) ^ digest.charCodeAt(i);
  }
  if (result !== 0) {
    return { valid: false, reason: 'hmac_mismatch' };
  }
  return { valid: true, reason: 'verified' };
}

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

// Webhook endpoint: receives Retell's call_analyzed webhook, verifies the
// X-Retell-Signature, extracts call data, runs it through Vardin's
// scam-detection AI, and saves the combined record + final assessment.
export default async function(req: Request): Promise<Response> {
  try {
    console.log('[CallGuard] Webhook received');

    // ---- 1. Get the Retell API key (used as the HMAC signing secret) ----
    const retellApiKey = (secrets.get('RETELL_API_KEY') || '').trim();
    if (!retellApiKey) {
      console.log('[CallGuard] RETELL_API_KEY secret not found');
      return Response.json({ error: 'Retell API key not configured' }, { status: 500 });
    }
    console.log('[CallGuard] RETELL_API_KEY secret found');

    // ---- 2. Read the raw body (required for signature verification) ----
    const rawBody = await req.text();

    // ---- 3. Verify the X-Retell-Signature header ----
    const signature = (req.headers.get('x-retell-signature') || '').trim();
    const signaturePresent = signature.length > 0;
    console.log(`[CallGuard] X-Retell-Signature present: ${signaturePresent}`);

    if (!signaturePresent) {
      return Response.json({ error: 'Missing X-Retell-Signature header' }, { status: 401 });
    }

    const verification = await verifyRetellSignature(rawBody, retellApiKey, signature);
    console.log(`[CallGuard] Signature verification: ${verification.valid} (${verification.reason})`);

    if (!verification.valid) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // ---- 4. Parse the Retell payload ----
    const payload = JSON.parse(rawBody);
    const { event, call } = payload;

    console.log(`[CallGuard] Event type: ${event || 'unknown'}`);

    if (!call || !call.call_id) {
      console.log('[CallGuard] Invalid payload: missing call object or call_id');
      return Response.json({ error: 'Invalid payload: missing call object or call_id' }, { status: 400 });
    }

    console.log(`[CallGuard] Call ID: ${call.call_id}`);

    // Only process call_analyzed events (where the call_analysis data is available)
    if (event !== 'call_analyzed') {
      console.log(`[CallGuard] Skipping event (not call_analyzed)`);
      return new Response(null, { status: 204 });
    }

    const base44 = createClientFromRequest(req);

    // ---- 4b. Entitlement check — verify the called number has an active Call Guard subscription ----
    const calledNumber = call.to_number || '';
    const normalizedToNumber = calledNumber.replace(/[^\d]/g, '');
    console.log(`[CallGuard] Checking entitlement for called number: ${normalizedToNumber || '(empty)'}`);

    let entitledUser = null;
    try {
      const candidates = await base44.asServiceRole.entities.User.filter({ call_guard_enabled: true });
      entitledUser = candidates.find((u: any) => {
        const userNum = String(u.call_guard_phone_number || '').replace(/[^\d]/g, '');
        return userNum === normalizedToNumber && userNum.length > 0 && u.call_guard_status === 'active';
      });
    } catch (e) {
      console.log(`[CallGuard] Entitlement lookup error: ${e.message}`);
    }

    if (!entitledUser) {
      console.log(`[CallGuard] No active Call Guard entitlement for this number`);
      return Response.json({ error: 'No active Call Guard entitlement for this number' }, { status: 403 });
    }

    // Auto-disable if the user's main subscription is no longer active
    if (entitledUser.subscription_status === 'inactive' || entitledUser.subscription_status === 'canceled') {
      console.log(`[CallGuard] User ${entitledUser.id} main subscription inactive — disabling Call Guard`);
      try {
        await base44.asServiceRole.entities.User.update(entitledUser.id, {
          call_guard_enabled: false,
          call_guard_status: 'expired',
          call_guard_expires_at: new Date().toISOString(),
        });
      } catch {}
      return Response.json({ error: 'Call Guard disabled — main subscription inactive' }, { status: 403 });
    }

    // Auto-disable if the Call Guard entitlement has expired
    if (entitledUser.call_guard_expires_at) {
      const expiresAt = new Date(entitledUser.call_guard_expires_at);
      if (expiresAt < new Date() && entitledUser.call_guard_status !== 'active') {
        console.log(`[CallGuard] Call Guard entitlement expired for user ${entitledUser.id}`);
        return Response.json({ error: 'Call Guard entitlement expired' }, { status: 403 });
      }
    }

    console.log(`[CallGuard] Entitlement verified for user ${entitledUser.id}`);

    // ---- 5. Idempotency check — skip duplicates on Retell retries ----
    const existing = await base44.asServiceRole.entities.CallGuardReport.filter({ call_id: call.call_id });
    if (existing.length > 0) {
      console.log(`[CallGuard] Duplicate call_id, returning existing record ${existing[0].id}`);
      return Response.json({
        call_id: call.call_id,
        report_id: existing[0].id,
        vardin_verdict: existing[0].vardin_verdict,
        duplicate: true,
      });
    }

    // ---- 6. Extract data from the Retell call object ----
    const callAnalysis = call.call_analysis || {};
    const dynamicVars = call.retell_llm_dynamic_variables || {};

    const call_id = call.call_id;
    const transcript = call.transcript || '';
    const summary = callAnalysis.call_summary || 'Call analysis not available.';

    // Custom post-call analysis fields (configured in the Retell agent)
    const caller_name = callAnalysis.caller_name || dynamicVars.caller_name || '';
    const claimed_organization = callAnalysis.claimed_organization || dynamicVars.claimed_organization || '';
    const reason_for_call = callAnalysis.reason_for_call || dynamicVars.reason_for_call || '';
    const requested_action = callAnalysis.requested_action || dynamicVars.requested_action || '';
    const sensitive_information_requested = callAnalysis.sensitive_information_requested || '';
    const payment_requested = callAnalysis.payment_requested || '';
    const urgency_or_threats = callAnalysis.urgency_or_threats || '';
    const remote_access_requested = callAnalysis.remote_access_requested || '';

    // Additional call context
    const from_number = call.from_number || '';
    const to_number = call.to_number || '';
    const direction = call.direction || '';

    // ---- 7. Save the raw call information ----
    let callRecord;
    try {
      callRecord = await base44.asServiceRole.entities.CallGuardReport.create({
        call_id,
        user_id: entitledUser.id,
        screened_phone_number: normalizedToNumber,
        caller_phone_number: from_number,
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
        vardin_verdict: 'SAFE',
        confidence_score: 0,
        vardin_explanation: '',
        scam_signals: [],
      });
      console.log(`[CallGuard] Record created: ${callRecord.id}`);
    } catch (dbError) {
      console.log(`[CallGuard] Record creation failed: ${dbError.message}`);
      throw dbError;
    }

    // ---- 8. Build the Vardin AI assessment prompt ----
    const callFacts = [
      `Caller phone number: ${from_number || 'not provided'}`,
      `Called number: ${to_number || 'not provided'}`,
      `Call direction: ${direction || 'unknown'}`,
      `Caller name: ${caller_name || 'not provided'}`,
      `Claimed organization: ${claimed_organization || 'not provided'}`,
      `Stated reason for call: ${reason_for_call || 'not provided'}`,
      `Requested action: ${requested_action || 'not provided'}`,
      `Sensitive information requested: ${sensitive_information_requested || 'none'}`,
      `Payment requested: ${payment_requested || 'none'}`,
      `Urgency or threats used: ${urgency_or_threats || 'none'}`,
      `Remote access requested: ${remote_access_requested || 'none'}`,
      `Retell call summary: ${summary}`,
    ].join('\n');

    const prompt = `You are Vardin, an AI-powered scam detection system. A voice-agent (Retell AI) just screened an incoming phone call and extracted structured information about the caller. Your job is to analyze this information and determine whether the call is SAFE, SUSPICIOUS, or a SCAM.

IMPORTANT: The Retell agent's summary is provided for context, but the agent does NOT make the final scam determination. YOU (Vardin) are solely responsible for the final verdict.

=== RETELL CALL SUMMARY ===
${summary}

=== EXTRACTED CALL FACTS ===
${callFacts}

=== FULL TRANSCRIPT ===
${transcript || '(no transcript provided)'}

=== BEHAVIOR THAT IS NOT A SCAM SIGNAL ===
The following behaviors are normal and must NEVER by themselves cause a caller to be classified as suspicious or a scam:
- The caller refused to provide their name or personal details.
- The caller was frustrated, annoyed, hostile, impatient, or rude toward the AI agent.
- The caller hung up, ended the call abruptly, or was short in duration.
- The caller refused to talk to an automated assistant or expressed dislike of voice agents.
- The caller was anonymous (did not state a name or organization).
- The caller was confused, skeptical, or uncooperative with screening questions.
- The caller spoke in a foreign language or had an accent.

These are common reactions to an automated screening call and do NOT indicate fraud. Do not penalize callers for any of the above.

=== ACTUAL SCAM INDICATORS (prioritize these) ===
Classify as suspicious or scam ONLY when you find concrete evidence of fraud such as:
- Requests for passwords, verification codes, OTPs, or authentication codes.
- Requests for banking details, credit/debit card numbers, or payment information.
- Requests for money, gift cards, wire transfers, cryptocurrency, or unusual payment methods.
- Suspicious payment links or instructions to visit unusual URLs to pay.
- Requests to install software, download apps, or provide remote device/computer access (screen sharing).
- Impersonation of a bank, government agency (IRS, SSA, police, immigration), tech support, or well-known company — COMBINED with a suspicious demand (money, info, access, or urgency).
- Urgency, threats, or pressure to act immediately (arrest, account closure, legal action, fines).
- Attempts to move the conversation to an unusual communication or payment channel (e.g., wire transfer, gift cards, crypto wallet, a specific messaging app).
- Attempts to obtain sensitive personal information (SSN, date of birth, account credentials, security question answers).
- Romance or investment scams with promises of returns, prizes, or lottery winnings requiring upfront payment.
- Caller-ID spoofing or claims that are verifiably inconsistent with the caller's behavior.

=== VERDICT GUIDELINES ===
- SAFE: No meaningful evidence of fraud. This is the DEFAULT when there are no concrete scam indicators — even if the caller was anonymous, impatient, rude, uncooperative, or hung up. Most legitimate callers will be SAFE.
- SUSPICIOUS: Some concrete but incomplete evidence of potential fraud (e.g., vague requests for personal info without clear malicious intent, or a suspicious claim that is not corroborated). Use this sparingly — only when you have a real reason to be cautious.
- SCAM: Strong, clear evidence of fraudulent or malicious intent (e.g., explicit requests for money, passwords, or remote access combined with urgency, threats, or impersonation).

=== CONFIDENCE SCORE (0-100) ===
Assign confidence based on the STRENGTH of the evidence, not the severity of the verdict:
- 90-100: overwhelming, unambiguous evidence for the verdict
- 70-89: strong evidence
- 40-69: moderate evidence, some ambiguity
- 0-39: limited or weak evidence — low confidence
A SAFE verdict with no evidence of fraud should have LOW confidence (10-30) if the call was too short or incomplete to assess, and MODERATE confidence (40-60) if the call was clearly normal and unremarkable. Do NOT artificially inflate confidence. If there is little to analyze, confidence should be low regardless of verdict.

Respond with ONLY a JSON object (no markdown, no backticks, no text outside JSON):
{
  "verdict": "SAFE" | "SUSPICIOUS" | "SCAM",
  "confidence_score": 0,
  "explanation": "concise plain-English explanation of the verdict (max 300 chars)",
  "scam_signals": ["short label for each concrete scam indicator detected, or empty array if none"]
}`;

    // ---- 9. Run Vardin's scam-detection AI ----
    let verdict = 'SAFE';
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
    } catch (llmError) {
      console.log(`[CallGuard] LLM assessment failed: ${llmError.message}`);
    }

    // ---- 10. Save the final Vardin assessment to the call record ----
    await base44.asServiceRole.entities.CallGuardReport.update(callRecord.id, {
      vardin_verdict: verdict,
      confidence_score: confidenceScore,
      vardin_explanation: explanation,
      scam_signals: scamSignals,
      assessed_at: new Date().toISOString(),
    });
    console.log(`[CallGuard] Assessment saved: verdict=${verdict}, confidence=${confidenceScore}`);

    // ---- 11. Return the result ----
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
    console.log(`[CallGuard] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
}