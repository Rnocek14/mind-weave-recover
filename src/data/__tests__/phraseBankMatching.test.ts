import { describe, expect, it } from 'vitest';
import { evaluatePhraseMatch, PHRASE_BANK, type PhraseTrial } from '@/data/phraseBank';

const target = (phrase: string): PhraseTrial => ({ ...PHRASE_BANK[0], phrase });

describe('Phrase Practice one-to-one speech word matching', () => {
  it('does not double-credit one spoken word for repeated words in a real phrase', () => {
    const result = evaluatePhraseMatch('I want to go the store', target('I want to go to the store'));
    expect(result.wordAccuracy).toBeCloseTo(6 / 7, 6);
    expect(result.matchedWords.filter((word) => word === 'to')).toHaveLength(1);
  });

  it('does not award full phrase success from one repeated target word', () => {
    const result = evaluatePhraseMatch('go', target('go go go'));
    expect(result.wordAccuracy).toBeCloseTo(1 / 3, 6);
    expect(result.match).toBe(false);
  });

  it('still tolerates word-order differences during supported aphasia practice', () => {
    const result = evaluatePhraseMatch('help need I', target('I need help'));
    expect(result.wordAccuracy).toBe(1);
    expect(result.match).toBe(true);
  });

  it('returns no invented success for silence, fillers or unrelated speech', () => {
    expect(evaluatePhraseMatch('', target('I need help')).wordAccuracy).toBe(0);
    expect(evaluatePhraseMatch('banana', target('I need help')).match).toBe(false);
  });
});
