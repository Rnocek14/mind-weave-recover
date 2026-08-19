/**
 * Worksheet pack integrity.
 *
 * The printed PDF, the browser print view, and the answer key are generated
 * from one function — so these tests guard the properties that would silently
 * break the pack if a content bank changed underneath it: determinism (the
 * hosted PDF must match what a user prints), non-empty sections, and an
 * answer key that actually answers the printed items.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { buildWorksheetPack } from '@/lib/worksheets/buildWorksheetPack';
import { FIX_SENTENCE_BANK } from '@/data/fixSentenceBank';

const pack = buildWorksheetPack();

describe('buildWorksheetPack', () => {
  it('is deterministic — the hosted PDF and a fresh print must agree', () => {
    expect(JSON.stringify(buildWorksheetPack())).toBe(JSON.stringify(buildWorksheetPack()));
  });

  it('fills every section with printable content', () => {
    expect(pack.sections).toHaveLength(4);
    expect(pack.categories.length).toBeGreaterThanOrEqual(6);
    expect(pack.clues.length).toBeGreaterThanOrEqual(6);
    expect(pack.pairs.length).toBeGreaterThanOrEqual(10);
    const sentenceCount = pack.sentences.reduce((n, s) => n + s.items.length, 0);
    expect(sentenceCount).toBeGreaterThanOrEqual(24);
  });

  it('serves all three difficulty levels, each non-empty', () => {
    expect(pack.sentences.map((s) => s.level)).toEqual([1, 2, 3]);
    for (const block of pack.sentences) {
      expect(block.items.length, `level ${block.level}`).toBeGreaterThan(0);
    }
  });

  it('prints the wrong word inside its own sentence (the task must be doable on paper)', () => {
    for (const block of pack.sentences) {
      for (const item of block.items) {
        const words = item.sentence.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/);
        expect(words, `${item.sentence}`).toContain(item.wrongWord.toLowerCase());
      }
    }
  });

  it('answer key entries are real accepted fixes from the bank', () => {
    const bySentence = new Map(FIX_SENTENCE_BANK.map((t) => [t.sentence, t]));
    for (const block of pack.sentences) {
      for (const item of block.items) {
        const trial = bySentence.get(item.sentence);
        expect(trial, `bank item for "${item.sentence}"`).toBeDefined();
        expect(trial!.acceptedFixes).toContain(item.answer);
        for (const alt of item.alternatives) {
          expect(trial!.acceptedFixes).toContain(alt);
        }
      }
    }
  });

  it('never prints the answer as the alternative of itself', () => {
    for (const block of pack.sentences) {
      for (const item of block.items) {
        expect(item.alternatives).not.toContain(item.answer);
      }
    }
  });

  it('two-clue items each print two clues and carry an answer', () => {
    for (const c of pack.clues) {
      expect(c.clues.length).toBe(2);
      expect(c.answer.length).toBeGreaterThan(1);
    }
  });

  it('listening pairs are two different words', () => {
    for (const p of pack.pairs) {
      expect(p.word1).not.toBe(p.word2);
      expect(p.contrast.length).toBeGreaterThan(0);
    }
  });

  it('excludes items that are unfair on paper (no highlighted error to find)', () => {
    // The interactive game highlights the wrong word; the printed sheet does
    // not, so a sentence that is still true as written has no findable error.
    const printed = pack.sentences.flatMap((b) => b.items.map((i) => i.sentence));
    expect(printed).not.toContain('I opened the door with my elbow.');
  });

  it('never prints the same listening contrast twice', () => {
    const keys = pack.pairs.map((p) => [p.word1, p.word2].map((w) => w.toLowerCase()).sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('composition is snapshot-locked against the hosted PDF', () => {
    // The download at public/downloads/ is a frozen render of this pack. If a
    // content bank changes underneath it this hash moves, which is the signal
    // to regenerate the PDF from /free-aphasia-worksheets/print — otherwise
    // the hosted file silently disagrees with the page's own item counts.
    const hash = createHash('sha256').update(JSON.stringify(pack)).digest('hex').slice(0, 16);
    expect(hash).toBe('73a2310a014b5fc9');
  });

  it('every section points at a playable version', () => {
    for (const s of pack.sections) {
      expect(s.playPath.startsWith('/')).toBe(true);
      expect(s.partnerNote.length).toBeGreaterThan(20);
    }
  });
});
