/**
 * Lightweight feature flag reader.
 *
 * Sources (first match wins):
 *   1. URL param ?ff_<name>=1 / =0  (per-tab override, useful for QA)
 *   2. localStorage key `ff:<name>` ('1' on, '0' off)
 *   3. import.meta.env.VITE_FF_<NAME> ('1' on)
 *   4. default (passed in)
 *
 * Flags are read on demand — cheap, synchronous, no provider needed.
 * Toggle in the browser console:  setFeatureFlag('narrative_visual_fading_v1', true)
 */

export type FlagName =
  | 'narrative_visual_fading_v1';

function readUrl(name: string): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = new URLSearchParams(window.location.search).get(`ff_${name}`);
    if (v === '1' || v === 'true') return true;
    if (v === '0' || v === 'false') return false;
  } catch { /* ignore */ }
  return null;
}

function readStorage(name: string): boolean | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = localStorage.getItem(`ff:${name}`);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch { /* ignore */ }
  return null;
}

function readEnv(name: string): boolean | null {
  try {
    const key = `VITE_FF_${name.toUpperCase()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (import.meta as any).env?.[key];
    if (v === '1' || v === 'true') return true;
    if (v === '0' || v === 'false') return false;
  } catch { /* ignore */ }
  return null;
}

export function isFeatureEnabled(name: FlagName, defaultValue = false): boolean {
  const url = readUrl(name);
  if (url !== null) return url;
  const ls = readStorage(name);
  if (ls !== null) return ls;
  const env = readEnv(name);
  if (env !== null) return env;
  return defaultValue;
}

export function setFeatureFlag(name: FlagName, value: boolean | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) localStorage.removeItem(`ff:${name}`);
    else localStorage.setItem(`ff:${name}`, value ? '1' : '0');
  } catch { /* ignore */ }
}

// Expose in dev for easy console toggling
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).setFeatureFlag = setFeatureFlag;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).isFeatureEnabled = isFeatureEnabled;
}
