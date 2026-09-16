/**
 * Reading the sentence back is not an answer. Saying the wrong word is.
 *
 * Every case below was measured in a real session before it was a test.
 */
import { describe, it, expect } from 'vitest';
import { isSentenceEcho } from '@/lib/fixSentence/sentenceEchoGuard';

const trial = {
  sentence: 'I wore a hat on my foot.',
  wrongWord: 'foot',
  acceptedFixes: ['head'],
};

describe('fragments of the sentence are not answers', () => {
  it.each([
    'I wore a',
    'on my foot',
    'I wore a hat on my',
    'i wore a hat on my foot',
    'I wore a hat on my foot.',
  ])('drops %j', (said) => {
    expect(isSentenceEcho(said, trial)).toBe(true);
  });

  it('is not defeated by a filler in front', () => {
    // One "um" used to defeat this entirely: the guard tested the RAW
    // transcript, so it failed on "um" and fell through to an echo filter
    // whose own stopwords then shrank the fragment below its thresholds — and
    // it was scored as a wrong attempt, while the same words without the "um"
    // were dropped correctly. A leading "um" is the norm for this population.
    for (const said of ['um I wore a', 'uh on my foot', 'er I wore a hat on my', 'hmm my foot']) {
      expect(isSentenceEcho(said, trial), said).toBe(true);
    }
  });
});

describe('real answers survive', () => {
  it('keeps an accepted fix, alone or embedded', () => {
    expect(isSentenceEcho('head', trial)).toBe(false);
    expect(isSentenceEcho('I wore a hat on my head', trial)).toBe(false);
    expect(isSentenceEcho('um head', trial)).toBe(false);
  });

  it('keeps the bare wrong word, which is a wrong answer and deserves a verdict', () => {
    // They found the odd word and repeated it instead of replacing it. It is a
    // sentence word and never an accepted fix, so it was being swallowed whole
    // — no feedback, no attempt, nothing on screen.
    expect(isSentenceEcho('foot', trial)).toBe(false);
    expect(isSentenceEcho('um foot', trial)).toBe(false);
  });

  it('keeps a word that is in neither list', () => {
    expect(isSentenceEcho('elephant', trial)).toBe(false);
    expect(isSentenceEcho('shoe', trial)).toBe(false);
  });

  it('never fires without a sentence or a transcript', () => {
    expect(isSentenceEcho('', trial)).toBe(false);
    expect(isSentenceEcho('anything', { sentence: null })).toBe(false);
    expect(isSentenceEcho('um', trial)).toBe(false); // nothing left after fillers
  });
});
