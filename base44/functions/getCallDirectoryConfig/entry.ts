import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getConfig } from '../../shared/phoneReputation.ts';

// ADMIN ONLY. Returns the current caller-ID configuration (labels + thresholds).

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
    const config = await getConfig(base44);
    return Response.json({ config });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}