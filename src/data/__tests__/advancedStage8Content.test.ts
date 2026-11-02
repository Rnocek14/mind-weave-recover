import { describe, expect, it } from 'vitest';
import { MEANING_MATCH_ITEMS } from '@/data/meaningMatchItems';
import { MEANING_MATCH_LEVEL8_ITEMS } from '@/data/meaningMatchLevel8Items';
import { TWO_CLUES_PUZZLES, getPuzzles } from '@/data/twoCluesBank';
import { TWO_CLUES_LEVEL8_PUZZLES } from '@/data/twoCluesLevel8Bank';
import { buildPool } from '@/hooks/useMeaningMatchGame';
import { selectTwoCluesStagePool } from '@/hooks/useTwoCluesGame';
import { mapTwoCluesSupport, getTwoCluesSupportEvidence } from '@/hooks/useTwoCluesProgression';
import { scoreAnswer } from '@/lib/twoCluesScorer';
import { highestImplementedMeaningMatchLevel, getMeaningMatchLevelSpec } from '@/lib/progression/meaningMatchLevels';
import { highestImplementedTwoCluesLevel, getTwoCluesLevelSpec } from '@/lib/progression/twoCluesLevels';

describe('dedicated stage 8 tasks are genuinely selected and scoreable', () => {
  it('isolates advanced Two Clues items until persistent L8 is earned', () => {
    expect(highestImplementedTwoCluesLevel()).toBe(8);
    expect(getTwoCluesLevelSpec(8).contentSelector?.implemented).toBe(true);
    expect(getTwoCluesLevelSpec(8).readiness).toBe('thin');
    expect(TWO_CLUES_LEVEL8_PUZZLES).toHaveLength(16);

    const regular = getPuzzles();
    expect(selectTwoCluesStagePool(regular, 7)).toEqual(regular);
    expect(selectTwoCluesStagePool(regular, 8, true)).toEqual(regular);
    const advanced = selectTwoCluesStagePool(regular, 8);
    expect(advanced).toHaveLength(16);
    expect(advanced.every(p => p.clinicalStage === 8 && p.difficulty === 3)).toBe(true);
    const regularIds = new Set(TWO_CLUES_PUZZLES.map(p => p.id));
    expect(new Set(advanced.map(p => p.id)).size).toBe(advanced.length);
    for (const item of advanced) {
      expect(regularIds.has(item.id), item.id).toBe(false);
      expect(item.clues).toHaveLength(2);
      expect(item.anchors.length).toBeGreaterThan(0);
      expect(item.cluster.length).toBeGreaterThan(0);
      expect(item.anchors.some(answer => item.clues.includes(answer)), item.id).toBe(false);
      expect(item.cluster.some(answer => item.clues.includes(answer)), item.id).toBe(false);
    }
  });

  it('scores a stage 8 canonical phrase without requiring external semantics', async () => {
    const trial = TWO_CLUES_LEVEL8_PUZZLES.find(p => p.id === 'tc-l8-fresh-start')!;
    const score = await scoreAnswer('fresh start', trial);
    expect(score.tier).toBe('strong');
    expect(score.reachedAnchor).toBe(true);
    // reachedAnchor is answer MATCH quality; it does not prove a cue was used.
    expect(mapTwoCluesSupport(false)).toBe('independent');
    expect(mapTwoCluesSupport(true, 'semantic')).toBe('semantic_cue');
    expect(mapTwoCluesSupport(true, 'phonemic')).toBe('phonemic_cue');
    expect(mapTwoCluesSupport(true, 'full_word')).toBe('carrier_or_full_model');
    expect(getTwoCluesSupportEvidence({ ...score, cueLevelUsed: 0, cueTypeUsed: 'none' })).toEqual({
      cueLevel: 0,
      supportUsed: 'independent',
    });
    expect(getTwoCluesSupportEvidence({ ...score, cueLevelUsed: 2, cueTypeUsed: 'phonemic' })).toEqual({
      cueLevel: 2,
      supportUsed: 'phonemic_cue',
    });
  });

  it('separates Meaning Match L8 inference from generic hard tiers', () => {
    expect(highestImplementedMeaningMatchLevel()).toBe(8);
    expect(getMeaningMatchLevelSpec(8).readiness).toBe('thin');
    expect(getMeaningMatchLevelSpec(8).contentSelector?.implemented).toBe(true);
    expect(MEANING_MATCH_LEVEL8_ITEMS).toHaveLength(16);
    const baseIds = new Set(MEANING_MATCH_ITEMS.map(i => i.id));
    const stage8Ids = new Set(MEANING_MATCH_LEVEL8_ITEMS.map(i => i.id));
    expect(stage8Ids.size).toBe(16);
    expect([...stage8Ids].every(id => !baseIds.has(id))).toBe(true);
    const ordinaryPool = buildPool(3, new Set(), 7);
    expect(ordinaryPool.every(i => i.clinicalStage === undefined)).toBe(true);
    const advancedPool = buildPool(1, new Set(), 8);
    expect(advancedPool).toHaveLength(16);
    expect(advancedPool.every(i => i.clinicalStage === 8 && i.type === 'figurative')).toBe(true);
    const seen = new Set(advancedPool.slice(0, 4).map(i => i.id));
    expect(buildPool(3, seen, 8).every(i => !seen.has(i.id))).toBe(true);
    expect(buildPool(3, stage8Ids, 8)).toHaveLength(16); // exhausted-bank replay
    expect(new Set(advancedPool.map(i => i.correctIndex))).toEqual(new Set([0,1,2,3]));
    for (const i of advancedPool) {
      expect(i.options).toHaveLength(4);
      expect(i.options[i.correctIndex]?.length).toBeGreaterThan(10);
      expect(new Set(i.options.map(o => o.toLowerCase())).size, i.id).toBe(4);
    }
  });
});
