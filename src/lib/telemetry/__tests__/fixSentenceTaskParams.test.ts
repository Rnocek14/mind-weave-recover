/**
 * Wave-13 telemetry QA — the taskParameters payload must let analysts
 * distinguish the three Fix Sentence tiers' clinical events.
 */
import { describe, it, expect } from 'vitest';
import { buildFixSentenceTaskParameters } from '@/lib/telemetry/fixSentenceTaskParams';
import {
  FIX_SENTENCE_BANK,
  FIX_SENTENCE_TWO_ERROR_BANK,
  FIX_SENTENCE_MORPHOLOGY_BANK,
} from '@/data/fixSentenceBank';
import type { FixSentenceTrialResult } from '@/hooks/useFixSentenceGame';

function resultFor(trialId: string, over: Partial<FixSentenceTrialResult> = {}): FixSentenceTrialResult {
  return {
    trialId,
    sentence: 's',
    wrongWord: 'w',
    spokenWord: 'x',
    matchedFix: null,
    isCorrect: false,
    isPartialCredit: false,
    selfCorrected: false,
    semanticSimilarity: null,
    reactionTimeMs: 1000,
    attemptNumber: 1,
    difficulty: 3,
    phonemeTargets: [],
    ...over,
  };
}

describe('buildFixSentenceTaskParameters', () => {
  it('tags single-error trials with their authored bank error type', () => {
    const t = FIX_SENTENCE_BANK[0];
    const p = buildFixSentenceTaskParameters(resultFor(t.id, { isCorrect: true }));
    expect(p.bank_error_type).toBe(t.errorType);
    expect(p.two_error_trial).toBe(false);
    expect(p.morphology_error_class).toBeNull();
    expect(p.phase2_abandoned).toBe(false);
  });

  it('tags morphology trials with their error class', () => {
    const t = FIX_SENTENCE_MORPHOLOGY_BANK[0];
    const p = buildFixSentenceTaskParameters(resultFor(t.id));
    expect(p.bank_error_type).toBe('morphology_error');
    expect(p.morphology_error_class).toBe(t.morphology!.errorClass);
  });

  it('distinguishes a two-error abandonment PARTIAL from a near-miss close_miss', () => {
    const t = FIX_SENTENCE_TWO_ERROR_BANK[0];
    const abandoned = buildFixSentenceTaskParameters(
      resultFor(t.id, { isPartialCredit: true, phase1Fix: t.acceptedFixes[0], phase2Fix: null }),
    );
    expect(abandoned.two_error_trial).toBe(true);
    expect(abandoned.phase2_abandoned).toBe(true);
    expect(abandoned.close_miss).toBe(false); // NOT the same clinical event

    const nearMiss = buildFixSentenceTaskParameters(
      resultFor(FIX_SENTENCE_BANK[0].id, { isPartialCredit: true }),
    );
    expect(nearMiss.close_miss).toBe(true);
    expect(nearMiss.phase2_abandoned).toBe(false);
  });

  it('carries both repair halves on a completed two-error aggregate', () => {
    const t = FIX_SENTENCE_TWO_ERROR_BANK[1];
    const p = buildFixSentenceTaskParameters(
      resultFor(t.id, {
        isCorrect: true,
        phase1Fix: t.acceptedFixes[0],
        phase2Fix: t.secondError!.acceptedFixes[0],
      }),
    );
    expect(p.phase1_fix).toBe(t.acceptedFixes[0]);
    expect(p.phase2_fix).toBe(t.secondError!.acceptedFixes[0]);
    expect(p.phase2_abandoned).toBe(false);
  });

  it('merges extra page-level fields without clobbering the core payload', () => {
    const t = FIX_SENTENCE_BANK[0];
    const p = buildFixSentenceTaskParameters(resultFor(t.id), { phoneme_matched: true });
    expect(p.phoneme_matched).toBe(true);
    expect(p.trial_id).toBe(t.id);
  });
});
