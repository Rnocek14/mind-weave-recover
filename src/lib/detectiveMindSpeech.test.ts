import { describe, expect, it } from 'vitest';
import { formatDetectiveOptionsForSpeech, formatDetectiveChoiceRetryPrompt, resolveDetectiveSpokenChoice } from './detectiveMindSpeech';

describe('Detective Mind spoken option labels', () => {
  it('announces all three options including the final C', () => {
    expect(formatDetectiveOptionsForSpeech(['Dogs', 'Cats', 'Birds']))
      .toBe('Option A: Dogs. Option B: Cats. Option C: Birds');
  });

  it('announces every option even when there are four', () => {
    expect(formatDetectiveOptionsForSpeech(['First', 'Second', 'Third', 'Fourth']))
      .toBe('Option A: First. Option B: Second. Option C: Third. Option D: Fourth');
  });

  it('uses the displayed/shuffled order, not the original case order', () => {
    expect(formatDetectiveOptionsForSpeech(['Correct', 'Distractor 2', 'Distractor 1']))
      .toBe('Option A: Correct. Option B: Distractor 2. Option C: Distractor 1');
  });

  it('handles an empty selection without inventing an answer', () => {
    expect(formatDetectiveOptionsForSpeech([])).toBe('');
  });
});

describe('Detective Mind conservative live ASR choice resolution', () => {
  const three = ['Dogs', 'Cats', 'Birds'];

  it.each([
    ['C', 2],
    ['sea', 2],
    ['option C', 2],
    ['answer is C', 2],
    ['I choose B', 1],
    ['number three', 2],
    ['the second one', 1],
    ['cats', 1],
    ['I think it is cats', 1],
    ['A please', 0],
  ] as const)('resolves a deliberate response %s', (heard, expected) => {
    expect(resolveDetectiveSpokenChoice(heard, three)).toBe(expected);
  });

  it.each([
    'I need a minute',
    'I saw a dog',
    'I see what you mean',
    'I would be careful',
    'number four',
    'option D',
    'option A or option C',
    'cats and birds',
    'cattle',
    '',
  ])('abstains for ambiguous or unsupported speech %s', (heard) => {
    expect(resolveDetectiveSpokenChoice(heard, three)).toBeNull();
  });

  it('never selects by a substring inside a different word', () => {
    expect(resolveDetectiveSpokenChoice('I saw a bearded man', ['beard', 'bear', 'glasses']))
      .toBeNull();
  });

  it('keeps shuffled displayed option order, including the last C', () => {
    expect(resolveDetectiveSpokenChoice('Birds', ['Birds', 'Dogs', 'Cats'])).toBe(0);
    expect(resolveDetectiveSpokenChoice('Cats', ['Birds', 'Dogs', 'Cats'])).toBe(2);
  });

  it('coaches only displayed letter options after a voice miss', () => {
    expect(formatDetectiveChoiceRetryPrompt(3)).toContain('A, B, or C');
    expect(formatDetectiveChoiceRetryPrompt(3)).not.toContain('D');
    expect(formatDetectiveChoiceRetryPrompt(4)).toContain('A, B, C, or D');
    expect(formatDetectiveChoiceRetryPrompt(0)).toContain('tap');
  });
});
