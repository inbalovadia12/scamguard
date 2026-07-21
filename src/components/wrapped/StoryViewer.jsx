import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function StoryViewer({ slides, index, setIndex, onClose }) {
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const current = slides[index];
  const duration = current?.duration || 6000;

  const goNext = useCallback(() => {
    if (index < slides.length - 1) {
      setIndex(index + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [index, slides.length, setIndex, onClose]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      setIndex(index - 1);
      setProgress(0);
    }
  }, [index, setIndex]);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          goNext();
          return 0;
        }
        return p + 100 / (duration / 50);
      });
    }, 50);
    return () => clearInterval(interval);
  }, [index, paused, duration, goNext]);

  useEffect(() => {
    setProgress(0);
  }, [index]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, onClose]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setPaused(true);
  };

  const handleTouchEnd = (e) => {
    setPaused(false);
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;
    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX > 0) goPrev();
      else goNext();
    }
  };

  if (!current) return null;
  const Slide = current.component;

  return (
    <div
      className="fixed inset-0 z-50 bg-black overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-30 flex gap-1.5 p-3 pt-5">
        {slides.map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/25 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full"
              style={{
                width: i < index ? "100%" : i === index ? `${progress}%` : "0%",
                transition: i === index ? "width 50ms linear" : "none",
              }}
            />
          </div>
        ))}
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-5 right-4 z-40 w-9 h-9 flex items-center justify-center text-white/80 hover:text-white transition-colors"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Slide content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0"
        >
          <Slide />
        </motion.div>
      </AnimatePresence>

      {/* Tap zones */}
      <button
        className="absolute left-0 top-16 bottom-0 w-1/3 z-20 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); goPrev(); }}
        aria-label="Previous slide"
      />
      <button
        className="absolute right-0 top-16 bottom-0 w-2/3 z-20 cursor-pointer"
        onClick={(e) => { e.stopPropagation(); goNext(); }}
        aria-label="Next slide"
      />
    </div>
  );
}