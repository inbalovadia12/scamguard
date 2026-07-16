import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Check, Globe, ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/i18n/translations";

export default function LanguageToggle({ className = "" }) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [pos, setPos] = useState({ dropUp: false, alignRight: true });

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Auto-reposition: flip up if near bottom, flip left if near right edge
  useLayoutEffect(() => {
    if (!open || !dropdownRef.current || !containerRef.current) return;
    const dr = dropdownRef.current.getBoundingClientRect();
    const cr = containerRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    setPos({
      dropUp: vh - cr.bottom < dr.height + 16 && cr.top > vh - cr.bottom,
      alignRight: vw - cr.right < dr.width + 16 && cr.left > vw - cr.right,
    });
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setFocusedIndex(0);
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setFocusedIndex(-1);
        break;
      case "ArrowDown":
        e.preventDefault();
        setFocusedIndex((p) => Math.min(p + 1, LANGUAGES.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((p) => Math.max(p - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (focusedIndex >= 0) {
          setLang(LANGUAGES[focusedIndex].code);
          setOpen(false);
          setFocusedIndex(-1);
        }
        break;
      case "Tab":
        setOpen(false);
        setFocusedIndex(-1);
        break;
    }
  };

  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <button
        onClick={() => { setOpen(!open); setFocusedIndex(open ? -1 : 0); }}
        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Change language"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Globe className="w-4 h-4" />
        <span className="text-base leading-none">{current.flag}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          role="listbox"
          className={`absolute z-50 w-44 max-h-[calc(100vh-2rem)] overflow-y-auto bg-popover border border-border rounded-xl shadow-lg animate-scale-in ${
            pos.dropUp ? "bottom-full mb-1" : "top-full mt-1"
          } ${pos.alignRight ? "right-0" : "left-0"}`}
        >
          {LANGUAGES.map((l, i) => (
            <button
              key={l.code}
              role="option"
              aria-selected={lang === l.code}
              onMouseEnter={() => setFocusedIndex(i)}
              onClick={() => { setLang(l.code); setOpen(false); setFocusedIndex(-1); }}
              className={`flex items-center justify-between w-full px-3 py-2 text-sm transition-colors ${
                focusedIndex === i ? "bg-muted" : ""
              } ${lang === l.code ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"}`}
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