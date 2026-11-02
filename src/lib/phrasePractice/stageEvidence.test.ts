import { describe, expect, it } from 'vitest';
import { describePhrasePracticeEvidence } from '@/lib/phrasePractice/stageEvidence';

describe('Phrase Practice support and clinical score provenance', () => {
  it.each([
    [1, 'visible_script'],
    [2, 'partial_script'],
    [3, 'word_clues'],
  ] as const)('classifies Stage %s as assisted practice, not clinical recovery evidence', (stage, support) => {
    expect(describePhrasePracticeEvidence({
      trainingStage: stage,
      scriptSupport: support,
      practiceStageSource: 'care_partner_selection',
    })).toMatchObject({
      training_stage: stage,
      script_support: support,
      practice_stage_source: 'care_partner_selection',
      clinical_stage_promotion_eligible: false,
      clinical_progression_eligible: false,
      independent_spoken_score_eligible: false,
      trial_mode: 'scaffolded',
    });
  });

  it('records whole-script rescue and manual confirmation without claiming independent speech', () => {
    expect(describePhrasePracticeEvidence({
      trainingStage: 2, scriptSupport: 'visible_script',
      fullScriptRevealed: true, manualConfirmed: true,
    })).toMatchObject({
      full_script_revealed: true,
      trial_mode: 'manual_practice',
      clinical_progression_eligible: false,
    });
  });

  it('also keeps legacy fully visible scripts out of clinical independent accuracy', () => {
    expect(describePhrasePracticeEvidence({})).toMatchObject({
      training_stage: null, script_support: 'visible_script',
      clinical_progression_eligible: false,
      independent_spoken_score_eligible: false,
    });
  });
});
