/**
 * Spoken choices for Detective Mind. Both automatic narration and the
 * "Repeat question" button must explicitly announce each displayed label.
 * Bare "C. ..." gets swallowed by some TTS normalizers, especially for the
 * final option, which makes the spoken list disagree with the visual choices.
 *
 * This produces the exact same text as the earlier inline mapping.
 */
export function formatDetectiveOptionsForSpeech(displayedOptions: readonly string[]): string {
  return displayedOptions
    .map((option, index) => `Option ${String.fromCharCode(65 + index)}: ${option}`)
    .join('. ');
}

/**
 * Conservative ASR choice parser for Detective Mind.
 *
 * A sentence like "I saw a dog" must NOT count as Option A just because it
 * contains the article "a". Similarly, "I see..." is not automatically C.
 * When multiple different answers are mentioned, return null and let the
 * patient repeat or tap instead of inventing a clinical comprehension score.
 */
const SPOKEN_OPTION_NUMBERS: Readonly<Record<string, number>> = {
  a: 0, ay: 0, hey: 0, eh: 0, one: 0, first: 0, '1': 0,
  b: 1, bee: 1, be: 1, two: 1, second: 1, '2': 1,
  c: 2, sea: 2, see: 2, three: 2, third: 2, '3': 2,
  d: 3, dee: 3, four: 3, fourth: 3, '4': 3,
};

const normalizedChoiceText = (value: string) =>
  value.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const uniqueChoice = (numbers: number[]): number | null => {
  const candidates = [...new Set(numbers)];
  return candidates.length === 1 ? candidates[0] : null;
};

/** Return a displayed option index, or abstain if ASR did not resolve one. */
export function resolveDetectiveSpokenChoice(
  transcript: string,
  displayedOptions: readonly string[],
): number | null {
  if (displayedOptions.length === 0) return null;
  const text = normalizedChoiceText(transcript);
  if (!text) return null;

  const valid = (index: number | undefined): index is number =>
    index !== undefined && index >= 0 && index < displayedOptions.length;
  const words = text.split(' ');

  // Strong evidence first: "option C", "answer B", "letter C",
  // "I choose B", "number three". A misleading article "a" is not
  // considered here unless it is explicitly preceded by a choice cue.
  const explicit: number[] = [];
  const cue = /\b(?:option|letter|answer|choose|chose|pick|picked|select|selected|number)\s+(?:is\s+|number\s+)?(a|b|c|d|ay|bee|be|sea|see|dee|one|two|three|four|[1-4])\b/g;
  for (const match of text.matchAll(cue)) {
    const idx = SPOKEN_OPTION_NUMBERS[match[1]];
    if (valid(idx)) explicit.push(idx);
  }
  // "the answer is C" or "my answer is B"
  const answerIs = /\banswer\s+is\s+(a|b|c|d|ay|bee|be|sea|see|dee|one|two|three|four|[1-4])\b/g;
  for (const match of text.matchAll(answerIs)) {
    const idx = SPOKEN_OPTION_NUMBERS[match[1]];
    if (valid(idx)) explicit.push(idx);
  }
  if (explicit.length) return uniqueChoice(explicit);

  // A bare single letter/number (including ASR homophones "bee", "sea")
  // is a valid answer. They are NOT valid while embedded in open speech.
  if (words.length === 1) {
    const idx = SPOKEN_OPTION_NUMBERS[words[0]];
    if (valid(idx)) return idx;
  }

  // "second one", "the third", "my first choice".
  const ordinals: number[] = [];
  for (const match of text.matchAll(/\b(first|second|third|fourth)\b/g)) {
    const idx = SPOKEN_OPTION_NUMBERS[match[1]];
    if (valid(idx)) ordinals.push(idx);
  }
  if (ordinals.length) return uniqueChoice(ordinals);

  // "I think C", "C please", "I'm going with B" are explicit short
  // letter answers, but "I think a..." and "I see..." are not.
  const shortAnswer = text.match(/^(?:(?:i\s+think|i\s+choose|i\s+pick|i\s+say|i\s+would\s+say|its|it\s+is|go\s+with|(?:im\s+)?going\s+with)\s+)?([b-d]|a)(?:\s+please)?$/);
  if (shortAnswer) {
    const idx = SPOKEN_OPTION_NUMBERS[shortAnswer[1]];
    if (valid(idx)) return idx;
  }

  // An exact spoken answer text, possibly within a phrase such as
  // "I think it is [option]", may resolve the choice. Use word boundaries,
  // never substring checks ("bear" must not match "beard"). If two
  // displayed options both occur, abstain rather than credit a guess.
  const matching = displayedOptions.flatMap((option, index) => {
    const normalized = normalizedChoiceText(option);
    if (normalized.length < 4) return [];
    const needle = normalized.split(' ');
    for (let i = 0; i <= words.length - needle.length; i++) {
      if (needle.every((word, j) => word === words[i + j])) return [index];
    }
    return [];
  });
  return uniqueChoice(matching);
}

/** Retry guidance refers only to letters that actually appear as buttons. */
export function formatDetectiveChoiceRetryPrompt(optionCount: number): string {
  const count = Math.min(4, Math.max(0, Math.floor(optionCount)));
  const letters = Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
  if (letters.length === 0) return 'Please tap an answer.';
  const joined = letters.length === 1
    ? letters[0]
    : letters.length === 2
      ? letters.join(' or ')
      : letters.slice(0, -1).join(', ') + ', or ' + letters[letters.length - 1];
  return `I didn't catch a choice. Try saying ${joined}, or tap an answer.`;
}
