# AssemblyAI LiveGuard - Quick Start

## ✅ PRE-FLIGHT CHECKLIST

- [ ] ASSEMBLY_AI_API_KEY is in Base44 Secrets
- [ ] Old DEEPGRAM_API_KEY is removed from Secrets
- [ ] Code has been updated to use AssemblyAI

## 🚀 DEPLOYMENT (3 STEPS)

### Step 1: Publish Function
```
1. Go to Base44 Dashboard
2. Find: Functions → analyzeCallChunk
3. Click: "Publish"
4. Wait: 1 minute for deployment
```

### Step 2: Navigate to Test
```
1. Go to: Phone Guard page
2. Click: Call Guard tab
3. You should see: "Record call" button
```

### Step 3: Test Recording
```
1. Click "Record call"
2. Speak for 30-60 seconds (preferably 2 people)
3. Examples:
   - You + speaker (different voices)
   - Play 2 audio clips sequentially
   - Simulate call with friend
4. Stop recording
5. Wait 4-7 seconds for analysis
```

## 📊 EXPECTED RESULTS

### Success Indicators
✅ Analysis completes in 4-7 seconds  
✅ Shows multiple speakers (Speaker 0, Speaker 1)  
✅ Red flags appear if keywords detected  
✅ Risk level calculated correctly  
✅ No error messages  

### Example Output
```json
{
  "transcript": "This is Speaker 0... Speaker 1 says...",
  "segments": [
    { "speaker": "Speaker 0", "text": "..." },
    { "speaker": "Speaker 1", "text": "..." }
  ],
  "red_flags": ["Urgency detected"],
  "risk_level": "medium",
  "confidence": 0.85,
  "analysis": "Detected urgency, but no money requests"
}
```

## 🔍 TESTING SCENARIOS

### Scenario 1: Quick Test (1-2 speakers, obvious scam)
**Audio:** "Act now! Send $500 gift card! This is urgent!"
**Expected:** Immediate analysis (<4s), risk_level: "high"

### Scenario 2: Ambiguous Call (normal conversation)
**Audio:** Normal conversation, no scam indicators
**Expected:** Analysis 5-7s, risk_level: "low"

### Scenario 3: Multi-speaker (realistic call)
**Audio:** 2+ people talking back and forth
**Expected:** Shows Speaker 0, Speaker 1, etc separately

### Scenario 4: Blurry/Quiet Audio
**Audio:** Noisy background, quiet speakers
**Expected:** Still works, but lower confidence (<0.7)

## 📈 PERFORMANCE TRACKING

After each test, note:
- **Time:** How long did analysis take? _____ seconds
- **Speakers:** How many speakers detected? ___ (expected: ___)
- **Red flags:** Any detected? Y/N
- **Accuracy:** Correct analysis? Y/N
- **Errors:** Any error messages? Y/N

## ❌ TROUBLESHOOTING

### Error: "AssemblyAI not configured"
**Fix:** Check Base44 Secrets
- [ ] ASSEMBLY_AI_API_KEY exists
- [ ] Value is correct (starts with `aai_`)
- [ ] No typos in key name
- [ ] Restart the function (republish)

### Error: "Transcription failed"
**Fix:**
- [ ] Check audio file is valid
- [ ] Try with different audio
- [ ] Check AssemblyAI account status (quota?)
- [ ] Verify internet connection

### Error: "Transcription timeout"
**Fix:**
- [ ] Audio file too long (>10 min)?
- [ ] AssemblyAI API slow? Try again
- [ ] Increase polling timeout if recurring

### No speakers detected (shows "Unknown")
**Fix:**
- [ ] Make sure 2+ distinct voices in audio
- [ ] Speak clearly and loud enough
- [ ] Mono audio might confuse diarization
- [ ] Try stereo input if possible

### Takes >8 seconds
**Fix:**
- [ ] That's normal for first-time processing
- [ ] Subsequent similar calls might be cached
- [ ] LLM timeout helps (skips if >2 seconds)

### Consistent wrong speaker labels
**Fix:**
- [ ] Audio quality issue (try clearer input)
- [ ] One speaker too quiet compared to other
- [ ] AssemblyAI limitation (rare with quality audio)

## 📞 REPORT BACK

After testing, tell me:

```
Test Results:
- Call length: ___ seconds
- Number of speakers: ___
- Analysis time: ___ seconds
- Red flags detected: Y/N (list: ___)
- Risk level: low/medium/high
- Any errors: Y/N (message: ___)
- Overall: Working as expected? Y/N
```

Example:
```
Test Results:
- Call length: 45 seconds
- Number of speakers: 2 (Speaker 0, Speaker 1)
- Analysis time: 5.2 seconds
- Red flags detected: Y (Urgency, Money request)
- Risk level: high
- Any errors: N
- Overall: Working as expected? YES
```

## 🎯 NEXT STEPS AFTER TESTING

Once testing complete:
1. Tell me results (performance + accuracy)
2. I'll optimize based on your feedback
3. Options:
   - Reduce timeout (faster but less detail)
   - Use URL-based audio (saves upload time)
   - Increase keyword list (catch more scams)
   - Enable parallel multi-chunk processing

## 💡 TIPS FOR BEST RESULTS

1. **Clear Audio:** Speak louder/closer to mic
2. **Multiple Speakers:** Make sure both people speak
3. **Natural Calls:** Use real call patterns (interrupts, gaps)
4. **Long Calls:** 30-60 seconds is ideal
5. **Variety:** Test with different accents/speeds

---

## READY?

→ Go publish analyzeCallChunk  
→ Test with a call recording  
→ Report back with results  
→ I'll optimize from there  

**Let's go!** 🚀
