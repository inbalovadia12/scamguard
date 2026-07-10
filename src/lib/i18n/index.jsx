import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translations, LANGUAGES } from "./translations";

const LanguageContext = createContext(null);

const STORAGE_KEY = "vardin_language";

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && translations[saved]) {
        setLangState(saved);
      }
    } catch {}
  }, []);

  const applyDirection = useCallback((language) => {
    const langInfo = LANGUAGES.find((l) => l.code === language);
    document.documentElement.dir = langInfo?.dir || "ltr";
    document.documentElement.lang = language;
  }, []);

  useEffect(() => {
    applyDirection(lang);
  }, [lang, applyDirection]);

  const setLang = useCallback((language) => {
    if (!translations[language]) return;
    setLangState(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {}
    applyDirection(language);
  }, [applyDirection]);

  const t = useCallback(
    (key) => {
      return translations[lang]?.[key] ?? translations.en?.[key] ?? key;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return { lang: "en", setLang: () => {}, t: (k) => k };
  }
  return ctx;
}