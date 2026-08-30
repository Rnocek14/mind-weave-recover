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

describe('validateCategoryWord — drinks brand names (QA: "Mountain Dew and coke didn\'t count")', () => {
  it('accepts common soda brand names', () => {
    expect(validateCategoryWord('coke', 'drinks')).toBe('valid');
    expect(validateCategoryWord('pepsi', 'drinks')).toBe('valid');
    expect(validateCategoryWord('sprite', 'drinks')).toBe('valid');
    expect(validateCategoryWord('fanta', 'drinks')).toBe('valid');
  });

  it('accepts multi-word brands through the compound matcher', () => {
    expect(isExactCategoryMatch('mountain dew', 'drinks')).toBe(true);
    expect(isExactCategoryMatch('dr pepper', 'drinks')).toBe(true);
    expect(isExactCategoryMatch('coca cola', 'drinks')).toBe(true);
    expect(isExactCategoryMatch('red bull', 'drinks')).toBe(true);
  });

  it('accepts common everyday drinks previously missing', () => {
    expect(isExactCategoryMatch('chai tea', 'drinks')).toBe(true);
    expect(isExactCategoryMatch('chocolate milk', 'drinks')).toBe(true);
    expect(isExactCategoryMatch('sweet tea', 'drinks')).toBe(true);
    expect(isExactCategoryMatch('iced coffee', 'drinks')).toBe(true);
  });

  it('still rejects non-drinks', () => {
    expect(validateCategoryWord('sandwich', 'drinks')).not.toBe('valid');
    // 'chair' regression guard: bare 'chai' in the list made 'chair' a valid
    // drink through truncation tolerance — chai lives as compounds only.
    expect(validateCategoryWord('chair', 'drinks')).not.toBe('valid');
  });
});
