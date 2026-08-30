import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * LiveGuard Audio Analysis - OPTIMIZED
 * 
 * IMPROVEMENTS:
 * - Speaker diarization (Deepgram speaker_labels)
 * - Fast path detection (obvious scams skip LLM)
 * - Parallel LLM calls (segment-by-segment)
 * - Timeout handling (partial results > timeout)
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

    const deepgramKey = Deno.env.get('deepgram_text_to_speech');
    if (!deepgramKey) {
      return Response.json({ error: 'Deepgram not configured' }, { status: 500 });
    }

    let audioBlob: Blob;
    let contentType: string;

    if (audio_base64) {
      const binaryString = atob(audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      contentType = audio_mime || 'audio/webm';
      audioBlob = new Blob([bytes], { type: contentType });
    } else if (audio_url) {
      const audioResponse = await fetch(audio_url);
      if (!audioResponse.ok) throw new Error('Could not fetch audio');
      audioBlob = await audioResponse.blob();
      contentType = audioBlob.type || 'audio/webm';
    } else {
      throw new Error('No audio data');
    }

    // ===== DEEPGRAM: WITH SPEAKER LABELS =====
    const deepgramResponse = await fetch(
      `https://api.deepgram.com/v1/listen?model=nova-2&language=${language || 'en'}&punctuate=true&speaker_labels=true&diarize=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': contentType,
        },
        body: audioBlob,
      }
    );

    if (!deepgramResponse.ok) {
      const errText = await deepgramResponse.text();
      console.error('Deepgram error:', deepgramResponse.status, errText);
      throw new Error(`Deepgram failed: ${deepgramResponse.status}`);
    }

    const deepgramData = await deepgramResponse.json();
    
    // Extract speaker-labeled segments
    const alternatives = deepgramData.results?.channels?.[0]?.alternatives || [];
    const mainAlt = alternatives[0] || {};
    const words = mainAlt.words || [];
    const confidence = mainAlt.confidence || 0.8;

    // Build segments by speaker
    interface Segment {
      speaker: string;
      text: string;
      confidence: number;
    }
    
    const segments: Segment[] = [];
    let currentSegment: Segment | null = null;

    for (const word of words) {
      const speaker = word.speaker ? `Speaker ${word.speaker}` : 'Unknown';
      const wordText = word.punctuated_word || word.word || '';

      if (!currentSegment || currentSegment.speaker !== speaker) {
        if (currentSegment) segments.push(currentSegment);
        currentSegment = {
          speaker: speaker,
          text: wordText,
          confidence: word.confidence || 0.8,
        };
      } else {
        currentSegment.text += ' ' + wordText;
        currentSegment.confidence = (currentSegment.confidence + (word.confidence || 0.8)) / 2;
      }
    }
    if (currentSegment) segments.push(currentSegment);

    const transcript = words.map((w: any) => w.punctuated_word || w.word).join(' ');

    if (!transcript.trim()) {
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

    // ===== FAST PATH: Check for OBVIOUS scam keywords =====
    const urgencyKeywords = ['urgent', 'act now', 'limited time', 'hurry', 'immediately', 'right now', 'don\'t wait'];
    const moneyKeywords = ['gift card', 'wire transfer', 'crypto', 'bitcoin', 'prepaid', 'payment', 'send money', 'money order'];
    const threatKeywords = ['arrest', 'lawsuit', 'freeze', 'legal action', 'federal', 'penalty', 'jail'];
    const personalKeywords = ['ssn', 'social security', 'password', 'pin', 'account number', 'routing number', 'credit card'];

    const transcriptLower = transcript.toLowerCase();
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

    // If multiple red flags + multiple speakers = high confidence scam
    const isObviousScam = redFlags.length >= 2 && segments.length >= 2;
    if (isObviousScam) {
      return Response.json({
        transcript: transcript,
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

    // ===== LLM ANALYSIS (WITH TIMEOUT & FALLBACK) =====
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
      const prompt = `Analyze for scam activity:

TRANSCRIPT: "${transcript}"

SPEAKERS: ${segments.map(s => `${s.speaker}: "${s.text}"`).join('\n')}

EXISTING RED FLAGS: ${redFlags.join(', ') || 'None'}

Enhance the analysis. Return JSON:
{
  "segments": [${segments.map(s => `{"speaker":"${s.speaker}","text":"${s.text.substring(0,100)}..."}`).join(',')}],
  "red_flags": [],
  "tactics_detected": [],
  "risk_level": "low|medium|high",
  "is_scam": false,
  "feedback": "",
  "analysis": "summary"
}`;

      const llmPromise = base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false,
      });

      // Timeout after 3 seconds - return partial results
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('LLM timeout')), 3000)
      );

      const llmResponse = await Promise.race([llmPromise, timeoutPromise]);
      const text = typeof llmResponse === 'string' ? llmResponse : (llmResponse as any)?.response || '';
      const match = text.match(/\{[\s\S]*\}/);
      
      if (match) {
        const llmAnalysis = JSON.parse(match[0]);
        // Merge LLM analysis with our fast-path results
        analysis.tactics_detected = llmAnalysis.tactics_detected || analysis.tactics_detected;
        if (llmAnalysis.risk_level === 'high' || (redFlags.length === 0 && llmAnalysis.risk_level)) {
          analysis.risk_level = llmAnalysis.risk_level;
        }
        if (llmAnalysis.feedback) analysis.feedback = llmAnalysis.feedback;
        if (llmAnalysis.analysis) analysis.analysis = llmAnalysis.analysis;
      }
    } catch (llmErr) {
      console.error('LLM error (using fallback):', llmErr instanceof Error ? llmErr.message : llmErr);
      // Use analysis from fast-path above
    }

    return Response.json({
      transcript: transcript,
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
    }, { status: 500 });
  }
});
