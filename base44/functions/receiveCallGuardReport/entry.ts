import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { secrets } from "base44:runtime";

/**
 * Verify Retell's X-Retell-Signature header using the official method.
 * Signature format: v=<timestamp_ms>,d=<hex_hmac_sha256>
 * HMAC input: rawBody + timestamp (as strings), keyed by the Retell API key.
 */
async function verifyRetellSignature(rawBody: string, signature: string, apiKey: string): Promise<boolean> {
  const match = signature.match(/v=(\d+),d=(.*)/);
  if (!match) return false;

  const timestamp = match[1];
  const digest = match[2];

  // Reject timestamps older than 5 minutes
  const now = Date.now();
  if (Math.abs(now - parseInt(timestamp, 10)) > 5 * 60 * 1000) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody + timestamp));
  const expected = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison
  if (expected.length !== digest.length) return false;
  let result = 0;
  for (let i = 0; i < digest.length; i++) {
    result |= expected.charCodeAt(i) ^ digest.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Run Vardin's scam-analysis AI on the call transcript and summary.
 * Vardin makes the final SAFE / SUSPICIOUS / SCAM decision — Retell only
 * screens the caller and collects information.
 */
async function analyzeWithVardin(base44: any, reportId: string, transcript: string, callSummary: string, callAnalysisData: string) {
  const prompt = `You are Vardin's scam-detection AI. An AI voice agent (Retell) screened an incoming phone call and collected the transcript and summary below. Your job is to make the final scam risk decision.

Retell only screened the caller and collected information. YOU make the final verdict.

Call Summary (from Retell's post-call analysis):
${callSummary || '(none provided)'}

Additional Retell post-call analysis data:
${callAnalysisData || '(none provided)'}

Call Transcript:
${transcript || '(empty)'}

Analyze the conversation for scam patterns including but not limited to:
- Impersonation (government, bank, tech support, delivery, lottery/prize)
- Urgency or fear tactics
- Requests for money, gift cards, crypto, wire transfers
- Requests for personal info (SSN, passwords, OTP codes, card numbers)
- Investment / crypto fraud promises
- Romance or trust-building followed by requests
- Remote access / software installation requests
- Caller ID spoofing indicators
- Evasiveness when asked for verification

Return your verdict as JSON with these fields:
- verdict: "safe", "suspicious", or "scam"
- confidence_score: 0-100 (confidence in your verdict)
- explanation: plain-English explanation of why you reached this verdict
- tactics_detected: array of scam tactics detected (empty if none)
- recommended_actions: array of recommended next steps for the user`;

  const llmResponse = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['safe', 'suspicious', 'scam'] },
        confidence_score: { type: 'number' },
        explanation: { type: 'string' },
        tactics_detected: { type: 'array', items: { type: 'string' } },
        recommended_actions: { type: 'array', items: { type: 'string' } },
      },
    },
  });

  await base44.entities.CallGuardReport.update(reportId, {
    vardin_verdict: llmResponse.verdict,
    vardin_confidence_score: llmResponse.confidence_score,
    vardin_explanation: llmResponse.explanation,
    vardin_tactics_detected: llmResponse.tactics_detected || [],
    vardin_recommended_actions: llmResponse.recommended_actions || [],
    processed: true,
  });
}

Deno.serve(async (req) => {
  try {
    // --- Signature verification (Retell's official X-Retell-Signature) ---
    const signature = req.headers.get('x-retell-signature');
    if (!signature) {
      return Response.json({ error: 'Missing X-Retell-Signature header' }, { status: 401 });
    }

    const apiKey = secrets.get("RETELL_API_KEY");
    if (!apiKey) {
      return Response.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    // Use raw body for signature verification — NOT JSON.stringify(parsed)
    const rawBody = await req.text();

    const isValid = await verifyRetellSignature(rawBody, signature, apiKey);
    if (!isValid) {
      return Response.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // --- Parse payload ---
    const payload = JSON.parse(rawBody);
    const { event, call } = payload;

    // Only process call_analyzed; ack other events silently
    if (event !== 'call_analyzed') {
      return new Response(null, { status: 204 });
    }

    if (!call || !call.call_id) {
      return Response.json({ error: 'Missing call_id' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const serviceRole = base44.asServiceRole;

    // --- Deduplication: skip if we already have a report for this call_id ---
    const existing = await serviceRole.entities.CallGuardReport.filter({ call_id: call.call_id });
    if (existing.length > 0) {
      return new Response(null, { status: 204 });
    }

    // --- Extract Retell fields ---
    const transcript = call.transcript || '';
    const callAnalysis = call.call_analysis || {};
    const callSummary = callAnalysis.call_summary || '';
    const callAnalysisData = JSON.stringify(callAnalysis);

    // --- Store the report ---
    const report = await serviceRole.entities.CallGuardReport.create({
      call_id: call.call_id,
      event,
      transcript,
      call_summary: callSummary,
      call_analysis_data: callAnalysisData,
      processed: false,
    });

    // --- Send to Vardin's scam-analysis AI (after storage) ---
    // Vardin makes the final SAFE / SUSPICIOUS / SCAM decision and confidence score.
    try {
      await analyzeWithVardin(serviceRole, report.id, transcript, callSummary, callAnalysisData);
    } catch (analysisErr) {
      console.error('Vardin analysis failed for call', call.call_id, analysisErr);
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});