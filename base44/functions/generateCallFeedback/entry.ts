import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    if (!await base44.auth.me()) {
      return Response.json({ error: 'Auth required' }, { status: 401 });
    }

    const { text, speaker, context, language } = await req.json();
    if (!text) return Response.json({ error: 'Text is required' }, { status: 400 });

    const groqKey = Deno.env.get('GROQ_STT');
    if (!groqKey) {
      return Response.json({ error: 'Groq speech-to-text is not configured' }, { status: 500 });
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.6-27b',
        messages: [
          {
            role: 'system',
            content: 'You are a scam prevention coach. Return only a compact JSON object with a feedback string. Do not explain your reasoning.',
          },
          {
            role: 'user',
            content: JSON.stringify({ text, speaker, context, language, output: { feedback: 'string' } }),
          },
        ],
        response_format: { type: 'json_object' },
        reasoning_effort: 'none',
        temperature: 0,
        max_completion_tokens: 60,
      }),
      signal: AbortSignal.timeout(1000),
    });

    if (!response.ok) {
      return Response.json({ error: 'Fast feedback is temporarily unavailable' }, { status: 502 });
    }

    const data = await response.json();
    const output = JSON.parse(data.choices?.[0]?.message?.content || '{}');
    return Response.json({ feedback: typeof output.feedback === 'string' ? output.feedback : '' });
  } catch {
    return Response.json({ error: 'Fast feedback is temporarily unavailable' }, { status: 502 });
  }
});