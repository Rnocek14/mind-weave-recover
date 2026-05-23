/**
 * variantClass — pure CSS helpers for adaptive UI variants.
 *
 * Zero behavior. Layout-only swaps driven by `useUiProfile`.
 * Used by /today and other top-level surfaces to apply
 * simplified / minimal / standard shapes without changing logic.
 *
 * No component should call this on raw text content — it's
 * for container/layout classNames only.
 */

import { cn } from '@/lib/utils';

export type UiVariant =
  | 'standard'
  | 'simplified-fluent'
  | 'simplified-non-fluent'
  | 'simplified-neglect'
  | 'minimal';

/**
 * Return tailwind classes for a container based on variant.
 * Pass `base` for the always-on classes, `simplified` for any
 * non-standard variant, and `minimal` for the strictest variant.
 */
export function variantClass(
  variant: UiVariant,
  opts: { base?: string; simplified?: string; minimal?: string; neglect?: string } = {}
): string {
  const { base, simplified, minimal, neglect } = opts;
  if (variant === 'minimal') return cn(base, minimal ?? simplified);
  if (variant === 'simplified-neglect') return cn(base, simplified, neglect);
  if (variant === 'simplified-fluent' || variant === 'simplified-non-fluent') {
    return cn(base, simplified);
  }
  return cn(base);
}

export const isSimplified = (v: UiVariant) => v !== 'standard';
export const isMinimal = (v: UiVariant) => v === 'minimal';
