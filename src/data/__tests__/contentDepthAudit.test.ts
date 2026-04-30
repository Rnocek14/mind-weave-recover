/**
 * Content Depth Audit (test-as-tool, no assertions)
 *
 * One-shot diagnostic: prints per-tier counts for the 4 validated games and
 * highlights tiers below the 15-item floor / 20-item target.
 *
 * Re-run: bunx vitest run src/data/__tests__/contentDepthAudit.test.ts
 */
import { describe, it } from 'vitest';
import { DETECTIVE_CASES } from '@/data/detectiveMindCases';
import { PLANNING_ITEMS } from '@/data/multiStepPlanningStimuli';
import { MINIMAL_PAIRS, getMinimalPairTrials } from '@/data/minimalPairsBank';
import { PHOTO_BANK, computePhotoTier } from '@/data/photoBank';

const FLOOR = 15;
const TARGET = 20;

type Row = { game: string; tier: number; count: number };

describe('Content depth audit — Batch A games', () => {
  it('prints per-tier counts and ranks weakest content areas', () => {
    const rows: Row[] = [];
    const add = (game: string, sizes: Record<number, number>) => {
      for (const t of [1, 2, 3]) rows.push({ game, tier: t, count: sizes[t] ?? 0 });
    };

    // PhotoNaming (locked reference)
    {
      const s: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      for (const t of PHOTO_BANK) s[computePhotoTier(t)]++;
      add('PhotoNaming', s);
    }
    // DetectiveMind
    {
      const s: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      for (const c of DETECTIVE_CASES) s[c.tier]++;
      add('DetectiveMind', s);
    }
    // MultiStepPlanning
    {
      const s: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      for (const i of PLANNING_ITEMS) s[i.tier]++;
      add('MultiStepPlanning', s);
    }
    // MinimalPairs (raw bank)
    {
      const s: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      for (const p of MINIMAL_PAIRS) s[p.difficulty]++;
      add('MinimalPairs (raw)', s);
    }
    // MinimalPairs (photo-backed playable pool)
    {
      const playable = getMinimalPairTrials();
      const s: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
      for (const t of playable) s[t.pair.difficulty]++;
      add('MinimalPairs (playable)', s);
    }

    /* eslint-disable no-console */
    console.log('\n📊 CONTENT DEPTH AUDIT — Floor=15, Target=20\n');
    console.log('Game                          T1     T2     T3   Worst');
    console.log('─'.repeat(64));
    const grouped = new Map<string, Row[]>();
    for (const r of rows) {
      if (!grouped.has(r.game)) grouped.set(r.game, []);
      grouped.get(r.game)!.push(r);
    }
    for (const [game, rs] of grouped) {
      const cells = rs.map(r => String(r.count).padStart(5)).join('  ');
      const worst = rs.reduce((a, b) => (a.count < b.count ? a : b));
      const flag = worst.count < FLOOR ? '🔴 below floor' : worst.count < TARGET ? '⚠️  thin' : '✅ healthy';
      console.log(`${game.padEnd(28)}${cells}   ${flag} (T${worst.tier}=${worst.count})`);
    }

    console.log('\n🔥 GAPS BELOW FLOOR (need expansion to ≥15):');
    const gaps = rows
      .filter(r => r.count < FLOOR)
      // exclude the raw-bank duplicate row when the playable pool exists separately
      .sort((a, b) => a.count - b.count);
    if (gaps.length === 0) console.log('  (none — all tiers ≥ 15)');
    for (const g of gaps) {
      console.log(
        `  ${g.game.padEnd(28)} T${g.tier}=${g.count}  → need +${FLOOR - g.count} (floor) / +${TARGET - g.count} (target)`
      );
    }

    console.log('\n⚠️  THIN TIERS (15–19, below target=20):');
    const thin = rows.filter(r => r.count >= FLOOR && r.count < TARGET);
    if (thin.length === 0) console.log('  (none)');
    for (const t of thin) {
      console.log(`  ${t.game.padEnd(28)} T${t.tier}=${t.count}  → need +${TARGET - t.count}`);
    }

    console.log('\n🏆 RANKED — Top weakest tiers (by gap from floor):');
    const ranked = [...rows]
      .filter(r => r.count < TARGET)
      .sort((a, b) => a.count - b.count)
      .slice(0, 5);
    ranked.forEach((r, i) => {
      const sev = r.count < FLOOR ? '🔴' : '⚠️';
      console.log(`  ${i + 1}. ${sev} ${r.game} T${r.tier}: ${r.count} items`);
    });
    /* eslint-enable no-console */
  });
});
