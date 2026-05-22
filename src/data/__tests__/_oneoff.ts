import { FIX_SENTENCE_BANK } from '@/data/fixSentenceBank';
import { MEANING_MATCH_ITEMS } from '@/data/meaningMatchItems';
import { PHONO_TRIALS } from '@/data/phonologicalBank';
import { SENTENCE_TRIALS } from '@/data/sentenceBank';
import { SEMANTIC_TRIALS } from '@/data/semanticFeatureBank';
import { DUAL_LOAD_SETS } from '@/data/dualLoadNamingStimuli';
import { SYNONYM_PROMPTS } from '@/data/synonymBank';
import { TWO_CLUES_PUZZLES } from '@/data/twoCluesBank';
import { DETECTIVE_CASES } from '@/data/detectiveMindCases';
import { PLANNING_ITEMS } from '@/data/multiStepPlanningStimuli';
import { MINIMAL_PAIRS } from '@/data/minimalPairsBank';
import { PHOTO_BANK, computePhotoTier } from '@/data/photoBank';

function bucket1to5(d:number){ return d<=2?1: d===3?2:3; }
function bucket1to10(d:number){ return d<=3?1: d<=7?2:3; }
function tally<T>(items: T[], get:(x:T)=>number){ const s={1:0,2:0,3:0} as any; for(const x of items){ s[get(x)]++; } return s as {1:number,2:number,3:number}; }

const rows: [string, {1:number,2:number,3:number}][] = [
  ['photo-naming', tally(PHOTO_BANK as any, (t:any)=> computePhotoTier(t))],
  ['fix-sentence', tally(FIX_SENTENCE_BANK, (t:any)=>t.difficulty)],
  ['meaning-match', tally(MEANING_MATCH_ITEMS, (t:any)=>t.tier)],
  ['phonological-awareness', tally(PHONO_TRIALS, (t:any)=>bucket1to5(t.difficulty))],
  ['sentence-construction', tally(SENTENCE_TRIALS as any[], (t:any)=>bucket1to10(t.difficulty))],
  ['semantic-features', tally(SEMANTIC_TRIALS, (t:any)=>bucket1to5(t.difficulty))],
  ['dual-load-naming', tally(DUAL_LOAD_SETS, (t:any)=>t.tier)],
  ['synonym-generator', tally(SYNONYM_PROMPTS, (t:any)=>t.difficulty)],
  ['two-clues', tally(TWO_CLUES_PUZZLES, (t:any)=>t.difficulty)],
  ['detective-mind', tally(DETECTIVE_CASES, (t:any)=>t.tier)],
  ['multi-step-plan', tally(PLANNING_ITEMS, (t:any)=>t.tier)],
  ['minimal-pairs', tally(MINIMAL_PAIRS, (t:any)=>t.difficulty)],
];

console.log('\nGAME                        T1    T2    T3   STATUS');
console.log('─'.repeat(60));
for(const [g,c] of rows){
  const min = Math.min(c[1],c[2],c[3]);
  const status = min < 15 ? '🔴 below floor' : min < 20 ? '⚠️  thin' : '✅ healthy';
  console.log(`${g.padEnd(28)}${String(c[1]).padStart(4)}  ${String(c[2]).padStart(4)}  ${String(c[3]).padStart(4)}   ${status} (min=${min})`);
}
