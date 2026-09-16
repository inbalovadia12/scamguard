/* eslint-disable no-undef */
// AudioWorklet processor: captures microphone/system audio, downsamples to
// 16 kHz mono, converts Float32 → Int16 PCM (little-endian), and posts raw
// PCM buffers to the main thread for forwarding to the AssemblyAI WebSocket.
//
// AssemblyAI Streaming v3 requires each binary chunk to be 50-1000 ms of
// audio (800-32000 samples at 16 kHz). We accumulate downsampled Int16 samples
// and only post when we have ~100 ms (1600 samples) — well within the range.
//
// Loaded via `audioContext.audioWorklet.addModule(new URL('./pcmWorklet.js', import.meta.url))`.
// `sampleRate` and `registerProcessor` are AudioWorkletGlobalScope globals.
const CHUNK_SAMPLES = 1600; // ~100 ms at 16 kHz

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.inputRate = sampleRate;
    this.ratio = this.inputRate / this.targetRate;
    this.buf = [];
    this.readPos = 0;
    this.accum = []; // accumulated Int16 samples across process() calls
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    for (let i = 0; i < ch.length; i++) this.buf.push(ch[i]);

    // Downsample: linear interpolation from inputRate → 16 kHz
    while (this.readPos + 1 < this.buf.length) {
      const i0 = Math.floor(this.readPos);
      const frac = this.readPos - i0;
      const s1 = this.buf[i0];
      const s2 = this.buf[i0 + 1];
      const sample = s1 + (s2 - s1) * frac;
      let v = Math.max(-1, Math.min(1, sample));
      v = v < 0 ? v * 0x8000 : v * 0x7fff;
      this.accum.push(v | 0);
      this.readPos += this.ratio;
    }

    // Shift consumed input samples
    const consumed = Math.floor(this.readPos);
    if (consumed > 0) {
      this.buf.splice(0, consumed);
      this.readPos -= consumed;
    }

    // Only post when we've accumulated enough for a valid chunk (≥ 50 ms)
    if (this.accum.length >= CHUNK_SAMPLES) {
      const buffer = new ArrayBuffer(this.accum.length * 2);
      const view = new DataView(buffer);
      for (let i = 0; i < this.accum.length; i++) view.setInt16(i * 2, this.accum[i], true);
      this.port.postMessage(buffer, [buffer]);
      this.accum = [];
    }
    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);