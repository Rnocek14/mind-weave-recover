/**
 * Content Coverage Checks (Per-Game Leveling Contract)
 *
 * Validates that the actual content banks support the level ranges promised by
 * `PER_GAME_CONTRACTS`. Goals:
 *   1. Surface tiers that are below the safety FLOOR (15 items) — these are
 *      the "fake progression" risk.
 *   2. Warn on tiers that are below the comfort TARGET (20 items).
 *   3. Hard-fail when a contract is marked `contentReadiness: 'ready'` but a
 *      tier is below the FLOOR — readiness must match reality.
 *
 * Non-goals:
 *   - Does NOT compute mastery, change adaptation, or affect runtime.
 *   - Does NOT enforce L4–L10 buckets yet for games whose internal scale tops
 *     out below 10; those are handled by the contract `internalScale` field
 *     and are surfaced as informational warnings only.
 */
import { describe, it, expect } from 'vitest';
import { PER_GAME_CONTRACTS, PER_GAME_CONTRACTS_VERSION } from '@/lib/leveling/perGameContracts';

import { PHOTO_BANK, computePhotoTier } from '@/data/photoBank';
import { TWO_CLUES_PUZZLES } from '@/data/twoCluesBank';
import { DESCRIBE_GUESS_BANK } from '@/data/describeGuessBank';
import { MEANING_MATCH_ITEMS } from '@/data/meaningMatchItems';
import { MINIMAL_PAIRS, getMinimalPairTrials } from '@/data/minimalPairsBank';
import { PHONO_TRIALS } from '@/data/phonologicalBank';
import { SEMANTIC_TRIALS } from '@/data/semanticFeatureBank';
import { SYNONYM_PROMPTS } from '@/data/synonymBank';
import { FIX_SENTENCE_BANK } from '@/data/fixSentenceBank';
import { SENTENCE_TRIALS, type SentenceTrial } from '@/data/sentenceBank';
import { NARRATIVE_STORIES } from '@/data/narrativeRetellStimuli';
import { PLANNING_ITEMS } from '@/data/multiStepPlanningStimuli';
import { ABSTRACT_COMPARE_ITEMS } from '@/data/abstractCompareStimuli';
import { DUAL_LOAD_SETS } from '@/data/dualLoadNamingStimuli';
import { DETECTIVE_CASES } from '@/data/detectiveMindCases';

const FLOOR = 15;
const TARGET = 20;

type TierCounts = { 1: number; 2: number; 3: number };

const empty = (): TierCounts => ({ 1: 0, 2: 0, 3: 0 });

/** Bucket a 1..N internal scale into our 3-tier reporting model. */
function bucketByScale(value: number, max: number): 1 | 2 | 3 {
  const lvl = Math.max(1, Math.min(max, value));
  const ratio = lvl / max;
  if (ratio <= 0.34) return 1;
  if (ratio <= 0.67) return 2;
  return 3;
}

function countPhotoNaming(): TierCounts {
  const c = empty();
  for (const t of PHOTO_BANK) c[computePhotoTier(t)]++;
  return c;
}
function countByTier<T extends { tier: 1 | 2 | 3 }>(items: T[]): TierCounts {
  const c = empty();
  for (const i of items) c[i.tier]++;
  return c;
}
function countByDifficulty<T extends { difficulty: number }>(items: T[]): TierCounts {
  const c = empty();
  for (const i of items) {
    const d = Math.round(i.difficulty);
    if (d === 1 || d === 2 || d === 3) c[d as 1 | 2 | 3]++;
  }
  return c;
}
function countByScale<T>(items: T[], get: (x: T) => number, max: number): TierCounts {
  const c = empty();
  for (const i of items) c[bucketByScale(get(i), max)]++;
  return c;
}

const COVERAGE: Record<string, () => TierCounts> = {
  photo_naming: countPhotoNaming,
  two_clues: () => countByTier(TWO_CLUES_PUZZLES),
  describe_guess: () => countByDifficulty(DESCRIBE_GUESS_BANK),
  meaning_match: () => countByTier(MEANING_MATCH_ITEMS),
  minimal_pairs: () => {
    // Use the photo-backed playable pool — that's what users actually see.
    const playable = getMinimalPairTrials();
    const c = empty();
    for (const t of playable) {
      const d = t.pair.difficulty;
      if (d === 1 || d === 2 || d === 3) c[d as 1 | 2 | 3]++;
      else if (d >= 4) c[3]++;
    }
    // Surface raw bank too (for L4–L5 awareness) — mirror via console only.
    void MINIMAL_PAIRS;
    return c;
  },
  phonological_awareness: () => countByScale(PHONOLOGICAL_TRIALS, (t) => t.difficulty, 5),
  semantic_features: () => countByScale(SEMANTIC_TRIALS, (t) => t.difficulty, 5),
  synonym_generator: () => countByDifficulty(SYNONYM_PROMPTS),
  fix_sentence: () => countByDifficulty(FIX_SENTENCE_BANK),
  sentence_construction: () => countByScale(SENTENCE_BANK, (t) => t.difficulty, 10),
  narrative_retell: () => countByTier(NARRATIVE_STORIES),
  multi_step_planning: () => countByTier(PLANNING_ITEMS),
  abstract_compare: () => countByTier(ABSTRACT_COMPARE_ITEMS),
  dual_load_naming: () => countByTier(DUAL_LOAD_SETS),
  detective_mind: () => countByTier(DETECTIVE_CASES),
};

interface Row {
  slug: string;
  readiness: string;
  risk: string;
  internalMax: number;
  counts: TierCounts;
  belowFloor: number[];
  belowTarget: number[];
}

function buildRows(): Row[] {
  return Object.values(PER_GAME_CONTRACTS).map((c) => {
    const counts = COVERAGE[c.slug] ? COVERAGE[c.slug]() : empty();
    const tiers: (1 | 2 | 3)[] = [1, 2, 3];
    return {
      slug: c.slug,
      readiness: c.contentReadiness,
      risk: c.wiringRisk,
      internalMax: c.internalScale.max,
      counts,
      belowFloor: tiers.filter((t) => counts[t] < FLOOR),
      belowTarget: tiers.filter((t) => counts[t] >= FLOOR && counts[t] < TARGET),
    };
  });
}

describe('Per-Game Leveling Contract — content coverage', () => {
  const rows = buildRows();

  it('prints a coverage report (informational)', () => {
    /* eslint-disable no-console */
    console.log(
      `\n📚 CONTENT COVERAGE — contracts v${PER_GAME_CONTRACTS_VERSION}  (FLOOR=${FLOOR}, TARGET=${TARGET})\n`
    );
    console.log('game                          scale   T1    T2    T3   readiness               flag');
    console.log('─'.repeat(96));
    for (const r of rows) {
      const cells = [r.counts[1], r.counts[2], r.counts[3]]
        .map((n) => String(n).padStart(4))
        .join('  ');
      const flag =
        r.belowFloor.length > 0
          ? `🔴 below floor T${r.belowFloor.join(',')}`
          : r.belowTarget.length > 0
            ? `⚠️  thin T${r.belowTarget.join(',')}`
            : '✅ healthy';
      console.log(
        `${r.slug.padEnd(28)} 1-${String(r.internalMax).padEnd(2)}  ${cells}   ${r.readiness.padEnd(22)} ${flag}`
      );
    }
    console.log('');
    /* eslint-enable no-console */
  });

  it('every contract has a coverage source defined', () => {
    const missing = Object.keys(PER_GAME_CONTRACTS).filter((slug) => !COVERAGE[slug]);
    expect(missing, `Add a COVERAGE entry for: ${missing.join(', ')}`).toEqual([]);
  });

  it('contracts marked "ready" must have ALL tiers ≥ FLOOR', () => {
    const violations = rows
      .filter((r) => r.readiness === 'ready' && r.belowFloor.length > 0)
      .map((r) => `${r.slug}: T${r.belowFloor.join(',')} below floor (counts=${JSON.stringify(r.counts)})`);
    expect(
      violations,
      `Readiness contract violated — either expand content or downgrade contentReadiness:\n${violations.join('\n')}`
    ).toEqual([]);
  });

  it('contracts marked "ready" must have at least one tier ≥ TARGET', () => {
    const weak = rows
      .filter((r) => r.readiness === 'ready')
      .filter((r) => Math.max(r.counts[1], r.counts[2], r.counts[3]) < TARGET)
      .map((r) => `${r.slug}: max tier count ${Math.max(r.counts[1], r.counts[2], r.counts[3])} < TARGET`);
    expect(weak, `Ready games should have at least one comfortably-sized tier:\n${weak.join('\n')}`).toEqual([]);
  });

  it('non-ready contracts are documented (notes) so wiring does not happen by accident', () => {
    const undocumented = Object.values(PER_GAME_CONTRACTS)
      .filter((c) => c.contentReadiness !== 'ready')
      .filter((c) => !c.notes || c.notes.trim().length < 5)
      .map((c) => c.slug);
    expect(undocumented, `Add a "notes" entry explaining the gap for: ${undocumented.join(', ')}`).toEqual([]);
  });
});
