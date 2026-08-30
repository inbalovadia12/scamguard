# Speaker Detection Debugging - FIX PROCESS

## DEPLOY & TEST

### Step 1: Publish
```
Base44 Dashboard → analyzeCallChunk → Publish
Wait 1 minute
```

### Step 2: Test with MULTI-SPEAKER audio
**IMPORTANT:** Use audio with 2+ DISTINCT people:
```
- Record yourself + friend (different voices)
- Or play 2 different phone recordings back-to-back
- Or use a real phone call recording
- Make sure voices are clearly different
```

### Step 3: Check DEBUG OUTPUT

After test completes, look for:
```json
{
  "debug": {
    "speakersDetected": 2,        // Should be 2, not 1
    "segmentsCreated": 8,         // Number of separate segments
    "pollCount": 4,               // How many polling cycles
    "wordsProcessed": 156         // Total words transcribed
  }
}
```

---

## UNDERSTANDING THE DEBUG OUTPUT

### Good Output (working correctly)
```json
{
  "speakersDetected": 2,
  "segmentsCreated": 8,
  "segments": [
    {"speaker": "Speaker 0", "text": "..."},
    {"speaker": "Speaker 1", "text": "..."},
    {"speaker": "Speaker 0", "text": "..."}
  ]
}
```
✅ **Means:** AssemblyAI correctly identified 2 speakers

### Bad Output (what we're seeing now)
```json
{
  "speakersDetected": 1,
  "segmentsCreated": 1,
  "segments": [
    {"speaker": "Unknown Speaker", "text": "...entire transcript..."}
  ]
}
```
❌ **Means:** AssemblyAI not returning speaker labels

---

## WHAT THE FIX DOES

### 1. Detailed Logging
Logs EVERY STEP:
- Audio upload success
- Transcript submission
- Polling progress
- Speaker detection results
- First 10 words with speaker info

### 2. Speaker Label Extraction
Looks for `word.speaker` field from AssemblyAI
- If present: uses it (Speaker 0, Speaker 1)
- If missing: tries fallback

### 3. Fallback Energy-Based Splitting
If only 1 speaker detected, tries:
- Split by audio energy/intensity changes
- Alternates Speaker 0 ↔ Speaker 1
- Creates segments based on speaking patterns

### 4. Debug Info in Response
Returns exactly what happened:
- How many speakers detected
- How many segments created
- Processing time
- Words processed

---

## TELL ME THESE 3 THINGS AFTER TEST:

1. **Speakers Detected** (from debug output)
   - How many? `speakersDetected: ___`
   - Expected: 2 or more

2. **Segments Created** (from debug output)
   - How many? `segmentsCreated: ___`
   - Expected: 4+ (back and forth conversation)

3. **Speaker Labels** (from segments array)
   - Do you see "Speaker 0" and "Speaker 1"?
   - Or still all "Unknown"?

---

## CRITICAL: TEST AUDIO REQUIREMENTS

**The test MUST have:**
- ✅ 2+ DIFFERENT VOICES (not just different parts of same person)
- ✅ 30+ seconds total (more data for diarization)
- ✅ Clear audio (not too much background noise)
- ✅ Back-and-forth conversation (not just one person monologuing)

**If you test with:**
- ❌ Same person talking (even with pauses)
- ❌ Very short audio (<10 seconds)
- ❌ Extremely quiet/noisy audio
- ❌ One person speaking 90% of time

**Then speaker detection will fail.** AssemblyAI needs sufficient distinct voice data.

---

## AFTER YOU TEST

Report:
```
Test Audio:
- Duration: ___ seconds
- Number of speakers: ___ (you speaking or recording?)
- Audio quality: Good / Okay / Poor
- Back-and-forth: Yes / No

Results:
- speakersDetected: ___
- segmentsCreated: ___
- Speaker labels shown: Yes / No
- Which speakers: Speaker 0? Speaker 1?

Any errors: Yes / No
Error message: ___
```

---

## IF STILL NOT WORKING

Possible reasons:
1. **Audio is actually mono** (single channel, not stereo)
   - Solution: Use stereo audio with 2 distinct speakers

2. **Audio is too similar** (same person throughout)
   - Solution: Test with 2 different people

3. **AssemblyAI API limitation** (rare, requires higher tier)
   - Solution: Contact AssemblyAI support

4. **Backend parameter issue**
   - Solution: I'll try different AssemblyAI parameters

5. **Fallback isn't triggering**
   - Solution: I'll make fallback more aggressive

---

## WHAT I'LL DO BASED ON YOUR FEEDBACK

**If speakers detected correctly:**
- ✅ Done! No more changes needed
- Optimize for speed

**If speakers still not detected:**
- Try more aggressive AssemblyAI parameters
- Enhance fallback splitting algorithm
- Test with public API limits
- Potentially switch to different service

**If partial success:**
- Fine-tune the parameters
- Adjust fallback thresholds
- Improve segment splitting

---

## GO TEST NOW

1. Publish function
2. Record test call (2+ people, 30+ seconds)
3. Check debug output
4. Tell me the 3 things above

**I will fix this completely. No matter what.** 🔧
