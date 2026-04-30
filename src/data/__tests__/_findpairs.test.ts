import { describe, it } from 'vitest';
import { PHOTO_BANK } from '@/data/photoBank';
import { MINIMAL_PAIRS } from '@/data/minimalPairsBank';

describe('find candidate pairs in PHOTO_BANK', () => {
  it('lists single-phoneme-different word pairs already photo-backed', () => {
    const used = new Set(MINIMAL_PAIRS.flatMap(p => [p.word1.toLowerCase(), p.word2.toLowerCase()]));
    const words = [...new Set(PHOTO_BANK.map(t => t.target.toLowerCase()))].sort();
    /* eslint-disable no-console */
    console.log(`PHOTO_BANK unique words: ${words.length}`);

    // Candidates: single-letter-different same-length pairs (rough proxy for minimal pair)
    const out: string[] = [];
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j < words.length; j++) {
        const a = words[i], b = words[j];
        if (a.length !== b.length) continue;
        if (a.length < 3 || a.length > 6) continue;
        let diff = 0;
        for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) diff++;
        if (diff === 1) {
          const tag = (used.has(a) || used.has(b)) ? '(in-use)' : '';
          out.push(`  ${a}/${b}  ${tag}`);
        }
      }
    }
    console.log(`\nCandidate pairs (1-letter-different, both in PHOTO_BANK): ${out.length}`);
    for (const line of out.slice(0, 80)) console.log(line);
    /* eslint-enable no-console */
  });
});
