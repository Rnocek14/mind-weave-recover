/**
 * "No spoken attempts this session" must mean exactly that. It used to be
 * printed whenever no spoken trial COUNTED, which told the clinician the
 * patient never tried to speak while five excluded clips sat in the audit.
 */
import { describe, it, expect } from 'vitest';
import { recognitionLineSuffix } from '@/components/patient-hub/review/recognitionLine';

describe('recognitionLineSuffix', () => {
  it('scored spoken trials exist → taps are simply kept separate', () => {
    expect(recognitionLineSuffix({ spokenTrials: 8, scoredSpokenTrials: 6, scaffoldedTaps: 0 })).toMatch(/kept separate/);
  });

  it('spoken attempts existed but none could be scored → says so, and points at the excluded clips', () => {
    const s = recognitionLineSuffix({ spokenTrials: 5, scoredSpokenTrials: 0, scaffoldedTaps: 0 });
    expect(s).toMatch(/5 spoken attempts could not be scored/);
    expect(s).not.toMatch(/no spoken attempts/);
    expect(recognitionLineSuffix({ spokenTrials: 1, scoredSpokenTrials: 0, scaffoldedTaps: 0 })).toMatch(/1 spoken attempt could/);
  });

  it('only scaffolded taps (mic heard nothing scorable, then a chip) → the mic, not the patient, is named', () => {
    const s = recognitionLineSuffix({ spokenTrials: 0, scoredSpokenTrials: 0, scaffoldedTaps: 10 });
    expect(s).toMatch(/microphone did not pick up/);
    expect(s).not.toMatch(/no spoken attempts/);
  });

  it('a chip-only session → no spoken attempts', () => {
    expect(recognitionLineSuffix({ spokenTrials: 0, scoredSpokenTrials: 0, scaffoldedTaps: 0 })).toMatch(/no spoken attempts this session/);
  });
});
