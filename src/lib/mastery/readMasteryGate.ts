/**
 * readMasteryGate — fetch longitudinal mastery confidence for a game's
 * level-up gate.
 *
 * Step 2 of the Clinical Progression v1 build: promotes mastery confidence
 * out of pure shadow mode into ONE enforcement point — the level-up evidence
 * gate inside `applySessionToState`. Nothing else is gated by mastery yet.
 *
 * Returns the *minimum* confidence across all skills the exercise trains,
 * so the gate is only as strong as its weakest constituent skill. Returns
 * `undefined` when no rows exist (first-ever session) — caller should treat
 * that as "skip mastery gate this session" to avoid blocking new users.
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

function minConfidence(
  values: MasteryConfidenceLevel[],
): MasteryConfidenceLevel | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((min, v) => (RANK[v] < RANK[min] ? v : min), values[0]);
}

export interface MasteryGateResult {
  confidence: MasteryConfidenceLevel | undefined;
  skills: string[];
  /** Per-skill confidence breakdown for diagnostics. */
  bySkill: Record<string, MasteryConfidenceLevel | 'missing'>;
}

/**
 * Read the mastery confidence gate for an exercise. Inputs are best-effort
 * — if the network call fails we return `undefined` (gate disabled) rather
 * than blocking progression.
 */
export async function readMasteryGate(args: {
  profileId: string;
  exerciseSlug: string;
  /** Optional difficulty hint so naming/phonology can pick the right skill bucket. */
  difficulty?: number | null;
}): Promise<MasteryGateResult> {
  const { profileId, exerciseSlug, difficulty } = args;

  if (isExcludedFromMastery(exerciseSlug)) {
    return { confidence: undefined, skills: [], bySkill: {} };
  }

  const skills = mapTrialToSkills({
    exerciseSlug,
    inputs: difficulty != null ? { difficulty } : null,
  });
  if (skills.length === 0) {
    return { confidence: undefined, skills: [], bySkill: {} };
  }

  try {
    const { data, error } = await supabase
      .from('user_skill_mastery')
      .select('skill_slug, confidence')
      .eq('profile_id', profileId)
      .in('skill_slug', skills);

    if (error) {
      console.warn('[masteryGate] read failed:', error.message);
      return { confidence: undefined, skills, bySkill: {} };
    }

    const bySkill: Record<string, MasteryConfidenceLevel | 'missing'> = {};
    for (const s of skills) bySkill[s] = 'missing';
    const found: MasteryConfidenceLevel[] = [];
    for (const row of data ?? []) {
      const c = (row.confidence as MasteryConfidenceLevel) ?? 'none';
      bySkill[row.skill_slug] = c;
      found.push(c);
    }

    // Any skill missing entirely → treat overall as undefined (no gate yet).
    // This avoids blocking users whose mastery rows haven't been written for
    // every skill. The shadow flush will catch them up.
    if (found.length < skills.length) {
      return { confidence: undefined, skills, bySkill };
    }

    return { confidence: minConfidence(found), skills, bySkill };
  } catch (err) {
    console.warn('[masteryGate] read threw:', err);
    return { confidence: undefined, skills, bySkill: {} };
  }
}
