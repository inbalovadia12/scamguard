import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { getAvailableCredits, applyCreditUsage, getMonthlyCreditLimit } from '../../shared/credits.ts';
import {
  analyzeScamContext,
  type ConversationTurn,
} from '../../shared/callGuardAnalysis.ts';

// Live streaming counterpart to analyzeCallChunk. The transcription now
// happens client-side via the AssemblyAI Streaming WebSocket; this function
// only runs the contextual scam analysis on a finalized transcript turn and
// charges 1 credit (same model as the batch path). Empty turns are free.
const CREDIT_COST = 1;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Auth required' }, { status: 401 });

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium') {
      return Response.json({ error: 'Premium required' }, { status: 403 });
    }

    const available = getAvailableCredits(user);
    if (available.remaining < CREDIT_COST) {
      return Response.json({
        error: 'Insufficient credits',
        credits_remaining: available.remaining,
        credits_limit: getMonthlyCreditLimit(user),
      }, { status: 402 });
    }

    const body = await req.json();
    const text = (body.text || '').trim();
    const speaker = body.speaker || 'caller';
    const language = body.language || 'en';
    const conversationContext: ConversationTurn[] = Array.isArray(body.conversation_context)
      ? body.conversation_context
      : [];
    const reportedIndicators: string[] = Array.isArray(body.reported_indicators)
      ? body.reported_indicators
      : [];

    // Silence / empty turn — no charge, no analysis.
    if (!text) {
      return Response.json({
        risk_level: 'low',
        warnings: [],
        new_indicators: [],
        tactics_detected: [],
        red_flags: [],
        feedback: '',
        summary: '',
        credits_used: 0,
        credits_remaining: available.remaining,
        credits_limit: getMonthlyCreditLimit(user),
      });
    }

    const fullConversation: ConversationTurn[] = [
      ...conversationContext,
      { speaker: speaker as ConversationTurn['speaker'], text },
    ];

    const analysis = await analyzeScamContext(
      base44,
      fullConversation,
      reportedIndicators,
      language
    );

    const chargeCredits = async () => {
      const usage = applyCreditUsage(user, CREDIT_COST);
      if (!usage) throw new Error('Credit balance changed during analysis. Please try again.');
      await base44.auth.updateMe(usage);
      return getAvailableCredits({ ...user, ...usage }).remaining;
    };
    const creditsRemaining = await chargeCredits();

    return Response.json({
      risk_level: analysis.risk_level,
      warnings: analysis.warnings,
      new_indicators: analysis.new_indicators,
      tactics_detected: analysis.new_indicators.map((i) => i.type),
      red_flags: analysis.new_indicators.map((i) => i.description),
      feedback: analysis.feedback,
      summary: analysis.summary,
      credits_used: CREDIT_COST,
      credits_remaining: creditsRemaining,
      credits_limit: getMonthlyCreditLimit(user),
    });
  } catch (error: any) {
    console.error('analyzeCallSegment error:', error?.message);
    return Response.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
});