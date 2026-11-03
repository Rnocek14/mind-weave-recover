/**
 * Conversation Partner / Conversation Coach: eight distinct *nonclinical*
 * scripted, two-turn practice formats each. The scripted partner is explicit;
 * it never pretends to understand the patient's open speech, and these are
 * not real-world conversation transfer or validated mastery measurements.
 *
 * The legacy live AI coach/partner flows are unchanged. This material powers
 * a caregiver-selectable alternate practice mode with human-reviewed output.
 */
export type ConversationPracticeKind = 'conversation-partner' | 'conversation-coach';
export type ConversationPracticeLevel = 1|2|3|4|5|6|7|8;
export type ConversationPracticeTurnType = 'reply'|'detail'|'ask'|'rephrase'|'repair'|'adapt';
interface BaseTurn {
  id: string;
  /** Fixed scripted line, not an AI response generated from patient speech. */
  mayaPrompt: string;
  clue: string;
  skill: ConversationPracticeTurnType;
}
export interface ChoiceTurn extends BaseTurn {
  kind: 'choice';
  options: readonly [string,string];
  bestChoice: 0|1;
}
export interface OpenTurn extends BaseTurn {
  kind: 'open';
  /** Only spoken before patient response for deliberately modeled tasks. */
  model?: string;
}
export type ConversationPracticeTurn = ChoiceTurn | OpenTurn;

export interface ConversationPracticeScene {
  id: string;
  title: string;
  situation: string;
  turns: readonly [ConversationPracticeTurn, ConversationPracticeTurn];
}
export interface ConversationPracticeStage {
  level: ConversationPracticeLevel;
  title: string;
  goal: string;
  instruction: string;
  /** The patient's actual words are NOT graded on this axis. */
  practiceOnly: true;
}

export const CONVERSATION_PRACTICE_STAGES: Readonly<Record<ConversationPracticeKind, readonly ConversationPracticeStage[]>> = {
  'conversation-partner': [
    {level:1,title:'Answer a greeting',goal:'Recognize two familiar conversational responses',instruction:'Listen. Choose a response.',practiceOnly:true},
    {level:2,title:'Answer familiar questions',goal:'Respond to simple connected questions without a word-count target',instruction:'Listen to two questions about one topic.',practiceOnly:true},
    {level:3,title:'Add a detail',goal:'Give a short answer and add information when asked',instruction:'Choose an answer. Then add a detail in your own words.',practiceOnly:true},
    {level:4,title:'Stay on one topic',goal:'Sustain a topic across two open conversational turns',instruction:'Talk about one familiar subject for two turns.',practiceOnly:true},
    {level:5,title:'Ask for clarification',goal:'Request clarification when a conversational message is incomplete',instruction:'Ask what you need to know. Then respond.',practiceOnly:true},
    {level:6,title:'Take a turn and ask',goal:'Initiate a related question, not only answer one',instruction:'Ask a question. Then respond to a scripted reply.',practiceOnly:true},
    {level:7,title:'Repair a misunderstanding',goal:'Clarify or restate a message after a communication breakdown',instruction:'Try correcting a misunderstanding politely.',practiceOnly:true},
    {level:8,title:'Manage a new conversation',goal:'Handle a novel everyday exchange with an unexpected change',instruction:'Try two connected turns in an unfamiliar situation.',practiceOnly:true},
  ],
  'conversation-coach': [
    {level:1,title:'Hear and rehearse a useful phrase',goal:'Practice a full-modeled everyday request, then try it in a response',instruction:'Hear a useful phrase. Say or type your own response.',practiceOnly:true},
    {level:2,title:'Choose and use a request',goal:'Identify a helpful request, then rehearse the same intention',instruction:'Choose a phrase. Then try saying it yourself.',practiceOnly:true},
    {level:3,title:'Use a clue to make a request',goal:'Form a familiar functional request with a semantic prompt',instruction:'Listen to the situation. Try asking for what you need.',practiceOnly:true},
    {level:4,title:'Make the request without a model',goal:'Initiate an unmodeled request and confirm an important detail',instruction:'Make your own request. Then confirm a detail.',practiceOnly:true},
    {level:5,title:'Explain the missing word',goal:'Communicate with a description when a particular word is stuck',instruction:'Describe what you mean. Then add a helpful detail.',practiceOnly:true},
    {level:6,title:'Change the situation',goal:'Rehearse a function and use it in a changed simulated context',instruction:'Try a request, then try it with a changed person or place.',practiceOnly:true},
    {level:7,title:'Repair the conversation',goal:'Maintain a meaningful request when the simulated listener misunderstands',instruction:'Explain the problem. Then clarify the misunderstanding.',practiceOnly:true},
    {level:8,title:'Try an unfamiliar practical exchange',goal:'Adapt a useful message after a new constraint changes the situation',instruction:'Make a plan. Then respond to a change.',practiceOnly:true},
  ],
};

const C=(id:string,mayaPrompt:string,options:readonly [string,string],bestChoice:0|1,clue:string,skill:ConversationPracticeTurnType='reply'):ChoiceTurn =>
  ({id,mayaPrompt,options,bestChoice,clue,skill,kind:'choice'});
const O=(id:string,mayaPrompt:string,clue:string,skill:ConversationPracticeTurnType='reply',model?:string):OpenTurn =>
  ({id,mayaPrompt,clue,skill,model,kind:'open'});
const S=(id:string,title:string,situation:string,first:ConversationPracticeTurn,second:ConversationPracticeTurn):ConversationPracticeScene =>
  ({id,title,situation,turns:[first,second]});
type Bank = Readonly<Record<ConversationPracticeLevel, readonly [ConversationPracticeScene,ConversationPracticeScene]>>;

const PARTNER_BANK:Bank={
  1:[
    S('cp-greet-door','At the door','Maya plays a neighbor arriving at your home.',
      C('cp-greet-door-1','Hello! How are you?',['I am doing okay, thanks.','The window is yellow.'],0,'You can greet the person and say how you feel.'),
      C('cp-greet-door-2','It is good to see you. May I come in?',['Yes, please come in.','Pencils swim in lakes.'],0,'Respond to what the visitor asked.')),
    S('cp-greet-store','At the store','Maya plays someone you know at the store.',
      C('cp-greet-store-1','Hi there! Good to see you.',['Good to see you too.','Sixteen is the color green.'],0,'A greeting can be short.'),
      C('cp-greet-store-2','Are you finding everything you need?',['Yes, thank you.','The moon wears a coat.'],0,'Answer the question about shopping.')),
  ],
  2:[
    S('cp-simple-breakfast','Breakfast chat','Maya asks about an everyday meal.',
      C('cp-simple-breakfast-1','Would you like toast or cereal?',['I would like toast.','The car is swimming.'],0,'Choose one breakfast food.'),
      C('cp-simple-breakfast-2','Would you like coffee or water with that?',['A bicycle, please.','Water would be nice.'],1,'Choose a drink.')),
    S('cp-simple-weather','Planning a walk','Maya talks about the weather.',
      C('cp-simple-weather-1','It looks cold outside. Do we need a coat?',['Yes, a coat would help.','The table is dreaming.'],0,'Answer about the cold weather.'),
      C('cp-simple-weather-2','Should we walk now or after lunch?',['Let us walk after lunch.','The train is a pillow.'],0,'Choose a time for the walk.')),
  ],
  3:[
    S('cp-detail-garden','Talking about a garden','Maya asks about a familiar activity.',
      C('cp-detail-garden-1','Do you like looking after plants?',['Yes, I enjoy plants.','Shoes are clouds.'],0,'Answer the question first.'),
      O('cp-detail-garden-2','What do you enjoy doing in the garden?','You can name an activity, like watering plants.','detail')),
    S('cp-detail-hobby','Talking about hobbies','Maya asks about free time.',
      C('cp-detail-hobby-1','Do you enjoy a quiet activity at home?',['Yes, I do.','An umbrella has dreams.'],0,'Give a short answer.'),
      O('cp-detail-hobby-2','Tell me one thing you like doing and why.','You can describe a familiar hobby.','detail')),
  ],
  4:[
    S('cp-topic-family','A family conversation','Maya is a friend asking about family.',
      O('cp-topic-family-1','What is something you like doing with family?','An activity, person or place is a useful start.'),
      O('cp-topic-family-2','Tell me a little more about that activity.','Add where, when or who was involved.','detail')),
    S('cp-topic-weekend','Weekend plans','Maya is a friend making weekend plans.',
      O('cp-topic-weekend-1','What would you like to do this weekend?','Choose one activity to talk about.'),
      O('cp-topic-weekend-2','Who might you do that with?','Answer on the same subject.','detail')),
  ],
  5:[
    S('cp-clarify-visit','A visit with missing details','Maya proposes meeting but leaves out a key detail.',
      O('cp-clarify-visit-1','Let us meet tomorrow. What would you like to ask me?','Try asking what time or where.','ask'),
      O('cp-clarify-visit-2','I was thinking of meeting at three. What else would you want to know?','You could ask for the place or confirm the time.','ask')),
    S('cp-clarify-delivery','A delivery message','Maya leaves out a piece of information.',
      O('cp-clarify-delivery-1','Your delivery will arrive on Friday. Is there anything you want to ask?','You can ask what time or how to receive it.','ask'),
      O('cp-clarify-delivery-2','The delivery person may need a signature. What would you say?','Ask whether someone must be home.','ask')),
  ],
  6:[
    S('cp-initiate-recipe','Asking about a recipe','Maya is a friend who cooked a meal.',
      O('cp-initiate-recipe-1','I made soup today. Ask me a question about it.','You could ask what ingredients I used.','ask'),
      O('cp-initiate-recipe-2','It has vegetables and beans. What would you say next?','You can ask a new question or respond to my answer.','detail')),
    S('cp-initiate-trip','Asking about a trip','Maya is a friend who just got back from a trip.',
      O('cp-initiate-trip-1','I just returned from a trip. Ask me something about it.','Maybe ask where I went.','ask'),
      O('cp-initiate-trip-2','I visited my sister for the weekend. What would you ask or say?','You can ask what we did or share a reaction.','ask')),
  ],
  7:[
    S('cp-repair-dinner','Wrong dinner plan','Maya misunderstands a dinner arrangement.',
      O('cp-repair-dinner-1','I thought you said dinner was at six, but I might have heard wrong. Can you clarify?','You can restate a time or ask me to confirm.','repair'),
      O('cp-repair-dinner-2','I heard six o’clock. Could you say the plan another way?','Repeat slowly or add a time and place.','rephrase')),
    S('cp-repair-item','Wrong item','Maya thinks you need a different item.',
      O('cp-repair-item-1','I thought you asked for the TV remote, but maybe you meant your phone. Please explain.','You can name, describe or point to the item.','repair'),
      O('cp-repair-item-2','I am not sure I understood. What does that item do?','Describe its purpose.','rephrase')),
  ],
  8:[
    S('cp-novel-meeting','An unexpected schedule change','Maya is a colleague changing plans unexpectedly.',
      O('cp-novel-meeting-1','Our community meeting moved from Thursday to Friday. Friday is difficult for you. What would you say?','Explain the conflict and ask about options.','adapt'),
      O('cp-novel-meeting-2','I cannot change Friday, but I can send notes. What would you suggest next?','Ask a question, propose a backup or explain a need.','adapt')),
    S('cp-novel-travel','A route change','Maya is a station worker helping with travel.',
      O('cp-novel-travel-1','The usual train is not running today. Tell me what you need to know.','You can ask about another route or time.','ask'),
      O('cp-novel-travel-2','The next bus leaves later but takes you downtown. How would you respond?','Confirm the destination, time or another option.','adapt')),
  ],
};

const COACH_BANK:Bank={
  1:[
    S('cc-model-water','Ask for water','Maya is a coach demonstrating a useful request.',
      O('cc-model-water-1','Listen to the model, then try asking for a drink.','A short request is enough.','reply','May I have some water, please?'),
      O('cc-model-water-2','Now imagine a friend can help. Ask for some water again.','Say it in your own way.','reply','Could I have some water, please?')),
    S('cc-model-help','Ask for help','Maya is a coach demonstrating how to request assistance.',
      O('cc-model-help-1','Listen to this request, then try your own.','You can ask politely.','reply','Can you help me, please?'),
      O('cc-model-help-2','Now ask someone nearby for help with a door.','Use a short request.','reply','Could you help me open the door?')),
  ],
  2:[
    S('cc-choice-repeat','Ask for a seat','Maya helps you choose a useful message.',
      C('cc-choice-repeat-1','You need to sit down. Which request fits?',['May I sit here?','There is a mountain outside.'],0,'Choose a clear request.'),
      O('cc-choice-repeat-2','Now ask for a seat in your own words.','You can say: May I sit here?','reply')),
    S('cc-choice-directions','Ask where to go','Maya helps you choose a useful question.',
      C('cc-choice-directions-1','You cannot find the front desk. Which question helps?',['The clock is square.','Where is the front desk?'],1,'Ask about the location.'),
      O('cc-choice-directions-2','Now ask for the front desk without looking at a full model.','Say what you need to find.','reply')),
  ],
  3:[
    S('cc-cue-coat','Ask for a coat','Maya describes a familiar situation.',
      O('cc-cue-coat-1','You are cold, and your coat is across the room. Ask a friend for it.','Ask for the thing that keeps you warm.'),
      O('cc-cue-coat-2','Your friend asks which coat you mean. Describe it.','Add a color or where it is hanging.','detail')),
    S('cc-cue-light','Ask about the light','Maya describes a familiar need.',
      O('cc-cue-light-1','The room is dark. Ask someone to turn on the light.','Say what change would help.'),
      O('cc-cue-light-2','They ask which light. Explain where it is.','Describe the lamp or room.','detail')),
  ],
  4:[
    S('cc-unmodeled-call','Make a phone request','Maya is the person you are calling.',
      O('cc-unmodeled-call-1','You are calling to check what time a community event starts. What do you say?','Begin with a greeting if that helps.'),
      O('cc-unmodeled-call-2','I say the event starts at two. Confirm the time.','Repeat the time or ask whether it is in the afternoon.','detail')),
    S('cc-unmodeled-shop','At a store','Maya is a shop worker.',
      O('cc-unmodeled-shop-1','You are looking for a gift but cannot find it. Ask for help.','Name or describe the item.'),
      O('cc-unmodeled-shop-2','I say the items are on aisle four. What would you ask to confirm?','You can check the aisle or location.','detail')),
  ],
  5:[
    S('cc-rephrase-kettle','The name is stuck','Maya is listening while you describe an object.',
      O('cc-rephrase-kettle-1','You cannot remember the word for a kettle. Explain the object without naming it.','What does it do? Where is it used?','rephrase'),
      O('cc-rephrase-kettle-2','I am not sure which object you mean. Add one more detail.','Describe heating or pouring water.','rephrase')),
    S('cc-rephrase-wallet','Describe a lost item','Maya helps you explain an object.',
      O('cc-rephrase-wallet-1','You cannot remember the word wallet. Describe the item you lost.','It holds cards and cash.','rephrase'),
      O('cc-rephrase-wallet-2','Where would someone look for it?','Describe a pocket, bag or usual place.','detail')),
  ],
  6:[
    S('cc-transfer-library','Ask, then change the place','Maya rehearses one request before a different roleplay.',
      O('cc-transfer-library-1','You cannot find a book at the library. Ask a librarian for help.','Say which book or section you need.','ask'),
      O('cc-transfer-library-2','Now you are in a store. Ask a worker where a different item can be found.','Keep the same asking-for-help goal.','adapt')),
    S('cc-transfer-family','Ask, then change the person','Maya rehearses a helpful request with a changed listener.',
      O('cc-transfer-family-1','Ask a family member to help carry a bag.','A short polite request is fine.'),
      O('cc-transfer-family-2','Now ask a neighbor for help with a different heavy item.','Keep the request clear for a new listener.','adapt')),
  ],
  7:[
    S('cc-repair-phone','An unclear phone call','Maya plays a listener who misunderstood.',
      O('cc-repair-phone-1','You call to say your appointment needs to change. Make the request.','Explain which appointment and what you need.'),
      O('cc-repair-phone-2','I thought you wanted to cancel forever. Is that right? Clarify that you want a new time.','Correct the misunderstanding and restate your request.','repair')),
    S('cc-repair-delivery','An unclear delivery request','Maya plays someone who misunderstood.',
      O('cc-repair-delivery-1','Ask a delivery worker to leave a package near the front door.','Say where you would like it left.'),
      O('cc-repair-delivery-2','I heard you wanted it by the back door. Please clarify.','Repeat or describe the correct door.','repair')),
  ],
  8:[
    S('cc-novel-appointment','An unfamiliar appointment change','Maya plays a receptionist with changing availability.',
      O('cc-novel-appointment-1','You need to move an appointment because you cannot attend Tuesday. Ask for another time.','Explain the conflict and request an option.','adapt'),
      O('cc-novel-appointment-2','I cannot offer Wednesday, but Thursday morning is open. How would you respond?','Accept, decline or ask for another day.','adapt')),
    S('cc-novel-library','An unexpected library problem','Maya plays a library worker.',
      O('cc-novel-library-1','You need to return a borrowed book, but the library is closed. Ask what to do.','Explain the problem and ask for an option.','ask'),
      O('cc-novel-library-2','The outside return slot is closed too, but we can renew the loan by phone. What would you ask next?','Clarify how and when to renew.','adapt')),
  ],
};

const BANKS: Readonly<Record<ConversationPracticeKind,Bank>>={
  'conversation-partner':PARTNER_BANK,
  'conversation-coach':COACH_BANK,
};
export function getConversationPracticeStage(kind:ConversationPracticeKind,level:unknown):ConversationPracticeStage|null{
  if(typeof level!=='number'||!Number.isInteger(level)||level<1||level>8)return null;
  return CONVERSATION_PRACTICE_STAGES[kind][level-1]??null;
}
export function getConversationPracticeScenes(
  kind:ConversationPracticeKind,level:ConversationPracticeLevel,sessionSeed?:string,
):ConversationPracticeScene[]{
  const scenes=BANKS[kind][level];
  if(!sessionSeed)return [...scenes];
  let hash=0;
  for(const char of sessionSeed+kind+level)hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
  const first=hash%scenes.length;
  return [scenes[first],scenes[(first+1)%scenes.length]];
}

/** Only objectively marked alternatives get a practice choice check. */
export function evaluateConversationPracticeTurn(
  turn:ConversationPracticeTurn,answer:{choiceIndex?:number},
):{practiceMatch:boolean|null}{
  return {practiceMatch:turn.kind==='choice'?answer.choiceIndex===turn.bestChoice:null};
}
