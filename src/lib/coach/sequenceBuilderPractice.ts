/**
 * Eight actual everyday ordering practice formats. No clinical recovery
 * thresholds or speech evidence: order accuracy is a practice observation.
 * The new-scene pool never silently falls back to familiar scenarios.
 */
export type SequencePracticeLevel=1|2|3|4|5|6|7|8;
export type SequencePracticeMode=
  'guided_pair'|'unguided_pair'|'three_with_hint'|'new_three'|
  'full_four'|'cause_and_order'|'choose_between_orders'|'new_four';
export interface SequenceItem {id:string;text:string}
export interface CauseQuestion {
  prompt:string;
  choices:readonly [string,string];
  correctIndex:0|1;
}
export interface SequencePracticeTrial {
  id:string;
  title:string;
  items:SequenceItem[];
  causeQuestion?:CauseQuestion;
}
export interface SequencePracticeStage {
  level:SequencePracticeLevel;
  label:string;
  instruction:string;
  mode:SequencePracticeMode;
  itemCount:2|3|4;
  pool:'familiar'|'novel';
  firstStepHint:boolean;
}
export const SEQUENCE_PRACTICE_STAGES:readonly SequencePracticeStage[]=[
  {level:1,label:'First and last with a model',instruction:'The first step is highlighted. Put two events in the right order.',mode:'guided_pair',itemCount:2,pool:'familiar',firstStepHint:true},
  {level:2,label:'Find the order',instruction:'Put two everyday events in order without the starting hint.',mode:'unguided_pair',itemCount:2,pool:'familiar',firstStepHint:false},
  {level:3,label:'Three connected steps',instruction:'Put three familiar steps in order. Ask for the first step if you need help.',mode:'three_with_hint',itemCount:3,pool:'familiar',firstStepHint:false},
  {level:4,label:'Three new everyday steps',instruction:'Put three steps from an unfamiliar everyday situation in order.',mode:'new_three',itemCount:3,pool:'novel',firstStepHint:false},
  {level:5,label:'Complete an everyday routine',instruction:'Arrange four steps to finish a practical task.',mode:'full_four',itemCount:4,pool:'familiar',firstStepHint:false},
  {level:6,label:'Order and explain a cause',instruction:'Put four steps in order, then answer one short question about why a step matters.',mode:'cause_and_order',itemCount:4,pool:'familiar',firstStepHint:false},
  {level:7,label:'Choose the better sequence',instruction:'Look at two possible four-step orders. Choose the one that makes sense.',mode:'choose_between_orders',itemCount:4,pool:'familiar',firstStepHint:false},
  {level:8,label:'Plan a new practical sequence',instruction:'Arrange four steps from an unfamiliar practical situation. Take your time.',mode:'new_four',itemCount:4,pool:'novel',firstStepHint:false},
];
export function getSequencePracticeStage(level:unknown):SequencePracticeStage|null {
  return typeof level==='number'&&Number.isInteger(level)&&level>=1&&level<=8
    ? SEQUENCE_PRACTICE_STAGES[level-1]:null;
}
const TASKS:readonly (SequencePracticeTrial&{pool:'familiar'|'novel'})[]=[
  {id:'breakfast',title:'Preparing oatmeal',pool:'familiar',items:[
    {id:'a',text:'Put oats into a pot'},
    {id:'b',text:'Add water to the oats'},
    {id:'c',text:'Cook the mixture until ready'},
    {id:'d',text:'Serve the oatmeal in a bowl'},
  ],causeQuestion:{prompt:'Why should the oatmeal be cooked before it is served?',
    choices:['So it is ready to eat','To make the bowl larger'],correctIndex:0}},
  {id:'mail-letter',title:'Mailing a letter',pool:'familiar',items:[
    {id:'a',text:'Write the message'},
    {id:'b',text:'Place the letter in an envelope'},
    {id:'c',text:'Write the delivery address'},
    {id:'d',text:'Put the envelope in a mailbox'},
  ],causeQuestion:{prompt:'Why is the address written before the letter is mailed?',
    choices:['So the letter can reach its destination','So the paper becomes thicker'],correctIndex:0}},
  {id:'plant-flower',title:'Planting a flower',pool:'familiar',items:[
    {id:'a',text:'Choose a suitable spot'},
    {id:'b',text:'Dig a small hole in the soil'},
    {id:'c',text:'Put the flower in the hole'},
    {id:'d',text:'Cover roots with soil and water'},
  ],causeQuestion:{prompt:'Why cover the roots after putting the flower in the hole?',
    choices:['To secure and protect the roots','To move the flower indoors'],correctIndex:0}},
  {id:'laundry',title:'Washing clothes',pool:'familiar',items:[
    {id:'a',text:'Collect the clothes to wash'},
    {id:'b',text:'Put them in the washer'},
    {id:'c',text:'Start the selected wash cycle'},
    {id:'d',text:'Remove the clean clothes'},
  ],causeQuestion:{prompt:'Why start the wash cycle before removing clean clothes?',
    choices:['The clothes need to be washed first','The washer needs a new shelf'],correctIndex:0}},
  {id:'library',title:'Borrowing a library book',pool:'novel',items:[
    {id:'a',text:'Find a book on the shelf'},
    {id:'b',text:'Take it to the checkout desk'},
    {id:'c',text:'Check it out with a library card'},
    {id:'d',text:'Carry the borrowed book home'},
  ]},
  {id:'video-call',title:'Starting a video call',pool:'novel',items:[
    {id:'a',text:'Choose the person to call'},
    {id:'b',text:'Start a video call'},
    {id:'c',text:'Wait for the person to answer'},
    {id:'d',text:'Greet the person on screen'},
  ]},
  {id:'picnic',title:'Going on a picnic',pool:'novel',items:[
    {id:'a',text:'Choose food for the picnic'},
    {id:'b',text:'Pack the food in a bag'},
    {id:'c',text:'Travel to the picnic spot'},
    {id:'d',text:'Sit down and unpack the food'},
  ]},
  {id:'postcard',title:'Sending a postcard',pool:'novel',items:[
    {id:'a',text:'Choose a postcard'},
    {id:'b',text:'Write a short message'},
    {id:'c',text:'Add an address and stamp'},
    {id:'d',text:'Put the postcard in a mailbox'},
  ]},
  {id:'rain-walk',title:'Preparing for a rainy walk',pool:'novel',items:[
    {id:'a',text:'Notice rain outside'},
    {id:'b',text:'Find a raincoat'},
    {id:'c',text:'Put on the raincoat'},
    {id:'d',text:'Go outside for the walk'},
  ]},
];
export function buildSequencePracticeTrials(
  stage:SequencePracticeStage,requested:number,
):SequencePracticeTrial[] {
  if(!Number.isFinite(requested)||requested<=0)return [];
  const eligible=TASKS.filter(task=>task.pool===stage.pool && (stage.mode!=='cause_and_order'||!!task.causeQuestion));
  return eligible.slice(0,Math.min(Math.floor(requested),eligible.length)).map(task=>({
    id:'sequence-stage-'+stage.level+'-'+task.id,
    title:task.title,
    items:task.items.slice(0,stage.itemCount).map(item=>({...item})),
    causeQuestion:stage.mode==='cause_and_order'?task.causeQuestion:undefined,
  }));
}
/** Exactly one correct, with a plausible adjacent-order mistake as distractor. */
export function buildSequenceAlternatives(trial:SequencePracticeTrial,index:number):{
  options:[SequenceItem[],SequenceItem[]]; correctIndex:0|1;
} {
  if(trial.items.length<3)throw new Error('Order comparison needs three or more steps.');
  const right=trial.items.map(x=>({...x}));
  const wrong=right.map(x=>({...x}));
  [wrong[1],wrong[2]]=[wrong[2],wrong[1]];
  return index%2===0
    ?{options:[right,wrong],correctIndex:0}
    :{options:[wrong,right],correctIndex:1};
}
export function scoreSequenceOrder(
  observed:readonly SequenceItem[],target:readonly SequenceItem[],
):{correct:boolean;positionAccuracy:number} {
  if(target.length===0||observed.length!==target.length)return {correct:false,positionAccuracy:0};
  const count=target.reduce((n,item,i)=>n+(item.id===observed[i]?.id?1:0),0);
  return {correct:count===target.length,positionAccuracy:count/target.length};
}
