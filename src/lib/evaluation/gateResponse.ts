/**
 * gateResponse — the single, mandatory pre-scoring gate.
 *
 * Wave 1 of the clinical engine hardening pass.
 *
 * HARD RULE: no game scores a transcript without first calling this function.
 * Returns either:
 *   { ok: true,  classification, validation }   → safe to score
 *   { ok: false, classification, validation, coachingText, rejectionReason }
 *
 * Pipeline (in order, fail-fast):
 *   1. EchoFilter           — rejects parroting of Maya's recent speech
 *   2. validateSpokenResponse — rejects empty / filler / instruction echoes / prompt repeats / too short
 *   3. (passthrough) — caller's domain scorer classifies semantic vs phonemic etc.
 *
 * The caller is responsible for downstream classification (semantic_paraphasia,
 * phonemic_paraphasia, circumlocution, off_topic) using their existing scorer.
 * Gate ensures NOTHING irrelevant ever reaches that scorer.
 */

import { checkEcho } from '@/lib/evaluation/echoFilter';
import {
  validateSpokenResponse,
  getRejectionCoachingText,
  type ValidateOptions,
  type ValidationResult,
  type RejectionReason,
} from '@/lib/evaluation/responseValidation';

export type GateClassification =
  | 'valid_to_score'
  | 'echo_of_maya'
  | 'echo_short_mimic'
  | 'empty'
  | 'filler'
  | 'instruction_echo'
  | 'prompt_repeat'
  | 'too_short'
  | 'non_answer';

export interface GateResult {
  ok: boolean;
  classification: GateClassification;
  validation: ValidationResult | null;
  coachingText: string | null;
  rejectionReason: RejectionReason | 'echo_of_maya' | null;
  /** Echo-filter debug info (always present) */
  echoScore: number;
  echoMatched: string | null;
}

export interface GateOptions extends ValidateOptions {
  /** Lines beyond Maya's recent speech to also check echo against (e.g., current prompt). */
  extraSpokenContext?: string[];
  /**
   * Legitimate expected answers for this trial (e.g. naming target + visible choices).
   * If the transcript normalizes to one of these, the echo filter is bypassed —
   * even if Maya recently spoke that same word during feedback or replay.
   * Critical for naming tasks where the target word is short and gets played as audio.
   */
  expectedAnswers?: string[];
}

function normalizeForCompare(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const ECHO_REJECTION_COACHING: Record<NonNullable<ReturnType<typeof checkEcho>['reason']>, string> = {
  exact:         "Tell me your answer, not what I just said.",
  token_overlap: "Try answering in your own words.",
  trigram:       "Try answering in your own words.",
  short_mimic:   "Tell me your answer, not the instructions.",
};

export function gateResponse(opts: GateOptions): GateResult {
  const { transcript, extraSpokenContext = [], expectedAnswers = [], ...validateOpts } = opts;

  // ─── 1. Echo of Maya (dynamic — checks last 5 lines actually spoken) ───
  const echo = checkEcho(transcript, extraSpokenContext);
  if (echo.isEcho) {
    // Bypass: if the transcript IS one of the trial's legitimate answers,
    // it's not an echo — it's the right word that Maya happened to also say
    // (e.g. PhotoNaming target word played as audio, then user names it).
    const userNorm = normalizeForCompare(transcript);
    const isLegitAnswer = expectedAnswers.some((ans) => {
      const ansNorm = normalizeForCompare(ans);
      return ansNorm.length > 0 && (ansNorm === userNorm || userNorm.includes(ansNorm));
    });
    if (isLegitAnswer) {
      console.log('[gateResponse] echo bypass — transcript matches expected answer', {
        transcript,
        echoMatched: echo.matched,
      });
    } else {
      console.log('[gateResponse] REJECT echo_of_maya', {
        transcript,
        matched: echo.matched,
        score: echo.score.toFixed(2),
        reason: echo.reason,
      });
      return {
        ok: false,
        classification: echo.reason === 'short_mimic' ? 'echo_short_mimic' : 'echo_of_maya',
        validation: null,
        coachingText: ECHO_REJECTION_COACHING[echo.reason!],
        rejectionReason: 'echo_of_maya',
        echoScore: echo.score,
        echoMatched: echo.matched,
      };
    }
  }

  // ─── 2. Static validation pipeline ───
  const validation = validateSpokenResponse({ transcript, ...validateOpts });
  if (!validation.valid) {
    console.log('[gateResponse] REJECT validation', {
      transcript,
      reason: validation.rejectionReason,
    });
    return {
      ok: false,
      classification: validation.rejectionReason as GateClassification,
      validation,
      coachingText: validation.rejectionReason ? getRejectionCoachingText(validation.rejectionReason) : null,
      rejectionReason: validation.rejectionReason,
      echoScore: echo.score,
      echoMatched: echo.matched,
    };
  }

  // ─── PASS — caller must classify (semantic/phonemic/correct/etc.) downstream ───
  return {
    ok: true,
    classification: 'valid_to_score',
    validation,
    coachingText: null,
    rejectionReason: null,
    echoScore: echo.score,
    echoMatched: echo.matched,
  };
}

/**
 * Dev-mode warning helper. Call from inside scorers to assert that they
 * were invoked AFTER gateResponse. Not enforced in prod.
 */
export function assertGated(wasGated: boolean, scorerName: string) {
  if (!wasGated && import.meta.env?.DEV) {
    console.warn(
      `[ClinicalIntegrity] ${scorerName} was called WITHOUT gateResponse() first. ` +
      `This bypasses validation and echo filtering. Fix the call site.`
    );
  }
}
