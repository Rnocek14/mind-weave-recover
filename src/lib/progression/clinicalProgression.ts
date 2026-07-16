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
 * Receptive-track per-trial credit. The expressive `SUPPORT_CREDIT` table
 * treats `recognition_only` as the *lowest* form of independence (0.0)
 * because for expressive naming, being shown the target word IS the
 * scaffold. For receptive tasks (meaning-match, detective-mind,
 * phonological-awareness) the inverse holds: `recognition_only` means
 * "the patient picked the right answer with NO hint" — that IS the
 * independent baseline and must score full credit. A `semantic_cue` trial
 * means they tapped the hint button first → partial credit.
 *
 * Without this inversion, receptive games whose target rung is
 * `recognition_only` (L3–L8 on meaning-match / detective-mind, L1–L8 on
 * phonological-awareness) accrue 0 progress per session regardless of
 * accuracy, leaving patients permanently stuck at L2.
 */
export const RECEPTIVE_SUPPORT_CREDIT: Partial<Record<SupportLevel, number>> = {
  recognition_only: 1.0, // independent: chose correctly with no scaffold
  semantic_cue: 0.6,     // used hint, then chose correctly
};

export function receptiveTrialCredit(params: {
  correct: boolean;
  support: SupportLevel;
}): number {
  if (!params.correct) return 0;
  const credit = RECEPTIVE_SUPPORT_CREDIT[params.support];
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

export type MasteryConfidenceLevel = 'none' | 'low' | 'medium' | 'high';

export interface SessionRollupInput {
  trials: Array<{ correct: boolean; support: SupportLevel }>;
  /**
   * Spec §5.3: hitting 100% only escalates if the level's evidence criterion
   * (e.g. accuracy threshold across required window) is met. Caller decides.
   */
  evidenceMet: boolean;
  trialWeight?: number;
  /**
   * Optional caller-computed progress delta (0–100 points). When provided,
   * overrides the generic `calculateProgressDelta`. Used by games with
   * level-specific weighting (e.g. Photo Naming).
   */
  progressDelta?: number;
  /**
   * Legacy mastery input: minimum confidence across trained skills.
   * Preserved for backward compatibility with tests and any caller that
   * has not migrated to `masteryVerdict`. New callers should pass
   * `masteryVerdict` instead — see Leak 4 fix in `readMasteryGate.ts`.
   */
  masteryConfidence?: MasteryConfidenceLevel;
  /**
   * Verdict from the mastery gate rule (Leak 4 fix). Takes precedence
   * over `masteryConfidence` when both are supplied.
   *   'pass'  → unlock level-up (subject to accuracy + evidence floors)
   *   'block' → hold at top of level even at 100% progress
   *   'skip'  → no opinion (no signal yet); gate is a no-op
   * When neither field is provided, gate is a no-op (legacy behavior).
   */
  masteryVerdict?: 'pass' | 'block' | 'skip';
  /**
   * Highest level whose contentSelector actually ships differentiated
   * content. When provided, level-up is clamped here so the patient never
   * advances into a planned tier and silently receives baseline-fallback
   * content labeled as the higher level. Optional for backward compat —
   * undefined disables the clamp.
   */
  maxImplementedLevel?: number;
}

/**
 * Legacy gate function — true when confidence is medium/high or undefined.
 * Kept for back-compat with tests; new code should use the verdict path.
 */
export function masteryConfidenceMeetsGate(
  confidence: MasteryConfidenceLevel | undefined,
): boolean {
  if (confidence === undefined) return true;
  return confidence === 'medium' || confidence === 'high';
}

/**
 * Verdict-aware gate. Prefers the explicit verdict; falls back to the
 * legacy confidence check; defaults to open when nothing is supplied.
 */
export function masteryGateAllowsAdvance(
  input: Pick<SessionRollupInput, 'masteryVerdict' | 'masteryConfidence'>,
): boolean {
  if (input.masteryVerdict !== undefined) {
    return input.masteryVerdict !== 'block';
  }
  return masteryConfidenceMeetsGate(input.masteryConfidence);
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

  const delta =
    typeof input.progressDelta === 'number'
      ? input.progressDelta
      : calculateProgressDelta(input.trials, { trialWeight: input.trialWeight });

  const ceiling =
    typeof input.maxImplementedLevel === 'number'
      ? clampLevel(input.maxImplementedLevel)
      : MAX_LEVEL;

  let nextProgress = clampProgress(prev.progressPct + delta);
  // Clamp prev.currentLevel to the implemented ceiling so legacy state that
  // advanced past the implemented tier is silently corrected downward.
  let nextLevel = Math.min(clampLevel(prev.currentLevel), ceiling);
  let nextStable = Math.min(clampLevel(prev.stableLevel), ceiling);
  let nextSupport = prev.supportBaseline;

  if (nextProgress >= MAX_PROGRESS) {
    const masteryOk = masteryGateAllowsAdvance(input);
    const canAdvance = nextLevel < MAX_LEVEL && nextLevel < ceiling;
    if (input.evidenceMet && masteryOk && canAdvance) {
      nextLevel = clampLevel(nextLevel + 1);
      nextProgress = MIN_PROGRESS;
      nextSupport = 0;
      nextStable = nextLevel;
    } else {
      nextProgress = MAX_PROGRESS; // hold at top of level (or top of implemented ceiling)
    }
  }

  if (wasStruggleSession) {
    nextSupport = Math.min(nextSupport + 1, 3); // soft regression bump
  } else if (input.trials.length > 0) {
    // Non-struggle / success session decays support baseline by 1.
    // Clamped to [0, 3]. Scope: Step 1 hygiene — no level drop here.
    nextSupport = Math.max(nextSupport - 1, 0);
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
  // Must NEVER throw: 13 exercise pages gate their render on this resolving.
  // A thrown network error (as opposed to a returned query error) would leave
  // the patient on an infinite "Loading your progression…" spinner.
  try {
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
  } catch (e) {
    console.warn('[clinicalProgression] load threw (network?):', e);
    return defaultProgressionState(params);
  }
}

/**
 * Upsert progression state at session end.
 *
 * Also appends an immutable row to `progression_events` capturing the
 * prev→next transition (level, progress, support baseline, leveled-up).
 * This is the single, centralized integration point so all 14 per-game
 * progression hooks get an append-only audit trail without per-hook changes.
 * The audit write is best-effort and never blocks state persistence.
 */
export async function saveProgressionState(
  state: ClinicalProgressionState
): Promise<{ ok: boolean; error?: string }> {
  // Read the previous row first so the audit event can record the transition.
  let prevRow: {
    current_level: number | null;
    progress_pct: number | null;
    support_baseline: number | null;
  } | null = null;
  try {
    const { data } = await (supabase as any)
      .from('clinical_progression_state')
      .select('current_level, progress_pct, support_baseline')
      .eq('profile_id', state.profileId)
      .eq('exercise_slug', state.exerciseSlug)
      .maybeSingle();
    prevRow = data ?? null;
  } catch {
    prevRow = null;
  }

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

  // Append-only audit event (best-effort; failures never break the session).
  try {
    const nextLevel = clampLevel(state.currentLevel);
    const nextProgress = clampProgress(state.progressPct);
    await (supabase as any).from('progression_events').insert({
      user_id: state.userId,
      profile_id: state.profileId,
      exercise_slug: state.exerciseSlug,
      session_id: state.lastSessionId ?? null,
      prev_level: prevRow?.current_level ?? null,
      next_level: nextLevel,
      prev_progress_pct: prevRow?.progress_pct ?? null,
      next_progress_pct: nextProgress,
      prev_support_baseline: prevRow?.support_baseline ?? null,
      next_support_baseline: state.supportBaseline,
      leveled_up:
        prevRow?.current_level != null
          ? nextLevel > prevRow.current_level
          : false,
      source: 'session_flush',
    });
  } catch (e) {
    if (import.meta.env?.DEV) {
      console.warn('[clinicalProgression] progression_events append failed', e);
    }
  }

  return { ok: true };
}

