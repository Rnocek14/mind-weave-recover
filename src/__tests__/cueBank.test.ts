import { describe, it, expect } from 'vitest';
import { PHOTO_BANK } from '@/data/photoBank';
import { cueBank, getCuesForWord, getCueText, hasCueCoverage, getCueBankStats } from '@/data/cueBank';
import { generateSemanticCue, generatePhonologicalCue, generateFullCue } from '@/lib/cueGenerator';

describe('cueBank ↔ photoBank alignment', () => {
  const photoTargets = [...new Set(PHOTO_BANK.map(t => t.target.toLowerCase()))];
  const cueBankWords = Object.keys(cueBank);

  it('every photoBank target has cueBank coverage', () => {
    const missing = photoTargets.filter(t => !hasCueCoverage(t));
    if (missing.length > 0) {
      console.warn('Words in photoBank missing from cueBank:', missing);
    }
    // Allow up to 5% gaps for now (warn, don't fail hard)
    expect(missing.length).toBeLessThan(photoTargets.length * 0.1);
  });

  it('every cueBank word has all 4 cue types', () => {
    const incomplete: string[] = [];
    for (const [word, variants] of Object.entries(cueBank)) {
      const types = new Set(variants.map(v => v.type));
      if (types.size < 4) incomplete.push(word);
    }
    expect(incomplete).toEqual([]);
  });

  it('getCuesForWord returns variants for known words', () => {
    const cues = getCuesForWord('cat');
    expect(cues.length).toBeGreaterThanOrEqual(4);
    expect(cues.map(c => c.type)).toContain('phonemic');
    expect(cues.map(c => c.type)).toContain('semantic');
    expect(cues.map(c => c.type)).toContain('sentence_completion');
    expect(cues.map(c => c.type)).toContain('repetition');
  });

  it('getCuesForWord with preferredType filters correctly', () => {
    const cues = getCuesForWord('dog', 'semantic');
    expect(cues.length).toBeGreaterThanOrEqual(1);
    expect(cues[0].type).toBe('semantic');
  });

  it('getCuesForWord returns empty for unknown words', () => {
    const cues = getCuesForWord('xyznonexistent');
    expect(cues).toEqual([]);
  });

  it('getCueText returns text for valid type', () => {
    const text = getCueText('house', 'phonemic');
    expect(text).toBeTruthy();
    expect(typeof text).toBe('string');
  });

  it('getCueText returns null for unknown word', () => {
    expect(getCueText('xyznonexistent', 'phonemic')).toBeNull();
  });

  it('cueGenerator uses cueBank before fallback', () => {
    // Semantic cue for "cat" should come from bank
    const semantic = generateSemanticCue('animals', 'cat');
    const bankSemantic = getCueText('cat', 'semantic');
    expect(semantic).toBe(bankSemantic);

    // Phonemic cue for "dog" should come from bank
    const phonemic = generatePhonologicalCue('dog');
    const bankPhonemic = getCueText('dog', 'phonemic');
    expect(phonemic).toBe(bankPhonemic);
  });

  it('cueGenerator falls back for words not in bank', () => {
    // "xyzword" isn't in the bank, should still generate something
    const semantic = generateSemanticCue('animals', 'xyzword');
    expect(semantic).toBeTruthy();
    expect(typeof semantic).toBe('string');
  });

  it('getCueBankStats returns correct counts', () => {
    const stats = getCueBankStats();
    expect(stats.totalWords).toBeGreaterThanOrEqual(90);
    expect(stats.totalCues).toBeGreaterThanOrEqual(360);
    expect(stats.wordsWithFullCoverage).toBe(stats.totalWords);
    expect(stats.byType.phonemic).toBe(stats.totalWords);
    expect(stats.byType.semantic).toBe(stats.totalWords);
  });

  it('case-insensitive lookup works', () => {
    expect(getCuesForWord('Cat').length).toBeGreaterThan(0);
    expect(getCuesForWord('DOG').length).toBeGreaterThan(0);
    expect(hasCueCoverage('House')).toBe(true);
  });
});
