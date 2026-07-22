import { useState, useEffect, useRef, useCallback } from "react";

export function useSpeechRecognition(lang = "en") {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef(null);
  const callbackRef = useRef(null);
  const finalTextRef = useRef("");

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SR);
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch { /* noop */ }
      }
    };
  }, []);

  const start = useCallback((onComplete) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Speech recognition not supported in this browser");
      return;
    }

    callbackRef.current = onComplete;
    finalTextRef.current = "";
    setInterimText("");
    setError(null);

    const recognition = new SR();
    recognition.lang = lang === "he" ? "he-IL" : lang === "es" ? "es-ES" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      finalTextRef.current = final;
      setInterimText(final + interim);
    };

    recognition.onerror = (event) => {
      setError(event.error || "Recognition error");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
      const text = finalTextRef.current.trim();
      if (text && callbackRef.current) {
        callbackRef.current(text);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [lang]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* noop */ }
    }
    setIsListening(false);
  }, []);

  return { isListening, interimText, error, isSupported, start, stop };
}