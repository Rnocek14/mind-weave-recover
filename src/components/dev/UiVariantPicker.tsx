/**
 * Dev-only floating picker for previewing UI variants.
 *
 * Sets `?uiProfile=…` on the current URL so `useUiProfile` picks it up.
 * Auto-hidden in production builds. Remove once the clinician picker
 * (Phase 2C-iv) ships.
 */

import { UiVariant } from '@/lib/ui/variantClass';

const VARIANTS: UiVariant[] = [
  'standard',
  'simplified-fluent',
  'simplified-non-fluent',
  'simplified-neglect',
  'minimal',
];

export function UiVariantPicker() {
  if (!import.meta.env.DEV) return null;

  const current =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('uiProfile') ?? 'standard'
      : 'standard';

  const set = (v: string) => {
    const url = new URL(window.location.href);
    if (v === 'standard') url.searchParams.delete('uiProfile');
    else url.searchParams.set('uiProfile', v);
    window.location.href = url.toString();
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
