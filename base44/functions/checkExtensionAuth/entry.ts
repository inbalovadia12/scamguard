import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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
    const plan = user.subscription_plan || 'starter';
    const premium = plan === 'premium' || plan === 'plus';

    return Response.json({
      authenticated: true,
      premium: premium,
      plan: plan,
      user_name: user.full_name || user.email
    });
  } catch (error) {
    return Response.json({
      authenticated: false,
      premium: false,
      error: error.message
    }, { status: 500 });
  }
});