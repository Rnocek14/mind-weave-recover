import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { calculateRecoveryLift, type TurnSnapshot } from './recoveryLiftScore';

const turn = (overrides: Partial<TurnSnapshot> = {}): TurnSnapshot => ({
  wordCount: 5,
  fluencyScore: 60,
  latencyMs: 1000,
  cueLevel: 1,
  wasIndependent: false,
  ...overrides,
});

describe('calculateRecoveryLift data integrity', () => {
  it('preserves zero change when all compared measurements are present', () => {
    const turns = Array.from({ length: 6 }, () => turn());

    expect(calculateRecoveryLift(turns)).toMatchObject({
      liftScore: 0,
      fluencyLift: 0,
      wordCountLift: 0,
      latencyLift: 0,
      cueDependencyLift: 0,
    });
  });

  it('preserves the existing formula for complete measurements', () => {
    const baseline = Array.from({ length: 3 }, () =>
      turn({ latencyMs: 3000, cueLevel: 2 })
    );
    const end = Array.from({ length: 3 }, () =>
      turn({ fluencyScore: 80, wordCount: 7, latencyMs: 2000, cueLevel: 1 })
    );

    expect(calculateRecoveryLift([...baseline, ...end])).toMatchObject({
      liftScore: 20,
      fluencyLift: 20,
      wordCountLift: 10,
      latencyLift: 25,
      cueDependencyLift: 25,
    });
  });

  it('does not manufacture improvement when end-window latency is missing', () => {
    const baseline = Array.from({ length: 3 }, () => turn({ latencyMs: 1000 }));
    const end = Array.from({ length: 3 }, () => turn({ latencyMs: null }));

    expect(calculateRecoveryLift([...baseline, ...end])).toBeNull();
  });

  it('does not publish the composite when any compared latency is missing', () => {
    const turns = Array.from({ length: 6 }, () => turn());
    turns[4] = turn({ latencyMs: null });

    expect(calculateRecoveryLift(turns)).toBeNull();
  });

  it('preserves a genuinely measured worsening in latency', () => {
    const baseline = Array.from({ length: 3 }, () => turn({ latencyMs: 1000 }));
    const end = Array.from({ length: 3 }, () => turn({ latencyMs: 2000 }));

    expect(calculateRecoveryLift([...baseline, ...end])).toMatchObject({
      liftScore: -5,
      latencyLift: -25,
    });
  });
});
