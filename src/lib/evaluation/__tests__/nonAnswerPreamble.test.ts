/**
 * "I can't remember, but…" is an answer.
 *
 * REPORTED SHAPE OF THE BUG: the non-answer gate discarded any utterance
 * STARTING with a phrase like "I can't remember" or "I don't know". Those are
 * the most common ways an aphasic answer begins — the person names the gap,
 * then works around it, which is exactly the skill Describe & Guess exists to
 * practice. The app threw the whole thing away and replied "That's okay —
 * take your time. Give it a try," immediately after they had tried, at length,
 * and succeeded.
 *
 * These tests pin both directions: a preamble followed by real content is an
 * attempt, and a bare refusal is still a refusal.
 */
import { describe, it, expect } from 'vitest';
import { validateSpokenResponse } from '@/lib/evaluation/responseValidation';

function isTreatedAsNonAnswer(text: string): boolean {
  const r = validateSpokenResponse({
    transcript: text,
    promptText: 'Describe it without saying the word',
    expectedMode: 'description',
  });
  return r.rejectionReason === 'non_answer';
}

describe('a non-answer phrase used as a preamble', () => {
  it('does not discard a full circumlocution', () => {
    expect(
      isTreatedAsNonAnswer("I can't remember what it's called but you drink your coffee out of it")
    ).toBe(false);
  });

  it('does not discard "I don\'t know" followed by a real description', () => {
    expect(
      isTreatedAsNonAnswer("I don't know, you put them on your feet before you go outside")
    ).toBe(false);
  });

  it('does not discard "I forgot" followed by a real description', () => {
    expect(isTreatedAsNonAnswer('I forgot the word, it sits on a desk and gives you light')).toBe(
      false
    );
  });
});

describe('a genuine refusal is still a refusal', () => {
  it('rejects the bare phrase', () => {
    expect(isTreatedAsNonAnswer("I don't know")).toBe(true);
    expect(isTreatedAsNonAnswer("I can't remember")).toBe(true);
    expect(isTreatedAsNonAnswer('no idea')).toBe(true);
  });

  it('rejects a phrase with nothing substantive after it', () => {
    expect(isTreatedAsNonAnswer("I don't know what it's called")).toBe(true);
    expect(isTreatedAsNonAnswer("I can't remember the word")).toBe(true);
  });

  it('still rejects a trailing refusal', () => {
    expect(isTreatedAsNonAnswer('the thing, I forget')).toBe(true);
  });

  it('does not turn a skip command into an attempt', () => {
    // "skip"/"pass"/"next" are commands, not word-finding difficulty.
    expect(isTreatedAsNonAnswer('skip this one please')).toBe(true);
    expect(isTreatedAsNonAnswer('pass')).toBe(true);
  });
});

describe('the cases the first version of this gate still threw away', () => {
  // Found by auditing the fix, not by the fix's own tests — which passed
  // throughout, because they only used examples long enough to clear a
  // three-content-word threshold.
  it('keeps a short circumlocution after a preamble', () => {
    expect(isTreatedAsNonAnswer("i dont know its a thing you drink from")).toBe(false);
    expect(isTreatedAsNonAnswer("I don't know, you drink from it")).toBe(false);
    expect(isTreatedAsNonAnswer('i forget you sit on it')).toBe(false);
  });

  it('keeps a description that gives up on the name at the END', () => {
    // Describe & Guess accumulates the whole trial into one transcript, so a
    // trailing refusal used to discard everything said before it.
    expect(
      isTreatedAsNonAnswer("you drink your coffee out of it in the morning i dont know")
    ).toBe(false);
    expect(isTreatedAsNonAnswer("its round and made of glass i cant remember")).toBe(false);
  });

  it('still refuses when there is nothing either side', () => {
    expect(isTreatedAsNonAnswer("I don't know the answer")).toBe(true);
    expect(isTreatedAsNonAnswer('the thing, I forget')).toBe(true);
    expect(isTreatedAsNonAnswer('um well i dont know')).toBe(true);
  });
});
