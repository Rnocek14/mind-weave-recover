/**
 * Pronunciation Overrides for TTS
 *
 * ElevenLabs occasionally reads certain English words with a non-American or
 * "fancy" pronunciation (e.g. "vase" → "vah-zay"). For stroke patients who rely
 * on hearing the target word clearly, the model word must always be spoken the
 * plain, expected American way.
 *
 * This module rewrites ONLY the text handed to the TTS engine. Callers should
 * keep the original word for scoring, echo detection, and display — never feed
 * the respelled form into those paths.
 *
 * Keep entries lowercase. Matching is case-insensitive and word-boundary aware,
 * so sentences ("Point to the vase.") are handled too.
 */

const PRONUNCIATION_MAP: Record<string, string> = {
  // word : phonetic respelling that ElevenLabs reads clearly
  vase: 'vayss',
  herb: 'urb',
  buoy: 'boo-ee',
  caramel: 'care-a-mel',
  apricot: 'ay-pri-cot',
  pecan: 'pee-can',
  almond: 'ah-mond',
  salmon: 'sam-un',
  comb: 'kohm',
  iron: 'eye-urn',
  yacht: 'yot',
  scissors: 'sizz-ers',
};

const WORD_RE = /[a-zA-Z]+(?:'[a-zA-Z]+)?/g;

/**
 * Rewrite a piece of text so any known mispronounced words are replaced with a
 * phonetic respelling. Casing is otherwise preserved by replacing per word.
 */
export function applyPronunciationOverrides(text: string): string {
  if (!text) return text;
  return text.replace(WORD_RE, (word) => {
    const override = PRONUNCIATION_MAP[word.toLowerCase()];
    return override ?? word;
  });
}
