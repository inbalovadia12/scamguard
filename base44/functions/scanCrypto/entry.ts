import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    risk_score: { type: "number", description: "0-100 risk score. Low 0-35, Medium 36-70, High 71-100. Must match risk_level." },
    explanation: { type: "string" },
    is_likely_scam: { type: "boolean" },
    contract_verified: { type: "boolean", description: "Whether the contract is verified on the block explorer" },
    honeypot_risk: { type: "string", enum: ["low", "medium", "high"] },
    rug_pull_risk: { type: "string", enum: ["low", "medium", "high"] },
    liquidity_status: { type: "string", description: "e.g. Locked, Unlocked, Burned, Unknown" },
    red_flags: { type: "array", items: { type: "string" } },
    tactics_detected: { type: "array", items: { type: "string" } },
    what_they_want: { type: "string" },
    why_scammers_do_this: { type: "string" },
    what_to_say: { type: "string", description: "How to respond or decline safely" },
    next_steps: { type: "array", items: { type: "string" } },
    sources: { type: "array", items: { type: "string" } },
  },
  required: ["risk_level", "risk_score", "explanation"],
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const mode = body.mode;
    const input = (body.input || "").trim();
    const blockchain = body.blockchain || "";
    if (!mode || !input) {
      return Response.json({ error: "mode and input required" }, { status: 400 });
    }

    const prompt = mode === "address"
      ? `You are a crypto security expert. Assess this ${blockchain || "blockchain"} wallet/contract address for scam signals.\nAddress/Contract: "${input}"\nSearch live data: block explorers, scam databases, honeypot detectors, token contract reputation, liquidity lock status, verified status, and community reports. Determine if this is a known scam, honeypot, or rug-pull risk. Respond in plain English. Always provide source URLs in "sources". If data is limited, say so and score conservatively.`
      : `You are a crypto scam expert. Analyze this "investment opportunity" for scam patterns.\nContent: "${input}"\nSearch live data for the token, project, team, giveaway, exchange, or celebrity mentioned. Identify: pig-butchering romance-investment scams, fake giveaways ("send X get 2X"), impersonation of celebrities/exchanges, rug-pull tokens, phishing links, unrealistic guaranteed returns, and pressure tactics. Respond in plain English. Always provide source URLs in "sources".`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      model: "gemini_3_flash",
      response_json_schema: RESPONSE_SCHEMA,
    });

    return Response.json(result);
  } catch (error) {
    console.error("scanCrypto error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});