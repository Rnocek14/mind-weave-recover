/**
 * textScale — global text-size setting.
 *
 * The single highest-value accessibility control for this population
 * (older stroke survivors, frequent low vision) and previously absent:
 * the "Minimal — largest text" view-mode label promised larger text that
 * no code delivered. The app is styled in rem units throughout, so
 * scaling the root font-size scales essentially all text and rem-based
 * spacing coherently.
 *
 * Persisted per device (localStorage) and applied before first paint via
 * initTextScale() in main.tsx.
 */

export type TextScale = 'normal' | 'large' | 'xlarge';

const STORAGE_KEY = 'text_scale_v1';

export const TEXT_SCALES: Record<TextScale, { percent: number; label: string }> = {
  normal: { percent: 100, label: 'Standard' },
  large: { percent: 115, label: 'Large' },
  xlarge: { percent: 130, label: 'Extra large' },
};

export function getStoredTextScale(): TextScale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'large' || raw === 'xlarge' || raw === 'normal') return raw;
  } catch {
    /* storage unavailable */
  }
  return 'normal';
}

export function applyTextScale(scale: TextScale): void {
  document.documentElement.style.fontSize = `${TEXT_SCALES[scale].percent}%`;
}

export function setTextScale(scale: TextScale): void {
  try {
    localStorage.setItem(STORAGE_KEY, scale);
  } catch {
    /* storage unavailable — still apply for this page load */
  }
  applyTextScale(scale);
}

/** Apply the persisted scale at boot, before first paint. */
export function initTextScale(): void {
  const scale = getStoredTextScale();
  if (scale !== 'normal') applyTextScale(scale);
}
