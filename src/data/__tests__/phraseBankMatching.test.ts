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

  it('keeps functional words like okay even though general ASR removes them as fillers', () => {
    const actual = PHRASE_BANK.find(trial => trial.id === 'im_okay')!;
    expect(actual.phrase).toBe("I'm okay");
    const exact = evaluatePhraseMatch("I'm okay", actual);
    expect(exact.match).toBe(true);
    expect(exact.wordAccuracy).toBe(1);
    const withFiller = evaluatePhraseMatch("um I'm okay", actual);
    expect(withFiller.match).toBe(true);
    expect(withFiller.wordAccuracy).toBe(1);
    // "okay" alone is not enough for the entire two-word phrase.
    expect(evaluatePhraseMatch('okay', actual).match).toBe(false);
  });

  it('does not credit a filler as unrelated phrase content', () => {
    const result = evaluatePhraseMatch('well uh need help', target('I need help'));
    expect(result.matchedWords).not.toContain('well');
    expect(result.wordAccuracy).toBeLessThan(1);
  });

  it('returns no invented success for silence, fillers or unrelated speech', () => {
    expect(evaluatePhraseMatch('', target('I need help')).wordAccuracy).toBe(0);
    expect(evaluatePhraseMatch('banana', target('I need help')).match).toBe(false);
  });
});
