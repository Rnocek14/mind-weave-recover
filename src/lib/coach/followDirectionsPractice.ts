/**
 * Follow Directions: eight distinct supported *practice* conditions.
 *
 * These are auditory-plus-optional-written comprehension activities.  A
 * successful touch is NOT an independent first-listen or clinical language
 * mastery score: replay, text, colors and visible targets may all help.
 */
export type DirectionLabel =
  | 'red circle' | 'blue square' | 'green triangle'
  | 'yellow star' | 'blue circle' | 'red square';
export type DirectionPracticeLevel = 1|2|3|4|5|6|7|8;
export type DirectionMode =
  'guided_one'|'heard_one'|'visible_two'|'heard_two'|
  'heard_three'|'temporal_relation'|'avoid_distractor'|'unfamiliar_four';

export interface DirectionPracticeStage {
  level: DirectionPracticeLevel;
  name: string;
  instructions: string;
  mode: DirectionMode;
  stepCount: number;
  boardSize: number;
  textInitiallyVisible: boolean;
  highlightFirst: boolean;
}

export interface DirectionPracticeTrial {
  id: string;
  text: string;
  steps: { action:'touch'; targetLabel:DirectionLabel }[];
  complexity: number;
  stage: DirectionPracticeLevel;
}

export const DIRECTION_LABELS: readonly DirectionLabel[] = [
  'red circle','blue square','green triangle','yellow star','blue circle','red square',
];

export const DIRECTION_PRACTICE_STAGES: readonly DirectionPracticeStage[] = [
  {level:1,name:'Find a guided shape',instructions:'Listen and touch the highlighted shape.',mode:'guided_one',stepCount:1,boardSize:2,textInitiallyVisible:true,highlightFirst:true},
  {level:2,name:'Listen for one shape',instructions:'Listen and find the named shape without a highlighted answer.',mode:'heard_one',stepCount:1,boardSize:4,textInitiallyVisible:true,highlightFirst:false},
  {level:3,name:'Follow two visible steps',instructions:'Listen, then touch two shapes in the given order. The words stay visible.',mode:'visible_two',stepCount:2,boardSize:4,textInitiallyVisible:true,highlightFirst:false},
  {level:4,name:'Remember two heard steps',instructions:'Listen for two steps. You can reveal the words if needed.',mode:'heard_two',stepCount:2,boardSize:6,textInitiallyVisible:false,highlightFirst:false},
  {level:5,name:'Remember three heard steps',instructions:'Listen for three shapes in order. There is no timer.',mode:'heard_three',stepCount:3,boardSize:6,textInitiallyVisible:false,highlightFirst:false},
  {level:6,name:'Understand before and after',instructions:'Listen for a before/after relation and touch the shapes in order.',mode:'temporal_relation',stepCount:3,boardSize:6,textInitiallyVisible:false,highlightFirst:false},
  {level:7,name:'Ignore the named distractor',instructions:'Follow the steps, and do not touch the distractor named in the instruction.',mode:'avoid_distractor',stepCount:3,boardSize:6,textInitiallyVisible:false,highlightFirst:false},
  {level:8,name:'New four-step directions',instructions:'Listen for four linked actions. Replay or read the words when needed.',mode:'unfamiliar_four',stepCount:4,boardSize:6,textInitiallyVisible:false,highlightFirst:false},
];

export function getDirectionPracticeStage(level:unknown):DirectionPracticeStage|null {
  return typeof level==='number'&&Number.isInteger(level)&&level>=1&&level<=8
    ? DIRECTION_PRACTICE_STAGES[level-1] : null;
}

/** Deterministic, distinct sequences: no target occurs twice in a direction. */
const PATHS: readonly (readonly number[])[] = [
  [0,1,2,3,4,5],
  [1,3,5,2,0,4],
  [2,5,1,4,3,0],
  [3,0,4,1,5,2],
  [4,2,3,5,0,1],
  [5,4,0,3,1,2],
  [1,2,4,0,5,3],
  [3,5,2,4,1,0],
];
function phrase(items:readonly DirectionLabel[]):string {
  if(items.length===1)return 'Touch the '+items[0]+'.';
  return 'Touch the '+items.slice(0,-1).join(', then the ')+', then the '+items[items.length-1]+'.';
}
export function buildDirectionPracticeTrials(
  stage:DirectionPracticeStage, requested:number,
):DirectionPracticeTrial[] {
  if(!Number.isFinite(requested)||requested<=0)return [];
  const count=Math.min(PATHS.length,Math.floor(requested));
  return Array.from({length:count},(_,i)=>{
    // Each successive trial begins with a different target, including
    // one-step stages. Rotating arbitrary prefixes used to repeat targets.
    const offset=PATHS[i].indexOf(i%DIRECTION_LABELS.length);
    const indices=PATHS[i].slice(offset).concat(PATHS[i].slice(0,offset));
    const labels=indices.slice(0,stage.stepCount).map(idx=>DIRECTION_LABELS[idx]);
    let text=phrase(labels);
    if(stage.mode==='temporal_relation') {
      text='Before touching the '+labels[2]+', touch the '+labels[0]+
        ', and then the '+labels[1]+'. Finish with the '+labels[2]+'.';
    } else if(stage.mode==='avoid_distractor'){
      const distractor=DIRECTION_LABELS.find(x=>!labels.includes(x))!;
      text='Do not touch the '+distractor+'. Instead touch the '+labels[0]+
        ', then the '+labels[1]+', and finally the '+labels[2]+'.';
    } else if(stage.mode==='unfamiliar_four'){
      text='First touch the '+labels[0]+'. After that touch the '+labels[1]+
        ', then the '+labels[2]+'. Finish with the '+labels[3]+'.';
    }
    return {
      id:'direction-practice-'+stage.level+'-'+i,
      text,steps:labels.map(targetLabel=>({action:'touch' as const,targetLabel})),
      complexity:labels.length,stage:stage.level,
    };
  });
}

/** Always show required targets; fill remaining slots with distinct distractors. */
export function getDirectionBoardLabels(
  stage:DirectionPracticeStage,trial:DirectionPracticeTrial,
):DirectionLabel[] {
  const required=trial.steps.map(x=>x.targetLabel);
  return [...required,...DIRECTION_LABELS.filter(x=>!required.includes(x))]
    .slice(0,Math.max(stage.boardSize,required.length));
}
