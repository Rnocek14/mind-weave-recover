/**
 * Dev-only floating picker for previewing UI variants.
 *
 * Persists choice in sessionStorage so it survives SPA navigation
 * (the URL param often gets dropped by <Link> / navigate() calls).
 *
 * Visible in Vite dev AND on Lovable preview/published hosts so
 * the team can QA variants from the live preview.
 */

import { useSearchParams } from 'react-router-dom';
import { UiVariant } from '@/lib/ui/variantClass';

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

  return (
    <div className="fixed bottom-20 right-4 z-[9999] rounded-lg border-2 border-primary bg-background px-3 py-2 shadow-lg text-xs flex items-center gap-2">
      <span className="text-muted-foreground">UI variant</span>
      <select
        value={current}
        onChange={(e) => set(e.target.value)}
        className="bg-transparent text-foreground outline-none cursor-pointer"
      >
        {VARIANTS.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
    </div>
  );
}
