import { describe, it } from 'vitest';
import { MINIMAL_PAIRS, getMinimalPairTrials } from '@/data/minimalPairsBank';
import { PHOTO_BANK } from '@/data/photoBank';

describe('list T3 minimal-pair gap', () => {
  it('prints which T3 pairs are missing photo backing', () => {
    const photoTargets = new Set(PHOTO_BANK.map(p => p.target.toLowerCase()));
    const playable = getMinimalPairTrials();
    const playableIds = new Set(playable.map(t => t.pair.id));

    const t3 = MINIMAL_PAIRS.filter(p => p.difficulty === 3);
    /* eslint-disable no-console */
    console.log(`\n📋 T3 raw pairs: ${t3.length}  |  T3 playable: ${playable.filter(t => t.pair.difficulty === 3).length}\n`);
    console.log('Pair                          w1-photo  w2-photo  category           status');
    console.log('─'.repeat(90));
    for (const p of t3) {
      const has1 = photoTargets.has(p.word1.toLowerCase());
      const has2 = photoTargets.has(p.word2.toLowerCase());
      const isPlayable = playableIds.has(p.id);
      const status = isPlayable ? '✅ playable' : (has1 && has2 ? '⚠️  has photos but excluded' : '🔴 missing photo(s)');
      console.log(
        `${(p.word1 + '/' + p.word2).padEnd(30)}${(has1 ? '   ✓   ' : '   ✗   ').padEnd(10)}${(has2 ? '   ✓   ' : '   ✗   ').padEnd(10)}${(p.category).padEnd(20)}${status}`
      );
    }
    console.log('\n🔥 Words to add to PHOTO_BANK to unlock T3 pairs:');
    const needed = new Set<string>();
    for (const p of t3) {
      if (!photoTargets.has(p.word1.toLowerCase())) needed.add(p.word1);
      if (!photoTargets.has(p.word2.toLowerCase())) needed.add(p.word2);
    }
    for (const w of needed) console.log(`  - ${w}`);
    console.log(`\nTotal unique words needed: ${needed.size}`);
    /* eslint-enable no-console */
  });
});
