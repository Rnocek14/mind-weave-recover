/**
 * ViewToggle — patient/caregiver-facing UI variant selector.
 *
 * Small collapsible chip that lets the person using the app switch between
 * Simplified (default), Standard, and Minimal views. Persisted in
 * localStorage so it survives reloads and sessions on the same device.
 *
 * Distinct from the dev `UiVariantPicker` which exposes all internal variants
 * (fluent / non-fluent / neglect) for QA.
 */

import { useState } from 'react';
import { Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type SimpleView = 'simplified-fluent' | 'standard' | 'minimal';

const STORAGE_KEY = 'uiProfileOverride';

const OPTIONS: { value: SimpleView; label: string; hint: string }[] = [
  { value: 'simplified-fluent', label: 'Simplified', hint: 'Recommended — less on screen' },
  { value: 'standard', label: 'Standard', hint: 'More detail and guidance' },
  { value: 'minimal', label: 'Minimal', hint: 'Largest text, fewest elements' },
];

function readCurrent(): SimpleView {
  if (typeof window === 'undefined') return 'simplified-fluent';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'standard' || v === 'minimal' || v === 'simplified-fluent') return v;
  } catch { /* ignore */ }
  return 'simplified-fluent';
}

export function ViewToggle() {
  const [expanded, setExpanded] = useState(false);
  const current = readCurrent();

  const set = (v: SimpleView) => {
    try {
      if (v === 'simplified-fluent') {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, v);
      }
    } catch { /* ignore */ }
    window.location.reload();
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Change view"
        title="Change view"
        className="fixed bottom-4 left-4 z-[9998] flex h-9 items-center gap-1.5 rounded-full border border-border/70 bg-background/90 px-3 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
      >
        <Eye className="h-3.5 w-3.5" />
        View
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-[9998] w-64 rounded-xl border border-border bg-background p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">View</span>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {OPTIONS.map((opt) => {
          const isActive = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => set(opt.value)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                isActive
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted'
              )}
            >
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-xs text-muted-foreground">{opt.hint}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
