import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const SCAM_TYPES = [
  'phishing_email', 'smishing', 'romance', 'crypto_investment', 'marketplace',
  'tech_support', 'fake_job', 'delivery', 'lottery_prize',
  'government_impersonation', 'bank_impersonation', 'other',
];

// Shares a result from the browser extension into the community feed.
// The caller can only ever post as themselves: the story is created with the
// caller's own token, so CommunityStory RLS keeps created_by_id = caller.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
    const story = typeof body.story === 'string' ? body.story.trim().slice(0, 4000) : '';
    if (!title || !story) {
      return Response.json({ error: 'title and story are required' }, { status: 400 });
    }

    const anonymous = body.anonymous === true;
    const scamType = SCAM_TYPES.indexOf(body.scam_type) === -1 ? 'other' : body.scam_type;

    const created = await base44.entities.CommunityStory.create({
      title,
      story,
      scam_type: scamType,
      channel: 'website',
      anonymous,
      author_name: anonymous ? undefined : (user.full_name || 'Vardin user'),
      likes_count: 0,
      status: 'active',
    });

    return Response.json({ success: true, id: created.id });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}