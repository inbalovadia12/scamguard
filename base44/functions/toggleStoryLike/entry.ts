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

    // Check if user already liked this story (prevents duplicate likes)
    const existing = await base44.asServiceRole.entities.StoryLike.filter({
      story_id,
      created_by_id: user.id,
    });

    if (action === 'like') {
      // Only increment if not already liked
      if (existing.length === 0) {
        await base44.asServiceRole.entities.StoryLike.create({
          story_id,
          created_by_id: user.id,
        });
        await base44.asServiceRole.entities.CommunityStory.updateMany(
          { id: story_id, status: 'active' },
          { $inc: { likes_count: 1 } }
        );
      }
    } else {
      // Only decrement if already liked
      if (existing.length > 0) {
        await base44.asServiceRole.entities.StoryLike.delete(existing[0].id);
        await base44.asServiceRole.entities.CommunityStory.updateMany(
          { id: story_id, status: 'active' },
          { $inc: { likes_count: -1 } }
        );
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});