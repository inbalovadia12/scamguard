import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * LiveGuard Audio Analysis - AssemblyAI Version
 * 
 * FEATURES:
 * - Speaker diarization (native AssemblyAI)
 * - Real-time speaker tracking
 * - Fast keyword detection (skip LLM for obvious scams)
 * - LLM analysis with timeout
 * - Sentiment analysis
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
    const { audio_url, audio_base64, audio_mime, language } = body;

    const assemblyKey = Deno.env.get('ASSEMBLY_AI_API_KEY');
    if (!assemblyKey) {
      console.error('ASSEMBLY_AI_API_KEY not set');
      return Response.json({ error: 'AssemblyAI not configured' }, { status: 500 });
    }

    let audioUrl: string;

    // ===== HANDLE AUDIO INPUT =====
    if (audio_url) {
      audioUrl = audio_url;
    } else if (audio_base64) {
      // Upload base64 audio to AssemblyAI
      const binaryString = atob(audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: audio_mime || 'audio/webm' });

      // Upload to AssemblyAI
      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': assemblyKey,
        },
        body: audioBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`AssemblyAI upload failed: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();
      audioUrl = uploadData.upload_url;
    } else {
      throw new Error('No audio data provided');
    }

    // ===== TRANSCRIBE WITH ASSEMBLYAI =====
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': assemblyKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: language === 'he' ? 'he' : language === 'es' ? 'es' : 'en',
        speaker_labels: true,
        speakers_expected: 2,
        sentiment_analysis: true,
      }),
    });

    if (!transcriptResponse.ok) {
      const errText = await transcriptResponse.text();
      console.error('AssemblyAI error:', transcriptResponse.status, errText);
      throw new Error(`Transcript failed: ${transcriptResponse.status}`);
    }

    const transcriptData = await transcriptResponse.json();
    const transcriptId = transcriptData.id;

    // Poll for completion (AssemblyAI is async)
    let completed = transcriptData.status === 'completed';
    let transcript = transcriptData;
    let pollCount = 0;
    const maxPolls = 60; // 60 * 1 second = 60 second timeout

    while (!completed && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      pollCount++;

      const statusResponse = await fetch(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: { 'Authorization': assemblyKey },
        }
      );

      if (statusResponse.ok) {
        transcript = await statusResponse.json();
        completed = transcript.status === 'completed';
      }

      if (transcript.status === 'error') {
        throw new Error(`Transcription failed: ${transcript.error}`);
      }
    }

    if (!completed) {
      throw new Error('Transcription timeout');
    }

    // ===== EXTRACT SPEAKER-LABELED SEGMENTS =====
    interface Segment {
      speaker: string;
      text: string;
      confidence: number;
      start_time?: number;
      end_time?: number;
    }

    const segments: Segment[] = [];
    const words = transcript.words || [];
    let currentSegment: Segment | null = null;

    for (const word of words) {
      const speaker = word.speaker !== null && word.speaker !== undefined 
        ? `Speaker ${word.speaker}` 
        : 'Unknown';
      const wordText = word.text || '';
      const confidence = word.confidence || 0.8;

      if (!currentSegment || currentSegment.speaker !== speaker) {
        if (currentSegment) segments.push(currentSegment);
        currentSegment = {
          speaker: speaker,
          text: wordText,
          confidence: confidence,
          start_time: word.start,
          end_time: word.end,
        };
      } else {
        currentSegment.text += ' ' + wordText;
        currentSegment.confidence = (currentSegment.confidence + confidence) / 2;
        currentSegment.end_time = word.end;
      }
    }
    if (currentSegment) segments.push(currentSegment);

    const fullTranscript = transcript.text || words.map((w: any) => w.text).join(' ');
    const confidence = transcript.confidence || 0.85;

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
      });
    }

    // ===== FAST PATH: KEYWORD DETECTION =====
    const urgencyKeywords = ['urgent', 'act now', 'limited time', 'hurry', 'immediately', 'right now', 'do not wait', 'asap'];
    const moneyKeywords = ['gift card', 'wire transfer', 'crypto', 'bitcoin', 'prepaid', 'payment', 'send money', 'money order', 'amazon card', 'itunes card'];
    const threatKeywords = ['arrest', 'lawsuit', 'freeze', 'legal action', 'federal', 'penalty', 'jail', 'court', 'charges'];
    const personalKeywords = ['ssn', 'social security', 'password', 'pin', 'account number', 'routing number', 'credit card', 'bank account'];
    const impersonationKeywords = ['irs', 'fbi', 'police', 'microsoft', 'apple', 'amazon', 'bank', 'paypal'];

    const transcriptLower = fullTranscript.toLowerCase();
    const redFlags: string[] = [];

    if (urgencyKeywords.some(kw => transcriptLower.includes(kw))) {
      redFlags.push('Urgency/time pressure detected');
    }
    if (moneyKeywords.some(kw => transcriptLower.includes(kw))) {
      redFlags.push('Money request detected');
    }
    if (threatKeywords.some(kw => transcriptLower.includes(kw))) {
      redFlags.push('Threats/intimidation detected');
    }
    if (personalKeywords.some(kw => transcriptLower.includes(kw))) {
      redFlags.push('Personal information request detected');
    }
    if (impersonationKeywords.some(kw => transcriptLower.includes(kw))) {
      redFlags.push('Possible impersonation detected');
    }

    // Fast-path scam detection
    const isObviousScam = redFlags.length >= 2 && segments.length >= 2;
    if (isObviousScam) {
      return Response.json({
        transcript: fullTranscript,
        segments: segments,
        speaker: segments[0]?.speaker || 'Unknown',
        red_flags: redFlags,
        tactics_detected: ['Combination of pressure, requests, and threats'],
        risk_level: 'high',
        is_scam: true,
        feedback: 'Hang up immediately. This is likely a scam. Do not provide any personal or financial information.',
        analysis: 'Multiple scam indicators detected: pressure tactics, financial requests, and intimidation.',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      });
    }

    // ===== LLM ANALYSIS (WITH TIMEOUT) =====
    let analysis: any = {
      segments: segments,
      red_flags: redFlags,
      tactics_detected: [],
      risk_level: redFlags.length > 0 ? 'medium' : 'low',
      is_scam: redFlags.length >= 2,
      feedback: '',
      analysis: redFlags.length > 0
        ? `Detected ${redFlags.length} potential scam indicators. Be cautious.`
        : 'No obvious scam indicators detected.',
    };

    try {
      const prompt = `Analyze this call transcript for scam activity. Be concise.

TRANSCRIPT: "${fullTranscript}"

SPEAKERS:
${segments.map(s => `${s.speaker}: "${s.text.substring(0, 80)}..."`).join('\n')}

EXISTING RED FLAGS: ${redFlags.join(', ') || 'None'}

Return JSON only:
{
  "tactics_detected": ["tactic1", "tactic2"],
  "risk_level": "low|medium|high",
  "is_scam": false,
  "feedback": "coaching or advice",
  "analysis": "1-2 sentence summary"
}`;

      const llmPromise = base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), 2000)
      );

      const llmResponse = await Promise.race([llmPromise, timeoutPromise]);
      const text = typeof llmResponse === 'string' ? llmResponse : (llmResponse as any)?.response || '';
      const match = text.match(/\{[\s\S]*\}/);

      if (match) {
        const llmAnalysis = JSON.parse(match[0]);
        analysis.tactics_detected = llmAnalysis.tactics_detected || [];
        if (llmAnalysis.risk_level) analysis.risk_level = llmAnalysis.risk_level;
        if (llmAnalysis.feedback) analysis.feedback = llmAnalysis.feedback;
        if (llmAnalysis.analysis) analysis.analysis = llmAnalysis.analysis;
        if (llmAnalysis.is_scam !== undefined) analysis.is_scam = llmAnalysis.is_scam;
      }
    } catch (llmErr) {
      console.error('LLM error (using fallback):', llmErr instanceof Error ? llmErr.message : llmErr);
    }

    return Response.json({
      transcript: fullTranscript,
      segments: segments,
      speaker: segments[0]?.speaker || 'Unknown',
      red_flags: analysis.red_flags || redFlags,
      tactics_detected: analysis.tactics_detected || [],
      risk_level: analysis.risk_level || 'low',
      is_scam: analysis.is_scam ?? false,
      feedback: analysis.feedback || '',
      analysis: analysis.analysis || '',
      confidence: confidence,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('analyzeCallChunk error:', error?.message || error);
    return Response.json({
      error: error?.message || 'Analysis failed',
      transcript: '',
      segments: [],
      red_flags: [],
      risk_level: 'low',
      is_scam: false,
      confidence: 0,
    }, { status: 500 });
  }
});
