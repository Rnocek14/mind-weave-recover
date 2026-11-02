/**
 * Pattern Match: generate choice boards with exactly one correct option.
 * Pure and bounded, so unlucky or mocked random values cannot hang the game.
 * These are visual-memory practice choices, not language-recovery scores.
 */
export type PatternShape = 'circle' | 'square' | 'triangle' | 'star';
export type PatternColor = 'red' | 'blue' | 'green' | 'yellow' | 'purple';
export type PatternItem = { shape: PatternShape; color: PatternColor };

export const PATTERN_SHAPES: readonly PatternShape[] = ['circle', 'square', 'triangle', 'star'];
export const PATTERN_COLORS: readonly PatternColor[] = ['red', 'blue', 'green', 'yellow', 'purple'];

const key = (pattern: readonly PatternItem[]) =>
  pattern.map((item) => item.shape + ':' + item.color).join('|');

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const sample = random();
    const j = Math.floor(Math.max(0, Math.min(0.999999999, Number.isFinite(sample) ? sample : 0)) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildPatternChoices(
  correct: readonly PatternItem[],
  requestedCount: number,
  random: () => number = Math.random,
): { options: PatternItem[][]; correctIndex: number } {
  if (correct.length === 0) return { options: [], correctIndex: -1 };
  const count = Math.max(1, Math.min(4, Math.floor(requestedCount) || 1));
  const original = correct.map((item) => ({ ...item }));
  const options: PatternItem[][] = [original];
  const seen = new Set([key(original)]);
  const add = (candidate: PatternItem[]) => {
    const candidateKey = key(candidate);
    if (seen.has(candidateKey)) return;
    seen.add(candidateKey);
    options.push(candidate);
  };

  // Preserve the original style of mixed visual changes, but bound retries.
  for (let attempt = 0; options.length < count && attempt < count * 24; attempt++) {
    const candidate = correct.map((item) => {
      if (random() >= 0.4) return { ...item };
      const shape = random() < 0.5
        ? PATTERN_SHAPES[Math.floor(random() * PATTERN_SHAPES.length) % PATTERN_SHAPES.length] ?? item.shape
        : item.shape;
      const color = random() < 0.5
        ? PATTERN_COLORS[Math.floor(random() * PATTERN_COLORS.length) % PATTERN_COLORS.length] ?? item.color
        : item.color;
      return { shape, color };
    });
    add(candidate);
  }

  // Deterministic fallback: even random() === 0 or 0.5 cannot produce a
  // duplicate board or infinite loop. Only one attribute changes at a time.
  for (let pos = 0; pos < original.length && options.length < count; pos++) {
    for (const shape of PATTERN_SHAPES) {
      if (shape !== original[pos].shape && options.length < count) {
        const candidate = original.map((item) => ({ ...item }));
        candidate[pos].shape = shape;
        add(candidate);
      }
    }
    for (const color of PATTERN_COLORS) {
      if (color !== original[pos].color && options.length < count) {
        const candidate = original.map((item) => ({ ...item }));
        candidate[pos].color = color;
        add(candidate);
      }
    }
  }
  const choices = shuffled(options, random);
  const correctIndex = choices.findIndex((option) => key(option) === key(original));
  return { options: choices, correctIndex };
}
