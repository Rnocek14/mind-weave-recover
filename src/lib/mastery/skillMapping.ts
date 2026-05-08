/**
 * skillMapping — exercise + stimulus → skill node slug(s)
 *
 * Pure function. Returns 0..N skill slugs that a given trial contributes to.
 * Used by the Mastery Layer writer (shadow mode). Does NOT influence any
 * live gameplay or in-session adaptation.
 *
 * Slug contract: this module always normalizes its input via
 * `normalizeExerciseSlug` (canonical underscore form). Callers may pass
 * dash-form, route-form, or any alias — the switch below is keyed on the
 * canonical underscore form returned by `CANONICAL_SLUGS`.
 */

import { normalizeExerciseSlug } from '@/lib/exerciseSlugNormalizer';

export type SkillSlug = string;

interface MapInput {
  exerciseSlug: string;
  inputs?: Record<string, any> | null;
}

/**
 * Exercises explicitly QUARANTINED from the mastery shadow layer.
 *
 * These produce open-ended / soft-scored evidence (LLM-graded discourse, no
 * stable cue scale, no objective target). Letting them feed `naming.*` or
 * `discourse.*` skill nodes would silently inflate mastery and contaminate
 * the longitudinal recovery model.
 *
 * Stored in canonical underscore form (matches what the writer persists).
 */
const MASTERY_EXCLUDED_EXERCISES = new Set<string>([
  'conversation_partner',
  'conversation_coach',
]);

export function isExcludedFromMastery(exerciseSlug: string): boolean {
  return MASTERY_EXCLUDED_EXERCISES.has(normalizeExerciseSlug(exerciseSlug || ''));
}

const VOICING_PAIRS = ['p/b', 'b/p', 't/d', 'd/t', 'k/g', 'g/k', 'f/v', 'v/f', 's/z', 'z/s'];
const PLACE_PAIRS = ['p/t', 't/p', 'b/d', 'd/b', 'k/t', 't/k', 'f/s', 's/f'];

function classifyMinimalPair(inputs?: Record<string, any> | null): SkillSlug {
  const id = String(
    inputs?.pairId ?? inputs?.pair_id ?? inputs?.contrast ?? inputs?.target_phrase ?? '',
  ).toLowerCase();
  if (!id) return 'phonology.unspecified';
  if (VOICING_PAIRS.some(p => id.includes(p))) return 'phonology.voicing';
  if (PLACE_PAIRS.some(p => id.includes(p))) return 'phonology.place';
  return 'phonology.manner';
}

function classifyNamingByFrequency(inputs?: Record<string, any> | null): SkillSlug {
  // Prefer explicit difficulty signal if present, else default to high-frequency.
  const raw = inputs?.difficulty ?? inputs?.difficulty_level;
  if (raw == null) return 'naming.unspecified';
  const tier = Number(raw);
  if (!Number.isFinite(tier)) return 'naming.unspecified';
  if (tier >= 3) return 'naming.low-frequency';
  return 'naming.high-frequency';
}

export function mapTrialToSkills({ exerciseSlug, inputs }: MapInput): SkillSlug[] {
  const slug = normalizeExerciseSlug(exerciseSlug || '');

  // Hard quarantine — open-ended / soft-scored exercises must never feed
  // mastery aggregation, even if they accidentally land in
  // adaptation_trial_logs through a future refactor.
  if (isExcludedFromMastery(slug)) return [];

  switch (slug) {
    case 'photo_naming':
    case 'two_clues':
    case 'semantic_features':
    case 'dual_load_naming':
      return [classifyNamingByFrequency(inputs)];

    case 'describe_guess':
      return ['naming.verbs-actions'];

    case 'meaning_match':
      return ['comprehension.single-word'];

    case 'minimal_pairs':
      return [classifyMinimalPair(inputs), 'comprehension.single-word'];

    case 'phonological_awareness':
      return [classifyMinimalPair(inputs)];

    case 'fix_sentence':
    case 'sentence_construction':
    case 'thought_continuation':
      return ['comprehension.sentence'];

    // Structured retell only. `conversation_coach` and `conversation_partner`
    // are quarantined above (see MASTERY_EXCLUDED_EXERCISES) — open-ended
    // discourse without an objective target or stable cue scale.
    case 'narrative_retell':
      return ['discourse.narrative'];

    case 'category_fluency':
      return ['discourse.category-fluency'];

    case 'synonym_generator':
      return ['discourse.synonyms'];

    case 'multi_step_planning':
    case 'detective_mind':
      return ['executive.planning'];

    case 'abstract_compare':
      return ['executive.abstract'];

    case 'pattern_match':
      return ['executive.attention', 'executive.abstract'];

    default:
      return [];
  }
}
