/**
 * The legacy lesson/targeted-practice Photo Naming route must preserve the
 * same answer-mode evidence as the standalone Photo Naming route.
 *
 * A patient who taps a choice after trying the microphone has completed a
 * recognition task, NOT an ASR-verified spoken naming trial. The original
 * audio can remain attached for review without entering ASR denominators.
 *
 * Pure mapping only; actual writes still go through useExerciseTelemetry.
 */
import {
  photoNamingTrialProvenance,
  type PhotoNamingEvidenceInput,
  type PhotoNamingResponseMode,
} from './photoNamingTrialProvenance';
import type { ValidityResult } from './classifyUtteranceValidity';

export interface EmbeddedPhotoNamingEvidence {
  validity: ValidityResult | undefined;
  taskParameters: {
    trial_mode: Exclude<PhotoNamingResponseMode, 'manual'>;
    response_mode: PhotoNamingResponseMode;
    production_attempted: boolean;
    confirmation_mode: 'asr' | 'manual' | 'caregiver' | 'selection';
    confirmed_by: 'asr' | 'user' | 'caregiver';
    manual_confirmed: boolean;
    asr_verified: boolean;
  };
}

export function buildEmbeddedPhotoNamingEvidence(
  input: PhotoNamingEvidenceInput,
): EmbeddedPhotoNamingEvidence {
  const provenance = photoNamingTrialProvenance(input);
  const mode = provenance.trialMode;

  return {
    validity: provenance.validity,
    taskParameters: {
      // The mastery router accepts scaffolded but not a manual trial_mode.
      // Keep manual source separately for clinical review.
      trial_mode: mode === 'manual' ? 'scaffolded' : mode,
      response_mode: mode,
      production_attempted: provenance.productionAttempted,
      // Recognition always denotes a choice, even if mic/ASR was used earlier.
      confirmation_mode: mode === 'recognition'
        ? 'selection'
        : (input.confirmationMode ?? (input.manualConfirmed ? 'manual' : 'asr')),
      confirmed_by: mode === 'recognition'
        ? 'user'
        : (input.confirmedBy ?? (input.manualConfirmed ? 'user' : 'asr')),
      manual_confirmed: input.manualConfirmed === true,
      asr_verified: mode === 'production' && input.asrVerified === true,
    },
  };
}
