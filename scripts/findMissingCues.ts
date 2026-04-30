import { PHOTO_BANK } from '../src/data/photoBank';
import { cueBank } from '../src/data/cueBank';

const photoTargets = [...new Set(PHOTO_BANK.map(t => t.target.toLowerCase()))];
const missing = photoTargets.filter(t => !cueBank[t]);
console.log('Missing count:', missing.length);
console.log('Total photo targets:', photoTargets.length);
console.log('Total cueBank words:', Object.keys(cueBank).length);

const missingWithCat = missing.map(m => {
  const entry = PHOTO_BANK.find(p => p.target.toLowerCase() === m);
  return { target: m, category: entry?.category, semantic: entry?.features?.semantic_category, first: entry?.features?.first_phoneme, syl: entry?.features?.syllable_count };
});
console.log(JSON.stringify(missingWithCat, null, 2));
