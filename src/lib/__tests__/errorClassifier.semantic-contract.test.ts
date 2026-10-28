import { beforeEach, describe, expect, it, vi } from 'vitest';

// Only the provider transport is controlled. Classification, lexical gating,
// cosine arithmetic and fallback/category mapping execute their real code.
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
let classifier: typeof import('../errorClassifier');
let semantics: typeof import('../semanticSimilarity');
const context = { trialNumber: 1, previousErrors: [], category: 'animals' };

beforeEach(async () => {
  vi.resetModules();
  invoke.mockReset().mockResolvedValue({ data: { fallback: true }, error: null });
  classifier = await import('../errorClassifier');
  semantics = await import('../semanticSimilarity');
});

function supplyCosine(score: number) {
  invoke.mockImplementation(async (name: string, options: { body: { text: string } }) => {
    expect(name).toBe('get-embedding');
    expect(['cat', 'dog']).toContain(options.body.text);
    return {
      data: { embedding: options.body.text === 'dog' ? [1, 0] : [score, Math.sqrt(1 - score * score)] },
      error: null,
    };
  });
}

describe('error relationship versus naming-answer validation', () => {
  it('keeps the naming guard while restoring fallback semantic-error classification', async () => {
    expect(await semantics.getSemanticSimilarityDetailed('cat', 'dog', 'animals')).toEqual({ score: 0.45, source: 'rule_based' });
    const result = await classifier.classifySpeechError('cat', 'dog', 0.9, context);
    expect(result.errorType).toBe('semantic_paraphasia');
    expect(result.semantic_similarity).toBe(0.7);
    expect(result.semantic_scorer).toBe('rule_based');
    // No global switch: ordinary naming remains guarded after classification.
    expect(await semantics.getSemanticSimilarity('cat', 'dog', 'animals')).toBe(0.45);
  });
  it('preserves an embedding relationship without rescaling or turning it into a correct answer', async () => {
    supplyCosine(0.6);
    const naming = await semantics.getSemanticSimilarityDetailed('cat', 'dog', 'animals');
    const result = await classifier.classifySpeechError('cat', 'dog', 0.9, context);
    expect(naming).toEqual({ score: 0.45, source: 'embedding' });
    expect(result.errorType).toBe('semantic_paraphasia');
    expect(result.semantic_similarity).toBeCloseTo(0.6, 10);
    expect(result.semantic_scorer).toBe('embedding');
    expect(invoke).toHaveBeenCalledTimes(2); // The actual shared cache is used.
    expect(invoke).toHaveBeenCalledWith('get-embedding', { body: { text: 'cat' } });
    expect(invoke).toHaveBeenCalledWith('get-embedding', { body: { text: 'dog' } });
  });
  it.each([0, 0.2, 0.44])('does not inflate a low raw relationship of %s into a semantic error', async score => {
    supplyCosine(score);
    const result = await classifier.classifySpeechError('cat', 'dog', 0.9, context);
    expect(result.errorType).toBe('unrelated');
    expect(result.semantic_similarity).toBeCloseTo(score, 10);
    expect(result.semantic_scorer).toBe('embedding');
  });
  it.each([[0.46, true], [0.5, false], [0.6, false]] as const)('preserves the existing review boundary at semantic score %s', async (score, review) => {
    supplyCosine(score);
    const result = await classifier.classifySpeechError('cat', 'dog', 0.9, context);
    expect(result.errorType).toBe('semantic_paraphasia');
    expect(result.needs_review).toBe(review);
  });
  it('does not change existing description-to-word evaluation', async () => {
    supplyCosine(0.6);
    expect((await semantics.getSemanticSimilarityDetailed('cat', 'dog', 'animals', 'description_to_word')).score).toBeCloseTo(0.6, 10);
  });
  it('keeps truly unrelated fallback words unrelated', async () => {
    const result = await classifier.classifySpeechError('house', 'dog', 0.9, context);
    expect(result.errorType).toBe('unrelated');
    expect(result.semantic_similarity).toBe(0.1);
    expect(result.semantic_scorer).toBe('rule_based');
  });
  it('retains fallback provenance on a provider error', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('Synthetic provider failure') });
    const result = await classifier.classifySpeechError('cat', 'dog', 0.9, context);
    expect(result.errorType).toBe('semantic_paraphasia');
    expect(result.semantic_scorer).toBe('rule_based');
    expect(result.semantic_similarity).toBe(0.7);
  });
  it('retains fallback provenance on a thrown transport failure', async () => {
    invoke.mockRejectedValue(new Error('Synthetic transport failure'));
    const result = await classifier.classifySpeechError('cat', 'dog', 0.9, context);
    expect(result.errorType).toBe('semantic_paraphasia');
    expect(result.semantic_scorer).toBe('rule_based');
  });
  it.each(['um', 'uhhh', '!!!', 'xkqzv'])('retains the nonsense gate for %s without provider traffic', async spoken => {
    const result = await classifier.classifySpeechError(spoken, 'dog', 0.9, context);
    expect(result.semantic_similarity).toBe(0);
    expect(result.semantic_scorer).toBe('nonsense_gate');
    expect(result.errorType).not.toBe('correct');
    expect(result.errorType).not.toBe('semantic_paraphasia');
    expect(invoke).not.toHaveBeenCalled();
  });
  it('keeps no response distinct from a measured semantic zero', async () => {
    const result = await classifier.classifySpeechError(' ', 'dog', 0.2, context);
    expect(result.errorType).toBe('no_response');
    expect(result.semantic_similarity).toBeUndefined();
    expect(result.needsRetry).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
  it.each([0, 0.39])('requests retry below the existing ASR boundary at %s', async confidence => {
    const result = await classifier.classifySpeechError('cat', 'dog', confidence, context);
    expect(result.errorType).toBe('uncertain');
    expect(result.needsRetry).toBe(true);
    expect(result.semantic_similarity).toBeUndefined();
    expect(invoke).not.toHaveBeenCalled();
  });
  it('retains the inclusive 0.4 classification boundary', async () => {
    expect((await classifier.classifySpeechError('cat', 'dog', 0.4, context)).errorType).toBe('semantic_paraphasia');
  });
  it('requests retry for unrelated speech below 0.6 confidence', async () => {
    const result = await classifier.classifySpeechError('house', 'dog', 0.59, context);
    expect(result.errorType).toBe('uncertain');
    expect(result.needsRetry).toBe(true);
    expect(result.needs_review).toBe(true);
  });
  it('retains the 0.6 unrelated-speech boundary', async () => {
    const result = await classifier.classifySpeechError('house', 'dog', 0.6, context);
    expect(result.errorType).toBe('unrelated');
    expect(result.needsRetry).toBe(false);
  });
  it('does not erase exact-match correctness or require an embedding request', async () => {
    const result = await classifier.classifySpeechError(' DOG ', 'dog', 0.9, context);
    expect(result.errorType).toBe('correct');
    expect(result.semantic_similarity).toBe(1);
    expect(result.phonological_similarity).toBe(1);
    expect(invoke).not.toHaveBeenCalled();
  });
});
