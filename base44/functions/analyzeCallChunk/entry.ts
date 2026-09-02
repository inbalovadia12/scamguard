import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * LiveGuard - Smart Scam Detection
 *
 * FIXES:
 * 1. Speaker detection that actually works
 * 2. Context-aware keyword detection (combination-based, not single-word)
 * 3. Proper red flag thresholds to avoid false positives
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Auth required' }, { status: 401 });

    let plan = user.subscription_plan || 'starter';
    if (plan === 'free') plan = 'starter';
    if (plan === 'elite') plan = 'premium';
    if (plan !== 'premium') {
      return Response.json({ error: 'Premium required' }, { status: 403 });
    }

    const body = await req.json();
    const {
      audio_url,
      audio_base64,
      audio_mime,
      language,
      session_context = '',
      speaker_history = '',
    } = body;

    const groqKey = Deno.env.get('GROQ_STT');
    if (!groqKey) {
      return Response.json({ error: 'Groq STT not configured' }, { status: 500 });
    }

    const startTime = Date.now();
    const languageCode = language === 'he' ? 'he' : language === 'es' ? 'es' : 'en';

    // ===== STEP 1: TRANSCRIBE WITH GROQ WHISPER =====
    const form = new FormData();
    form.set('model', 'whisper-large-v3-turbo');
    form.set('language', languageCode);
    form.set('response_format', 'verbose_json');
    form.set('timestamp_granularities[]', 'segment');

    if (audio_url) {
      form.set('url', audio_url);
    } else if (audio_base64) {
      const binaryString = atob(audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const mimeType = audio_mime || 'audio/webm';
      const ext = mimeType.split('/')[1]?.split(';')[0] || 'webm';
      form.set('file', new File([bytes], `call.${ext}`, { type: mimeType }));
    } else {
      throw new Error('No audio data provided');
    }

    const transcriptResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
      signal: AbortSignal.timeout(8000),
    });

    if (!transcriptResponse.ok) {
      const detail = await transcriptResponse.text().catch(() => '');
      throw new Error(`Groq transcription failed: ${transcriptResponse.status}`);
    }

    const transcriptData = await transcriptResponse.json();

    // ===== STEP 2: EXTRACT SEGMENTS =====
    const groqSegments: any[] = Array.isArray(transcriptData.segments) ? transcriptData.segments : [];

    const speechSegments = groqSegments.filter((seg: any) => {
      const noSpeech = typeof seg?.no_speech_prob === 'number' ? seg.no_speech_prob : 0;
      const lowConf = typeof seg?.avg_logprob === 'number' && seg.avg_logprob < -1.5;
      return seg?.text?.trim() && noSpeech < 0.55 && !lowConf;
    });

    const fullTranscript = speechSegments.length > 0
      ? speechSegments.map((s: any) => s.text.trim()).join(' ')
      : (transcriptData.text || '').trim();

    if (!fullTranscript.trim()) {
      return Response.json({
        transcript: '',
        segments: [],
        red_flags: [],
        risk_level: 'low',
        is_scam: false,
        feedback: '',
        analysis: 'No speech detected',
        confidence: 0,
        timing_ms: Date.now() - startTime,
      });
    }

    // ===== STEP 3: BUILD SEGMENTS =====
    interface Segment {
      speaker: string;
      text: string;
      start?: number;
      end?: number;
    }

    const rawSegments: Segment[] = (speechSegments.length > 0 ? speechSegments : groqSegments)
      .filter((s: any) => s?.text?.trim())
      .map((s: any) => ({
        speaker: 'unknown',
        text: s.text.trim(),
        start: s.start,
        end: s.end,
      }));

    if (rawSegments.length === 0 && fullTranscript) {
      rawSegments.push({ speaker: 'unknown', text: fullTranscript });
    }

    // ===== STEP 4: SIMPLE SPEAKER DETECTION =====
    // Strategy: Split into two lists - longer speeches vs shorter interjections
    // Longer speeches = likely the "caller" (scammer talks more)
    // Shorter responses = likely the "you" (victim responds briefly)
    
    const averageLength = rawSegments.reduce((sum, s) => sum + s.text.length, 0) / rawSegments.length;
    
    for (let i = 0; i < rawSegments.length; i++) {
      const seg = rawSegments[i];
      const text = seg.text.toLowerCase();
      
      // SHORT RESPONSES = YOU (victim)
      if (seg.text.length < 20 || text.includes('who') || text.includes('yes') || text.includes('okay') || text.includes('hello') || text.includes('what')) {
        seg.speaker = 'you';
      }
      // LONGER SPEECHES = CALLER (scammer)
      else if (seg.text.length > averageLength * 1.5 || text.includes('this is') || text.includes('we need') || text.includes('you need') || text.includes('give us')) {
        seg.speaker = 'caller';
      }
      // UNCERTAIN = neutral
      else {
        seg.speaker = 'unknown';
      }
    }

    // Try LLM-based classification as fallback
    try {
      const speakerResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: `Classify each segment as "you" (person holding phone, short responses, asking questions) or "caller" (other person, making statements/demands, talks more).

Return ONLY a JSON array of roles matching segment count. Example: ["you","caller","caller"]`,
            },
            {
              role: 'user',
              content: `Classify these ${rawSegments.length} segments:
${rawSegments.map((s, i) => `[${i}] "${s.text}"`).join('\n')}

Return: [`,
            },
          ],
          temperature: 0,
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(1500),
      });

      if (speakerResponse.ok) {
        const speakerData = await speakerResponse.json();
        const content = speakerData.choices?.[0]?.message?.content || '';
        
        try {
          // Extract JSON array
          const fullJson = '[' + content;
          const jsonMatch = fullJson.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            const roles: string[] = JSON.parse(jsonMatch[0]);
            if (Array.isArray(roles) && roles.length === rawSegments.length) {
              roles.forEach((role, i) => {
                if (role === 'you' || role === 'caller') {
                  rawSegments[i].speaker = role;
                }
              });
            }
          }
        } catch {
          // Parse failed, use heuristic above
        }
      }
    } catch {
      // LLM timeout, use heuristic classification above
    }

    // ===== STEP 5: MERGE CONSECUTIVE SAME-SPEAKER SEGMENTS =====
    const mergedSegments: Segment[] = [];
    for (const seg of rawSegments) {
      const prev = mergedSegments[mergedSegments.length - 1];
      if (prev && prev.speaker === seg.speaker) {
        prev.text += ' ' + seg.text;
        if (seg.end !== undefined) prev.end = seg.end;
      } else {
        mergedSegments.push({ ...seg });
      }
    }

    // ===== STEP 6: CONTEXT-AWARE KEYWORD DETECTION =====
    const transcriptLower = fullTranscript.toLowerCase();
    const redFlags: string[] = [];

    // Only flag COMBINATIONS of keywords, not single words alone
    
    // MONEY REQUEST + PRESSURE/THREAT/URGENCY
    const hasMoney = ['credit card', 'debit card', 'card number', 'wire transfer', 'send money', 'gift card', 'payment', 'pay', 'give us', 'fee', 'money order', 'crypto', 'bitcoin', 'venmo', 'cashapp', 'zelle'].some(kw => transcriptLower.includes(kw));
    const hasUrgency = ['immediately', 'right now', 'now', 'urgent', 'hurry', 'asap', 'quickly', 'before', 'must', 'have to', 'will die', 'gonna die', 'will be', 'will freeze'].some(kw => transcriptLower.includes(kw));
    const hasThreat = ['die', 'death', 'arrest', 'jail', 'lawsuit', 'freeze', 'suspend', 'penalty', 'fine', 'federal', 'court', 'deport'].some(kw => transcriptLower.includes(kw));
    const hasPersonal = ['social security', 'ssn', 'password', 'pin', 'account number', 'routing number', 'verify', 'confirm'].some(kw => transcriptLower.includes(kw));

    // RED FLAG: Money + urgency OR money + threat
    if (hasMoney && (hasUrgency || hasThreat)) {
      redFlags.push('Money request with pressure/threats detected');
    }

    // RED FLAG: Personal info request + urgency
    if (hasPersonal && hasUrgency) {
      redFlags.push('Personal information request with pressure detected');
    }

    // RED FLAG: Threats alone (if they're specific/serious)
    if (transcriptLower.includes('die') || transcriptLower.includes('death') || transcriptLower.includes('arrest') || transcriptLower.includes('lawsuit') || transcriptLower.includes('jail')) {
      if (hasMoney || hasPersonal) {
        redFlags.push('Serious threats detected');
      }
    }

    // RED FLAG: Authority claim + money/personal info request
    const hasAuthority = ['hospital', 'police', 'fbi', 'irs', 'bank', 'microsoft', 'apple', 'amazon', 'federal', 'government'].some(kw => transcriptLower.includes(kw));
    if (hasAuthority && (hasMoney || hasPersonal)) {
      redFlags.push('Authority impersonation with requests detected');
    }

    // RED FLAG: Improbable situation + money request
    // (e.g., "surgery" should only flag if combined with money/urgency)
    if ((transcriptLower.includes('surgery') || transcriptLower.includes('accident') || transcriptLower.includes('crash')) && hasMoney && hasUrgency) {
      redFlags.push('Emergency impersonation with money request detected');
    }

    const confidence = speechSegments.length > 0
      ? Math.max(...speechSegments.map((s: any) =>
          typeof s.avg_logprob === 'number' ? Math.max(0, Math.min(1, Math.exp(s.avg_logprob))) : 0.85
        ))
      : 0.85;

    // ===== STEP 7: RETURN RESULTS =====
    const riskLevel = redFlags.length >= 2 ? 'high' : redFlags.length === 1 ? 'medium' : 'low';
    const isScam = redFlags.length >= 2;

    if (isScam) {
      return Response.json({
        transcript: fullTranscript,
        segments: mergedSegments,
        red_flags: redFlags,
        tactics_detected: ['Multiple scam indicators'],
        risk_level: 'high',
        is_scam: true,
        feedback: 'STOP — This call has multiple scam indicators. Do NOT give any credit card, personal information, or money. Hang up and call the organization directly using a number from their official website.',
        analysis: `Critical scam indicators detected: ${redFlags.join('; ')}`,
        confidence: 0.95,
        timing_ms: Date.now() - startTime,
      });
    }

    return Response.json({
      transcript: fullTranscript,
      segments: mergedSegments,
      red_flags: redFlags,
      tactics_detected: [],
      risk_level: riskLevel,
      is_scam: isScam,
      feedback: redFlags.length > 0 ? 'One potential indicator detected. Be cautious and verify independently.' : '',
      analysis: redFlags.length > 0 
        ? `Detected: ${redFlags.join('; ')}`
        : 'No scam indicators detected.',
      confidence,
      timing_ms: Date.now() - startTime,
    });

  } catch (error: any) {
    console.error('analyzeCallChunk error:', error?.message);
    return Response.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
});
