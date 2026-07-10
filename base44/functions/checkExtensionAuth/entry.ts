import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const PLAN_LIMITS = { starter: 15, plus: 150, premium: 400 };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Validate user token server-side
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({
        authenticated: false,
        premium: false
      }, { status: 401 });
    }

    // Check premium status server-side
    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    const premium = plan === 'premium' || plan === 'plus';

    // Calculate remaining credits
    const currentMonth = new Date().toISOString().slice(0, 7);
    let creditsUsed = user.credits_used || 0;
    if (user.credits_reset_month !== currentMonth) {
      creditsUsed = 0;
    }
    const creditLimit = PLAN_LIMITS[plan] || PLAN_LIMITS.starter;
    const creditsRemaining = Math.max(0, creditLimit - creditsUsed);

    return Response.json({
      authenticated: true,
      premium: premium,
      plan: plan,
      user_name: user.full_name || user.email,
      credits_remaining: creditsRemaining,
      credits_limit: creditLimit
    });
  } catch (error) {
    return Response.json({
      authenticated: false,
      premium: false,
      error: error.message
    }, { status: 500 });
  }
});