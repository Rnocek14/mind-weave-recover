/**
 * FixSentence intensity ladder.
 *
 * Primary axis: error-type sophistication.
 *
 * Cohorts map 1-to-1 to FixSentenceTrial.errorType:
 *   category_error        — pillow ↔ soap (cross-category)
 *   semantic_swap         — spoon ↔ knife (within category)
 *   function_error        — coin ↔ key (subtle function mismatch)
 *   multiple_valid_repairs — multiple defensible answers
 *
 * Sub-tier index sorts within the cohort by:
 *   sentenceLength → wrongWordIndex
 *   (longer sentences with errors late in the sentence are harder — must
 *    hold the whole sentence in working memory.)
 *
 * Pressure modifiers control hint visibility, not timing — repair is not a
 * speed task. The "show me" button availability drops as the level climbs.
 */

import { registerGameIntensity, type GameIntensityConfig } from './gameIntensity';

export const FIX_SENTENCE_SLUG = 'fix-sentence';

const config: GameIntensityConfig = {
  slug: FIX_SENTENCE_SLUG,
  levelContent: {
    1:  { cohort: 'category_error', subTierIndex: 0.0 },
    2:  {
      cohort: 'category_error',
      cohortMix: [
        { cohort: 'category_error', weight: 0.8 },
        { cohort: 'semantic_swap', weight: 0.2 },
      ],
      subTierIndex: 0.5,
    },
    3:  { cohort: 'semantic_swap', subTierIndex: 0.3 },
    4:  {
      cohort: 'semantic_swap',
      cohortMix: [
        { cohort: 'semantic_swap', weight: 0.7 },
        { cohort: 'function_error', weight: 0.3 },
      ],
      subTierIndex: 0.6,
    },
    5:  { cohort: 'function_error', subTierIndex: 0.3 },
    6:  { cohort: 'function_error', subTierIndex: 0.6 },
    7:  {
      cohort: 'function_error',
      cohortMix: [
        { cohort: 'function_error', weight: 0.75 },
        { cohort: 'multiple_valid_repairs', weight: 0.25 },
      ],
      subTierIndex: 0.9,
    },
    8:  { cohort: 'multiple_valid_repairs', subTierIndex: 0.5 },
    9:  { cohort: 'multiple_valid_repairs', subTierIndex: 0.9 },
    10: { cohort: 'multiple_valid_repairs', subTierIndex: 1.0 },
  },
  levelModifiers: {
    1:  { maxCueLevel: 3, cueAutoOfferAfterMs: 0,    label: 'Category errors · "Show me" visible' },
    2:  { maxCueLevel: 3, cueAutoOfferAfterMs: 0,    label: 'Category + light semantic · "Show me" visible' },
    3:  { maxCueLevel: 2, cueAutoOfferAfterMs: 0,    label: 'Semantic swaps · "Show me" costs a hint' },
    4:  { maxCueLevel: 2, cueAutoOfferAfterMs: 10000, label: 'Semantic + function preview · cue after 10s' },
    5:  { maxCueLevel: 1, cueAutoOfferAfterMs: 0,    label: 'Function errors · no "Show me"' },
    6:  { maxCueLevel: 1, cueAutoOfferAfterMs: 0,    label: 'Function errors (T3) · no hints' },
    7:  { maxCueLevel: 0, cueAutoOfferAfterMs: 0,    label: 'Function + ambiguous · no hints' },
    8:  { maxCueLevel: 0, cueAutoOfferAfterMs: 0,    label: 'Multi-valid repair · no hints' },
    9:  { maxCueLevel: 0, cueAutoOfferAfterMs: 0,    multiTarget: true,  label: 'Multi-valid + 2-error stretch' },
    10: { maxCueLevel: 0, cueAutoOfferAfterMs: 0,    multiTarget: true,  label: '2-error + paragraph context' },
  },
};

registerGameIntensity(config);
