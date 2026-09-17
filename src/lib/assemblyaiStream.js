// Manages an AssemblyAI Streaming v3 WebSocket session. The browser connects
// directly to AssemblyAI using a short-lived token (minted server-side by the
// createCallGuardStreamToken function), streams raw PCM16/16kHz audio, and
// receives Turn messages. Partial turns update a live transcript line; final
// turns (end_of_turn) trigger the backend scam analysis.
export class AssemblyAIStream {
  constructor({
    token,
    onOpen,
    onPartial,
    onTurn,
    onError,
    onClose,
    speechModel = "universal-3-5-pro",
    mode = "min_latency",
  }) {
    this.token = token;
    this.speechModel = speechModel;
    this.mode = mode;
    this.onOpen = onOpen;
    this.onPartial = onPartial;
    this.onTurn = onTurn;
    this.onError = onError;
    this.onClose = onClose;
    this.ws = null;
    this.terminated = false;
    this.keepAliveTimer = null;
  }

  startKeepAlive() {
    this.stopKeepAlive();
    // AssemblyAI closes idle sessions (close code 3006) after a period with no
    // audio/messages. During silence the mic can stop delivering frames, so we
    // send a KeepAlive control frame every few seconds to hold the session open.
    this.keepAliveTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: "KeepAlive" }));
        } catch {
          /* ignore */
        }
      }
    }, 4000);
  }

  stopKeepAlive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  connect() {
    const params = new URLSearchParams({
      token: this.token,
      speech_model: this.speechModel,
      sample_rate: "16000",
      encoding: "pcm_s16le",
      format_turns: "true",
    });
    const url = `wss://streaming.assemblyai.com/v3/ws?${params.toString()}`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    this.ws.onopen = () => {
      this.startKeepAlive();
      this.onOpen?.();
    };

    this.ws.onmessage = (e) => {
      if (typeof e.data !== "string") return;
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "Turn") {
          if (msg.end_of_turn) {
            this.onTurn?.(msg.transcript || "", msg);
          } else {
            this.onPartial?.(msg.transcript || "", msg);
          }
        }
      } catch {
        /* ignore non-JSON / keepalive frames */
      }
    };

    this.ws.onerror = (e) => this.onError?.(e);

    this.ws.onclose = (e) => {
      this.stopKeepAlive();
      if (!this.terminated) this.onClose?.(e?.code, e?.reason);
    };
  }

  sendAudio(pcmArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Buffer is already an ArrayBuffer of Int16 PCM; forward as binary.
      this.ws.send(pcmArrayBuffer);
    }
  }

  forceEndpoint() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: "ForceEndpoint" }));
      } catch {
        /* ignore */
      }
    }
  }

  terminate() {
    this.terminated = true;
    this.stopKeepAlive();
    const ws = this.ws;
    this.ws = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "Terminate" }));
      } catch {
        /* ignore */
      }
    }
    if (ws) {
      ws.onmessage = null;
      ws.onerror = null;
      ws.onopen = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }
}