import { useState, useRef, useEffect } from "react";
import { Check, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/i18n/translations";

export default function LanguageToggle({ className = "" }) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        aria-label="Change language"
      >
        <Globe className="w-4 h-4" />
        <span className="text-base leading-none">{current.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50 animate-scale-in">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code);
                setOpen(false);
              }}
              className={`flex items-center justify-between w-full px-3 py-2 text-sm transition-colors ${
                lang === l.code
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{l.flag}</span>
                {l.label}
              </span>
              {lang === l.code && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}