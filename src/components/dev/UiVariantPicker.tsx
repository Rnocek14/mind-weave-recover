/**
 * Dev-only floating picker for previewing UI variants.
 *
 * Uses SPA navigation (no full page reload) so switching is instant.
 * Auto-hidden in production builds.
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

function isPreviewHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h.includes('lovable.app') || h.includes('lovableproject.com') || h === 'localhost';
}

export function UiVariantPicker() {
  if (!import.meta.env.DEV && !isPreviewHost()) return null;
  const [params, setParams] = useSearchParams();
  const current = params.get('uiProfile') ?? 'standard';

  const set = (v: string) => {
    const next = new URLSearchParams(params);
    if (v === 'standard') next.delete('uiProfile');
    else next.set('uiProfile', v);
    setParams(next, { replace: true });
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] rounded-lg border-2 border-primary bg-background px-3 py-2 shadow-lg text-xs flex items-center gap-2">
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
