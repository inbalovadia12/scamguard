import { useRef, useCallback, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export function useElevenLabsTTS(lang = "en") {
  const audioRef = useRef(null);
  const queueRef = useRef([]);
  const playingRef = useRef(false);

  const playNext = useCallback(() => {
    playingRef.current = false;
    const next = queueRef.current.shift();
    if (!next) return;
    playingRef.current = true;
    base44.functions.invoke("generateSpeech", { text: next, language: lang })
      .then((res) => {
        if (res.data?.audio_url) {
          const audio = new Audio(res.data.audio_url);
          audioRef.current = audio;
          audio.onended = () => { audioRef.current = null; playNext(); };
          audio.onerror = () => { audioRef.current = null; playNext(); };
          audio.play().catch(() => { audioRef.current = null; playNext(); });
        } else {
          playNext();
        }
      })
      .catch(() => playNext());
  }, [lang]);

  const speak = useCallback((text) => {
    if (!text) return;
    queueRef.current.push(text);
    if (!playingRef.current) playNext();
  }, [playNext]);

  const stop = useCallback(() => {
    queueRef.current = [];
    playingRef.current = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { speak, stop };
}