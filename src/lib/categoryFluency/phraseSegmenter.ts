/**
 * Turning what someone said into the things they actually named.
 *
 * REPORTED: "my dad said bowling alley and it counted it as two words. or for
 * drink he said jake and coke, rum and coke, even though those arent
 * conventional they work."
 *
 * Both halves of that were real, and the second half matters more than it
 * looks. An unrecognised item is not quietly skipped — it is rendered struck
 * through with an X. So a correct answer the word list happens not to know
 * gets crossed out in front of the person who just produced it, during a timed
 * task whose whole point is to produce as much as you can.
 *
 * WHAT WAS WRONG
 *
 * The old assembler held ONE word back and asked whether the pair formed a
 * known compound. That gets "hot chocolate" and nothing longer, so:
 *   "bowling alley"  -> two entries, both crossed out
 *   "rum and coke"   -> three entries ("and" is three characters, so it
 *                       cleared the length filter and became an item of its
 *                       own), two of them crossed out
 *
 * WHAT THIS DOES INSTEAD
 *
 * Longest-match-first segmentation over a window, which is the standard way to
 * cut a token stream into known phrases, plus one rule for the shape that
 * defeated it: a category item joined by a connector.
 *
 *   "rum and coke"   -> one item, because `rum` is a known drink
 *   "jack and coke"  -> one item, because `coke` is a known drink
 *   "gin and tonic"  -> one item
 *   "coffee tea"     -> TWO items, because there is no connector to join them
 *
 * That last line is the one to protect. A rule that swallowed any run of words
 * containing a known item would quietly merge a fast list of three drinks into
 * one, and under-counting is the failure this exists to fix.
 */
import { validateCategoryWord, isExactCategoryMatch, type WordValidation } from '@/data/categoryWordLists';

/**
 * Words that JOIN an item rather than being one. "rum and coke" is a drink;
 * "and" is not an answer, and it used to be scored as one.
 */
const CONNECTORS = new Set(['and', 'n', 'with', 'of', 'on', 'in', 'the', 'a', 'an', 'or']);

/** Longest phrase we will consider, in tokens. "whiskey on the rocks" is 4. */
const MAX_PHRASE_TOKENS = 4;

/**
 * How many trailing tokens to hold back while speech is still arriving.
 *
 * The transcript grows a word at a time, so committing the tail immediately
 * would cut "bowling" loose before "alley" ever showed up — which is precisely
 * the reported bug. Held tokens are released by a final pass when the person
 * stops talking.
 */
const TAIL_HOLD_TOKENS = MAX_PHRASE_TOKENS - 1;

export interface SegmentedItem {
  text: string;
  status: WordValidation;
}

export interface SegmentResult {
  items: SegmentedItem[];
  /** Tokens consumed from the front of the input. The rest may still grow. */
  consumed: number;
}

function isKnownItem(phrase: string, category: string): boolean {
  return isExactCategoryMatch(phrase, category) || validateCategoryWord(phrase, category) === 'valid';
}

/**
 * A connector phrase: content words joined by a connector, where at least one
 * of the content words is a known member of the category.
 *
 * Either side may be the known one. "rum and coke" is recognised through
 * `rum`; "jack and coke" through `coke`. Requiring the FIRST word to be known
 * would have kept failing the exact example that was reported, and the
 * mis-hearing of a proper noun ("jake" for "Jack") is normal for this input.
 */
function isConnectorPhrase(tokens: string[], category: string): boolean {
  if (tokens.length < 3) return false;
  const inner = tokens.slice(1, -1);
  if (!inner.some((t) => CONNECTORS.has(t))) return false;

  const content = tokens.filter((t) => !CONNECTORS.has(t));
  if (content.length < 2) return false;
  return content.some((t) => isKnownItem(t, category));
}

/**
 * Cut a token stream into the items the person named.
 *
 * `final` releases the held tail; pass it when speech has stopped.
 */
export function segmentCategoryPhrases(
  tokens: string[],
  category: string,
  { final = false }: { final?: boolean } = {}
): SegmentResult {
  const items: SegmentedItem[] = [];
  const limit = final ? tokens.length : Math.max(0, tokens.length - TAIL_HOLD_TOKENS);
  let i = 0;

  while (i < tokens.length) {
    // Stop before the held tail unless this is the final pass.
    if (i >= limit) break;

    let matched = false;

    // Longest match first, so "orange juice" never becomes "orange" + "juice".
    for (let len = Math.min(MAX_PHRASE_TOKENS, tokens.length - i); len >= 2; len--) {
      const slice = tokens.slice(i, i + len);
      if (CONNECTORS.has(slice[0])) continue;

      const phrase = slice.join(' ');
      if (isExactCategoryMatch(phrase, category) || isConnectorPhrase(slice, category)) {
        items.push({ text: phrase, status: 'valid' });
        i += len;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // No phrase here — take the single token on its own terms.
    const token = tokens[i];
    items.push({ text: token, status: validateCategoryWord(token, category) });
    i += 1;
  }

  return { items, consumed: i };
}
