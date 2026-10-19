import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Stores a custom display name for an agent conversation. The installed SDK
// version does not expose base44.agents.updateConversation, so we persist the
// name in a ConversationMeta entity keyed by conversation_id. The client merges
// these records with the SDK's conversation list at load time.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const { conversation_id, name } = await req.json();
    if (!conversation_id || !name || typeof name !== 'string') {
      return Response.json({ error: 'conversation_id and name are required' }, { status: 400 });
    }

    const trimmedName = name.trim().slice(0, 100);
    if (!trimmedName) {
      return Response.json({ error: 'Name cannot be empty' }, { status: 400 });
    }

    // Upsert the conversation meta record (keyed by conversation_id)
    const result = await base44.entities.ConversationMeta.upsert(
      [{ conversation_id, name: trimmedName }],
      { key: 'conversation_id' }
    );

    return Response.json({ ok: true, name: trimmedName, result });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Rename failed' }, { status: 500 });
  }
});