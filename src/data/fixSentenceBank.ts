/**
 * Fix the Sentence Bank
 * 
 * Sentences with one wrong word that the user must detect and replace.
 * Trains self-monitoring and error repair — critical for conversation recovery.
 * 
 * Error types:
 * - semantic_swap: same-category word (spoon → knife)
 * - category_error: wrong category entirely (pillow → soap)
 * - function_error: subtle function mismatch (coin → key)
 * - multiple_valid_repairs: multiple "best" answers exist
 */

export interface FixSentenceTrial {
  id: string;
  sentence: string;
  wrongWord: string;
  wrongWordIndex: number;
  acceptedFixes: string[];
  fixAliases: Record<string, string[]>;
  category: string;
  difficulty: 1 | 2 | 3;
  errorType: 'semantic_swap' | 'category_error' | 'function_error' | 'multiple_valid_repairs';
  /** Phoneme targets for adaptive phoneme-aware selection */
  phonemeTargets: string[];
}

export const FIX_SENTENCE_BANK: FixSentenceTrial[] = [
  // ══════════════ DIFFICULTY 1: Obvious category violations ══════════════
  {
    id: 'fs_1', sentence: 'I washed my hands with a pillow.', wrongWord: 'pillow', wrongWordIndex: 7,
    acceptedFixes: ['soap', 'towel'], fixAliases: { soap: ['so', 'soaps'], towel: ['towels', 'tal'] },
    category: 'bathroom', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/s/', '/p/', '/t/'],
  },
  {
    id: 'fs_2', sentence: 'I brushed my teeth with a hammer.', wrongWord: 'hammer', wrongWordIndex: 7,
    acceptedFixes: ['toothbrush', 'brush'], fixAliases: { toothbrush: ['tooth brush', 'toothbrushes'], brush: ['brushes'] },
    category: 'bathroom', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/b/', '/r/', '/ʃ/'],
  },
  {
    id: 'fs_3', sentence: 'I put on my shoes and tied the flowers.', wrongWord: 'flowers', wrongWordIndex: 9,
    acceptedFixes: ['laces', 'shoelaces'], fixAliases: { laces: ['lace', 'lays'], shoelaces: ['shoe laces'] },
    category: 'clothing', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/l/', '/s/', '/ʃ/'],
  },
  {
    id: 'fs_4', sentence: 'The dog wagged its book.', wrongWord: 'book', wrongWordIndex: 5,
    acceptedFixes: ['tail'], fixAliases: { tail: ['tale', 'tails'] },
    category: 'animals', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/t/', '/eɪ/', '/l/'],
  },
  {
    id: 'fs_5', sentence: 'I drove the car and turned the blanket.', wrongWord: 'blanket', wrongWordIndex: 9,
    acceptedFixes: ['wheel', 'steering wheel'], fixAliases: { wheel: ['wheels', 'weel'], 'steering wheel': ['steering'] },
    category: 'driving', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/w/', '/iː/', '/l/'],
  },
  {
    id: 'fs_6', sentence: 'The bird sang a beautiful lamp.', wrongWord: 'lamp', wrongWordIndex: 6,
    acceptedFixes: ['song', 'tune', 'melody'], fixAliases: { song: ['songs'], tune: ['tunes'] },
    category: 'nature', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/s/', '/ŋ/', '/t/'],
  },
  {
    id: 'fs_7', sentence: 'I turned off the chair before bed.', wrongWord: 'chair', wrongWordIndex: 5,
    acceptedFixes: ['light', 'lamp', 'tv', 'television'], fixAliases: { light: ['lights', 'lite'], lamp: ['lamps'], tv: ['t.v.', 'tee vee'] },
    category: 'home', difficulty: 1, errorType: 'multiple_valid_repairs',
    phonemeTargets: ['/l/', '/aɪ/', '/t/'],
  },
  {
    id: 'fs_8', sentence: 'She poured coffee into a shoe.', wrongWord: 'shoe', wrongWordIndex: 6,
    acceptedFixes: ['cup', 'mug', 'glass'], fixAliases: { cup: ['cups'], mug: ['mugs'], glass: ['glasses'] },
    category: 'kitchen', difficulty: 1, errorType: 'multiple_valid_repairs',
    phonemeTargets: ['/k/', '/ʌ/', '/p/', '/g/'],
  },
  {
    id: 'fs_9', sentence: 'I read a chair before sleeping.', wrongWord: 'chair', wrongWordIndex: 3,
    acceptedFixes: ['book', 'story', 'magazine'], fixAliases: { book: ['books'], story: ['stories'] },
    category: 'home', difficulty: 1, errorType: 'multiple_valid_repairs',
    phonemeTargets: ['/b/', '/ʊ/', '/k/'],
  },
  {
    id: 'fs_10', sentence: 'The baby was crying in the tree.', wrongWord: 'tree', wrongWordIndex: 7,
    acceptedFixes: ['crib', 'bed', 'stroller', 'room'], fixAliases: { crib: ['cribs', 'cred'], bed: ['beds'] },
    category: 'home', difficulty: 1, errorType: 'category_error',
    phonemeTargets: ['/k/', '/r/', '/b/'],
  },

  // ══════════════ DIFFICULTY 2: Same-category swaps ══════════════
  {
    id: 'fs_11', sentence: 'I cut my steak with a spoon.', wrongWord: 'spoon', wrongWordIndex: 7,
    acceptedFixes: ['knife', 'fork'], fixAliases: { knife: ['knives', 'nife'], fork: ['forks'] },
    category: 'kitchen', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/n/', '/aɪ/', '/f/', '/k/'],
  },
  {
    id: 'fs_12', sentence: 'I drank my water from a plate.', wrongWord: 'plate', wrongWordIndex: 7,
    acceptedFixes: ['glass', 'cup', 'bottle'], fixAliases: { glass: ['glasses'], cup: ['cups'], bottle: ['bottles'] },
    category: 'kitchen', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/g/', '/l/', '/k/', '/b/'],
  },
  {
    id: 'fs_13', sentence: 'She put on her gloves and scarf and boots.', wrongWord: 'boots', wrongWordIndex: 9,
    acceptedFixes: ['hat', 'coat', 'jacket'], fixAliases: { hat: ['hats'], coat: ['coats'], jacket: ['jackets'] },
    category: 'clothing', difficulty: 2, errorType: 'multiple_valid_repairs',
    phonemeTargets: ['/h/', '/æ/', '/t/', '/k/'],
  },
  {
    id: 'fs_14', sentence: 'The cat chased the bird across the ceiling.', wrongWord: 'ceiling', wrongWordIndex: 8,
    acceptedFixes: ['yard', 'garden', 'lawn', 'floor', 'room'], fixAliases: { yard: ['yards'], garden: ['gardens'] },
    category: 'home', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/j/', '/ɑː/', '/d/', '/g/'],
  },
  {
    id: 'fs_15', sentence: 'I stirred the soup with a fork.', wrongWord: 'fork', wrongWordIndex: 7,
    acceptedFixes: ['spoon', 'ladle'], fixAliases: { spoon: ['spoons'], ladle: ['ladles', 'ladel'] },
    category: 'kitchen', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/s/', '/p/', '/uː/', '/n/'],
  },
  {
    id: 'fs_16', sentence: 'He sat on the table and watched TV.', wrongWord: 'table', wrongWordIndex: 4,
    acceptedFixes: ['couch', 'sofa', 'chair'], fixAliases: { couch: ['couches'], sofa: ['sofas'], chair: ['chairs'] },
    category: 'furniture', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/k/', '/aʊ/', '/tʃ/', '/s/'],
  },
  {
    id: 'fs_17', sentence: 'I wrote a letter with a pencil and envelope.', wrongWord: 'pencil', wrongWordIndex: 7,
    acceptedFixes: ['pen'], fixAliases: { pen: ['pens', 'pin'] },
    category: 'office', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/p/', '/ɛ/', '/n/'],
  },
  {
    id: 'fs_18', sentence: 'She hung the painting on the floor.', wrongWord: 'floor', wrongWordIndex: 7,
    acceptedFixes: ['wall'], fixAliases: { wall: ['walls', 'walled'] },
    category: 'home', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/w/', '/ɔː/', '/l/'],
  },
  {
    id: 'fs_19', sentence: 'The children played in the kitchen at recess.', wrongWord: 'kitchen', wrongWordIndex: 5,
    acceptedFixes: ['playground', 'yard', 'park', 'field'], fixAliases: { playground: ['play ground'], yard: ['yards'] },
    category: 'school', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/p/', '/l/', '/j/', '/ɑː/'],
  },
  {
    id: 'fs_20', sentence: 'I peeled the banana and threw away the seeds.', wrongWord: 'seeds', wrongWordIndex: 10,
    acceptedFixes: ['peel', 'skin'], fixAliases: { peel: ['peels', 'peal'], skin: ['skins'] },
    category: 'food', difficulty: 2, errorType: 'semantic_swap',
    phonemeTargets: ['/p/', '/iː/', '/l/', '/s/'],
  },

  // ══════════════ DIFFICULTY 3: Subtle function errors ══════════════
  {
    id: 'fs_21', sentence: 'I locked the door with a coin.', wrongWord: 'coin', wrongWordIndex: 7,
    acceptedFixes: ['key'], fixAliases: { key: ['keys', 'keep'] },
    category: 'home', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/k/', '/iː/'],
  },
  {
    id: 'fs_22', sentence: 'She dried her hair with a towel and a comb.', wrongWord: 'comb', wrongWordIndex: 10,
    acceptedFixes: ['dryer', 'hair dryer', 'blow dryer'], fixAliases: { dryer: ['drier', 'dryers'], 'hair dryer': ['hairdryer'], 'blow dryer': ['blow drier'] },
    category: 'bathroom', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/d/', '/r/', '/aɪ/'],
  },
  {
    id: 'fs_23', sentence: 'He hammered the nail with a screwdriver.', wrongWord: 'screwdriver', wrongWordIndex: 7,
    acceptedFixes: ['hammer'], fixAliases: { hammer: ['hammers'] },
    category: 'tools', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/h/', '/æ/', '/m/'],
  },
  {
    id: 'fs_24', sentence: 'I checked the temperature with a clock.', wrongWord: 'clock', wrongWordIndex: 7,
    acceptedFixes: ['thermometer'], fixAliases: { thermometer: ['thermometers', 'thermometre', 'the mom it er'] },
    category: 'health', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/θ/', '/ɜː/', '/m/'],
  },
  {
    id: 'fs_25', sentence: 'She measured the fabric with a pen.', wrongWord: 'pen', wrongWordIndex: 7,
    acceptedFixes: ['ruler', 'tape measure', 'measuring tape'], fixAliases: { ruler: ['rulers', 'rule her'], 'tape measure': ['tape'], 'measuring tape': ['measure'] },
    category: 'craft', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/r/', '/uː/', '/l/'],
  },
  {
    id: 'fs_26', sentence: 'The firefighter put out the fire with a blanket.', wrongWord: 'blanket', wrongWordIndex: 10,
    acceptedFixes: ['hose', 'water', 'extinguisher'], fixAliases: { hose: ['hoses', 'hoes'], water: ['waters'], extinguisher: ['fire extinguisher'] },
    category: 'emergency', difficulty: 3, errorType: 'multiple_valid_repairs',
    phonemeTargets: ['/h/', '/oʊ/', '/z/', '/w/'],
  },
  {
    id: 'fs_27', sentence: 'I mailed the letter without a stamp on the box.', wrongWord: 'box', wrongWordIndex: 11,
    acceptedFixes: ['envelope'], fixAliases: { envelope: ['envelopes', 'envelop'] },
    category: 'office', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/ɛ/', '/n/', '/v/'],
  },
  {
    id: 'fs_28', sentence: 'She watered the plants with a bucket instead of a cup.', wrongWord: 'cup', wrongWordIndex: 11,
    acceptedFixes: ['watering can', 'hose', 'sprinkler'], fixAliases: { 'watering can': ['watering'], hose: ['hoses'] },
    category: 'garden', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/w/', '/ɔː/', '/h/'],
  },
  {
    id: 'fs_29', sentence: 'He tightened the bolt with a knife.', wrongWord: 'knife', wrongWordIndex: 7,
    acceptedFixes: ['wrench', 'spanner', 'pliers'], fixAliases: { wrench: ['wrenches', 'ranch'], spanner: ['spanners'] },
    category: 'tools', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/r/', '/ɛ/', '/n/', '/tʃ/'],
  },
  {
    id: 'fs_30', sentence: 'I sewed the button with a pencil.', wrongWord: 'pencil', wrongWordIndex: 7,
    acceptedFixes: ['needle', 'needle and thread'], fixAliases: { needle: ['needles', 'noodle'], 'needle and thread': ['thread'] },
    category: 'craft', difficulty: 3, errorType: 'function_error',
    phonemeTargets: ['/n/', '/iː/', '/d/', '/l/'],
  },
];

/**
 * Get trials filtered by difficulty and optionally by phoneme targets
 */
/**
 * Map an engine difficulty (1..10) to the FixSentence content tier (1..3).
 * Until L4-L10 content lands, the bank only has 3 tiers; this collapse is
 * explicit and centralized so callers can pass either a tier or an engine level.
 */
function toFixSentenceTier(d: number): 1 | 2 | 3 {
  if (!Number.isFinite(d)) return 2;
  if (d <= 3) return 1;
  if (d <= 7) return 2;
  return 3;
}

export function getFixSentenceTrials(options?: {
  /** Tier 1..3 OR engine level 1..10. Both are accepted; engine levels collapse to a tier. */
  difficulty?: number;
  count?: number;
  focusPhonemes?: string[];
}): FixSentenceTrial[] {
  // ── BAND-ISOLATED selection (no more cumulative `<=` filter) ──
  // Pick the exact target tier. If the resulting pool is too small for the
  // requested count, fall back to the immediately adjacent tier (±1) — never
  // the full bank. This guarantees L1 vs L2 vs L3 produce visibly different
  // content while still preventing empty pools.
  let pool: FixSentenceTrial[];

  if (options?.difficulty != null) {
    const targetTier = toFixSentenceTier(options.difficulty);
    const exact = FIX_SENTENCE_BANK.filter(t => t.difficulty === targetTier);
    const requested = options.count ?? exact.length;

    if (exact.length >= requested) {
      pool = exact;
    } else {
      // Padding policy: prefer the HARDER neighbor first to preserve the
      // engine's challenge direction. (Easier-first padding silently drops
      // perceived difficulty — the exact bug we just removed.)
      const neighbors: number[] =
        targetTier === 1 ? [2, 3] :
        targetTier === 3 ? [2, 1] :
        [3, 1]; // tier 2: prefer tier 3 over tier 1
      const padded = [...exact];
      for (const n of neighbors) {
        if (padded.length >= requested) break;
        padded.push(...FIX_SENTENCE_BANK.filter(t => t.difficulty === n));
      }
      pool = padded;
    }
  } else {
    pool = [...FIX_SENTENCE_BANK];
  }

  let trials = [...pool];

  // Phoneme-aware prioritization: sort phoneme-matching trials first
  if (options?.focusPhonemes && options.focusPhonemes.length > 0) {
    const focus = new Set(options.focusPhonemes);
    const matched = trials.filter(t => t.phonemeTargets.some(p => focus.has(p)));
    const unmatched = trials.filter(t => !t.phonemeTargets.some(p => focus.has(p)));
    for (const arr of [matched, unmatched]) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    trials = [...matched, ...unmatched];
  } else {
    for (let i = trials.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [trials[i], trials[j]] = [trials[j], trials[i]];
    }
  }

  if (options?.count) {
    trials = trials.slice(0, options.count);
  }

  return trials;
}
