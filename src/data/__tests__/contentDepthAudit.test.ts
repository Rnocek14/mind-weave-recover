/**
 * Content Depth Audit — all 14 progression-wired games.
 *
 * Per-tier T1/T2/T3 counts so the engine can be trusted to find a
 * next-tier item when a user's clinical level escalates.
 *
 * Floor=15 (mathematically can level up), Target=20 (recency-exclusion +
 * variety comfortable across a full session).
 *
 * Re-run: bunx vitest run src/data/__tests__/contentDepthAudit.test.ts
 */
import { describe, it } from 'vitest';
import { PHOTO_BANK, computePhotoTier } from '@/data/photoBank';
import { FIX_SENTENCE_BANK } from '@/data/fixSentenceBank';
import { MEANING_MATCH_ITEMS } from '@/data/meaningMatchItems';
import { PHONO_TRIALS } from '@/data/phonologicalBank';
import { SENTENCE_TRIALS } from '@/data/sentenceBank';
import { SEMANTIC_TRIALS } from '@/data/semanticFeatureBank';
import { DUAL_LOAD_SETS } from '@/data/dualLoadNamingStimuli';
import { SYNONYM_PROMPTS } from '@/data/synonymBank';
import { TWO_CLUES_PUZZLES } from '@/data/twoCluesBank';
import { DETECTIVE_CASES } from '@/data/detectiveMindCases';
import { PLANNING_ITEMS } from '@/data/multiStepPlanningStimuli';
import { MINIMAL_PAIRS, getMinimalPairTrials } from '@/data/minimalPairsBank';

const FLOOR = 15;
const TARGET = 20;

type Counts = { 1: number; 2: number; 3: number };
type Row = { game: string; counts: Counts; note?: string };

function tally<T>(items: readonly T[], getTier: (x: T) => number): Counts {
  const s: Counts = { 1: 0, 2: 0, 3: 0 };
  for (const x of items) {
    const t = getTier(x);
    if (t === 1 || t === 2 || t === 3) s[t]++;
  }
  return s;
}
// Bucket engine difficulty 1–5 into T1/T2/T3
const b5 = (d: number) => (d <= 2 ? 1 : d === 3 ? 2 : 3);
// Bucket engine difficulty 1–10 into T1/T2/T3
const b10 = (d: number) => (d <= 3 ? 1 : d <= 7 ? 2 : 3);

describe('Content depth audit — all 14 progression-wired games', () => {
  it('prints per-tier counts and ranks weakest content areas', () => {
    const rows: Row[] = [
      { game: 'photo-naming',
        counts: tally(PHOTO_BANK as any[], (t: any) => computePhotoTier(t)) },
      { game: 'fix-sentence',
        counts: tally(FIX_SENTENCE_BANK, (t) => t.difficulty) },
      { game: 'meaning-match',
        counts: tally(MEANING_MATCH_ITEMS, (t) => t.tier) },
      { game: 'phonological-awareness',
        counts: tally(PHONO_TRIALS, (t) => b5(t.difficulty)),
        note: 'bank diff 1–5 bucketed into T1(1–2)/T2(3)/T3(4–5)' },
      { game: 'sentence-construction',
        counts: tally(SENTENCE_TRIALS as any[], (t: any) => b10(t.difficulty)),
        note: 'bank diff 1–10 bucketed into T1(1–3)/T2(4–7)/T3(8–10)' },
      { game: 'semantic-features',
        counts: tally(SEMANTIC_TRIALS, (t: any) => (t.difficulty <= 1 ? 1 : t.difficulty <= 3 ? 2 : 3)),
        note: 'bank diff 1–5 bucketed into T1(1)/T2(2–3)/T3(4–5), matches semanticFeaturesDifficultyBridge' },
      { game: 'dual-load-naming',
        counts: tally(DUAL_LOAD_SETS, (t) => t.tier) },
      { game: 'synonym-generator',
        counts: tally(SYNONYM_PROMPTS, (t) => t.difficulty) },
      { game: 'two-clues',
        counts: tally(TWO_CLUES_PUZZLES, (t) => t.difficulty) },
      { game: 'detective-mind',
        counts: tally(DETECTIVE_CASES, (t) => t.tier) },
      { game: 'multi-step-plan',
        counts: tally(PLANNING_ITEMS, (t) => t.tier) },
      { game: 'minimal-pairs (raw)',
        counts: tally(MINIMAL_PAIRS, (t) => t.difficulty) },
      { game: 'minimal-pairs (playable)',
        counts: tally(getMinimalPairTrials(), (t: any) => t.pair.difficulty) },
    ];

    /* eslint-disable no-console */
    console.log('\n📊 CONTENT DEPTH AUDIT — Floor=15, Target=20\n');
    console.log('Game                            T1    T2    T3   Status');
    console.log('─'.repeat(72));
    for (const { game, counts } of rows) {
      const cells = [counts[1], counts[2], counts[3]]
        .map((n) => String(n).padStart(4)).join('  ');
      const min = Math.min(counts[1], counts[2], counts[3]);
      const status = min < FLOOR ? '🔴 below floor'
        : min < TARGET ? '⚠️  thin' : '✅ healthy';
      console.log(`${game.padEnd(30)}${cells}   ${status} (min=${min})`);
    }

    const flat = rows.flatMap(({ game, counts }) =>
      [1, 2, 3].map((t) => ({ game, tier: t as 1 | 2 | 3, count: counts[t as 1 | 2 | 3] })));

    console.log('\n🔥 BELOW FLOOR (engine cannot reliably level into this tier):');
    const below = flat.filter((r) => r.count < FLOOR).sort((a, b) => a.count - b.count);
    if (below.length === 0) console.log('  (none)');
    for (const g of below) {
      console.log(`  ${g.game.padEnd(30)} T${g.tier}=${g.count}  → need +${FLOOR - g.count} (floor) / +${TARGET - g.count} (target)`);
    }

    console.log('\n⚠️  THIN (15–19, levels but variety stalls):');
    const thin = flat.filter((r) => r.count >= FLOOR && r.count < TARGET);
    if (thin.length === 0) console.log('  (none)');
    for (const t of thin) {
      console.log(`  ${t.game.padEnd(30)} T${t.tier}=${t.count}  → need +${TARGET - t.count}`);
    }

    console.log('\n🔬 PER-BANK-DIFFICULTY (true engine-relevant counts, floor=15):');
    const perDiff = (label: string, items: readonly any[], get: (x: any) => number, max: number) => {
      const c: Record<number, number> = {};
      for (let i = 1; i <= max; i++) c[i] = 0;
      for (const x of items) { const d = get(x); if (c[d] !== undefined) c[d]++; }
      const cells = Object.entries(c).map(([d, n]) => `d${d}=${String(n).padStart(2)}`).join('  ');
      const min = Math.min(...Object.values(c));
      console.log(`  ${label.padEnd(28)} ${cells}   ${min < FLOOR ? '🔴' : min < TARGET ? '⚠️' : '✅'} min=${min}`);
    };
    perDiff('semantic-features', SEMANTIC_TRIALS, (t) => t.difficulty, 5);
    perDiff('phonological-awareness', PHONO_TRIALS, (t) => t.difficulty, 5);
    perDiff('sentence-construction', SENTENCE_TRIALS as any[], (t: any) => t.difficulty, 10);
    perDiff('minimal-pairs (raw)', MINIMAL_PAIRS, (t) => t.difficulty, 5);

    console.log('\n📝 Notes:');
    for (const r of rows) if (r.note) console.log(`  ${r.game}: ${r.note}`);
    /* eslint-enable no-console */
  });
});
