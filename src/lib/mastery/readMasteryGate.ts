/**
 * readMasteryGate — fetch longitudinal mastery confidence for a game's
 * level-up gate.
 *
 * Step 2 of the Clinical Progression v1 build, **Leak 4 fix** revision.
 *
 * Prior shape returned the minimum confidence across all trained skills,
 * and `undefined` whenever *any* skill row was missing. That silently
 * disabled the gate for new users on multi-skill games — a brand-new
 * patient could ride accuracy alone from L1→L7 because the gate never
 * had an opinion.
 *
 * New rule (single source of truth in `evaluateGateRule` below):
 *
 *   verdict = 'pass'  when at least one trained skill is medium-or-high
 *                     AND no trained skill is "stuck low" (low with
 *                     ≥12 trials — the threshold computeMastery uses
 *                     to qualify a skill for medium).
 *
 *   verdict = 'block' when at least one trained skill has signal
 *                     (confidence !== 'none') but the pass conditions
 *                     are not met. This is the honest "you have evidence
 *                     and the evidence is not yet sufficient" outcome.
 *
 *   verdict = 'skip'  when every trained skill is at confidence: 'none'
 *                     (which by computeMastery means trials_total < 5).
 *                     No data → no opinion → don't block. This is the
 *                     honest semantics, not a grace carve-out: the gate
 *                     refuses to render a verdict on data that does not
 *                     exist. The accuracy/support floors still apply.
 */
import { supabase } from '@/integrations/supabase/client';
import { mapTrialToSkills, isExcludedFromMastery } from './skillMapping';
import type { MasteryConfidenceLevel } from '@/lib/progression/clinicalProgression';

const RANK: Record<MasteryConfidenceLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Threshold above which a skill is considered to have "earned its chance"
 * at medium confidence. Mirrors computeMastery's medium cutoff
 * (trialsTotal >= 12 AND sessionCount >= 3); we only check trial volume
 * here because user_skill_mastery does not persist session count.
 *
 * A skill at confidence:'low' with trials_total >= STUCK_LOW_TRIAL_FLOOR
 * is treated as a real weakness signal and blocks level-up.
 */
export const STUCK_LOW_TRIAL_FLOOR = 12;

export type MasteryGateVerdict = 'pass' | 'block' | 'skip';

export interface SkillEvidence {
  confidence: MasteryConfidenceLevel;
  trialsTotal: number;
}

/**
 * Pure rule function — given the per-skill evidence map for the skills
 * a game trains, decide pass/block/skip. Exported and tested in
 * isolation so the rule cannot regress silently.
 */
export function evaluateGateRule(
  perSkill: SkillEvidence[],
): MasteryGateVerdict {
  if (perSkill.length === 0) return 'skip';

  const hasAnySignal = perSkill.some((s) => s.confidence !== 'none');
  if (!hasAnySignal) return 'skip';

  const stuckLow = perSkill.some(
    (s) => s.confidence === 'low' && s.trialsTotal >= STUCK_LOW_TRIAL_FLOOR,
  );
  if (stuckLow) return 'block';

  const hasMediumOrHigh = perSkill.some(
    (s) => s.confidence === 'medium' || s.confidence === 'high',
  );
  if (hasMediumOrHigh) return 'pass';

  return 'block';
}

function minConfidence(
  values: MasteryConfidenceLevel[],
): MasteryConfidenceLevel | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((min, v) => (RANK[v] < RANK[min] ? v : min), values[0]);
}

export interface MasteryGateResult {
  /** Pass/block/skip verdict per the locked rule (Leak 4 fix). */
  verdict: MasteryGateVerdict;
  /**
   * Min confidence across trained skills, or undefined when no rows
   * exist. Retained for diagnostics / dev UIs. **Do not use for
   * gating** — use `verdict`.
   */
  confidence: MasteryConfidenceLevel | undefined;
  skills: string[];
  /** Per-skill breakdown for diagnostics. */
  bySkill: Record<
    string,
    { confidence: MasteryConfidenceLevel | 'missing'; trialsTotal: number }
  >;
  /**
   * Quality signals for the A.3 promotion classifier: the WEAKEST trained
   * skill's longitudinal mastery score / cue independence (conservative —
   * promotion quality is only as good as the weakest trained skill).
   * Null when no skill row carries the value yet.
   */
  minMasteryScore: number | null;
  minCueIndependence: number | null;
}

/**
 * Read the mastery confidence gate for an exercise.
 *
 * Network failures degrade safely to verdict:'skip' — never block
 * progression on transport errors.
 */
export async function readMasteryGate(args: {
  profileId: string;
  exerciseSlug: string;
  /** Optional difficulty hint so naming/phonology pick the right bucket. */
  difficulty?: number | null;
}): Promise<MasteryGateResult> {
  const { profileId, exerciseSlug, difficulty } = args;

  if (isExcludedFromMastery(exerciseSlug)) {
    return { verdict: 'skip', confidence: undefined, skills: [], bySkill: {}, minMasteryScore: null, minCueIndependence: null };
  }

  const skills = mapTrialToSkills({
    exerciseSlug,
    inputs: difficulty != null ? { difficulty } : null,
  });
  if (skills.length === 0) {
    return { verdict: 'skip', confidence: undefined, skills: [], bySkill: {}, minMasteryScore: null, minCueIndependence: null };
  }

  try {
    const { data, error } = await supabase
      .from('user_skill_mastery')
      .select('skill_slug, confidence, trials_total, mastery_score, cue_independence')
      .eq('profile_id', profileId)
      .in('skill_slug', skills);

    if (error) {
      console.warn('[masteryGate] read failed:', error.message);
      return { verdict: 'skip', confidence: undefined, skills, bySkill: {}, minMasteryScore: null, minCueIndependence: null };
    }

    const rowBySkill = new Map<
      string,
      { confidence: MasteryConfidenceLevel; trialsTotal: number }
    >();
    for (const row of data ?? []) {
      rowBySkill.set(row.skill_slug, {
        confidence: (row.confidence as MasteryConfidenceLevel) ?? 'none',
        trialsTotal: row.trials_total ?? 0,
      });
    }

    const bySkill: MasteryGateResult['bySkill'] = {};
    const perSkill: SkillEvidence[] = [];
    for (const s of skills) {
      const row = rowBySkill.get(s);
      if (row) {
        bySkill[s] = { confidence: row.confidence, trialsTotal: row.trialsTotal };
        perSkill.push(row);
      } else {
        // Missing row = no signal yet for this skill. Treat as 'none'/0
        // so the rule sees it as ramping, not blocking.
        bySkill[s] = { confidence: 'missing', trialsTotal: 0 };
        perSkill.push({ confidence: 'none', trialsTotal: 0 });
      }
    }

    const verdict = evaluateGateRule(perSkill);
    const confidence = minConfidence(
      perSkill
        .filter((s) => s.confidence !== 'none' || rowBySkill.size > 0)
        .map((s) => s.confidence),
    );

    // Weakest-skill quality signals for the promotion classifier. Only rows
    // that actually carry the value participate (null ≠ zero).
    const scores = (data ?? [])
      .map((r) => r.mastery_score)
      .filter((v): v is number => typeof v === 'number');
    const independences = (data ?? [])
      .map((r) => r.cue_independence)
      .filter((v): v is number => typeof v === 'number');
    const minMasteryScore = scores.length > 0 ? Math.min(...scores) : null;
    const minCueIndependence = independences.length > 0 ? Math.min(...independences) : null;

    return { verdict, confidence, skills, bySkill, minMasteryScore, minCueIndependence };
  } catch (err) {
    console.warn('[masteryGate] read threw:', err);
    return { verdict: 'skip', confidence: undefined, skills, bySkill: {}, minMasteryScore: null, minCueIndependence: null };
  }
}
