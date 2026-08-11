/**
 * Fix Sentence — choice-tile builder for the L1/L2 scaffolded response
 * modes (ladder targetSupport `highlight_plus_choice` / `choice_based`).
 *
 * Pure + deterministic per trial id so a retry shows the same tiles
 * (shuffling between attempts of the same trial would punish memory,
 * not language).
 */
import type { FixSentenceTrial } from '@/data/fixSentenceBank';
import { FIX_SENTENCE_BANK } from '@/data/fixSentenceBank';

export const CHOICE_TILE_COUNT = 4;

/** Small deterministic PRNG seeded from a string. */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

function normalize(word: string): string {
  return word.toLowerCase().trim();
}

/**
 * Everything that would be a VALID answer for this trial — the correct
 * fixes, their aliases, and the wrong word itself (it's on screen).
 * Distractors must never collide with any of these.
 */
function validAnswerSet(trial: FixSentenceTrial): Set<string> {
  const s = new Set<string>();
  s.add(normalize(trial.wrongWord));
  for (const fix of trial.acceptedFixes) s.add(normalize(fix));
  for (const aliases of Object.values(trial.fixAliases)) {
    for (const a of aliases) s.add(normalize(a));
  }
  return s;
}

/**
 * Build the tile set: the primary accepted fix + distractors drawn from
 * the single-error bank's answer vocabulary (single words only — tiles
 * must be tappable at a glance), deterministically shuffled.
 */
export function buildFixSentenceChoices(
  trial: FixSentenceTrial,
  opts: { count?: number; bank?: FixSentenceTrial[] } = {},
): string[] {
  const count = opts.count ?? CHOICE_TILE_COUNT;
  const bank = opts.bank ?? FIX_SENTENCE_BANK;
  const rand = seededRandom(trial.id);
  const exclude = validAnswerSet(trial);

  const pool: string[] = [];
  const seen = new Set<string>();
  for (const t of bank) {
    for (const candidate of [t.acceptedFixes[0], t.wrongWord]) {
      const n = normalize(candidate);
      if (!n || n.includes(' ') || exclude.has(n) || seen.has(n)) continue;
      seen.add(n);
      pool.push(candidate);
    }
  }

  // Deterministic shuffle of the pool, take distractors.
  const shuffledPool = [...pool].sort(() => rand() - 0.5);
  const distractors = shuffledPool.slice(0, Math.max(0, count - 1));

  const tiles = [trial.acceptedFixes[0], ...distractors];
  return tiles.sort(() => rand() - 0.5);
}
