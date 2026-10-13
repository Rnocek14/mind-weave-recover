/**
 * Patient-reported category-fluency regressions.
 *
 * Tests are deliberately read-only: they exercise the actual word validator
 * and streaming phrase segmenter, not database writes or clinical progression.
 * Never make unknown categories globally valid to satisfy these examples.
 */
import { describe, expect, it } from 'vitest';
import { isExactCategoryMatch, validateCategoryWord } from '@/data/categoryWordLists';
import { segmentCategoryPhrases } from '@/lib/categoryFluency/phraseSegmenter';

describe('patient-reported naming answers', () => {
  it.each([
    ['plumbing', 'professions'],
    ['financial advisor', 'professions'],
    ['wire cutters', 'tools'],
  ])('accepts %s as %s', (answer, category) => {
    expect(validateCategoryWord(answer, category)).toBe('valid');
  });

  it.each([
    ['financial advisor', 'professions'],
    ['wire cutters', 'tools'],
  ])('preserves %s as one item during spoken segmentation', (answer, category) => {
    expect(segmentCategoryPhrases(answer.split(' '), category, { final: true }).items)
      .toEqual([{ text: answer, status: 'valid' }]);
  });

  it('recognizes the plural tool compound without treating arbitrary phrases as tools', () => {
    expect(isExactCategoryMatch('wire cutters', 'tools')).toBe(true);
    expect(validateCategoryWord('financial advisor', 'tools')).toBe('invalid');
    expect(validateCategoryWord('wire cutters', 'professions')).toBe('invalid');
  });

  it('keeps separate named tools separate rather than merging a fast list', () => {
    expect(segmentCategoryPhrases(['hammer', 'drill', 'saw'], 'tools', { final: true }).items)
      .toEqual([
        { text: 'hammer', status: 'valid' },
        { text: 'drill', status: 'valid' },
        { text: 'saw', status: 'valid' },
      ]);
  });
});
