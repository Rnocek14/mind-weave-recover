import { describe, it } from 'vitest';
import { getDescribeGuessTrials, DESCRIBE_GUESS_BANK } from '@/data/describeGuessBank';

describe('probe2', () => {
  it('print', () => {
    const t1 = DESCRIBE_GUESS_BANK.filter(t => t.difficulty === 1).length;
    const t2 = DESCRIBE_GUESS_BANK.filter(t => t.difficulty === 2).length;
    const t3 = DESCRIBE_GUESS_BANK.filter(t => t.difficulty === 3).length;
    console.log(`bank tiers: 1=${t1} 2=${t2} 3=${t3}`);
    const r = getDescribeGuessTrials({ difficulty: 10, count: 8 });
    const dist: Record<number, number> = {};
    for (const x of r) dist[x.difficulty] = (dist[x.difficulty] ?? 0) + 1;
    console.log('L10 result:', JSON.stringify(dist), 'n=', r.length);
    console.log('ids:', r.map(x => `${x.id}(d${x.difficulty})`).join(','));
  });
});
