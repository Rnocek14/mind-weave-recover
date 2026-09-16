/**
 * The reported cases, first.
 *
 * "my dad said bowling alley and it counted it as two words. or for drink he
 * said jake and coke, rum and coke, even though those arent conventional they
 * work."
 *
 * An item this misses is not skipped quietly — it is struck through with an X
 * in front of the person who just said it, during a timed task about producing
 * as much as you can. So the bar here is not "usually right".
 */
import { describe, it, expect } from 'vitest';
import { segmentCategoryPhrases } from '@/lib/categoryFluency/phraseSegmenter';

const say = (text: string, category: string, final = true) =>
  segmentCategoryPhrases(text.split(/\s+/), category, { final });

describe('what he actually said', () => {
  it('counts "bowling alley" as one place, not two words', () => {
    const { items } = say('bowling alley', 'places');
    expect(items).toEqual([{ text: 'bowling alley', status: 'valid' }]);
  });

  it('counts "rum and coke" as one drink', () => {
    const { items } = say('rum and coke', 'drinks');
    expect(items).toEqual([{ text: 'rum and coke', status: 'valid' }]);
  });

  it('counts "jake and coke" as one drink — the mis-heard proper noun', () => {
    // Chrome heard "jake" for "Jack". The drink is recognised through `coke`,
    // which is why either side of the connector is allowed to be the known one.
    const { items } = say('jake and coke', 'drinks');
    expect(items).toEqual([{ text: 'jake and coke', status: 'valid' }]);
  });

  it('never emits the connector as an answer of its own', () => {
    // "and" is three characters, so it cleared the old length filter and was
    // scored as an item — then crossed out.
    const { items } = say('rum and coke', 'drinks');
    expect(items.some((i) => i.text === 'and')).toBe(false);
  });
});

describe('it must not merge a fast list into one item', () => {
  it('keeps separate drinks separate', () => {
    const { items } = say('coffee tea milk', 'drinks');
    expect(items.map((i) => i.text)).toEqual(['coffee', 'tea', 'milk']);
    expect(items.every((i) => i.status === 'valid')).toBe(true);
  });

  it('still prefers the longer known phrase over its parts', () => {
    const { items } = say('orange juice', 'drinks');
    expect(items).toEqual([{ text: 'orange juice', status: 'valid' }]);
  });

  it('segments a phrase followed by a single item', () => {
    const { items } = say('orange juice beer', 'drinks');
    expect(items.map((i) => i.text)).toEqual(['orange juice', 'beer']);
  });
});

describe('holding the tail while speech is still arriving', () => {
  it('does not commit a word that might still be part of a phrase', () => {
    // The transcript grows a word at a time. Committing "bowling" the moment
    // it arrives is exactly how it got crossed out before "alley" was said.
    const { items, consumed } = segmentCategoryPhrases(['bowling'], 'places', { final: false });
    expect(items).toEqual([]);
    expect(consumed).toBe(0);
  });

  it('commits it once the speaker stops', () => {
    const { items } = segmentCategoryPhrases(['bowling'], 'places', { final: true });
    expect(items).toHaveLength(1);
  });

  it('commits earlier items while holding only the tail', () => {
    const { items } = segmentCategoryPhrases(
      ['coffee', 'tea', 'milk', 'juice', 'beer'],
      'drinks',
      { final: false }
    );
    expect(items.map((i) => i.text)).toEqual(['coffee', 'tea']);
  });
});

describe('a word that is not in the category is still reported as such', () => {
  it('does not turn everything into a pass', () => {
    const { items } = say('hammer', 'drinks');
    expect(items[0].status).toBe('invalid');
  });

  it('needs a connector before it will join two words', () => {
    // Without this, any run of words containing one known drink would collapse
    // into a single item and the count would silently fall.
    const { items } = say('beer hammer', 'drinks');
    expect(items.map((i) => i.text)).toEqual(['beer', 'hammer']);
  });
});
