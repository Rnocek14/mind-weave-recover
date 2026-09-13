/**
 * Stamped onto every user_skill_mastery and skill_mastery_history row so a
 * stored score can be attributed to the maths that produced it.
 *
 * v0.2 — confidence counts distinct sessions and day span across a 90-day
 * retention window instead of the 14-day recency window. Scores, accuracy and
 * cue independence are unchanged; rows written before the split can carry a
 * lower confidence for the same practice history, so the two are not
 * comparable and must not be trended across the boundary without this tag.
 */
export const MASTERY_MODEL_VERSION = 'mastery-v0.2-shadow';
