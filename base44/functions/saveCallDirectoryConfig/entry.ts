import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { DEFAULT_CONFIG } from '../../shared/phoneReputation.ts';

// ADMIN ONLY. Creates or updates the single caller-ID configuration record.

const FIELDS = [
  'scam_label', 'spam_label', 'suspicious_label', 'safe_label', 'unknown_label',
  'min_confidence', 'include_safe', 'include_verified_businesses', 'entitled_plans',
];

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const existing = await base44.asServiceRole.entities.CallerIdConfig.list('-updated_at', 1);

    const patch: any = { updated_at: now };
    for (const f of FIELDS) if (body[f] !== undefined) patch[f] = body[f];

    let saved;
    if (existing.length > 0) {
      saved = await base44.asServiceRole.entities.CallerIdConfig.update(existing[0].id, patch);
    } else {
      saved = await base44.asServiceRole.entities.CallerIdConfig.create({ ...DEFAULT_CONFIG, ...patch });
    }
    return Response.json({ ok: true, config: saved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}