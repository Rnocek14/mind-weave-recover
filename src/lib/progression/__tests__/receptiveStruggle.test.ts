/**
 * Receptive ladders must not book a clean, hint-free session as a struggle session.
 *
 * `receptiveTrialCredit` already inverts credit for comprehension/acoustic tasks:
 * there, `recognition_only` means "chose correctly with no scaffold" and is the
 * INDEPENDENT baseline (see the comment above RECEPTIVE_SUPPORT_CREDIT). The
 * struggle predicate was never inverted with it, so a 10/10 no-hint session was
 * classified as struggle, pinning supportBaseline at its cap, holding
 * consecutiveSuccessSessions at 0, and keeping the soft-regression scaffold on
 * permanently for the best-performing patients.
 *
 * Spec: docs/clinical-progression-v1-spec.md §5.6 (soft regression is for struggle).
 */
import { describe, it, expect } from 'vitest';
import {
  applySessionToState,
  defaultProgressionState,
  isStruggleTrial,
  receptiveIsStruggleTrial,
  type SupportLevel,
} from '../clinicalProgression';

const ids = { userId: 'u1', profileId: 'p1', exerciseSlug: 'meaning-match' };

const session = (n: number, support: SupportLevel, correct = true) =>
  Array.from({ length: n }, () => ({ correct, support }));

describe('receptive struggle predicate', () => {
  it('treats a correct no-hint recognition trial as independent, not struggle', () => {
    const trial = { correct: true, support: 'recognition_only' as SupportLevel };
    expect(isStruggleTrial(trial)).toBe(true);            // expressive track: unchanged
    expect(receptiveIsStruggleTrial(trial)).toBe(false);  // receptive track: independent
  });

  it('still counts an incorrect trial as struggle on the receptive track', () => {
    expect(receptiveIsStruggleTrial({ correct: false, support: 'recognition_only' })).toBe(true);
  });

  it('still counts a fully modelled correct trial as struggle', () => {
    expect(receptiveIsStruggleTrial({ correct: true, support: 'carrier_or_full_model' })).toBe(true);
  });
});

describe('applySessionToState — receptive track', () => {
  it('does not inflate support after a perfect hint-free session', () => {
    const prev = defaultProgressionState(ids);
    const next = applySessionToState(prev, {
      trials: session(10, 'recognition_only'),
      evidenceMet: false,
      progressDelta: 10,
      track: 'receptive',
    });
    expect(next.supportBaseline).toBe(0);
    expect(next.consecutiveSuccessSessions).toBe(1);
    expect(next.consecutiveStruggleSessions).toBe(0);
  });

  it('keeps the soft-regression scaffold off across repeated clean sessions', () => {
    let state = defaultProgressionState(ids);
    for (let i = 0; i < 6; i++) {
      state = applySessionToState(state, {
        trials: session(10, 'recognition_only'),
        evidenceMet: false,
        progressDelta: 5,
        track: 'receptive',
      });
    }
    expect(state.supportBaseline).toBe(0);
    expect(state.consecutiveStruggleSessions).toBe(0);
    expect(state.consecutiveSuccessSessions).toBe(6);
  });

  it('still raises support when the receptive session really is poor', () => {
    const prev = defaultProgressionState(ids);
    const next = applySessionToState(prev, {
      trials: session(10, 'recognition_only', false),
      evidenceMet: false,
      progressDelta: 0,
      track: 'receptive',
    });
    expect(next.supportBaseline).toBe(1);
    expect(next.consecutiveStruggleSessions).toBe(1);
  });

  it('leaves the expressive track exactly as it was', () => {
    const prev = defaultProgressionState({ ...ids, exerciseSlug: 'photo-naming' });
    const next = applySessionToState(prev, {
      trials: session(10, 'recognition_only'),
      evidenceMet: false,
      progressDelta: 0,
    });
    expect(next.supportBaseline).toBe(1);
    expect(next.consecutiveStruggleSessions).toBe(1);
  });
});
