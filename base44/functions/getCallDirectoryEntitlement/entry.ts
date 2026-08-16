import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { isCallerIdEntitled, getConfig } from '../../shared/phoneReputation.ts';

// Lets the future iOS app check whether the signed-in Vardin user's current plan
// includes caller identification, before calling the snapshot/changes endpoints.
// Uses Vardin's existing subscription/plan hierarchy — no hard-coded prices.

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    const config = await getConfig(base44);
    const plan = String(user.subscription_plan || 'starter').toLowerCase();
    const entitled = isCallerIdEntitled(user, config);
    return Response.json({
      entitled,
      caller_id_enabled: entitled,
      plan,
      entitled_plans: config.entitled_plans || ['plus', 'premium'],
      upgrade_url: 'https://vardin.base44.app/pricing',
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}