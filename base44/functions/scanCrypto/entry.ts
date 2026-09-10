import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * scanCrypto - OPTIMIZED
 * 
 * OPTIMIZATIONS:
 * - AI-first analysis for investment messages (no keyword-only verdicts)
 * - Live web context for token/project/address verification
 * - Longer LLM timeout so the model can actually complete the message check
 * - Timing info in response
 */

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
    risk_score: { type: 'number', description: '0-100' },
    explanation: { type: 'string' },
    is_likely_scam: { type: 'boolean' },
    contract_verified: { type: 'boolean' },
    honeypot_risk: { type: 'string', enum: ['low', 'medium', 'high'] },
    rug_pull_risk: { type: 'string', enum: ['low', 'medium', 'high'] },
    liquidity_status: { type: 'string' },
    red_flags: { type: 'array', items: { type: 'string' } },
    tactics_detected: { type: 'array', items: { type: 'string' } },
    what_they_want: { type: 'string' },
    why_scammers_do_this: { type: 'string' },
    what_to_say: { type: 'string' },
    next_steps: { type: 'array', items: { type: 'string' } },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['risk_level', 'risk_score', 'explanation'],
};

// Database of known safe tokens (verified, established)
const KNOWN_SAFE_TOKENS: Record<string, any> = {
  'bitcoin': { name: 'Bitcoin', risk_score: 15, verified: true },
  'ethereum': { name: 'Ethereum', risk_score: 15, verified: true },
  'usdc': { name: 'USD Coin', risk_score: 10, verified: true },
  'usdt': { name: 'Tether', risk_score: 15, verified: true },
  'dai': { name: 'Dai', risk_score: 15, verified: true },
  'bnb': { name: 'BNB', risk_score: 15, verified: true },
  'solana': { name: 'Solana', risk_score: 15, verified: true },
  'cardano': { name: 'Cardano', risk_score: 15, verified: true },
  'ripple': { name: 'XRP', risk_score: 20, verified: true },
  'dogecoin': { name: 'Dogecoin', risk_score: 25, verified: true },
};

// Database of known scam patterns
const KNOWN_SCAM_INDICATORS = [
  'send X get 2X back',
  'guaranteed returns',
  'limited time offer',
  'hurry before',
  'act now',
  'double your money',
  'free money',
  'no risk',
  'get rich quick',
  'send ethereum',
  'send btc',
  'piggy bank',
  'pig butcher',
  'pig slaughter',
  'elon musk',
  'spacex',
  'tesla',
  'celebrity endorsement',
  'token airdrop',
  'free token',
  'whitelisted',
  'presale',
  'ido scam',
];

Deno.serve(async (req) => {
  const startTime = Date.now();
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const mode = body.mode;
    const input = (body.input || '').trim();
    const blockchain = body.blockchain || '';
    const urlContext = body.url_context || null;

    if (!mode || !input) {
      return Response.json({ error: 'mode and input required' }, { status: 400 });
    }

    const inputLower = input.toLowerCase();

    // Investment messages must be analyzed as messages. A mention of a legitimate
    // token (e.g. BTC/USDT) does NOT make the surrounding DM legitimate, so never
    // use the token list as an early exit for this mode.
    if (mode === 'investment') {
      // Skip all keyword-based early exits and send the complete message to AI.
    } else {
      // === EARLY EXIT: Known safe tokens (address mode only) ===
      for (const [key, token] of Object.entries(KNOWN_SAFE_TOKENS)) {
      if (inputLower.includes(key)) {
        return Response.json({
          risk_level: 'low',
          risk_score: token.risk_score,
          explanation: `${token.name} is an established, verified token. No scam indicators detected.`,
          is_likely_scam: false,
          contract_verified: token.verified,
          honeypot_risk: 'low',
          rug_pull_risk: 'low',
          liquidity_status: 'Locked / Established',
          red_flags: [],
          tactics_detected: [],
          what_they_want: 'N/A',
          why_scammers_do_this: 'N/A',
          what_to_say: 'This is a legitimate token.',
          next_steps: ['Trade on major exchanges only', 'Use official wallets'],
          sources: ['Verified blockchain data'],
          cached: true,
          timing_ms: Date.now() - startTime,
        });
      }
      }
    }

    // === EARLY EXIT: Obvious scam patterns (address mode only) ===
    // Investment messages intentionally skip this path so AI can evaluate context
    // instead of declaring a message a scam from a single matching phrase.
    let hasObviousScamPattern = false;
    if (mode !== 'investment') {
      for (const indicator of KNOWN_SCAM_INDICATORS) {
        if (inputLower.includes(indicator)) {
          hasObviousScamPattern = true;
          break;
        }
      }
    }

    if (hasObviousScamPattern) {
      return Response.json({
        risk_level: 'high',
        risk_score: 85,
        explanation: `This message contains common crypto scam indicators: guaranteed returns, urgency tactics, or celebrity impersonation.`,
        is_likely_scam: true,
        contract_verified: false,
        honeypot_risk: 'high',
        rug_pull_risk: 'high',
        liquidity_status: 'Unknown / Likely no liquidity',
        red_flags: [
          'Guaranteed returns (impossible)',
          'Urgency/pressure tactics',
          'Request to send crypto',
          'Celebrity impersonation or endorsement',
        ],
        tactics_detected: ['Pig-butchering scam', 'Fake giveaway', 'Unrealistic promises'],
        what_they_want: 'Your cryptocurrency',
        why_scammers_do_this: 'To steal money through social engineering',
        what_to_say: 'No legitimate investment guarantees returns. This is a scam.',
        next_steps: ['Do NOT send any cryptocurrency', 'Report to law enforcement', 'Block the sender'],
        sources: ['Scam pattern database'],
        detected: 'fast_path',
        timing_ms: Date.now() - startTime,
      });
    }

    // === LLM ANALYSIS (WITH TIMEOUT) ===
    const prompt = mode === 'address'
      ? `You are Vardin's crypto safety analyst. Analyze this ${blockchain || 'blockchain'} wallet/contract address using live web information where available. Address: "${input}". Check authoritative block explorers, token/project documentation, known scam reports, contract verification, honeypot signals, liquidity/lock information, and reputable community/security reports. Separate verified facts from uncertainty. Do not claim a contract is safe merely because it is verified, and do not invent on-chain facts. Explain exactly what evidence supports the risk score. Include source URLs only when they were actually consulted.`
      : `You are Vardin's AI message-checking engine. Analyze the COMPLETE crypto DM/investment/giveaway message below, not just isolated keywords.\n\nMESSAGE:\n"""${input}"""\n\n${urlContext ? `LIVE URL SCAN FOR THE LINK IN THIS MESSAGE:\n${JSON.stringify(urlContext)}\n\nUse this URL evidence as additional context, but still judge the COMPLETE MESSAGE. A clean/unknown URL does NOT make a suspicious message safe, and a suspicious URL should strengthen the risk assessment when the message asks the user to visit it.\n` : 'If the message contains a URL, inspect it with live web context when possible.\n'}\nDetermine whether the COMPLETE message is likely legitimate, suspicious, or a scam. Consider unsolicited crypto rewards or airdrops, unusually large/free token amounts, fake eligibility, claim deadlines/countdowns, pressure to act, requests to verify/connect a wallet, sign a transaction, approve a token, pay a fee, send crypto first, provide a seed phrase/private key, login credentials, or personal information. Also check impersonation, investment promises, fake endorsements, withdrawal claims, pig-butchering/drainer patterns, suspicious links/domains, and whether the claimed reward is plausible.\n\nIMPORTANT: Legitimate token names such as USDT, BTC, ETH, etc. do NOT make the surrounding message legitimate. The words airdrop, giveaway, or investment alone do NOT prove a scam either. Judge the full context and requested action.\n\nOnly report red flags actually present in the message or supported by live URL evidence. Do not invent sources or facts. Give a calibrated 0-100 risk score and explain the strongest evidence. An unsolicited large reward + short deadline + wallet connection/transaction approval request is strong evidence of high risk. For a benign message, explicitly say why it appears benign and keep the score low. Respond in plain English suitable for a non-technical user. Include source URLs only for sources actually consulted.`;

    let result;
    try {
      const llmPromise = base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: RESPONSE_SCHEMA,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 15000)
      );

      result = await Promise.race([llmPromise, timeoutPromise]);
    } catch (e) {
      // LLM timeout - return conservative analysis
      result = {
        risk_level: 'medium',
        risk_score: 50,
        explanation: 'The AI analysis could not be completed in time, so Vardin cannot reliably classify this message. No scam verdict was inferred from the timeout.',
        is_likely_scam: false,
        contract_verified: false,
        honeypot_risk: 'medium',
        rug_pull_risk: 'medium',
        liquidity_status: 'Unknown',
        red_flags: ['AI verification was incomplete'],
        tactics_detected: [],
        what_they_want: 'Unknown',
        why_scammers_do_this: 'Unknown',
        what_to_say: 'I could not complete the AI check, so I cannot reliably classify this message.',
        next_steps: ['Do not send funds or connect a wallet until the AI check can be completed', 'Try the scan again'],
        sources: [],
      };
    }

    (result as any).timing_ms = Date.now() - startTime;
    return Response.json(result);
  } catch (error: any) {
    console.error('scanCrypto error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
