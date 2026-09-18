import React, { useEffect } from "react";
import { X } from "lucide-react";

// Full-screen close-up viewer for chat images. Open via onDoubleClick on an
// image; close with the button, clicking the backdrop, or pressing Escape.
export default function ImageLightbox({ src, alt = "Image", onClose }) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-lg select-none"
        draggable={false}
      />
    </div>
  );
}