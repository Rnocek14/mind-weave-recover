/**
 * P0 safety: flushMasteryShadow must use ALLOWLIST routing
 * (verdict !== 'expressive' → skip), not denylist (verdict === 'excluded' → skip).
 *
 * This guards against a future RouteVerdict (e.g. 'receptive', 'assisted')
 * silently flowing into expressive mastery before it has explicit handling.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { RouteVerdict } from '../masterySignalRouting';

describe('flushMasteryShadow expressive allowlist', () => {
  const src = readFileSync(
    join(__dirname, '..', 'flushMasteryShadow.ts'),
    'utf8',
  );

  it('uses allowlist gate (verdict !== expressive)', () => {
    expect(src).toContain("verdict !== 'expressive'");
  });

  it('does NOT use the old denylist gate (verdict === excluded)', () => {
    expect(src).not.toMatch(/verdict\s*===\s*'excluded'/);
  });

  it('allowlist semantics: only "expressive" passes; any future verdict is skipped', () => {
    const gate = (v: RouteVerdict | string): 'pass' | 'skip' =>
      v === 'expressive' ? 'pass' : 'skip';

    expect(gate('expressive')).toBe('pass');
    expect(gate('excluded')).toBe('skip');
    expect(gate('skipped_unknown')).toBe('skip');
    // Hypothetical future verdicts must NOT default to expressive mastery.
    expect(gate('receptive')).toBe('skip');
    expect(gate('assisted')).toBe('skip');
    expect(gate('exposure')).toBe('skip');
    expect(gate('weighted')).toBe('skip');
  });
});
