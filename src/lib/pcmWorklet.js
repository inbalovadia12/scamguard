/* eslint-disable no-undef */
// AudioWorklet processor: captures microphone/system audio, downsamples to
// 16 kHz mono, converts Float32 → Int16 PCM (little-endian), and posts raw
// PCM buffers to the main thread for forwarding to the AssemblyAI WebSocket.
//
// Loaded via `audioContext.audioWorklet.addModule(new URL('./pcmWorklet.js', import.meta.url))`.
// `sampleRate` and `registerProcessor` are AudioWorkletGlobalScope globals.
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.inputRate = sampleRate;
    this.ratio = this.inputRate / this.targetRate;
    this.buf = [];
    this.readPos = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    for (let i = 0; i < ch.length; i++) this.buf.push(ch[i]);

    const out = [];
    while (this.readPos + 1 < this.buf.length) {
      const i0 = Math.floor(this.readPos);
      const frac = this.readPos - i0;
      const s1 = this.buf[i0];
      const s2 = this.buf[i0 + 1];
      const sample = s1 + (s2 - s1) * frac;
      let v = Math.max(-1, Math.min(1, sample));
      v = v < 0 ? v * 0x8000 : v * 0x7fff;
      out.push(v | 0);
      this.readPos += this.ratio;
    }

    const consumed = Math.floor(this.readPos);
    if (consumed > 0) {
      this.buf.splice(0, consumed);
      this.readPos -= consumed;
    }

    if (out.length > 0) {
      const buffer = new ArrayBuffer(out.length * 2);
      const view = new DataView(buffer);
      for (let i = 0; i < out.length; i++) view.setInt16(i * 2, out[i], true);
      this.port.postMessage(buffer, [buffer]);
    }
    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);