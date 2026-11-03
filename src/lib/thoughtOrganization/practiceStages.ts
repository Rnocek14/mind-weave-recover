/**
 * Thought Organization: eight distinct functional-cognition *practice*
 * formats. None defines or advances a clinical recovery level. Choice and
 * ordering exercises can be objectively marked as practice; open discourse
 * always requires human review and is never auto-marked as correct.
 */
export type ThoughtOrganizationLevel = 1|2|3|4|5|6|7|8;
export type ThoughtOrganizationMode =
  'identify_main_idea'|'first_then_next'|'beginning_middle_end'|
  'cause_consequence'|'personal_event_outline'|'essential_vs_extra'|
  'stay_on_topic'|'novel_explanation';

export interface ThoughtOrganizationStage {
  level:ThoughtOrganizationLevel;
  mode:ThoughtOrganizationMode;
  title:string;
  instruction:string;
  audioHint:string;
}
export const THOUGHT_ORGANIZATION_STAGES:readonly ThoughtOrganizationStage[]=[
  {level:1,mode:'identify_main_idea',title:'Find the main idea',
    instruction:'Listen to an everyday situation. Choose what it is mainly about.',
    audioHint:'Think: what is the one big idea?'},
  {level:2,mode:'first_then_next',title:'What comes first?',
    instruction:'Listen to a plan. Choose which idea should come first and what follows.',
    audioHint:'Think: before and after.'},
  {level:3,mode:'beginning_middle_end',title:'Organize three ideas',
    instruction:'Arrange the beginning, middle and ending of a short event.',
    audioHint:'Start with the beginning.'},
  {level:4,mode:'cause_consequence',title:'Explain what caused it',
    instruction:'Choose the connection between what happened and why.',
    audioHint:'Think about the reason and what happened next.'},
  {level:5,mode:'personal_event_outline',title:'Tell a personal event',
    instruction:'Share an everyday event with a beginning, middle and ending.',
    audioHint:'You can say what happened in your own words. There is no single right answer.'},
  {level:6,mode:'essential_vs_extra',title:'Keep important details',
    instruction:'Find the two details that belong to the main idea. Ignore unrelated details.',
    audioHint:'Which details really matter to this idea?'},
  {level:7,mode:'stay_on_topic',title:'Answer a follow-up question',
    instruction:'Respond to a second person about the same topic using your own words.',
    audioHint:'Try to answer the question and stay with the topic.'},
  {level:8,mode:'novel_explanation',title:'Explain a new practical situation',
    instruction:'Explain a new situation: the problem, a possible plan and why it might work.',
    audioHint:'One idea at a time. Ask for help whenever needed.'},
];
export function getThoughtOrganizationStage(value:unknown):ThoughtOrganizationStage|null{
  return typeof value==='number' && Number.isInteger(value)&&value>=1&&value<=8
    ? THOUGHT_ORGANIZATION_STAGES[value-1]:null;
}
interface TrialBase {
  id:string;
  prompt:string;
  guidance:string;
  title:string;
}
export interface ChoiceTrial extends TrialBase{
  kind:'choice';
  options:readonly [string,string];
  correctIndex:0|1;
}
export interface OrderTrial extends TrialBase{
  kind:'order';
  ordered:readonly [string,string,string];
}
export interface RelevanceTrial extends TrialBase{
  kind:'relevance';
  options:readonly [string,string,string,string];
  correctIndices:readonly [number,number];
}
export interface OpenTrial extends TrialBase{
  kind:'open';
  prompts:readonly string[];
}
export type ThoughtOrganizationTrial=ChoiceTrial|OrderTrial|RelevanceTrial|OpenTrial;
type Bank=Readonly<Record<ThoughtOrganizationLevel,readonly ThoughtOrganizationTrial[]>>;
export const THOUGHT_ORGANIZATION_BANK:Bank={
  1:[
    {kind:'choice',id:'main-groceries',title:'At the market',
      prompt:'A person needs milk, eggs and apples. They write a list before going out.',
      guidance:'What is this mainly about?',options:['Planning grocery shopping','Fixing a broken car'],correctIndex:0},
    {kind:'choice',id:'main-family',title:'A family visit',
      prompt:'Three relatives plan to visit their grandmother and bring lunch on Sunday.',
      guidance:'What is the big idea?',options:['A family visit','A doctor appointment'],correctIndex:0},
    {kind:'choice',id:'main-garden',title:'The garden',
      prompt:'Someone waters plants, removes weeds and picks vegetables every morning.',
      guidance:'What are these details about?',options:['Taking a train','Caring for a garden'],correctIndex:1},
  ],
  2:[
    {kind:'choice',id:'order-mail',title:'Mail a letter',
      prompt:'A letter needs to be sent to a friend.',
      guidance:'Choose what should happen first and next.',
      options:['Write the letter, then send it','Send the letter, then write it'],correctIndex:0},
    {kind:'choice',id:'order-breakfast',title:'Make breakfast',
      prompt:'A person wants toast in the morning.',
      guidance:'Which order is useful?',options:['Eat the toast, then make it','Make the toast, then eat it'],correctIndex:1},
    {kind:'choice',id:'order-bus',title:'Catch the bus',
      prompt:'A person needs to take the bus across town.',
      guidance:'What happens first?',options:['Get on the bus, then go to the stop','Go to the stop, then get on the bus'],correctIndex:1},
  ],
  3:[
    {kind:'order',id:'bme-visitor',title:'Welcome a visitor',
      prompt:'Put this short visit into beginning, middle and ending.',
      guidance:'Which happened first, next and last?',
      ordered:['Someone knocks at the door','The host invites them inside','The visitor says goodbye']},
    {kind:'order',id:'bme-food',title:'Prepare lunch',
      prompt:'Organize the main events of a simple lunch.',
      guidance:'Think beginning, middle and ending.',
      ordered:['Choose something to eat','Prepare the lunch','Sit down and eat']},
    {kind:'order',id:'bme-rain',title:'An unexpected shower',
      prompt:'Put these events into order.',
      guidance:'What caused the change in the plan?',
      ordered:['Clouds cover the sky','Rain begins to fall','People go inside']},
  ],
  4:[
    {kind:'choice',id:'cause-rain',title:'Rainy afternoon',
      prompt:'Heavy rain began during an outdoor picnic. The family moved inside.',
      guidance:'Which explanation makes sense?',
      options:['They went inside because of the rain','They went inside because the chairs were blue'],correctIndex:0},
    {kind:'choice',id:'cause-lost',title:'Finding the keys',
      prompt:'The keys were missing. Sam checked the place where he usually leaves them.',
      guidance:'Why did Sam check that place?',
      options:['He wanted to buy new shoes','He thought the keys might be there'],correctIndex:1},
    {kind:'choice',id:'cause-late',title:'A late appointment',
      prompt:'The road was closed, so the driver used another street.',
      guidance:'Why did the driver change the route?',
      options:['The usual road was blocked','The driver forgot the destination'],correctIndex:0},
  ],
  5:[
    {kind:'open',id:'personal-breakfast',title:'Your morning',
      prompt:'Tell someone about a familiar part of your morning.',
      guidance:'Try the beginning, what you did next and how it ended.',
      prompts:['How did it start?','What did you do?','What happened afterward?']},
    {kind:'open',id:'personal-visit',title:'A visit you remember',
      prompt:'Share a short memory of visiting someone or welcoming a visitor.',
      guidance:'Tell the who, what happened and the ending.',
      prompts:['Who was there?','What happened?','How did it end?']},
    {kind:'open',id:'personal-hobby',title:'Something you enjoy',
      prompt:'Describe a time you enjoyed an activity.',
      guidance:'Use a beginning, middle and ending in your own words.',
      prompts:['What did you plan?','What did you do?','How did you feel afterward?']},
  ],
  6:[
    {kind:'relevance',id:'detail-doctor',title:'A medical appointment',
      prompt:'A person needs to describe why they came to a medical appointment.',
      guidance:'Choose the two details that matter to explaining the appointment.',
      options:['The concern began this week','The waiting room has blue chairs','A symptom changes when walking','A neighbor has a new dog'],correctIndices:[0,2]},
    {kind:'relevance',id:'detail-trip',title:'A travel delay',
      prompt:'Someone is explaining why their trip was late.',
      guidance:'Select two useful facts for this explanation.',
      options:['The train departed 30 minutes late','They like the color yellow','They missed a planned connection','Their cousin owns a bicycle'],correctIndices:[0,2]},
    {kind:'relevance',id:'detail-dinner',title:'A late dinner',
      prompt:'A person is telling their family why dinner will be late.',
      guidance:'Which two facts explain the delay?',
      options:['The pan was dirty','The cook got home late','The kitchen has green walls','The stove needed time to heat up'],correctIndices:[1,3]},
  ],
  7:[
    {kind:'open',id:'follow-up-dinner',title:'Making dinner plans',
      prompt:'Your friend says: "We could eat at home or go out." They ask: "Which would you prefer, and why?"',
      guidance:'Answer the question about dinner, using your own words.',
      prompts:['Choose one option','Say why you prefer it']},
    {kind:'open',id:'follow-up-weather',title:'Changing a walk',
      prompt:'Someone says: "The weather may turn rainy." They ask: "Should we change our walk?"',
      guidance:'Tell the other person what you think and why.',
      prompts:['Give your suggestion','Explain why']},
    {kind:'open',id:'follow-up-visit',title:'A visitor arriving',
      prompt:'Your family says: "Our guest will arrive early." They ask: "What should we do first?"',
      guidance:'Respond with a practical first step.',
      prompts:['Name the first step','Add one reason if you can']},
  ],
  8:[
    {kind:'open',id:'novel-library',title:'A new situation at the library',
      prompt:'The library has changed its opening time. A friend wants to return a book before leaving town. Explain what the problem is and suggest a plan.',
      guidance:'Use your own ideas. This response needs human review.',
      prompts:['What changed?','What could your friend do?','Why might that work?']},
    {kind:'open',id:'novel-neighbors',title:'A shared community space',
      prompt:'Two neighbors want to use the community room at the same time for different activities. Suggest a fair plan and explain it.',
      guidance:'Say the problem, your idea and a reason.',
      prompts:['What is the problem?','What is a fair plan?','Why is it fair?']},
    {kind:'open',id:'novel-meeting',title:'A changed appointment',
      prompt:'Someone moves an important appointment to a busy afternoon. Explain two ways to handle the schedule and which seems better.',
      guidance:'Try to compare a plan and a backup.',
      prompts:['What changed?','What could they do?','Why choose that plan?']},
  ],
};
export function getThoughtOrganizationTrials(
  stage:ThoughtOrganizationStage,count:number,
):ThoughtOrganizationTrial[]{
  if(!Number.isSafeInteger(count)||count<1)return [];
  return THOUGHT_ORGANIZATION_BANK[stage.level].slice(0,count);
}
export function evaluateThoughtOrganizationResponse(
  task:ThoughtOrganizationTrial, answer:{
    choiceIndex?:number;order?:readonly string[];selectedIndices?:readonly number[];
  },
):{correct:boolean|null;practiceAccuracy:number|null}{
  if(task.kind==='choice')return {
    correct:answer.choiceIndex===task.correctIndex,
    practiceAccuracy:answer.choiceIndex===task.correctIndex?1:0,
  };
  if(task.kind==='order'){
    const ordered=answer.order??[];
    if(ordered.length!==task.ordered.length)
      return {correct:false,practiceAccuracy:0};
    const matched=task.ordered.filter((item,i)=>item===ordered[i]).length;
    return {correct:matched===task.ordered.length,
      practiceAccuracy:matched/task.ordered.length};
  }
  if(task.kind==='relevance'){
    const selected=answer.selectedIndices??[];
    const unique=new Set(selected);
    if(unique.size!==selected.length || selected.some(x=>!Number.isSafeInteger(x)||x<0||x>=task.options.length))
      return {correct:false,practiceAccuracy:0};
    const matched=selected.filter(x=>task.correctIndices.includes(x)).length;
    const falseMatches=selected.length-matched;
    const accuracy=Math.max(0,(matched-falseMatches)/task.correctIndices.length);
    return {correct:matched===task.correctIndices.length && falseMatches===0,
      practiceAccuracy:accuracy};
  }
  // Never infer clinical truth, coherent discourse, or functional transfer
  // from length or keyword matching of a self-reported open response.
  return {correct:null,practiceAccuracy:null};
}
