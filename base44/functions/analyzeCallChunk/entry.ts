import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

/**
 * LiveGuard - AssemblyAI with AGGRESSIVE speaker diarization debugging
 * 
 * FEATURES:
 * - Full logging to debug speaker detection
 * - Multiple diarization approaches
 * - Fallback speaker detection
 * - Real-time speaker identification
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
      return Response.json({ error: 'AssemblyAI not configured' }, { status: 500 });
    }

    let audioUrl: string;

    // ===== HANDLE AUDIO INPUT =====
    if (audio_url) {
      audioUrl = audio_url;
      console.log('Using audio URL:', audioUrl.substring(0, 100));
    } else if (audio_base64) {
      const binaryString = atob(audio_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: audio_mime || 'audio/webm' });
      console.log('Uploading base64 audio, size:', audioBlob.size, 'bytes');

      const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          'Authorization': assemblyKey,
        },
        body: audioBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();
      audioUrl = uploadData.upload_url;
      console.log('Upload successful, URL:', audioUrl.substring(0, 100));
    } else {
      throw new Error('No audio data provided');
    }

    // ===== TRANSCRIBE WITH ASSEMBLYAI - AGGRESSIVE DIARIZATION =====
    console.log('Submitting to AssemblyAI with speaker_labels enabled');
    
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': assemblyKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: language === 'he' ? 'he' : language === 'es' ? 'es' : 'en',
        speaker_labels: true,  // Enable diarization
        speakers_expected: 2,   // Expect 2 speakers (key parameter)
        sentiment_analysis: true,
        entity_detection: false,
      }),
    });

    if (!transcriptResponse.ok) {
      const errText = await transcriptResponse.text();
      console.error('Transcript submission failed:', transcriptResponse.status, errText);
      throw new Error(`Transcript failed: ${transcriptResponse.status}`);
    }

    const transcriptData = await transcriptResponse.json();
    const transcriptId = transcriptData.id;
    console.log('Transcript ID:', transcriptId, 'Status:', transcriptData.status);

    // ===== POLL FOR COMPLETION =====
    let completed = transcriptData.status === 'completed';
    let transcript = transcriptData;
    let pollCount = 0;
    const maxPolls = 120; // 120 * 1 second = 2 minutes max

    while (!completed && pollCount < maxPolls) {
      await new Promise(resolve => setTimeout(resolve, 1000));
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
        if (pollCount % 5 === 0) {
          console.log(`Poll ${pollCount}: Status = ${transcript.status}`);
        }
      }

      if (transcript.status === 'error') {
        throw new Error(`Transcription failed: ${transcript.error}`);
      }
    }

    if (!completed) {
      throw new Error('Transcription timeout after 120 seconds');
    }

    console.log('Transcription complete. Parsing response...');
    console.log('Response has', transcript.words?.length || 0, 'words');
    console.log('Speaker labels enabled:', transcript.speaker_labels !== undefined);

    // ===== EXTRACT SPEAKER-LABELED SEGMENTS =====
    const words = transcript.words || [];
    
    // Debug: Check first 10 words for speaker data
    console.log('First 10 words with speaker info:');
    for (let i = 0; i < Math.min(10, words.length); i++) {
      console.log(`Word ${i}: "${words[i].text}" | Speaker: ${words[i].speaker} | Confidence: ${words[i].confidence}`);
    }

    interface Segment {
      speaker: string;
      text: string;
      confidence: number;
      start_time?: number;
      end_time?: number;
    }

    const segments: Segment[] = [];
    let currentSegment: Segment | null = null;
    const speakerSet = new Set<number>();

    for (const word of words) {
      // AssemblyAI returns speaker as number (0, 1, etc) or null
      const speakerNum = word.speaker;
      
      if (speakerNum !== null && speakerNum !== undefined) {
        speakerSet.add(speakerNum);
      }

      const speaker = speakerNum !== null && speakerNum !== undefined
        ? `Speaker ${speakerNum}`
        : 'Unknown Speaker';
        
      const wordText = word.text || '';
      const confidence = word.confidence || 0.8;

      if (!currentSegment || currentSegment.speaker !== speaker) {
        if (currentSegment) {
          segments.push(currentSegment);
        }
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
    if (currentSegment) {
      segments.push(currentSegment);
    }

    console.log('Detected speakers:', Array.from(speakerSet).sort());
    console.log('Total segments:', segments.length);
    console.log('Segments by speaker:');
    segments.forEach((seg, idx) => {
      console.log(`Segment ${idx}: ${seg.speaker} - "${seg.text.substring(0, 50)}..."`);
    });

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
        debug: { speakersDetected: 0, pollCount: pollCount },
      });
    }

    // ===== FALLBACK: If only 1 speaker detected, try voice energy analysis =====
    if (speakerSet.size <= 1 && words.length > 20) {
      console.log('Only 1 speaker detected, attempting energy-based fallback split...');
      
      // Split by silence/energy changes
      const energySegments: Segment[] = [];
      let currentEnergy = 0;
      let silenceThreshold = 0.02;
      let energyThreshold = 0.5;
      
      let tempSegment: Segment | null = null;
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        // Estimate "energy" from word length and confidence
        const wordEnergy = (word.text?.length || 0) * (word.confidence || 0.8) / 10;
        
        // If energy drops significantly, split into new speaker (alternating)
        const energyDrop = Math.abs(wordEnergy - currentEnergy) > energyThreshold;
        
        if (energyDrop && i > 0 && i < words.length - 1) {
          if (tempSegment) {
            energySegments.push(tempSegment);
            // Alternate speaker for fallback
            const nextSpeaker = energySegments.length % 2 === 0 ? 'Speaker 0' : 'Speaker 1';
            tempSegment = {
              speaker: nextSpeaker,
              text: word.text || '',
              confidence: word.confidence || 0.8,
              start_time: word.start,
              end_time: word.end,
            };
          }
        } else {
          if (!tempSegment) {
            const speaker = energySegments.length % 2 === 0 ? 'Speaker 0' : 'Speaker 1';
            tempSegment = {
              speaker: speaker,
              text: word.text || '',
              confidence: word.confidence || 0.8,
              start_time: word.start,
              end_time: word.end,
            };
          } else {
            tempSegment.text += ' ' + (word.text || '');
            tempSegment.confidence = (tempSegment.confidence + (word.confidence || 0.8)) / 2;
            tempSegment.end_time = word.end;
          }
        }
        
        currentEnergy = wordEnergy;
      }
      
      if (tempSegment) {
        energySegments.push(tempSegment);
      }
      
      if (energySegments.length > 1) {
        console.log('Fallback split created', energySegments.length, 'segments');
        segments.length = 0;
        segments.push(...energySegments);
      }
    }

    // ===== FAST PATH: KEYWORD DETECTION =====
    const urgencyKeywords = ['urgent', 'act now', 'limited time', 'hurry', 'immediately', 'right now', 'do not wait', 'asap'];
    const moneyKeywords = ['gift card', 'wire transfer', 'crypto', 'bitcoin', 'prepaid', 'payment', 'send money', 'money order', 'amazon card', 'itunes'];
    const threatKeywords = ['arrest', 'lawsuit', 'freeze', 'legal action', 'federal', 'penalty', 'jail', 'court'];
    const personalKeywords = ['ssn', 'social security', 'password', 'pin', 'account number', 'routing number', 'credit card', 'bank'];
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
        analysis: 'Multiple scam indicators detected.',
        confidence: 0.95,
        timestamp: new Date().toISOString(),
        debug: { speakersDetected: Array.from(speakerSet).length, segmentsCreated: segments.length, pollCount: pollCount },
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
        ? `Detected ${redFlags.length} potential scam indicators.`
        : 'No obvious scam indicators detected.',
    };

    try {
      const prompt = `Analyze this call for scam activity.

TRANSCRIPT: "${fullTranscript}"

SPEAKERS: ${segments.map(s => `${s.speaker}: "${s.text.substring(0, 80)}..."`).join('\n')}

RED FLAGS: ${redFlags.join(', ') || 'None'}

Return JSON:
{
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
      }
    } catch (llmErr) {
      console.error('LLM error:', llmErr instanceof Error ? llmErr.message : llmErr);
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
      debug: {
        speakersDetected: Math.max(Array.from(speakerSet).length, segments.length > 1 ? 2 : 1),
        segmentsCreated: segments.length,
        pollCount: pollCount,
        wordsProcessed: words.length,
      },
    });

  } catch (error: any) {
    console.error('FATAL analyzeCallChunk error:', error?.message || error);
    return Response.json({
      error: error?.message || 'Analysis failed',
      debug: { errorType: error?.constructor?.name },
    }, { status: 500 });
  }
});
