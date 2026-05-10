/**
 * Unified Trial Submission — canonical input shape.
 *
 * One trial in. Three systems out:
 *   1. exercise_events           (clinical raw record, via useExerciseTelemetry)
 *   2. adaptation_trial_logs     (per-trial adaptation telemetry)
 *   3. clinical_progression_state (per-game level/progress, on commit)
 *   4. user_skill_mastery        (longitudinal mastery, on commit)
 *
 * Step 1 of the longitudinal-progression unification work. No new
 * gating / promotion behavior is added here. Existing per-game logic
 * (PhotoNamingProgression, FixSentenceProgression) is preserved and
 * routed through this single API.
 *
 * See docs/unified-trial-contract.md for the migration checklist.
 */

import type { SupportLevel } from '@/lib/progression/clinicalProgression';
import type { ValidityResult } from '@/lib/clinical/classifyUtteranceValidity';

/** Why this is the only canonical shape — see docs/unified-trial-contract.md §1. */
export interface UnifiedTrialInput {
  // ---- identity / context ----
  profileId: string | null | undefined;
  sessionId: string | null;
  /** Canonical exercise slug (the orchestrator normalizes for you). */
  gameId: string;
  /** Optional clinical skill key (used by mastery layer; defaults derived from gameId+stimulus). */
  skillKey?: string | null;
  /** Trial-mode taxonomy (frozen progression theory v0.3.0-spec). */
  trialMode?: 'production' | 'recognition' | 'scaffolded' | 'exposure' | 'mixed' | null;
  /** 1..N current adaptive level / difficulty tier. */
  level: number;
  /** Stable identifier for the stimulus (word, sentence, pair id, …). */
  stimulusId?: string | null;
  expectedResponse?: string | null;
  userResponse?: string | null;

  // ---- outcome ----
  isCorrect: boolean;
  /** Optional 0..1 graded accuracy (LLM / fuzzy / continuous scorers). */
  accuracyScore?: number | null;
  /** 0..3 cue intensity actually given. */
  cueLevel?: number | null;
  cueType?: string | null;
  /**
   * Clinical SupportLevel for the (correct? + cue path) — required by the
   * progression layer. Caller maps via game-specific helpers
   * (mapPhotoNamingSupport / mapFixSentenceSupport / mapMinimalPairsSupport).
   */
  supportUsed: SupportLevel;

  latencyMs?: number | null;
  attempts?: number | null;

  // ---- optional state-of-day signals ----
  fatigueSignal?: 'none' | 'low' | 'medium' | 'high' | null;
  frustrationSignal?: 'none' | 'low' | 'medium' | 'high' | null;

  trialTimestamp?: string;

  /** Anything else the per-game telemetry wants to record on exercise_events. */
  taskParameters?: Record<string, unknown>;
  /** Pre-classified speech-validity verdict (Phase 1 gate). */
  validity?: ValidityResult | null;

  // ---- pass-throughs to existing telemetry layer ----
  errorType?: string;
  errorClassification?: any;
  whisperTranscript?: string | null;
  whisperConfidence?: number | null;
  acousticMetrics?: any;
  audioStoragePath?: string | null;
  audioMimeType?: string | null;
  recordingDurationMs?: number | null;
  cueTypeGiven?: string | null;
  cueWasEffective?: boolean | null;
  timeToSuccessAfterCueMs?: number | null;
}

export interface UnifiedTrialSummary {
  ok: boolean;
  routed: {
    exerciseEvents: boolean;      // wrote raw clinical event
    adaptationTrialLogs: boolean; // wrote per-trial telemetry
    progressionBuffered: boolean; // queued for commitSession
  };
  /** Updated progression snapshot if available at this point in the session. */
  progression?: {
    level: number;
    progressPct: number;
    supportBaseline: number;
    bufferedTrialCount: number;
  } | null;
}

export interface CommitSessionResult {
  ok: boolean;
  progression?: { level: number; progressPct: number } | null;
  masteryFlushed: boolean;
  errors: string[];
}
