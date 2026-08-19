import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// ---- ElevenLabs webhook signature verification (official method) ----
// ElevenLabs-Signature header format: "t={unix_seconds_timestamp},v0={hex_digest}"
// The digest is HMAC-SHA256 of "{timestamp}.{rawBody}", keyed with the webhook secret.
// Timestamp tolerance: 30 minutes (1800 seconds) per ElevenLabs docs.
// Returns { valid, reason } so the caller can log the failure cause without
// exposing the signature, timestamp, or digest values.
async function verifyElevenLabsSignature(
  rawBody: string,
  webhookSecret: string,
  signatureHeader: string
): Promise<{ valid: boolean; reason: string }> {
  if (!signatureHeader) {
    return { valid: false, reason: 'missing_signature_header' };
  }

  // Parse the header: "t=1234567890,v0=abc123..."
  const elements = signatureHeader.split(',');
  const timestampEl = elements.find((e) => e.trim().startsWith('t='));
  const signatures = elements
    .filter((e) => e.trim().startsWith('v0='))
    .map((e) => e.trim().substring(3));

  if (!timestampEl || signatures.length === 0) {
    return { valid: false, reason: 'signature_format_mismatch' };
  }

  const timestamp = timestampEl.trim().substring(2);

  // Reject replays older than 30 minutes (ElevenLabs uses seconds, not ms)
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return { valid: false, reason: 'timestamp_not_numeric' };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > 1800) {
    return { valid: false, reason: 'timestamp_out_of_range' };
  }

  // Compute HMAC-SHA256("{timestamp}.{rawBody}", webhookSecret)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(webhookSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signedPayload = `${timestamp}.${rawBody}`;
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expectedDigest = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison against any of the provided v0 signatures
  let isValid = false;
  for (const sig of signatures) {
    if (sig.length !== expectedDigest.length) continue;
    let result = 0;
    for (let i = 0; i < expectedDigest.length; i++) {
      result |= expectedDigest.charCodeAt(i) ^ sig.charCodeAt(i);
    }
    if (result === 0) {
      isValid = true;
      break;
    }
  }

  if (!isValid) {
    return { valid: false, reason: 'hmac_mismatch' };
  }
  return { valid: true, reason: 'verified' };
}

// Convert ElevenLabs transcript array [{role, message, time_in_call_secs}, ...]
// into a readable text transcript for storage and LLM analysis.
function formatTranscript(transcriptArray: any[]): string {
  if (!Array.isArray(transcriptArray) || transcriptArray.length === 0) return '';
  return transcriptArray
    .map((turn) => {
      const role = turn.role === 'agent' ? 'Agent' : 'Caller';
      const message = turn.message || '';
      return `${role}: ${message}`;
    })
    .join('\n');
}

// Extract a phone number from the ElevenLabs payload.
// The post_call_transcription webhook does not include phone numbers directly,
// so we check dynamic_variables and metadata for common key names.
function extractPhoneNumber(data: any): string {
  const dynamicVars = data?.conversation_initiation_client_data?.dynamic_variables || {};
  const metadata = data?.metadata || {};

  // Check dynamic variables for phone number keys
  const phoneKeys = [
    'screened_phone_number',
    'phone_number',
    'to_number',
    'user_phone',
    'vardin_phone',
    'caller_phone',
    'from_number',
  ];
  for (const key of phoneKeys) {
    const val = dynamicVars[key];
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }

  // Check metadata for phone number fields (telephony calls may include these)
  for (const key of phoneKeys) {
    const val = metadata[key];
    if (val && typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }

  // Check metadata.body for SIP/Twilio phone fields
  const metaBody = metadata.body || {};
  if (metaBody.to_number) return String(metaBody.to_number);
  if (metaBody.from_number) return String(metaBody.from_number);

  return '';
}

// Extract a field from ElevenLabs data_collection_results, falling back to
// dynamic_variables and then to an empty string.
function extractCollectedField(data: any, fieldName: string): string {
  const results = data?.analysis?.data_collection_results || {};
  const dynamicVars = data?.conversation_initiation_client_data?.dynamic_variables || {};

  const fromResults = results[fieldName];
  if (fromResults && typeof fromResults === 'string' && fromResults.trim()) {
    return fromResults.trim();
  }
  // Check with snake_case and camelCase variants
  const camelKey = fieldName.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const fromResultsCamel = results[camelKey];
  if (fromResultsCamel && typeof fromResultsCamel === 'string' && fromResultsCamel.trim()) {
    return fromResultsCamel.trim();
  }

  const fromVars = dynamicVars[fieldName];
  if (fromVars && typeof fromVars === 'string' && fromVars.trim()) {
    return fromVars.trim();
  }
  const fromVarsCamel = dynamicVars[camelKey];
  if (fromVarsCamel && typeof fromVarsCamel === 'string' && fromVarsCamel.trim()) {
    return fromVarsCamel.trim();
  }

  return '';
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

// Webhook endpoint: receives ElevenLabs' post_call_transcription webhook,
// verifies the ElevenLabs-Signature, extracts call data, runs it through
// Vardin's scam-detection AI, and saves the combined record + final assessment.
export default async function(req: Request): Promise<Response> {
  try {
    console.log('[CallGuard] Webhook received');

    // ---- 1. Get the webhook secret (used for HMAC verification) ----
    const webhookSecret = (secrets.get('CALLGUARD_WEBHOOK_SECRET') || '').trim();
    if (!webhookSecret) {
      console.log('[CallGuard] CALLGUARD_WEBHOOK_SECRET not found');
      return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    // ---- 2. Read the raw body (required for signature verification) ----
    const rawBody = await req.text();

    // ---- 3. Verify the ElevenLabs-Signature header ----
    const signature = (
      req.headers.get('elevenlabs-signature') ||
      req.headers.get('ElevenLabs-Signature') ||
      ''
    ).trim();
    const signaturePresent = signature.length > 0;
    console.log(`[CallGuard] ElevenLabs-Signature present: ${signaturePresent}`);

    if (!signaturePresent) {
      return Response.json({ error: 'Missing ElevenLabs-Signature header' }, { status: 401 });
    }

    const verification = await verifyElevenLabsSignature(rawBody, webhookSecret, signature);
    console.log(`[CallGuard] Signature verification: ${verification.valid} (${verification.reason})`);

    if (!verification.valid) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // ---- 4. Parse the ElevenLabs payload ----
    const payload = JSON.parse(rawBody);
    const { type, data } = payload;

    console.log(`[CallGuard] Event type: ${type || 'unknown'}`);

    if (!data || !data.conversation_id) {
      console.log('[CallGuard] Invalid payload: missing data or conversation_id');
      return Response.json({ error: 'Invalid payload: missing data or conversation_id' }, { status: 400 });
    }

    const conversationId = data.conversation_id;
    console.log(`[CallGuard] Conversation ID: ${conversationId}`);

    // Only process post_call_transcription events (contains transcript + analysis)
    if (type !== 'post_call_transcription') {
      console.log(`[CallGuard] Skipping event (not post_call_transcription)`);
      return new Response(null, { status: 204 });
    }

    const base44 = createClientFromRequest(req);

    // ---- 4b. Entitlement check — verify the called number has an active Call Guard subscription ----
    const phoneNumberFromPayload = extractPhoneNumber(data);
    const normalizedToNumber = phoneNumberFromPayload.replace(/[^\d]/g, '');
    console.log(`[CallGuard] Entitlement lookup — phone number present: ${normalizedToNumber.length > 0}`);

    let entitledUser = null;
    if (normalizedToNumber.length > 0) {
      try {
        const candidates = await base44.asServiceRole.entities.User.filter({ call_guard_enabled: true });
        entitledUser = candidates.find((u: any) => {
          const userNum = String(u.call_guard_phone_number || '').replace(/[^\d]/g, '');
          return userNum === normalizedToNumber && userNum.length > 0 && u.call_guard_status === 'active';
        });
      } catch (e: any) {
        console.log(`[CallGuard] Entitlement lookup error: ${e.message}`);
      }
    }

    if (!entitledUser) {
      console.log(`[CallGuard] No active Call Guard entitlement found`);
      return Response.json({ error: 'No active Call Guard entitlement for this number' }, { status: 403 });
    }

    // Auto-disable if the user's main subscription is no longer active
    if (entitledUser.subscription_status === 'inactive' || entitledUser.subscription_status === 'canceled') {
      console.log(`[CallGuard] User main subscription inactive — disabling Call Guard`);
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
        console.log(`[CallGuard] Call Guard entitlement expired`);
        return Response.json({ error: 'Call Guard entitlement expired' }, { status: 403 });
      }
    }

    console.log(`[CallGuard] Entitlement verified for user`);

    // ---- 5. Idempotency check — skip duplicates on ElevenLabs retries ----
    const existing = await base44.asServiceRole.entities.CallGuardReport.filter({ call_id: conversationId });
    if (existing.length > 0) {
      console.log(`[CallGuard] Duplicate conversation_id, returning existing record`);
      return Response.json({
        call_id: conversationId,
        report_id: existing[0].id,
        vardin_verdict: existing[0].vardin_verdict,
        duplicate: true,
      });
    }

    // ---- 6. Extract data from the ElevenLabs payload ----
    const analysis = data.analysis || {};
    const metadata = data.metadata || {};

    // Transcript: convert array to readable text
    const transcript = formatTranscript(data.transcript || []);

    // Summary from ElevenLabs' post-call analysis
    const summary = analysis.transcript_summary || 'Call analysis not available.';

    // Call timing metadata
    const startTimeSecs = metadata.start_time_unix_secs || null;
    const callDurationSecs = metadata.call_duration_secs || null;
    const terminationReason = metadata.termination_reason || '';
    const callSuccessful = analysis.call_successful || '';

    // Caller/phone metadata (when available from telephony integration)
    const callerPhoneNumber = extractPhoneNumber(data) || '';

    // Custom post-call analysis fields (configured via ElevenLabs agent data collection)
    const caller_name = extractCollectedField(data, 'caller_name');
    const claimed_organization = extractCollectedField(data, 'claimed_organization');
    const reason_for_call = extractCollectedField(data, 'reason_for_call');
    const requested_action = extractCollectedField(data, 'requested_action');
    const sensitive_information_requested = extractCollectedField(data, 'sensitive_information_requested');
    const payment_requested = extractCollectedField(data, 'payment_requested');
    const urgency_or_threats = extractCollectedField(data, 'urgency_or_threats');
    const remote_access_requested = extractCollectedField(data, 'remote_access_requested');

    // ---- 7. Save the raw call information ----
    let callRecord;
    try {
      callRecord = await base44.asServiceRole.entities.CallGuardReport.create({
        call_id: conversationId,
        user_id: entitledUser.id,
        screened_phone_number: normalizedToNumber,
        caller_phone_number: callerPhoneNumber,
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
    } catch (dbError: any) {
      console.log(`[CallGuard] Record creation failed: ${dbError.message}`);
      throw dbError;
    }

    // ---- 8. Build the Vardin AI assessment prompt ----
    const callFacts = [
      `Caller phone number: ${callerPhoneNumber ? 'provided' : 'not provided'}`,
      `Call duration: ${callDurationSecs !== null ? callDurationSecs + ' seconds' : 'unknown'}`,
      `Call successful: ${callSuccessful || 'unknown'}`,
      `Termination reason: ${terminationReason || 'none'}`,
      `Caller name: ${caller_name || 'not provided'}`,
      `Claimed organization: ${claimed_organization || 'not provided'}`,
      `Stated reason for call: ${reason_for_call || 'not provided'}`,
      `Requested action: ${requested_action || 'not provided'}`,
      `Sensitive information requested: ${sensitive_information_requested || 'none'}`,
      `Payment requested: ${payment_requested || 'none'}`,
      `Urgency or threats used: ${urgency_or_threats || 'none'}`,
      `Remote access requested: ${remote_access_requested || 'none'}`,
      `ElevenLabs call summary: ${summary}`,
    ].join('\n');

    const prompt = `You are Vardin, an AI-powered scam detection system. A voice-agent (ElevenLabs Conversational AI) just screened an incoming phone call and extracted structured information about the caller. Your job is to analyze this information and determine whether the call is SAFE, SUSPICIOUS, or a SCAM.

IMPORTANT: The ElevenLabs agent's summary is provided for context, but the agent does NOT make the final scam determination. YOU (Vardin) are solely responsible for the final verdict.

=== ELEVENLABS CALL SUMMARY ===
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
      console.log(`[CallGuard] Vardin analysis result: verdict=${verdict}, confidence=${confidenceScore}`);
    } catch (llmError: any) {
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
    console.log(`[CallGuard] Assessment saved to record ${callRecord.id}`);

    // ---- 11. Return 200 after successful processing ----
    return Response.json({
      call_id: conversationId,
      report_id: callRecord.id,
      vardin_verdict: verdict,
      confidence_score: confidenceScore,
    });
  } catch (error: any) {
    console.log(`[CallGuard] Unhandled error: ${error.message}`);
    return Response.json({ error: error.message }, { status: 500 });
  }
}