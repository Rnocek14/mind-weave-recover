import { describe, it, expect } from 'vitest';
import { buildFixSentenceChoices, CHOICE_TILE_COUNT } from '@/lib/fixSentenceChoices';
import {
  FIX_SENTENCE_BANK,
  FIX_SENTENCE_MORPHOLOGY_BANK,
  FIX_SENTENCE_TWO_ERROR_BANK,
} from '@/data/fixSentenceBank';
import { matchSpokenFix } from '@/hooks/useFixSentenceGame';

describe('buildFixSentenceChoices (L1/L2 scaffold tiles)', () => {
  it('every trial gets a full tile set containing exactly one valid answer', () => {
    for (const trial of FIX_SENTENCE_BANK) {
      const tiles = buildFixSentenceChoices(trial);
      expect(tiles.length, trial.id).toBe(CHOICE_TILE_COUNT);
      expect(new Set(tiles.map((t) => t.toLowerCase())).size, trial.id).toBe(tiles.length);

      const valid = new Set([
        ...trial.acceptedFixes.map((f) => f.toLowerCase()),
        ...Object.values(trial.fixAliases).flat().map((a) => a.toLowerCase()),
      ]);
      const validTiles = tiles.filter((t) => valid.has(t.toLowerCase()));
      expect(validTiles.length, `${trial.id}: tiles=${tiles.join(',')}`).toBe(1);
      // The one valid tile is the primary accepted fix.
      expect(validTiles[0].toLowerCase(), trial.id).toBe(trial.acceptedFixes[0].toLowerCase());
      // The on-screen wrong word is never offered back as a tile.
      expect(tiles.map((t) => t.toLowerCase()), trial.id).not.toContain(trial.wrongWord.toLowerCase());
    }
  });


  /**
   * The check above asks whether a tile is *in the accepted-fix list*. That is
   * not the question the patient's tap is answered by: `scoreChoice` grades
   * through `matchSpokenFix`, which also honours ±s plural tolerance and a
   * leading article. A distractor could therefore be absent from every list and
   * still be marked correct — "crayon" against the fix "crayons" was exactly
   * that, on a Level 1/2 tile set, telling the patient a wrong tap was right and
   * feeding the false success into ladder evidence.
   *
   * So ask the scorer, across every bank the choice modes can draw from.
   */
  it('the scorer accepts exactly one tile — not merely the fix list', () => {
    const banks = [
      FIX_SENTENCE_BANK,
      FIX_SENTENCE_MORPHOLOGY_BANK,
      FIX_SENTENCE_TWO_ERROR_BANK,
    ];
    for (const trial of banks.flat()) {
      const tiles = buildFixSentenceChoices(trial);
      const accepted = tiles.filter(
        (tile) =>
          matchSpokenFix(tile, trial.acceptedFixes, trial.fixAliases, trial.sentence, {
            pluralTolerance: !trial.morphology,
          }) != null,
      );
      expect(
        accepted,
        `${trial.id}: tiles=[${tiles.join(', ')}] scored correct=[${accepted.join(', ')}]`,
      ).toHaveLength(1);
    }
  });

  it('is deterministic per trial (retries show the same tiles in the same order)', () => {
    const trial = FIX_SENTENCE_BANK[0];
    expect(buildFixSentenceChoices(trial)).toEqual(buildFixSentenceChoices(trial));
  });

  it('tiles are single words (tappable at a glance)', () => {
    for (const trial of FIX_SENTENCE_BANK.slice(0, 25)) {
      for (const tile of buildFixSentenceChoices(trial)) {
        // The correct fix itself may be multi-word ('steering wheel');
        // distractors must not be.
        if (tile.toLowerCase() !== trial.acceptedFixes[0].toLowerCase()) {
          expect(tile, trial.id).not.toMatch(/\s/);
        }
      }
    }
  });
});
