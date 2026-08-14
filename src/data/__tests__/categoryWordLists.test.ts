/**
 * Category word list acceptance — regression tests for real-session misses.
 *
 * A patient session surfaced valid spoken answers being rejected:
 *   - "plumbing" for jobs (list had only "plumber")
 *   - "financial advisor" for jobs (missing entirely)
 *   - "wire cutters" for tools (list had only singular "wire cutter",
 *     and bigram matching was strict-exact)
 */
import { describe, it, expect } from 'vitest';
import { validateCategoryWord, isExactCategoryMatch } from '@/data/categoryWordLists';

describe('validateCategoryWord — jobs/professions', () => {
  it('accepts trade/activity forms of agent nouns', () => {
    expect(validateCategoryWord('plumbing', 'professions')).toBe('valid');
    expect(validateCategoryWord('teaching', 'professions')).toBe('valid');
    expect(validateCategoryWord('farming', 'professions')).toBe('valid');
  });

  it('accepts advisor variants', () => {
    expect(validateCategoryWord('advisor', 'professions')).toBe('valid');
    expect(validateCategoryWord('adviser', 'professions')).toBe('valid');
    expect(validateCategoryWord('financial advisor', 'professions')).toBe('valid');
  });

  it('still rejects non-jobs', () => {
    expect(validateCategoryWord('banana', 'professions')).toBe('invalid');
    expect(validateCategoryWord('xylophone', 'professions')).toBe('invalid');
  });
});

describe('isExactCategoryMatch — compound entries', () => {
  it('matches compound entries exactly', () => {
    expect(isExactCategoryMatch('wire cutter', 'tools')).toBe(true);
    expect(isExactCategoryMatch('financial advisor', 'professions')).toBe(true);
  });

  it('tolerates a plural on the final word only', () => {
    expect(isExactCategoryMatch('wire cutters', 'tools')).toBe(true);
    expect(isExactCategoryMatch('staple guns', 'tools')).toBe(true);
    expect(isExactCategoryMatch('financial advisors', 'professions')).toBe(true);
  });

  it('stays strict about non-compounds and junk pairs', () => {
    expect(isExactCategoryMatch('dog cat', 'animals')).toBe(false);
    expect(isExactCategoryMatch('wires cutter', 'tools')).toBe(false);
  });
});

describe('validateCategoryWord — multi-word phrases (typed input path)', () => {
  it('accepts plural compounds', () => {
    expect(validateCategoryWord('wire cutters', 'tools')).toBe('valid');
  });
});
