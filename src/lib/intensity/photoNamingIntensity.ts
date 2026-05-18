/**
 * PhotoNaming intensity ladder.
 *
 * Primary axis: lexical retrieval under fading support.
 *
 * Cohorts:
 *   tier_1  → easy lexicon (high-frequency, monosyllabic, early-acquired)
 *   tier_2  → mid lexicon
 *   tier_3  → hard lexicon (low-frequency, multi-syllable, late-acquired)
 *   stretch → tier_3 items explicitly tagged as atypical / late-acquired
 *
 * Sub-tier index sorts within the cohort by:
 *   frequency_rank → syllable_count → age_of_acquisition
 *
 * Levels 1-3 share tier_1 but slide from easy-end → hard-end of T1.
 * Levels 4-7 share tier_2 but slide across T2 (and L7 nudges towards T3).
 * Levels 8-10 share tier_3 but L9-10 pull from the stretch slice.
 *
 * Pressure modifiers compound the lexical difficulty:
 *   - cueAutoOfferAfterMs:  semantic cue auto-offers later (or not at all)
 *   - responseWindowMs:     soft response window appears from L5 up
 *   - maxCueLevel:          cue ceiling drops as level climbs
 *   - foilChipCount:        recognition fallback chip count climbs at L8+
 *   - preferConfusableFoils: phonological foils at L≥6 (was hardcoded L8)
 */

import { registerGameIntensity, type GameIntensityConfig } from './gameIntensity';

export const PHOTO_NAMING_SLUG = 'photo-naming';

const config: GameIntensityConfig = {
  slug: PHOTO_NAMING_SLUG,
  levelContent: {
    1:  { cohort: 'tier_1', subTierIndex: 0.0 },
    2:  { cohort: 'tier_1', subTierIndex: 0.5 },
    3:  { cohort: 'tier_1', subTierIndex: 1.0 },
    4:  { cohort: 'tier_2', subTierIndex: 0.0 },
    5:  { cohort: 'tier_2', subTierIndex: 0.4 },
    6:  { cohort: 'tier_2', subTierIndex: 0.7 },
    7:  {
      cohort: 'tier_2',
      cohortMix: [
        { cohort: 'tier_2', weight: 0.7 },
        { cohort: 'tier_3', weight: 0.3 },
      ],
      subTierIndex: 1.0,
    },
    8:  { cohort: 'tier_3', subTierIndex: 0.3 },
    9:  {
      cohort: 'stretch',
      cohortMix: [
        { cohort: 'tier_3', weight: 0.4 },
        { cohort: 'stretch', weight: 0.6 },
      ],
      subTierIndex: 0.7,
    },
    10: { cohort: 'stretch', subTierIndex: 1.0 },
  },
  levelModifiers: {
    1:  { maxCueLevel: 3, cueAutoOfferAfterMs: 0,    foilChipCount: 4, label: 'T1 easy · cues on tap' },
    2:  { maxCueLevel: 3, cueAutoOfferAfterMs: 0,    foilChipCount: 4, label: 'T1 mid · cues on tap' },
    3:  { maxCueLevel: 2, cueAutoOfferAfterMs: 0,    foilChipCount: 4, label: 'T1 hard · semantic on tap' },
    4:  { maxCueLevel: 2, cueAutoOfferAfterMs: 0,    foilChipCount: 4, label: 'T2 easy · semantic on tap' },
    5:  { maxCueLevel: 2, cueAutoOfferAfterMs: 8000, responseWindowMs: 20000, foilChipCount: 4, label: 'T2 mid · cue after 8s · 20s window' },
    6:  { maxCueLevel: 1, cueAutoOfferAfterMs: 10000, responseWindowMs: 18000, foilChipCount: 4, preferConfusableFoils: true, label: 'T2 hard · phonemic foils · 18s window' },
    7:  { maxCueLevel: 0, cueAutoOfferAfterMs: 0,    responseWindowMs: 15000, foilChipCount: 4, preferConfusableFoils: true, label: 'T2/T3 blend · no cues · 15s window' },
    8:  { maxCueLevel: 0, cueAutoOfferAfterMs: 0,    responseWindowMs: 12000, foilChipCount: 4, preferConfusableFoils: true, label: 'T3 · no cues · 12s window' },
    9:  { maxCueLevel: 0, cueAutoOfferAfterMs: 0,    responseWindowMs: 10000, foilChipCount: 4, preferConfusableFoils: true, useStretchSlice: true, label: 'T3 stretch · 10s window' },
    10: { maxCueLevel: 0, cueAutoOfferAfterMs: 0,    responseWindowMs: 10000, foilChipCount: 4, preferConfusableFoils: true, useStretchSlice: true, label: 'Stretch only · 10s window' },
  },
};

registerGameIntensity(config);
