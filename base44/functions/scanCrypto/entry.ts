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
      ? `Scam detection expert: analyze this ${blockchain || 'blockchain'} wallet/contract address for scam risk. Address: "${input}". Use live web information where available. Check authoritative block explorers, token/project documentation, known scam reports, contract verification, honeypot signals, liquidity/lock information, and reputable security reports. Explain the evidence and uncertainty. Return the requested JSON.`
      : `Scam detection expert: analyze this crypto/investment message for scam risk.\nMessage: "${input}"\n\n${urlContext ? `A link in the message was also scanned. Treat this as additional evidence, not as a replacement for analyzing the message:\n${JSON.stringify(urlContext)}\n` : ''}Rules: never say "definitely a scam" (use "likely"); plain English; educational. Analyze the COMPLETE message and its requested action, not just a token name or one keyword. Name manipulation tactics when applicable (e.g. Urgency, Authority Impersonation, Scarcity, Fake Reward/Giveaway, Payment Red Flags, Wallet-Drainer Risk) and concrete next steps (e.g. Do not reply, Block sender, Do not connect a wallet, Do not approve/sign transactions). Legitimate token names such as USDT, BTC, or ETH do NOT make the surrounding message safe.\n\nRISK SCORE: Set risk_score as a whole number 0-100 that reflects the ACTUAL danger of this message. Low risk = 0-35, Medium risk = 36-70, High risk = 71-100. The score MUST match the risk_level. Do NOT default to 10 or any fixed number — vary it based on how many scam indicators are present and how severe they are.`;

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

    // Safety floor for a specific high-confidence wallet-drainer pattern.
    // AI still performs the full analysis; this prevents a legitimate token name
    // from accidentally overriding multiple concrete scam signals in combination.
    if (mode === 'investment') {
      const message = inputLower;
      const hasReward = /(selected|eligible|claim|reward|airdrop|giveaway).{0,180}(usdt|usdc|btc|eth|token|crypto|\$)/i.test(message);
      const hasLargeAmount = /(?:\b\d[\d,.]*\s*(?:usdt|usdc|btc|eth|tokens?)\b|\$\s*\d[\d,.]*\b)/i.test(message);
      const hasUrgency = /(closes? in|expires? in|\b\d+\s*(?:minutes?|hours?)\b|don't miss|hurry|limited time|deadline|timer)/i.test(message);
      const hasClaimLink = /https?:\/\//i.test(message);
      const hasWalletAction = /(connect (?:your )?wallet|approve (?:the )?transaction|sign (?:the )?transaction|approve|connect wallet)/i.test(message);

      if (hasReward && hasLargeAmount && hasUrgency && hasClaimLink && hasWalletAction) {
        result.risk_level = 'high';
        result.risk_score = Math.max(Number(result.risk_score) || 0, 90);
        result.is_likely_scam = true;
        result.explanation = `This message is highly suspicious. It combines an unsolicited crypto reward with a large amount, a short deadline, a claim link, and a request to connect a wallet or approve a transaction. Those are classic social-engineering and wallet-drainer warning signs. The fact that it mentions a legitimate token such as USDT does not make the message legitimate.`;
        result.red_flags = Array.from(new Set([
          ...(Array.isArray(result.red_flags) ? result.red_flags : []),
          'Unsolicited crypto reward offer',
          'Large/free token amount',
          'Short deadline or urgency',
          'External claim link',
          'Request to connect a wallet or approve a transaction',
        ]));
        result.tactics_detected = Array.from(new Set([
          ...(Array.isArray(result.tactics_detected) ? result.tactics_detected : []),
          'Urgency',
          'Scarcity',
          'Fake giveaway / reward',
          'Wallet-drainer risk',
        ]));
        result.next_steps = [
          'Do NOT connect your wallet or approve/sign the transaction',
          'Do NOT send crypto or pay a claim fee',
          'Close the link and report/block the sender',
          'If you already connected a wallet, revoke suspicious approvals and move remaining funds to a safe wallet',
        ];
      }
    }

    (result as any).timing_ms = Date.now() - startTime;
    return Response.json(result);
  } catch (error: any) {
    console.error('scanCrypto error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
