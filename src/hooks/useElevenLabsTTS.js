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

    base44.functions.fetch("/generateSpeech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: next, language: lang }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("TTS failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; playNext(); };
        audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; playNext(); };
        await audio.play().catch(() => { URL.revokeObjectURL(url); audioRef.current = null; playNext(); });
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