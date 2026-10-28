/**
 * Restored classifier coverage. The actual classifier and semantic scorer run;
 * only the embedding transport is unavailable. No real backend is contacted.
 * See docs/qa/classifier-quarantine-resolution.md for the reproduced failures
 * and the two historical confidence tests corrected to test actual boundaries.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { ErrorContext, ErrorClassificationResult } from '../errorClassifier';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
let api: typeof import('../errorClassifier');
beforeEach(async () => {
  vi.resetModules();
  invoke.mockReset().mockResolvedValue({ data: { fallback: true }, error: null });
  api = await import('../errorClassifier');
});

describe('Phonological Similarity', () => {
  it('should return 1.0 for identical words', () => {
    expect(api.calculatePhonologicalSimilarity('dog', 'dog')).toBe(1.0);
  });
  it('should detect high similarity for phonemic paraphasia', () => {
    const similarity = api.calculatePhonologicalSimilarity('dok', 'dog');
    expect(similarity).toBeGreaterThan(0.5);
    expect(similarity).toBeCloseTo(0.67, 1);
  });
  it('should detect low similarity for unrelated words', () => {
    expect(api.calculatePhonologicalSimilarity('cat', 'house')).toBeLessThan(0.3);
  });
  it('should handle phonological neighbors correctly', () => {
    expect(api.calculatePhonologicalSimilarity('cat', 'hat')).toBeGreaterThan(0.6);
    expect(api.calculatePhonologicalSimilarity('cat', 'bat')).toBeGreaterThan(0.6);
  });
  it('should handle length differences', () => {
    expect(api.calculatePhonologicalSimilarity('dog', 'doggy')).toBeGreaterThan(0.5);
  });
});

describe('Levenshtein Distance', () => {
  it('should return 0 for identical strings', () => {
    expect(api.levenshteinDistance('test', 'test')).toBe(0);
  });
  it('should return correct distance for single substitution', () => {
    expect(api.levenshteinDistance('cat', 'hat')).toBe(1);
  });
  it('should return correct distance for single insertion', () => {
    expect(api.levenshteinDistance('cat', 'cats')).toBe(1);
  });
  it('should return correct distance for single deletion', () => {
    expect(api.levenshteinDistance('cats', 'cat')).toBe(1);
  });
  it('should handle complex transformations', () => {
    expect(api.levenshteinDistance('kitten', 'sitting')).toBe(3);
  });
});

describe('Semantic Similarity', () => {
  it('should detect high similarity within same category', async () => {
    expect(await api.calculateSemanticSimilarity('cat', 'dog', 'animals')).toBeGreaterThan(0.55);
  });
  it('should detect low similarity for unrelated words', async () => {
    expect(await api.calculateSemanticSimilarity('cat', 'house', 'animals')).toBeLessThan(0.3);
  });
  it('should detect superordinate errors', async () => {
    expect(await api.calculateSemanticSimilarity('animal', 'dog', 'animals')).toBeGreaterThanOrEqual(0.6);
  });
  it('should handle fine-grained categories', async () => {
    expect(await api.calculateSemanticSimilarity('puppy', 'dog', 'domestic_animal')).toBeGreaterThan(0.55);
  });
  it('should detect cross-category relationships', async () => {
    expect(await api.calculateSemanticSimilarity('chair', 'table', 'furniture')).toBeGreaterThan(0.55);
  });
});

describe('Word Validation', () => {
  it('should recognize common words', async () => {
    expect(await api.isValidWord('dog')).toBe(true);
    expect(await api.isValidWord('cat')).toBe(true);
    expect(await api.isValidWord('house')).toBe(true);
  });
  it('should reject non-words', async () => {
    expect(await api.isValidWord('dok')).toBe(false);
    expect(await api.isValidWord('xyz')).toBe(false);
  });
  it('should be case-insensitive', async () => {
    expect(await api.isValidWord('DOG')).toBe(true);
    expect(await api.isValidWord('Dog')).toBe(true);
  });
});

const baseContext: ErrorContext = { trialNumber: 1, previousErrors: [], category: 'animals' };
describe('Error Classification', () => {
  it('should identify correct responses', async () => {
    const result = await api.classifySpeechError('dog', 'dog', 0.9, baseContext);
    expect(result.errorType).toBe('correct');
    expect(result.confidence).toBeGreaterThan(0.8);
  });
  it('should identify semantic paraphasia', async () => {
    const result = await api.classifySpeechError('cat', 'dog', 0.9, baseContext);
    expect(result.errorType).toBe('semantic_paraphasia');
    expect(result.semantic_similarity).toBeGreaterThan(0.55);
    expect(result.semantic_scorer).toBe('rule_based');
  });
  it('should identify phonemic paraphasia', async () => {
    const result = await api.classifySpeechError('dok', 'dog', 0.8, baseContext);
    expect(result.errorType).toBe('phonemic_paraphasia');
    expect(result.phonological_similarity).toBeGreaterThan(0.5);
  });
  it('should identify no response with low confidence', async () => {
    expect((await api.classifySpeechError('', 'dog', 0.2, baseContext)).errorType).toBe('no_response');
  });
  it('should identify self-correction', async () => {
    expect((await api.classifySpeechError('cat... no... dog', 'dog', 0.8, baseContext)).errorType).toBe('self_corrected');
  });
  it('should identify unrelated responses', async () => {
    const result = await api.classifySpeechError('house', 'dog', 0.9, baseContext);
    expect(result.errorType).toBe('unrelated');
    expect(result.phonological_similarity).toBeLessThan(0.5);
    expect(result.semantic_similarity).toBeLessThan(0.55);
  });
  it('should flag uncertain unrelated speech for review without a conditional assertion', async () => {
    // The old dug/dog fixture scored 2/3, so its conditional assertion never ran.
    const result = await api.classifySpeechError('house', 'dog', 0.5, baseContext);
    expect(result.errorType).toBe('uncertain');
    expect(result.needs_review).toBe(true);
    expect(result.needsRetry).toBe(true);
  });
  it('should request retry below the ASR gate instead of assigning an error label', async () => {
    // Existing policy is <0.4, not <=0.4. Semantic confidence is not ASR confidence.
    const low = await api.classifySpeechError('cat', 'dog', 0.39, baseContext);
    const high = await api.classifySpeechError('cat', 'dog', 0.95, baseContext);
    expect(low.errorType).toBe('uncertain');
    expect(low.needsRetry).toBe(true);
    expect(low.isUncertain).toBe(true);
    expect(low.semantic_similarity).toBeUndefined();
    expect(high.errorType).toBe('semantic_paraphasia');
    expect(high.confidence).toBeGreaterThan(low.confidence);
  });
});

const item = (errorType: ErrorClassificationResult['errorType']): ErrorClassificationResult => ({
  errorType, confidence: 0.8, reasoning: '', needs_review: false,
});
describe('Error Pattern Analysis', () => {
  it('should identify semantic error pattern', () => {
    const patterns = api.analyzeErrorPatterns([item('semantic_paraphasia'), item('semantic_paraphasia'), item('correct')]);
    expect(patterns.predominantPattern).toBe('semantic');
    expect(patterns.semanticErrorCount).toBe(2);
  });
  it('should identify phonemic error pattern', () => {
    const patterns = api.analyzeErrorPatterns([item('phonemic_paraphasia'), item('phonemic_paraphasia'), item('neologism')]);
    expect(patterns.predominantPattern).toBe('phonemic');
    expect(patterns.phonemicErrorCount).toBe(2);
  });
  it('should identify mixed error pattern', () => {
    expect(api.analyzeErrorPatterns([item('semantic_paraphasia'), item('phonemic_paraphasia'), item('correct')]).predominantPattern).toBe('mixed');
  });
  it('should only consider recent errors (last 5)', () => {
    const history = [item('semantic_paraphasia'), item('semantic_paraphasia'), item('semantic_paraphasia'),
      item('phonemic_paraphasia'), item('phonemic_paraphasia'), item('phonemic_paraphasia')];
    expect(api.analyzeErrorPatterns(history).predominantPattern).toBe('phonemic');
  });
  it('should return unknown for insufficient data', () => {
    expect(api.analyzeErrorPatterns([item('correct')]).predominantPattern).toBe('unknown');
  });
});

describe('Edge Cases', () => {
  it('should handle empty strings', () => {
    expect(api.calculatePhonologicalSimilarity('', '')).toBe(1.0);
  });
  it('should handle very long words', () => {
    expect(api.calculatePhonologicalSimilarity('antidisestablishmentarianism', 'antidisestablishment')).toBeGreaterThan(0.7);
  });
  it('should handle special characters gracefully', async () => {
    expect((await api.classifySpeechError('dog!', 'dog', 0.9, baseContext)).errorType).not.toBe('no_response');
  });
  it('should handle multi-word responses', async () => {
    expect((await api.classifySpeechError('big dog', 'dog', 0.8, baseContext)).errorType).toBe('self_corrected');
  });
});
