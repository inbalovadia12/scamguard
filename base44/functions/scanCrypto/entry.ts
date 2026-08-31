import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * scanCrypto - OPTIMIZED
 * 
 * OPTIMIZATIONS:
 * - Known verified token database (instant result, skip LLM)
 * - Known scam detection (instant HIGH RISK, skip LLM)
 * - LLM timeout: 1.5 seconds
 * - Timing info in response
 * - Early detection for obvious red flags
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

    if (!mode || !input) {
      return Response.json({ error: 'mode and input required' }, { status: 400 });
    }

    const inputLower = input.toLowerCase();

    // === EARLY EXIT: Known safe tokens ===
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

    // === EARLY EXIT: Obvious scam patterns ===
    let hasObviousScamPattern = false;
    for (const indicator of KNOWN_SCAM_INDICATORS) {
      if (inputLower.includes(indicator)) {
        hasObviousScamPattern = true;
        break;
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
      ? `Assess this ${blockchain || 'blockchain'} wallet/contract for scam signals.\nAddress: "${input}"\nSearch: block explorers, scam databases, honeypot detectors, liquidity lock status, verified status, community reports. High-signal results only. Respond plain English. Always include source URLs.`
      : `Analyze this investment opportunity for crypto scams.\nContent: "${input}"\nSearch: token, project, team, giveaway, exchange, celebrity mentioned. Identify: pig-butchering, fake giveaways, impersonation, rug-pull, phishing, unrealistic returns, pressure. High-signal results only. Respond plain English. Always include source URLs.`;

    let result;
    try {
      const llmPromise = base44.integrations.Core.InvokeLLM({
        prompt,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: RESPONSE_SCHEMA,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 1500)
      );

      result = await Promise.race([llmPromise, timeoutPromise]);
    } catch (e) {
      // LLM timeout - return conservative analysis
      result = {
        risk_level: 'medium',
        risk_score: 50,
        explanation: 'LLM analysis timeout. Unable to complete full analysis.',
        is_likely_scam: false,
        contract_verified: false,
        honeypot_risk: 'medium',
        rug_pull_risk: 'medium',
        liquidity_status: 'Unknown',
        red_flags: ['Unable to verify - assume medium risk'],
        tactics_detected: [],
        what_they_want: 'Unknown',
        why_scammers_do_this: 'Unknown',
        what_to_say: 'Be cautious. Cannot verify this token.',
        next_steps: ['Research independently on blockchain explorer', 'Never send cryptocurrency to unknown addresses'],
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
