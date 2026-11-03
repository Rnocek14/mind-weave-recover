/**
 * Describe & Guess: eight genuine, nonclinical practice conditions.
 *
 * Existing 1–3 behavior is retained. Levels 4–8 add targeted description
 * tasks, support fading and a reserved new-listener situation set. None of
 * this sets clinical promotion criteria or changes the guess engine's score.
 */
import {
  getDescribeGuessTrials, type DescribeGuessTrial, type FeatureType,
} from '@/data/describeGuessBank';
import { detectSpokenDimensions } from '@/lib/describeGuess/coverageGuess';

export type DescribeTrainingLevel=1|2|3|4|5|6|7|8;
export type DescribeTrainingMode=
  'full_feature_model'|'starting_clues'|'harder_picture'|'function_and_place'|
  'look_and_material'|'three_features'|'avoid_the_name'|'new_listener';

export interface DescribeGuessTrainingStage {
  level:DescribeTrainingLevel;
  label:string;
  instruction:string;
  mode:DescribeTrainingMode;
  itemTier:1|2|3;
  /** Number of EXTRA feature chips above the default two. */
  initialVisiblePrompts:0|3;
  /** Do not automatically offer chips: an explicit Help button restores them. */
  hideAutomaticPrompts?:boolean;
  /** Optional nonclinical response observations: no score thresholds changed. */
  requiredFeatures:readonly FeatureType[];
  /** An expressive description, not a direct label, is the goal. */
  prohibitNaming?:boolean;
  /** Different daily-life prompts on a reserved subset of tier-3 items. */
  situational?:boolean;
}
const STAGES:Readonly<Record<DescribeTrainingLevel,DescribeGuessTrainingStage>>={
  1:{level:1,label:'Describe with full feature help',
    instruction:'Tell what you know about this familiar object. The feature questions can help.',
    mode:'full_feature_model',itemTier:1,initialVisiblePrompts:3,requiredFeatures:[]},
  2:{level:2,label:'Describe with fewer starting clues',
    instruction:'Describe this familiar object using your own words. Ask the feature questions if needed.',
    mode:'starting_clues',itemTier:1,initialVisiblePrompts:0,requiredFeatures:[]},
  3:{level:3,label:'Describe a more challenging picture',
    instruction:'Explain what you see in the picture. Use a clue if you need one.',
    mode:'harder_picture',itemTier:2,initialVisiblePrompts:0,requiredFeatures:[]},
  4:{level:4,label:'Say what it does and where it belongs',
    instruction:'Describe how someone could use this, and where they might find it.',
    mode:'function_and_place',itemTier:2,initialVisiblePrompts:0,
    requiredFeatures:['function','location']},
  5:{level:5,label:'Explain how it looks and what it is made of',
    instruction:'Describe its appearance and what it might be made from.',
    mode:'look_and_material',itemTier:3,initialVisiblePrompts:0,
    requiredFeatures:['appearance','material']},
  6:{level:6,label:'Connect three useful details',
    instruction:'Give three different clues: its use, its appearance and what kind of thing it is.',
    mode:'three_features',itemTier:3,initialVisiblePrompts:0,
    hideAutomaticPrompts:true,requiredFeatures:['function','appearance','category']},
  7:{level:7,label:'Explain without naming the object',
    instruction:'Help a listener understand by describing its use, place and type. Do not say its name.',
    mode:'avoid_the_name',itemTier:3,initialVisiblePrompts:0,
    hideAutomaticPrompts:true,prohibitNaming:true,
    requiredFeatures:['function','location','category']},
  8:{level:8,label:'Help a new listener in an everyday situation',
    instruction:'Imagine someone cannot see the picture. Explain it with several useful details without saying its name.',
    mode:'new_listener',itemTier:3,initialVisiblePrompts:0,
    hideAutomaticPrompts:true,prohibitNaming:true,situational:true,
    requiredFeatures:['function','appearance','category']},
};

/** Author-edited situational prompts use existing, available photographed targets. */
const SITUATIONS:Readonly<Record<string,string>>={
  dg_pillow:'Someone needs to rest comfortably after a long day. Describe what they should look for, without using its name.',
  dg_puzzle:'A friend wants a quiet table activity with pieces to fit together. Explain what to look for without naming it.',
  dg_candle:'Someone wants a small object that gives a soft glow during dinner. Describe it without naming it.',
  dg_bicycle:'A neighbor wants to travel a short distance without a car. Describe the object they might use without naming it.',
  dg_window:'A visitor wants to see outside from inside a room. Describe what to look through without saying its name.',
  dg_ladder:'A person needs to reach a high shelf. Explain what kind of equipment could help without naming it.',
  dg_mirror:'A visitor wants to check how their clothes look before leaving. Describe what could help without naming it.',
  dg_envelope:'Someone has written a letter and needs to send it. Describe what can hold the letter without using its name.',
  dg_calendar:'A friend wants to remember a coming appointment. Describe an item they could use without saying its name.',
};
export const DESCRIBE_NEW_LISTENER_IDS=Object.freeze(Object.keys(SITUATIONS));

export function getDescribeGuessTrainingStage(
  level:number|null|undefined,
):DescribeGuessTrainingStage|null {
  return level != null && Number.isInteger(level) && level>=1 && level<=8
    ? STAGES[level as DescribeTrainingLevel] : null;
}
export function getDescribeGuessStagePrompt(
  stage:DescribeGuessTrainingStage,
  trial:DescribeGuessTrial|null|undefined,
):string {
  return stage.situational && trial ? (SITUATIONS[trial.id]??stage.instruction):stage.instruction;
}

/** Never silently pad a selected practice level with easier targets. */
export function getDescribeGuessStageTrials(
  stage:DescribeGuessTrainingStage,count:number,
):DescribeGuessTrial[] {
  if(!Number.isSafeInteger(count)||count<1)return [];
  const engineDifficulty=stage.itemTier===1?1:stage.itemTier===2?5:9;
  // Stage 8 has a dedicated situation pool. Fetch enough real tier-3
  // candidates to ensure the selected subset exists, then strictly filter.
  // This is still the existing photographed object bank, not new photos.
  const candidates=getDescribeGuessTrials({
    difficulty:engineDifficulty,count:stage.situational?100:count,
  }).filter(t=>t.difficulty===stage.itemTier);
  return (stage.situational
    ? candidates.filter(t=>Object.prototype.hasOwnProperty.call(SITUATIONS,t.id)) : candidates
  ).slice(0,count);
}

/**
 * Practice-goal evidence is lexical keyword coverage of the patient's
 * response. It is NOT an independent speech score, validated discourse
 * adequacy rating, or evidence that the listener understood the message.
 */
export function assessDescribeGuessPracticeGoal(args:{
  stage:DescribeGuessTrainingStage;
  trial:DescribeGuessTrial;
  response:string;
}):{
  observedFeatures:FeatureType[];
  missingFeatures:FeatureType[];
  targetNamed:boolean;
  goalObserved:boolean;
}{
  const {stage,trial,response}=args;
  const observedFeatures=detectSpokenDimensions(response,trial);
  const missingFeatures=stage.requiredFeatures.filter(x=>!observedFeatures.includes(x));
  const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const text=' '+normalize(response)+' ';
  const targetNamed=[trial.target,...trial.acceptedWords].some(label=>{
    const phrase=normalize(label);
    return phrase.length>0&&text.includes(' '+phrase+' ');
  });
  return {
    observedFeatures,missingFeatures,targetNamed,
    goalObserved:stage.requiredFeatures.length>0 && missingFeatures.length===0 &&
      (!stage.prohibitNaming||!targetNamed),
  };
}
