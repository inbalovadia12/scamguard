import { useEffect, useState } from "react";

const STORAGE_KEY = "vardin_accessibility";

export const DEFAULT_ACCESSIBILITY = {
  text_size: "normal", // normal | large | xlarge
  high_contrast: false,
  reduced_motion: false,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_ACCESSIBILITY, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_ACCESSIBILITY;
}

function applySettings(settings) {
  const root = document.documentElement;

  // Text size
  root.classList.remove("text-size-normal", "text-size-large", "text-size-xlarge");
  root.classList.add(`text-size-${settings.text_size}`);

  // High contrast
  root.classList.toggle("high-contrast", settings.high_contrast);

  // Reduced motion
  root.classList.toggle("reduced-motion", settings.reduced_motion);
}

export function useAccessibility() {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    applySettings(settings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return { settings, update };
}