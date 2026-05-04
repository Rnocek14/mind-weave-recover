/**
 * Category example pools.
 *
 * Used by CategoryFluencyGame to:
 *  - rotate which 3 example words show during a round (instead of the same
 *    fixed 3 every time), and
 *  - generate "Ideas for next time" after the round.
 *
 * Pools are intentionally HIGH-FREQUENCY, EVERYDAY words — not a full
 * vocabulary list. The full validator (see categoryWordLists.ts) still
 * accepts a much larger universe of valid answers.
 *
 * Keep each pool 12–15 words. Order doesn't matter — selection is randomized
 * per round and de-duped against recently shown items in localStorage.
 */

export const CATEGORY_EXAMPLE_POOLS: Record<string, string[]> = {
  animals: [
    'dog', 'cat', 'horse', 'cow', 'pig', 'sheep', 'rabbit', 'mouse',
    'lion', 'tiger', 'bear', 'elephant', 'monkey', 'fish', 'bird',
  ],
  foods: [
    'bread', 'apple', 'rice', 'cheese', 'banana', 'chicken', 'pasta',
    'soup', 'egg', 'potato', 'tomato', 'milk', 'butter', 'pizza', 'salad',
  ],
  colors: [
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
    'brown', 'black', 'white', 'gray', 'gold', 'silver',
  ],
  clothes: [
    'shirt', 'hat', 'shoes', 'pants', 'jacket', 'socks', 'dress',
    'coat', 'sweater', 'belt', 'gloves', 'scarf', 'jeans', 'boots',
  ],
  kitchen: [
    'cup', 'fork', 'pan', 'knife', 'spoon', 'plate', 'bowl', 'pot',
    'kettle', 'oven', 'fridge', 'toaster', 'spatula', 'whisk', 'mug',
  ],
  tools: [
    'hammer', 'saw', 'drill', 'screwdriver', 'wrench', 'pliers',
    'tape measure', 'level', 'nail', 'screw', 'shovel', 'rake',
    'ladder', 'sandpaper',
  ],
  vehicles: [
    'car', 'bus', 'bike', 'truck', 'train', 'plane', 'boat', 'van',
    'motorcycle', 'taxi', 'helicopter', 'tractor', 'subway', 'scooter',
  ],
  professions: [
    'doctor', 'teacher', 'driver', 'nurse', 'chef', 'farmer', 'plumber',
    'electrician', 'lawyer', 'pilot', 'dentist', 'firefighter',
    'mechanic', 'carpenter',
  ],
  emotions: [
    'happy', 'sad', 'angry', 'scared', 'tired', 'excited', 'nervous',
    'calm', 'proud', 'lonely', 'surprised', 'frustrated', 'hopeful',
    'bored',
  ],
  sports: [
    'soccer', 'tennis', 'swimming', 'baseball', 'basketball', 'golf',
    'football', 'hockey', 'running', 'cycling', 'skiing', 'boxing',
    'volleyball', 'yoga',
  ],
};

const RECENT_KEY_PREFIX = 'categoryFluency_recentExamples_';
const RECENT_LIMIT = 8;

function loadRecent(category: string): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY_PREFIX + category);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(category: string, recent: string[]) {
  try {
    localStorage.setItem(
      RECENT_KEY_PREFIX + category,
      JSON.stringify(recent.slice(-RECENT_LIMIT)),
    );
  } catch {
    /* storage full or disabled — non-fatal */
  }
}

/**
 * Pick `count` example words for a category, biased away from words shown
 * recently (tracked in localStorage per category). Falls back to repeats
 * when the pool is exhausted.
 *
 * @param exclude — additional words to exclude from this draw (e.g. words
 *   currently visible, so "Show different examples" actually swaps them).
 */
export function pickExamples(
  category: string,
  count = 3,
  exclude: string[] = [],
): string[] {
  const pool = CATEGORY_EXAMPLE_POOLS[category];
  if (!pool || pool.length === 0) return [];

  const recent = new Set(loadRecent(category).map(w => w.toLowerCase()));
  const excluded = new Set(exclude.map(w => w.toLowerCase()));

  const fresh = pool.filter(
    w => !recent.has(w.toLowerCase()) && !excluded.has(w.toLowerCase()),
  );
  const stale = pool.filter(
    w => recent.has(w.toLowerCase()) && !excluded.has(w.toLowerCase()),
  );

  const shuffled = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const picks = [...shuffled(fresh), ...shuffled(stale)].slice(0, count);

  // Update recent list.
  const newRecent = [...loadRecent(category), ...picks];
  saveRecent(category, newRecent);

  return picks;
}

/**
 * Build the post-round "Ideas for next time" list — words from the example
 * pool that the user did NOT name. Capped to `count` (default 6).
 *
 * Matching is loose: lowercased substring overlap with a word the user
 * already produced suppresses the suggestion (so "doggy" → "dog" suggestion
 * is hidden).
 */
export function pickIdeasForNextTime(
  category: string,
  saidWords: string[],
  count = 6,
): string[] {
  const pool = CATEGORY_EXAMPLE_POOLS[category] ?? [];
  if (pool.length === 0) return [];

  const said = saidWords.map(w => w.toLowerCase().trim());
  const wasSaid = (poolWord: string) => {
    const pw = poolWord.toLowerCase();
    return said.some(s => s === pw || s.includes(pw) || pw.includes(s));
  };

  const remaining = pool.filter(w => !wasSaid(w));

  // Shuffle for variety across sessions.
  const a = [...remaining];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, count);
}
