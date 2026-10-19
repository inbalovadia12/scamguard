import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Generates a short, descriptive title for a chat conversation based on its
// first few messages. Called by the AgentChat page after the first AI response
// to replace the truncated-first-message placeholder.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const { messages } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'Messages required' }, { status: 400 });
    }

    const summary = messages
      .slice(0, 4)
      .map((m: any) => `${m.role}: ${(m.content || '').slice(0, 300)}`)
      .join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a very short title (3-6 words, max 40 characters) for this conversation. The title should capture the main topic or question. Return ONLY the title text — no quotes, no explanation, no punctuation at the end.\n\nConversation:\n${summary}`,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string", description: "3-6 word title, max 40 chars" }
        },
        required: ["title"]
      },
      model: "gpt_5_mini",
    });

    const title = ((result?.title as string) || '').slice(0, 40).trim() || 'New Chat';
    return Response.json({ title });
  } catch (error: any) {
    return Response.json({ error: error?.message || 'Title generation failed' }, { status: 500 });
  }
});