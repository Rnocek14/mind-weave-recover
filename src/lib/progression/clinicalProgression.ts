/**
 * Clinical Progression v1 — Persistence + pure scoring helpers.
 *
 * Step 1 of the Clinical Progression v1 build (see
 * docs/clinical-progression-v1-spec.md). This module owns:
 *   - the canonical TypeScript shape of per-(profile × game) progression
 *   - clamping + default state
 *   - load / upsert against `clinical_progression_state`
 *   - PURE scoring helpers (no I/O, no side effects)
 *
 * Intentional non-goals for Step 1:
 *   - no game wiring (Photo Naming, Fix Sentence, Minimal Pairs untouched)
 *   - no UI surfacing
 *   - no gating enforcement
 *   - no hard regression beyond counter bookkeeping
 *   - no receptive / assisted mastery
 */

import { supabase } from '@/integrations/supabase/client';

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 8;
export const MIN_PROGRESS = 0;
export const MAX_PROGRESS = 100;

export interface ClinicalProgressionState {
  userId: string;
  profileId: string;
  exerciseSlug: string;
  currentLevel: number;
  progressPct: number;
  supportBaseline: number;
  stableLevel: number;
  consecutiveSuccessSessions: number;
  consecutiveStruggleSessions: number;
  lastSessionId: string | null;
  lastUpdatedAt: string;
  createdAt: string;
}

export type SupportLevel =
  // Photo Naming
  | 'independent'
  | 'semantic_cue'
  | 'phonemic_cue'
  | 'carrier_or_full_model'
  | 'recognition_only'
  // Fix Sentence
  | 'open_response'
  | 'choice_based'
  | 'highlight_plus_choice'
  // Minimal Pairs
  | 'first_listen'
  | 'after_replay'
  | 'after_multiple_replays';

/**
 * Cue / support discount table from spec §5.4. The exact numbers are tunable
 * but the *ordering* must hold (independent > cued > recognition).
 */
export const SUPPORT_CREDIT: Record<SupportLevel, number> = {
  // Photo Naming
  independent: 1.0,
  semantic_cue: 0.6,
  phonemic_cue: 0.4,
  carrier_or_full_model: 0.2,
  recognition_only: 0.0,
  // Fix Sentence
  open_response: 1.0,
  choice_based: 0.6,
  highlight_plus_choice: 0.4,
  // Minimal Pairs
  first_listen: 1.0,
  after_replay: 0.7,
  after_multiple_replays: 0.4,
};

// ---------- Pure helpers ----------

export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return MIN_LEVEL;
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(level)));
}

export function clampProgress(pct: number): number {
  if (!Number.isFinite(pct)) return MIN_PROGRESS;
  return Math.max(MIN_PROGRESS, Math.min(MAX_PROGRESS, pct));
}

/**
 * Per-trial credit, in the unit "fractional success on this trial."
 *  - incorrect → 0
 *  - correct + independent → 1.0
 *  - correct + scaffolded → SUPPORT_CREDIT[support] (always ≤ 1.0)
 */
export function trialCredit(params: {
  correct: boolean;
  support: SupportLevel;
}): number {
  if (!params.correct) return 0;
  const credit = SUPPORT_CREDIT[params.support];
  return typeof credit === 'number' ? credit : 0;
}

/**
 * Struggle signal for a single trial: incorrect, or correct only with heavy
 * support (recognition / full model / multiple replays).
 */
export function isStruggleTrial(params: {
  correct: boolean;
  support: SupportLevel;
}): boolean {
  if (!params.correct) return true;
  return (
    params.support === 'recognition_only' ||
    params.support === 'carrier_or_full_model' ||
    params.support === 'after_multiple_replays'
  );
}

/**
 * Convert a session's worth of trials into a progress delta (0–100 points)
 * for the current level. Independent corrects are worth more than cued ones.
 *
 * `trialWeight` lets a calling game tune how many "credits" map to 1
 * progress point — defaults to 5, i.e. roughly 5 fully-independent corrects
 * per 1 progress percentage point. Implementation may tune this per game.
 */
export function calculateProgressDelta(
  trials: Array<{ correct: boolean; support: SupportLevel }>,
  options: { trialWeight?: number } = {}
): number {
  const weight = options.trialWeight ?? 5;
  const totalCredit = trials.reduce((sum, t) => sum + trialCredit(t), 0);
  return totalCredit / weight;
}

export interface SessionRollupInput {
  trials: Array<{ correct: boolean; support: SupportLevel }>;
  /**
   * Spec §5.3: hitting 100% only escalates if the level's evidence criterion
   * (e.g. accuracy threshold across required window) is met. Caller decides.
   */
  evidenceMet: boolean;
  trialWeight?: number;
}

/**
 * Apply one session's trials to a state snapshot. Pure — does not write.
 *
 * Encodes spec rules:
 *   §5.2 — cued < independent credit
 *   §5.3 — level-up requires 100% AND evidence
 *   §5.6 — soft regression bumps support_baseline within current level
 *   §5.7 — counters track consecutive struggle sessions; level drop itself
 *          is *not* enforced here in Step 1
 */
export function applySessionToState(
  prev: ClinicalProgressionState,
  input: SessionRollupInput
): ClinicalProgressionState {
  const struggleCount = input.trials.filter(isStruggleTrial).length;
  const wasStruggleSession =
    input.trials.length > 0 && struggleCount / input.trials.length >= 0.5;

  const delta = calculateProgressDelta(input.trials, {
    trialWeight: input.trialWeight,
  });

  let nextProgress = clampProgress(prev.progressPct + delta);
  let nextLevel = clampLevel(prev.currentLevel);
  let nextStable = clampLevel(prev.stableLevel);
  let nextSupport = prev.supportBaseline;

  if (nextProgress >= MAX_PROGRESS) {
    if (input.evidenceMet && nextLevel < MAX_LEVEL) {
      nextLevel = clampLevel(nextLevel + 1);
      nextProgress = MIN_PROGRESS;
      nextSupport = 0;
      nextStable = nextLevel;
    } else {
      nextProgress = MAX_PROGRESS; // hold at top of level
    }
  }

  if (wasStruggleSession) {
    nextSupport = Math.min(nextSupport + 1, 3); // soft regression bump
  }

  return {
    ...prev,
    currentLevel: clampLevel(nextLevel),
    progressPct: clampProgress(nextProgress),
    supportBaseline: nextSupport,
    stableLevel: clampLevel(nextStable),
    consecutiveSuccessSessions: wasStruggleSession
      ? 0
      : prev.consecutiveSuccessSessions + 1,
    consecutiveStruggleSessions: wasStruggleSession
      ? prev.consecutiveStruggleSessions + 1
      : 0,
    lastUpdatedAt: new Date().toISOString(),
  };
}

// ---------- Defaults ----------

export function defaultProgressionState(params: {
  userId: string;
  profileId: string;
  exerciseSlug: string;
}): ClinicalProgressionState {
  const now = new Date().toISOString();
  return {
    userId: params.userId,
    profileId: params.profileId,
    exerciseSlug: params.exerciseSlug,
    currentLevel: MIN_LEVEL,
    progressPct: MIN_PROGRESS,
    supportBaseline: 0,
    stableLevel: MIN_LEVEL,
    consecutiveSuccessSessions: 0,
    consecutiveStruggleSessions: 0,
    lastSessionId: null,
    lastUpdatedAt: now,
    createdAt: now,
  };
}

// ---------- Persistence (typed wrappers around Supabase) ----------

interface DbRow {
  user_id: string;
  profile_id: string;
  exercise_slug: string;
  current_level: number;
  progress_pct: number;
  support_baseline: number;
  stable_level: number;
  consecutive_success_sessions: number;
  consecutive_struggle_sessions: number;
  last_session_id: string | null;
  last_updated_at: string;
  created_at: string;
}

function fromRow(row: DbRow): ClinicalProgressionState {
  return {
    userId: row.user_id,
    profileId: row.profile_id,
    exerciseSlug: row.exercise_slug,
    currentLevel: clampLevel(row.current_level),
    progressPct: clampProgress(Number(row.progress_pct)),
    supportBaseline: row.support_baseline ?? 0,
    stableLevel: clampLevel(row.stable_level),
    consecutiveSuccessSessions: row.consecutive_success_sessions ?? 0,
    consecutiveStruggleSessions: row.consecutive_struggle_sessions ?? 0,
    lastSessionId: row.last_session_id,
    lastUpdatedAt: row.last_updated_at,
    createdAt: row.created_at,
  };
}

/**
 * Load progression for (profile, exercise). Returns the default Level 1 / 0%
 * state if no row exists yet — does NOT insert. The first write will upsert.
 */
export async function loadProgressionState(params: {
  userId: string;
  profileId: string;
  exerciseSlug: string;
}): Promise<ClinicalProgressionState> {
  const { data, error } = await (supabase as any)
    .from('clinical_progression_state')
    .select('*')
    .eq('profile_id', params.profileId)
    .eq('exercise_slug', params.exerciseSlug)
    .maybeSingle();

  if (error) {
    console.warn('[clinicalProgression] load failed:', error.message);
    return defaultProgressionState(params);
  }
  if (!data) return defaultProgressionState(params);
  return fromRow(data as DbRow);
}

/**
 * Upsert progression state at session end.
 */
export async function saveProgressionState(
  state: ClinicalProgressionState
): Promise<{ ok: boolean; error?: string }> {
  const row = {
    user_id: state.userId,
    profile_id: state.profileId,
    exercise_slug: state.exerciseSlug,
    current_level: clampLevel(state.currentLevel),
    progress_pct: clampProgress(state.progressPct),
    support_baseline: state.supportBaseline,
    stable_level: clampLevel(state.stableLevel),
    consecutive_success_sessions: state.consecutiveSuccessSessions,
    consecutive_struggle_sessions: state.consecutiveStruggleSessions,
    last_session_id: state.lastSessionId,
    last_updated_at: new Date().toISOString(),
  };

  const { error } = await (supabase as any)
    .from('clinical_progression_state')
    .upsert(row, { onConflict: 'profile_id,exercise_slug' });

  if (error) {
    console.warn('[clinicalProgression] save failed:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
