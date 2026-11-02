import { describe, expect, it } from 'vitest';
import { scorePlanningSequence, classifyPlanningRoundEvidence } from './roundEvidence';
import { routeTrialMode } from '@/lib/mastery/masterySignalRouting';
import type { PlanningTrialResult } from '@/hooks/useMultiStepPlanningGame';

const trial = (overrides: Partial<PlanningTrialResult> = {}): PlanningTrialResult => ({
  itemId: 'plan-01',
  goal: 'Make a cup of tea',
  tier: 1,
  transcript: 'boil water then pour water then add milk',
  stepCount: 3,
  stepsFound: 3,
  stepsTotal: 5,
  goalCoverage: 0.6,
  sequenceScore: 1,
  sequenceEvidenceAvailable: true,
  sequenceMatchedSteps: 3,
  sequenceMethod: 'distinctive_tokens_v1',
  durationMs: 10000,
  skipped: false,
  inputMode: 'spoken',
  completionReason: 'completed',
  responseValid: true,
  browserTranscript: 'boil water then pour water then add milk',
  depthTelemetry: {
    taskType: 'multi_step_plan',
    stepCount: 3,
    sequenceScore: 1,
    goalCoverage: 0.6,
  },
  ...overrides,
});

describe('Multi-Step Planning observed sequence evidence', () => {
  const steps = ['boil water', 'get cup', 'put tea bag', 'pour water', 'add milk or sugar'];
  const ideal = [0, 1, 2, 3, 4];

  it('detects truly reversed steps instead of crediting their predefined array order', () => {
    const forward = scorePlanningSequence('Boil water and then pour water', steps, ideal);
    const reverse = scorePlanningSequence('Pour water and then boil water', steps, ideal);
    expect(forward).toMatchObject({
      sequenceScore: 1,
      sequenceEvidenceAvailable: true,
      matchedStepCount: 2,
      matchedStepIndices: [0, 3],
    });
    expect(reverse).toMatchObject({
      sequenceScore: 0,
      sequenceEvidenceAvailable: true,
      matchedStepCount: 2,
      matchedStepIndices: [3, 0],
    });
  });

  it('respects a curated idealOrder that differs from keySteps array order', () => {
    const nonSequential = ['get bread', 'choose filling', 'spread butter'];
    const order = [0, 2, 1];
    expect(scorePlanningSequence('bread butter filling', nonSequential, order)).toMatchObject({
      sequenceScore: 1,
      matchedStepIndices: [0, 2, 1],
    });
    expect(scorePlanningSequence('bread filling butter', nonSequential, order).sequenceScore)
      .toBeCloseTo(2 / 3, 8);
  });

  it('abstains when there is only one detectable step or overlapping vague tokens', () => {
    expect(scorePlanningSequence('water water', steps, ideal)).toMatchObject({
      sequenceEvidenceAvailable: false, sequenceScore: 0, matchedStepCount: 0,
    });
    expect(scorePlanningSequence('boil water', steps, ideal)).toMatchObject({
      sequenceEvidenceAvailable: false, sequenceScore: 0, matchedStepCount: 1,
    });
    expect(scorePlanningSequence('anything', steps, [0, 1, 1, 3, 4])).toMatchObject({
      sequenceEvidenceAvailable: false,
    });
  });
});

describe('Multi-Step Planning response-mode and mastery integrity', () => {
  it('preserves BOTH preexisting game criteria: 0.6 coverage AND 0.5 order', () => {
    expect(classifyPlanningRoundEvidence(trial())).toMatchObject({
      practiceSuccessful: true,
      clinicalProgressionEligible: true,
      trialMode: 'production',
      requiredGoalCoverage: 0.6,
      requiredSequenceScore: 0.5,
    });
    expect(classifyPlanningRoundEvidence(trial({ goalCoverage: 0.3 })).practiceSuccessful).toBe(false);
    expect(classifyPlanningRoundEvidence(trial({ sequenceScore: 0.49 })).practiceSuccessful).toBe(false);
    expect(classifyPlanningRoundEvidence(trial({ goalCoverage: 0.6, sequenceScore: 0.5 })).practiceSuccessful).toBe(true);
  });

  it('retains typed progress as practice, never as independently verified expressive speech', () => {
    const e = classifyPlanningRoundEvidence(trial({
      inputMode: 'typed', browserTranscript: null,
    }));
    expect(e).toMatchObject({
      practiceSuccessful: true, clinicalProgressionEligible: false, trialMode: 'mixed',
    });
    expect(routeTrialMode('multi-step-planning', e.trialMode)).toBe('excluded');
  });

  it('records but excludes skipped, invalid, or sequence-unknown responses from spoken clinical progression', () => {
    for (const partial of [
      { inputMode: 'none', completionReason: 'skipped', skipped: true } as const,
      { responseValid: false } as const,
      { sequenceEvidenceAvailable: false, sequenceMatchedSteps: 1 } as const,
      { sequenceMatchedSteps: 0 } as const,
      { sequenceScore: Number.NaN } as const,
      { goalCoverage: Infinity } as const,
    ]) {
      const e = classifyPlanningRoundEvidence(trial(partial));
      expect(e.clinicalProgressionEligible, JSON.stringify(partial)).toBe(false);
      expect(e.trialMode).toBe('mixed');
      expect(routeTrialMode('multi-step-planning', e.trialMode)).toBe('excluded');
    }
  });

  it('does not treat recognized speech as independently correct when observed order fails', () => {
    const e = classifyPlanningRoundEvidence(trial({ sequenceScore: 0 }));
    expect(e).toMatchObject({
      practiceSuccessful: false, clinicalProgressionEligible: true, trialMode: 'production',
    });
    expect(routeTrialMode('multi-step-planning', e.trialMode)).toBe('expressive');
  });
});
