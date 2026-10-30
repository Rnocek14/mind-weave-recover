/**
 * Photo Naming has two independently meaningful outcomes:
 *  - a patient says a word (spoken production / ASR validity applies)
 *  - a patient chooses a displayed answer (recognition task / no speech required)
 *
 * A recognition tap is a scored task attempt, but NEVER proof of spoken
 * production, ASR accuracy, or pronunciation. Keep its modality distinct even
 * when the microphone was previously active or a stale transcript exists.
 *
 * Don't apply the speech-validity classifier to selection tasks: an empty
 * speech transcript is expected for a successful tap, not "no response".
 */
import {
  classifyUtteranceValidity,
  type ValidityInput,
  type ValidityResult,
} from '@/lib/clinical/classifyUtteranceValidity';

export type PhotoNamingResponseMode =
  | 'production'
  | 'recognition'
  | 'scaffolded'
  | 'manual';

export interface PhotoNamingEvidenceInput extends ValidityInput {
  responseMode?: PhotoNamingResponseMode;
  /** True when a mic was attempted before the patient selected a choice. */
  productionAttempted?: boolean;
}

export interface PhotoNamingTrialProvenance {
  trialMode: PhotoNamingResponseMode;
  productionAttempted: boolean;
  validity: ValidityResult | undefined;
}

/**
 * Returns provenance for the *answer that was actually given*.
 * "recognition" remains recognition even after an attempted speech response;
 * we separately record that attempt for support/cue analysis.
 */
export function photoNamingTrialProvenance(
  input: PhotoNamingEvidenceInput,
): PhotoNamingTrialProvenance {
  const trialMode: PhotoNamingResponseMode = input.responseMode
    ?? (input.manualConfirmed ? 'manual' : 'production');
  return {
    trialMode,
    productionAttempted: input.productionAttempted === true,
    validity: trialMode === 'recognition'
      ? undefined
      : classifyUtteranceValidity(input),
  };
}
