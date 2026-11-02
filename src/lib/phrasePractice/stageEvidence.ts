/**
 * Phrase Practice evidence source: every script-mode response has lexical
 * or a spoken model available. This is useful observed practice, but never
 * uncued independent speech or a clinical recovery-level promotion.
 *
 * The raw event retains correctness, supported response and source,
 * while clinical/ASR "verified accuracy" must not count this round.
 */
export interface PhrasePracticeEvidenceInput {
  trainingStage?: number | null;
  practiceStageSource?: string | null;
  scriptSupport?: 'visible_script' | 'partial_script' | 'word_clues' | 'situational_prompt' | 'repair_prompt' | null;
  fullScriptRevealed?: boolean | null;
  manualConfirmed?: boolean | null;
}

export function describePhrasePracticeEvidence(input: PhrasePracticeEvidenceInput) {
  return {
    training_stage: input.trainingStage ?? null,
    practice_stage_source: input.practiceStageSource ?? 'general_practice',
    script_support: input.scriptSupport ?? 'visible_script',
    full_script_revealed: input.fullScriptRevealed ?? true,
    clinical_stage_promotion_eligible: false,
    clinical_progression_eligible: false,
    independent_spoken_score_eligible: false,
    trial_mode: input.manualConfirmed ? 'manual_practice' : 'scaffolded',
    evidence_scope: 'supported_phrase_practice',
  } as const;
}
