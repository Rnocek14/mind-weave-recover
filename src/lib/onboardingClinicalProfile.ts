/**
 * Onboarding → Provisional Clinical Profile builder
 *
 * Turns the lightweight onboarding screener answers into a CONSERVATIVE,
 * provisional "therapy personalization profile" — NOT a clinician-confirmed
 * diagnosis. Its only job is to stop new users from running on dark defaults
 * by giving the dailyLessonEngine and Smart Coach a real (if low-confidence)
 * clinical profile to consume.
 *
 * Priority / override rules (enforced by the caller):
 *  - A clinician-created profile (profile_source !== 'onboarding') ALWAYS wins.
 *  - Onboarding-built profiles are tagged profile_source = 'onboarding'.
 *  - Confidence is 'low' (or 'medium' when answers are strongly convergent),
 *    never 'high' — only a clinician confirmation should raise it.
 *
 * We deliberately do NOT make medical claims or over-specify. Word-finding
 * difficulty maps to the mildest plausible type (anomic), and we let a
 * clinician refine later. The strings written here are read back by
 * detectAphasiaType() in dailyLessonEngine.ts.
 */

import type { ClinicalProfile } from './clinicalProfileMapper';

export interface OnboardingScreener {
  strokeTiming: string | null;
  mainDifficulty: string[];
  energyLevel: string | null;
}

/** Screener difficulty option labels (must match Onboarding.tsx). */
const DIFFICULTY = {
  findingWords: 'Finding words',
  understanding: 'Understanding others',
  readingWriting: 'Reading/Writing',
  movement: 'Movement',
} as const;

/** Map stroke-timing answer → chronicity tag (informational, low stakes). */
function inferChronicity(strokeTiming: string | null): string | null {
  if (!strokeTiming) return null;
  if (strokeTiming.includes('Less than 3 months')) return 'subacute';
  if (strokeTiming.includes('3') && strokeTiming.includes('12')) return 'subacute';
  if (strokeTiming.includes('Over 1 year')) return 'chronic';
  return null;
}

/**
 * Build a provisional ClinicalProfile from onboarding answers + goals.
 * Returns null only if there is genuinely nothing to personalize on
 * (no goals, no difficulties) — callers should then leave the profile empty.
 */
export function buildOnboardingClinicalProfile(
  screener: OnboardingScreener,
  goals: string[],
): ClinicalProfile | null {
  const diffs = screener.mainDifficulty || [];
  const hasFindingWords = diffs.includes(DIFFICULTY.findingWords);
  const hasUnderstanding = diffs.includes(DIFFICULTY.understanding);
  const hasReadingWriting = diffs.includes(DIFFICULTY.readingWriting);
  const hasMovement = diffs.includes(DIFFICULTY.movement);

  const wantsSpeech = goals.includes('speech');
  const wantsMotor = goals.includes('motor');
  const wantsCognition = goals.includes('cognition');

  // Nothing meaningful to build on
  if (
    !hasFindingWords && !hasUnderstanding && !hasReadingWriting && !hasMovement &&
    !wantsSpeech && !wantsMotor && !wantsCognition
  ) {
    return null;
  }

  const speech: string[] = [];
  const motor: string[] = [];
  const cognitive: string[] = [];
  const visual: string[] = [];
  const inferenceNotes: ClinicalProfile['inference_notes'] = [];

  // === Provisional aphasia-type inference (conservative) ===
  // Both expressive + receptive difficulty → global-pattern aphasia.
  if (hasFindingWords && hasUnderstanding) {
    speech.push('global aphasia (provisional — expressive and receptive difficulty reported)');
    inferenceNotes.push({
      impairment: 'global aphasia',
      source: 'onboarding screener',
      reasoning: 'Reported difficulty both finding words and understanding others.',
      confidence: 'low',
    });
  } else if (hasFindingWords) {
    // Word-finding alone → mildest plausible type (anomic). Clinician can refine to Broca.
    speech.push('anomic aphasia (provisional — word-finding difficulty reported)');
    inferenceNotes.push({
      impairment: 'anomic aphasia',
      source: 'onboarding screener',
      reasoning: 'Reported word-finding difficulty; mapped to anomic pending clinician review.',
      confidence: 'low',
    });
  } else if (hasUnderstanding) {
    speech.push('receptive aphasia (provisional — comprehension difficulty reported)');
    inferenceNotes.push({
      impairment: 'receptive aphasia',
      source: 'onboarding screener',
      reasoning: 'Reported difficulty understanding others.',
      confidence: 'low',
    });
  } else if (wantsSpeech) {
    // Goal is speech but no specific difficulty named → generic language focus.
    speech.push('aphasia (provisional — speech/language recovery goal)');
  }

  if (hasReadingWriting) {
    speech.push('reading and writing difficulty (provisional)');
  }

  // === Motor ===
  if (hasMovement || wantsMotor) {
    motor.push('arm and hand weakness (provisional)');
    if (hasMovement) {
      inferenceNotes.push({
        impairment: 'motor impairment',
        source: 'onboarding screener',
        reasoning: 'Reported movement difficulty.',
        confidence: 'low',
      });
    }
  }

  // === Cognition ===
  if (wantsCognition) {
    cognitive.push('attention and memory support (provisional)');
  }

  // === Severity / mode flags ===
  // Severe-pattern only when the picture is broadly impaired AND fatigue is high.
  const tiresEasily = (screener.energyLevel || '').includes('Easily tired');
  const broadlyImpaired = hasFindingWords && hasUnderstanding;
  const speechSeverity = broadlyImpaired
    ? (tiresEasily ? 'severe' : 'moderate')
    : (hasFindingWords || hasUnderstanding ? 'mild' : 'moderate');

  const severity: Record<string, string> = {};
  if (speech.length > 0) severity.speech = speechSeverity;
  if (motor.length > 0) severity.motor = 'moderate';

  // Convergent answers (a clear single deficit + matching goal) → medium confidence.
  const convergent =
    (hasFindingWords && wantsSpeech && !hasUnderstanding) ||
    (hasUnderstanding && wantsSpeech && !hasFindingWords);
  const confidence: ClinicalProfile['confidence'] = convergent ? 'medium' : 'low';

  const therapyFocus: string[] = [];
  if (wantsSpeech || speech.length > 0) therapyFocus.push('speech/language');
  if (wantsMotor || motor.length > 0) therapyFocus.push('motor');
  if (wantsCognition || cognitive.length > 0) therapyFocus.push('cognition');

  const severeAphasiaMode = broadlyImpaired && tiresEasily;
  const comprehensionSupport = hasUnderstanding;

  const profile: ClinicalProfile = {
    impairments: { motor, speech, cognitive, visual },
    stroke_location: null,
    affected_side: null,
    therapy_focus: therapyFocus,
    severity,
    notes:
      'Provisional therapy personalization profile generated from onboarding answers. ' +
      'This is NOT a clinician-confirmed diagnosis and can be edited or replaced by clinician notes.',
    profile_source: 'manual',
    confidence,
    inference_notes: inferenceNotes,
    last_updated: new Date().toISOString(),
    extraction_metadata: {
      last_updated: new Date().toISOString(),
      parser_version: 'onboarding-v1',
      // Custom tags consumed by personalization layers / clinician UI.
      provenance: 'onboarding',
      chronicity: inferChronicity(screener.strokeTiming),
      severe_aphasia_mode: severeAphasiaMode,
      comprehension_support: comprehensionSupport,
      energy_level: screener.energyLevel,
    },
  };

  // Tag provenance explicitly so the override hierarchy can detect onboarding origin.
  // (profile_source stays 'manual' for type-compat with downstream readers; the
  // authoritative provenance flag is extraction_metadata.provenance === 'onboarding'.)
  (profile as any).provisional = true;

  return profile;
}

/**
 * Decide whether an onboarding-built profile may overwrite the existing one.
 * Clinician-authored profiles (anything not tagged onboarding provenance) win.
 */
export function canOnboardingOverwrite(existing: any | null | undefined): boolean {
  if (!existing || typeof existing !== 'object') return true;
  const hasImpairments =
    existing.impairments &&
    ['speech', 'motor', 'cognitive', 'visual'].some(
      (k) => Array.isArray(existing.impairments[k]) && existing.impairments[k].length > 0,
    );
  if (!hasImpairments) return true; // empty/blank profile → safe to populate
  const provenance = existing?.extraction_metadata?.provenance;
  // Only overwrite if the existing profile itself came from onboarding.
  return provenance === 'onboarding';
}
