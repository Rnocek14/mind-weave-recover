import { describe, it, expect } from 'vitest';
import { baselineSupport, stallRevealLevel, resolveVisualSupport } from '../visualSupport';

describe('visualSupport', () => {
  it('baseline fades as adaptive level rises', () => {
    expect(baselineSupport(1)).toBe(3);
    expect(baselineSupport(3)).toBe(3);
    expect(baselineSupport(4)).toBe(2);
    expect(baselineSupport(6)).toBe(2);
    expect(baselineSupport(7)).toBe(1);
    expect(baselineSupport(8)).toBe(1);
    expect(baselineSupport(9)).toBe(0);
    expect(baselineSupport(10)).toBe(0);
  });

  it('stall reveal climbs with stall index', () => {
    expect(stallRevealLevel(-1)).toBe(0);
    expect(stallRevealLevel(0)).toBe(1);
    expect(stallRevealLevel(1)).toBe(2);
    expect(stallRevealLevel(2)).toBe(3);
    expect(stallRevealLevel(3)).toBe(3);
  });

  it('resolved level never drops below baseline', () => {
    const r = resolveVisualSupport({ adaptiveLevel: 2, stallPromptIndex: -1 });
    expect(r.level).toBe(3); // baseline strong, no stall
  });

  it('stall reveal can rescue a low-baseline user', () => {
    const r = resolveVisualSupport({ adaptiveLevel: 10, stallPromptIndex: 1 });
    expect(r.baseline).toBe(0);
    expect(r.stallReveal).toBe(2);
    expect(r.level).toBe(2);
  });

  it('preference=extra bumps baseline', () => {
    expect(resolveVisualSupport({ adaptiveLevel: 7, stallPromptIndex: -1, preference: 'extra' }).level).toBe(2);
  });

  it('preference=minimal caps baseline at 1', () => {
    expect(resolveVisualSupport({ adaptiveLevel: 1, stallPromptIndex: -1, preference: 'minimal' }).level).toBe(1);
  });

  it('preference=minimal still allows stall rescue to full', () => {
    const r = resolveVisualSupport({ adaptiveLevel: 1, stallPromptIndex: 2, preference: 'minimal' });
    expect(r.level).toBe(3);
  });
});
