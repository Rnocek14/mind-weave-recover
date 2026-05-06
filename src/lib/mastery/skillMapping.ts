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

const VOICING_PAIRS = ['p/b', 'b/p', 't/d', 'd/t', 'k/g', 'g/k', 'f/v', 'v/f', 's/z', 'z/s'];
const PLACE_PAIRS = ['p/t', 't/p', 'b/d', 'd/b', 'k/t', 't/k', 'f/s', 's/f'];

function classifyMinimalPair(inputs?: Record<string, any> | null): SkillSlug {
  const id = String(inputs?.pairId ?? inputs?.pair_id ?? inputs?.contrast ?? '').toLowerCase();
  if (VOICING_PAIRS.some(p => id.includes(p))) return 'phonology.voicing';
  if (PLACE_PAIRS.some(p => id.includes(p))) return 'phonology.place';
  return 'phonology.manner';
}

function classifyNamingByFrequency(inputs?: Record<string, any> | null): SkillSlug {
  // Prefer explicit difficulty signal if present, else default to high-frequency.
  const tier = Number(inputs?.difficulty ?? inputs?.difficulty_level ?? 1);
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
