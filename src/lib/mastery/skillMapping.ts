/**
 * skillMapping — exercise + stimulus → skill node slug(s)
 *
 * Pure function. Returns 0..N skill slugs that a given trial contributes to.
 * Used by the Mastery Layer writer (shadow mode). Does NOT influence any
 * live gameplay or in-session adaptation.
 */

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
 * They remain valuable as functional/conversational practice and continue to
 * write to `exercise_events` for clinician review — they just must not flow
 * into mastery aggregation. Revisit only after a real cue scale and
 * objective scoring contract exist for the exercise.
 */
const MASTERY_EXCLUDED_EXERCISES = new Set<string>([
  'conversation-partner',
  'conversation-coach',
]);

export function isExcludedFromMastery(exerciseSlug: string): boolean {
  return MASTERY_EXCLUDED_EXERCISES.has((exerciseSlug || '').toLowerCase());
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
  const slug = (exerciseSlug || '').toLowerCase();

  switch (slug) {
    case 'photo-naming':
    case 'two-clues':
    case 'semantic-feature':
    case 'dual-load-naming':
      return [classifyNamingByFrequency(inputs)];

    case 'describe-guess':
      return ['naming.verbs-actions'];

    case 'meaning-match':
      return ['comprehension.single-word'];

    case 'minimal-pairs':
      return [classifyMinimalPair(inputs), 'comprehension.single-word'];

    case 'phonological':
      return [classifyMinimalPair(inputs)];

    case 'fix-sentence':
    case 'sentence-construction':
    case 'thought-continuation':
      return ['comprehension.sentence'];

    case 'narrative-retell':
    case 'conversation-coach':
    case 'conversation-partner':
      return ['discourse.narrative'];

    case 'category-fluency':
      return ['discourse.category-fluency'];

    case 'synonym-generator':
      return ['discourse.synonyms'];

    case 'multi-step-plan':
    case 'detective-mind':
      return ['executive.planning'];

    case 'abstract-compare':
      return ['executive.abstract'];

    case 'pattern-match':
      return ['executive.attention', 'executive.abstract'];

    default:
      return [];
  }
}
