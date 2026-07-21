import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { story_id, action } = await req.json();
    if (!story_id) return Response.json({ error: 'story_id is required' }, { status: 400 });
    if (action !== 'like' && action !== 'unlike') {
      return Response.json({ error: 'Invalid action' }, { status: 400 });
    }

    const increment = action === 'like' ? 1 : -1;

    // Atomic increment — only likes_count can be modified, and only by ±1
    await base44.asServiceRole.entities.CommunityStory.updateMany(
      { id: story_id, status: 'active' },
      { $inc: { likes_count: increment } }
    );

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});