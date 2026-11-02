/**
 * Eight distinct, non-clinical visual-memory practice formats.
 *
 * These levels change the actual stimulus and/or response rule. They do not
 * update the longitudinal clinical_progression_state. This game is not an
 * aphasia mastery probe and cannot measure visual neglect recovery.
 */
import {
  buildPatternChoices, PATTERN_COLORS, PATTERN_SHAPES,
  type PatternItem,
} from './buildPatternChoices';

export type PatternPracticeLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type PatternMatchRule = 'exact' | 'shape' | 'color';
export interface PatternPracticeSpec {
  level: PatternPracticeLevel;
  label: string;
  instruction: string;
  patternSize: number;
  optionCount: number;
  previewMs: number;
  visibleAtAnswer: boolean;
  /** Alternates which visual feature must be remembered. */
  rule: 'exact' | 'alternate';
}
const ALL_STAGES: readonly PatternPracticeSpec[] = [
  { level: 1, label: 'See and match', instruction: 'Find the same shape. You can see the example.', patternSize: 1, optionCount: 2, previewMs: 0, visibleAtAnswer: true, rule: 'exact' },
  { level: 2, label: 'Match a short pair', instruction: 'Find the two shapes in the same order. The example stays visible.', patternSize: 2, optionCount: 2, previewMs: 0, visibleAtAnswer: true, rule: 'exact' },
  { level: 3, label: 'Remember two', instruction: 'Remember two shapes, then find the same order.', patternSize: 2, optionCount: 2, previewMs: 7000, visibleAtAnswer: false, rule: 'exact' },
  { level: 4, label: 'Remember three', instruction: 'Look carefully at the three shapes and their colors.', patternSize: 3, optionCount: 3, previewMs: 6500, visibleAtAnswer: false, rule: 'exact' },
  { level: 5, label: 'Find among choices', instruction: 'Remember three shapes and choose among four patterns.', patternSize: 3, optionCount: 4, previewMs: 6000, visibleAtAnswer: false, rule: 'exact' },
  { level: 6, label: 'Longer sequence', instruction: 'Remember the order of four colored shapes.', patternSize: 4, optionCount: 4, previewMs: 6000, visibleAtAnswer: false, rule: 'exact' },
  { level: 7, label: 'Switch the rule', instruction: 'Look for SHAPE order on one turn and COLOR order on the next.', patternSize: 4, optionCount: 4, previewMs: 6500, visibleAtAnswer: false, rule: 'alternate' },
  { level: 8, label: 'New long patterns', instruction: 'Remember five colored shapes in order, without the example.', patternSize: 5, optionCount: 4, previewMs: 5500, visibleAtAnswer: false, rule: 'exact' },
];

export function getPatternPracticeStage(value: unknown): PatternPracticeSpec | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 8) return null;
  return ALL_STAGES[value - 1];
}
export const PATTERN_PRACTICE_STAGES = ALL_STAGES;

export function patternRuleForTrial(stage: PatternPracticeSpec, trialNumber: number): PatternMatchRule {
  return stage.rule === 'exact' ? 'exact' : trialNumber % 2 === 1 ? 'shape' : 'color';
}

/**
 * Exactly one choice matches the dimension specified by the prompt.
 * Unlike the generic exact-match generator, distractors for a shape-only
 * rule change *only shape*, so color cannot accidentally become the key.
 */
export function buildPatternPracticeChoices(
  correct: readonly PatternItem[],
  optionCount: number,
  rule: PatternMatchRule,
  random: () => number = Math.random,
): { options: PatternItem[][]; correctIndex: number } {
  if (!correct.length) return { options: [], correctIndex: -1 };
  if (rule === 'exact') return buildPatternChoices(correct, optionCount, random);
  const options: PatternItem[][] = [correct.map(item => ({ ...item }))];
  const keyFor = (items: readonly PatternItem[]) =>
    items.map(item => item[rule]).join('|');
  const seen = new Set([keyFor(options[0])]);
  const values: readonly string[] = rule === 'shape' ? PATTERN_SHAPES : PATTERN_COLORS;

  for (let pos = 0; pos < correct.length && options.length < optionCount; pos++) {
    for (const value of values) {
      if (options.length >= optionCount) break;
      if (value === correct[pos][rule]) continue;
      const next = correct.map(item => ({ ...item }));
      if (rule === 'shape') next[pos].shape = value as PatternItem['shape'];
      else next[pos].color = value as PatternItem['color'];
      const key = keyFor(next);
      if (!seen.has(key)) {
        seen.add(key);
        options.push(next);
      }
    }
  }
  // Rotate correct answer position, not always the first tile.
  const n = Math.floor(Math.max(0, Math.min(0.999999, random())) * options.length);
  return {
    options: [...options.slice(n), ...options.slice(0, n)],
    correctIndex: (options.length - n) % options.length,
  };
}
