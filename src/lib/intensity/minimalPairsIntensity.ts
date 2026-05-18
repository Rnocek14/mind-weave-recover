/**
 * MinimalPairs intensity ladder.
 *
 * Primary axis: acoustic resolution + speed.
 *
 * The real scaffold here is *replay budget*, not hints. Replays are how the
 * patient compensates for not catching a contrast on first listen. As level
 * climbs, replay budget shrinks and contrast distance narrows.
 *
 * Cohorts map to MinimalPair.category (categorical contrast type):
 *   stop_fricative        — biggest acoustic distance (cat/hat)
 *   fricative_affricate   — single-feature, moderate distance (ship/chip)
 *   voicing               — voicing-only contrast (fan/van)
 *   placement / other     — fall back to broader "all_tier_2_single_feature"
 *
 * Sub-tier index sorts within the cohort by:
 *   contrastPosition (initial < medial < final — final position is hardest)
 *   then alphabetic (stable secondary).
 *
 * Modifiers:
 *   replayBudget:      hard ceiling on audio replays per trial
 *   responseWindowMs:  soft timer kicks in at L4+
 *   foilChipCount:     stays at 2 for the binary photo choice; triads at L8+
 *   preferConfusableFoils: triads = within-pair confusable groups
 */

import { registerGameIntensity, type GameIntensityConfig } from './gameIntensity';

export const MINIMAL_PAIRS_SLUG = 'minimal-pairs';

const config: GameIntensityConfig = {
  slug: MINIMAL_PAIRS_SLUG,
  levelContent: {
    1:  { cohort: 'tier_1', subTierIndex: 0.0 },
    2:  { cohort: 'tier_1', subTierIndex: 0.7 },
    3:  { cohort: 'tier_1', subTierIndex: 1.0 },
    4:  { cohort: 'tier_2', subTierIndex: 0.2 },
    5:  { cohort: 'tier_2', subTierIndex: 0.5 },
    6:  { cohort: 'tier_2', subTierIndex: 0.8 },
    7:  { cohort: 'tier_2', subTierIndex: 1.0 },
    8:  { cohort: 'tier_3', subTierIndex: 0.4 },
    9:  { cohort: 'tier_3', subTierIndex: 0.8 },
    10: { cohort: 'tier_3', subTierIndex: 1.0 },
  },
  levelModifiers: {
    1:  { replayBudget: -1, foilChipCount: 2, label: 'Distinct contrasts · unlimited replays' },
    2:  { replayBudget: 3,  foilChipCount: 2, label: 'Distinct contrasts · 3 replays' },
    3:  { replayBudget: 2,  foilChipCount: 2, label: 'Distinct contrasts · 2 replays' },
    4:  { replayBudget: 2,  responseWindowMs: 12000, foilChipCount: 2, label: 'Single-feature · 2 replays · 12s' },
    5:  { replayBudget: 2,  responseWindowMs: 10000, foilChipCount: 2, label: 'Single-feature broadened · 10s' },
    6:  { replayBudget: 1,  responseWindowMs: 10000, foilChipCount: 2, preferConfusableFoils: true, label: 'Single-feature medial · 1 replay' },
    7:  { replayBudget: 1,  responseWindowMs: 8000,  foilChipCount: 2, preferConfusableFoils: true, label: 'Single-feature final · 1 replay · 8s' },
    8:  { replayBudget: 1,  responseWindowMs: 8000,  foilChipCount: 3, preferConfusableFoils: true, useStretchSlice: true, label: 'Confusable triads · 1 replay' },
    9:  { replayBudget: 0,  responseWindowMs: 8000,  foilChipCount: 3, preferConfusableFoils: true, useStretchSlice: true, label: 'Triads · no replay' },
    10: { replayBudget: 0,  responseWindowMs: 8000,  foilChipCount: 3, preferConfusableFoils: true, useStretchSlice: true, multiTarget: true, label: 'Triads + dual-load' },
  },
};

registerGameIntensity(config);
