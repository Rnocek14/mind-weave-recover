/**
 * Dev-only floating picker for previewing UI variants.
 *
 * Persists choice in sessionStorage so it survives SPA navigation
 * (the URL param often gets dropped by <Link> / navigate() calls).
 *
 * Visible in Vite dev AND on Lovable preview/published hosts so
 * the team can QA variants from the live preview.
 *
 * Collapsible: renders as a small chip by default so it never covers
 * bottom-anchored primary CTAs (e.g. "Start Practice"). Click the chip
 * to expand the full variant selector.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UiVariant } from '@/lib/ui/variantClass';
import { SlidersHorizontal, X } from 'lucide-react';

const VARIANTS: UiVariant[] = [
  'standard',
  'simplified-fluent',
  'simplified-non-fluent',
  'simplified-neglect',
  'minimal',
];

const STORAGE_KEY = 'uiProfileOverride';

/**
 * Opt-in only — never auto-show for patients/anon, even on preview/published
 * hosts (CLEAN-1). Enable with `?uivars=1` in the URL or `localStorage.uivars=1`.
 * The `?uiProfile=` override itself still works regardless (handled in
 * useUiProfile) — this only controls the floating selector chrome.
 */
function shouldShowPicker() {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return true;
  try {
    if (new URLSearchParams(window.location.search).get('uivars') === '1') return true;
    return window.localStorage.getItem('uivars') === '1';
  } catch {
    return false;
  }
}

export function UiVariantPicker() {
  if (!shouldShowPicker()) return null;
  const [params, setParams] = useSearchParams();
  const [expanded, setExpanded] = useState(false);
  const urlValue = params.get('uiProfile');
  const stored = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
  const current = urlValue ?? stored ?? 'standard';

  const set = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === 'standard') {
      next.delete('uiProfile');
      try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    } else {
      next.set('uiProfile', v);
      try { sessionStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
    }
    setParams(next, { replace: true });
    // Force a re-render of consumers of useUiProfile (location.search changed,
    // but if it didn't, reload is the safest signal for the sticky storage case).
    if (v === current) return;
    window.location.reload();
  };

  // Collapsed: a small, unobtrusive chip that never blocks CTAs.
  if (!expanded) {
    const isOverridden = current !== 'standard';
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        title={`UI variant: ${current} (click to change)`}
        aria-label={`UI variant picker (current: ${current})`}
        className="fixed bottom-4 right-4 z-[9999] flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-background/90 text-primary shadow-md backdrop-blur transition-transform hover:scale-105"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {isOverridden && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 rounded-lg border-2 border-primary bg-background px-3 py-2 text-xs shadow-lg">
      <span className="text-muted-foreground">UI variant</span>
      <select
        value={current}
        onChange={(e) => set(e.target.value)}
        className="cursor-pointer bg-transparent text-foreground outline-none"
      >
        {VARIANTS.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setExpanded(false)}
        title="Collapse"
        aria-label="Collapse UI variant picker"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
