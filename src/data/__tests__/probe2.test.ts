import { describe, it } from 'vitest';
import { DESCRIBE_GUESS_BANK } from '@/data/describeGuessBank';
import { PHOTO_BANK } from '@/data/photoBank';

describe('p', () => {
  it('print', () => {
    const valid = new Set(PHOTO_BANK.map((p:any)=>p.id));
    const remap: any = (DESCRIBE_GUESS_BANK as any[]); // already exported with PHOTO_ID_REMAP applied? no
    const counts: Record<number, number> = {1:0,2:0,3:0};
    let dropped = 0;
    for (const t of DESCRIBE_GUESS_BANK) {
      if (valid.has(t.photoBankId)) counts[t.difficulty] = (counts[t.difficulty] ?? 0) + 1;
      else dropped++;
    }
    console.log('VALID per tier:', counts, 'dropped:', dropped);
  });
});
