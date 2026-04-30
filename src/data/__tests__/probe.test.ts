import { describe, it } from 'vitest';
import { getFixSentenceTrials, FIX_SENTENCE_BANK } from '@/data/fixSentenceBank';

describe('probe', () => {
  it('print', () => {
    console.log('BANK tier counts:',
      FIX_SENTENCE_BANK.filter(t=>t.difficulty===1).length,
      FIX_SENTENCE_BANK.filter(t=>t.difficulty===2).length,
      FIX_SENTENCE_BANK.filter(t=>t.difficulty===3).length);
    const a = getFixSentenceTrials({ difficulty: 1, count: 10 });
    const b = getFixSentenceTrials({ difficulty: 3, count: 10 });
    console.log('L1 ids:', a.map(t=>`${t.id}(d${t.difficulty})`).join(','));
    console.log('L3 ids:', b.map(t=>`${t.id}(d${t.difficulty})`).join(','));
  });
});
