export { mapTrialToSkills, isExcludedFromMastery } from './skillMapping';
export type { SkillSlug } from './skillMapping';
export { computeMastery, suggestLevelChange } from './computeMastery';
export type { MasteryRow, MasteryTrial } from './computeMastery';
export { MASTERY_MODEL_VERSION } from './version';
export {
  routeTrialMode,
  isAdoptedForTrialMode,
  filterTrialsForExpressiveMastery,
} from './masterySignalRouting';
export type { TrialModeTag, RouteVerdict } from './masterySignalRouting';
