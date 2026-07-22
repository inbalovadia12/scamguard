import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium' && plan !== 'plus') {
      return Response.json({ error: 'Premium subscription required', upgrade_url: 'https://vardin.base44.app/pricing' }, { status: 403 });
    }

    const body = await req.json();
    const { action, scenario_id, conversation, language } = body;

    const LANGUAGE_NAMES: Record<string, string> = { en: 'English', he: 'Hebrew', es: 'Spanish' };
    const languageName = LANGUAGE_NAMES[language] || 'English';

    // ── ACTION: START ── Returns the scammer's opening line
    if (action === 'start') {
      const prompt = `You are roleplaying as a phone scammer for an educational training simulator. The user is a student practicing how to handle scam calls.

SCENARIO: ${scenario_id}

Your task: Generate the scammer's OPENING LINE — the very first thing they say when the call connects. Make it realistic and convincing, just like a real scammer would speak. Use the appropriate persona, tone, and manipulation style for this scam type.

Guidelines:
- Be realistic — real scammers sound professional and friendly at first
- Do NOT reveal you are a scammer or that this is a simulation
- Keep it to 2-3 sentences maximum
- Do NOT ask for money or sensitive info in the opening line — build rapport first
- Speak naturally in ${languageName}

Respond with JSON containing:
- scammer_line: The scammer's opening line
- tactic_used: The primary manipulation tactic used (e.g., "Authority & Trust", "Friendly Approach", "Urgency")
- tactic_description: Brief explanation of why this tactic works on victims`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            scammer_line: { type: 'string' },
            tactic_used: { type: 'string' },
            tactic_description: { type: 'string' },
          },
          required: ['scammer_line', 'tactic_used'],
        },
      });

      return Response.json({
        scammer_line: result.scammer_line,
        tactic_used: result.tactic_used || '',
        tactic_description: result.tactic_description || '',
      });
    }

    // ── ACTION: RESPOND ── Returns the scammer's next reply + assessment of user's last message
    if (action === 'respond') {
      const convoText = conversation
        .map((m: { speaker: string; text: string }) => `${m.speaker === 'scammer' ? 'SCAMMER' : 'STUDENT'}: ${m.text}`)
        .join('\n');

      const prompt = `You are running an educational scam call simulator. A student is roleplaying against an AI scammer.

SCENARIO: ${scenario_id}

CONVERSATION SO FAR:
${convoText}

Your task has TWO parts:

PART 1 — Assess the student's LAST message:
- Did they fall for the scammer's tactic? (e.g., shared info, agreed to pay, showed fear/compliance)
- Did they share any sensitive information? (SSN, bank details, passwords, address, card numbers)
- Did they challenge, question, or push back against the scammer?
- Did they correctly identify the scam or show suspicion?
- Give brief, constructive feedback (praise good moves, warn about bad ones)

PART 2 — Generate the scammer's NEXT reply:
- Stay in character as a convincing scammer
- Escalate tactics if the student is compliant (push harder for money/info)
- If the student is resisting, try different manipulation angles (guilt, fear, authority, urgency)
- If the student has clearly ended the call (said goodbye, threatened to report, etc.), set should_continue to false
- Do NOT reveal you are a scammer — stay in character
- Keep replies to 1-3 sentences
- After about 6-8 exchanges, if the student hasn't hung up, the scammer should make a final push or give up
- Speak naturally in ${languageName}

Respond with JSON containing:
- scammer_line: The scammer's next reply (empty string if the call has ended)
- tactic_used: The manipulation tactic used in THIS reply (e.g., "Urgency & Pressure", "Intimidation", "Isolation", "Phishing for Info", "False Authority", "Emotional Manipulation", "Payment Request")
- user_assessment: object with:
  - fell_for_tactic: boolean (did the student comply or show vulnerability?)
  - shared_sensitive_info: boolean (did they reveal personal/financial info?)
  - challenged_scammer: boolean (did they question, push back, or show suspicion?)
  - identified_scam: boolean (did they explicitly call it a scam or show clear recognition?)
  - feedback: string (brief constructive feedback on their last response)
- should_continue: boolean (should the call continue, or has it naturally ended?)`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            scammer_line: { type: 'string' },
            tactic_used: { type: 'string' },
            user_assessment: {
              type: 'object',
              properties: {
                fell_for_tactic: { type: 'boolean' },
                shared_sensitive_info: { type: 'boolean' },
                challenged_scammer: { type: 'boolean' },
                identified_scam: { type: 'boolean' },
                feedback: { type: 'string' },
              },
              required: ['fell_for_tactic', 'shared_sensitive_info', 'challenged_scammer', 'feedback'],
            },
            should_continue: { type: 'boolean' },
          },
          required: ['scammer_line', 'tactic_used', 'user_assessment', 'should_continue'],
        },
      });

      return Response.json({
        scammer_line: result.scammer_line || '',
        tactic_used: result.tactic_used || '',
        user_assessment: {
          fell_for_tactic: result.user_assessment?.fell_for_tactic ?? false,
          shared_sensitive_info: result.user_assessment?.shared_sensitive_info ?? false,
          challenged_scammer: result.user_assessment?.challenged_scammer ?? false,
          identified_scam: result.user_assessment?.identified_scam ?? false,
          feedback: result.user_assessment?.feedback || '',
        },
        should_continue: result.should_continue ?? true,
      });
    }

    // ── ACTION: END ── Returns the final score with breakdown
    if (action === 'end') {
      const convoText = conversation
        .map((m: { speaker: string; text: string }) => `${m.speaker === 'scammer' ? 'SCAMMER' : 'STUDENT'}: ${m.text}`)
        .join('\n');

      const prompt = `You are evaluating a student who just completed a scam call simulation.

SCENARIO: ${scenario_id}

FULL CONVERSATION:
${convoText}

Score the student's performance across 4 categories (0-100 each):

1. INFORMATION PROTECTION (0-100): Did they protect their personal and financial information? 
   - 100 = shared nothing sensitive, gave no personal details
   - 0 = shared SSN, bank details, passwords, card numbers, or personal info the scammer could use

2. TACTIC RECOGNITION (0-100): Did they recognize the manipulation tactics being used?
   - 100 = identified the scam early, called out specific tactics
   - 50 = showed some suspicion but didn't fully recognize the scam
   - 0 = never recognized it was a scam

3. RESISTANCE & PUSHBACK (0-100): Did they resist the scammer's demands and push back?
   - 100 = firmly refused all requests, challenged the scammer, hung up
   - 50 = showed some resistance but wavered or partially complied
   - 0 = fully complied with demands

4. CALL HANDLING (0-100): Did they handle the call appropriately?
   - 100 = hung up promptly, refused to stay on the line, said they'd verify through official channels
   - 50 = stayed on the call longer than necessary but didn't comply
   - 0 = stayed on the line, followed instructions, didn't attempt to end the call

Also provide:
- overall_score: weighted average (information_protection 35%, tactic_recognition 25%, resistance 25%, call_handling 15%)
- grade: letter grade (A+, A, B+, B, C+, C, D, F) based on overall_score
- strengths: 2-3 things the student did well (empty array if none)
- improvements: 2-3 things they should improve (empty array if perfect)
- summary: 2-3 sentence overall assessment with encouragement
- tactics_encountered: list of all manipulation tactics the scammer used during the call

Respond entirely in ${languageName}.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_score: { type: 'number' },
            grade: { type: 'string' },
            breakdown: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string' },
                  score: { type: 'number' },
                  feedback: { type: 'string' },
                },
                required: ['category', 'score', 'feedback'],
              },
            },
            strengths: { type: 'array', items: { type: 'string' } },
            improvements: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
            tactics_encountered: { type: 'array', items: { type: 'string' } },
          },
          required: ['overall_score', 'grade', 'breakdown', 'summary'],
        },
      });

      return Response.json({
        overall_score: Math.round(result.overall_score || 0),
        grade: result.grade || 'F',
        breakdown: result.breakdown || [],
        strengths: result.strengths || [],
        improvements: result.improvements || [],
        summary: result.summary || '',
        tactics_encountered: result.tactics_encountered || [],
      });
    }

    return Response.json({ error: 'Invalid action. Use "start", "respond", or "end".' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});