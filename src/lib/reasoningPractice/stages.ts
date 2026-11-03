/**
 * Optional nonclinical practice for Fix the Sentence and Detective Mind.
 *
 * These are NEW authored practice exercises, NOT added clinical content banks.
 * Neither the persisted Fix Sentence L6 ceiling nor Detective Mind L7 ceiling
 * changes. A correct multiple-choice response is receptive practice, not
 * independently spoken language or a validated reasoning-recovery metric.
 *
 * Two authored scenarios and two connected tasks per stage keep every stage
 * playable and give the upper levels genuinely different work to do. A small
 * bank can repeat across sessions; it is not a validated item-equivalent test.
 */

export type ReasoningPracticeKind = 'fix-sentence' | 'detective-mind';
export type ReasoningPracticeLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type ReasoningPracticeSkill =
  | 'detect_error' | 'select_repair' | 'semantic_repair' | 'functional_repair'
  | 'two_error_repair' | 'morphology' | 'embedded_clause' | 'open_repair'
  | 'literal_fact' | 'fact_sequence' | 'evidence_location' | 'inference'
  | 'fact_vs_inference' | 'multi_step_inference' | 'alternative_hypothesis'
  | 'novel_abstract_reasoning';

interface BaseStep {
  id: string;
  question: string;
  clue: string;
  skill: ReasoningPracticeSkill;
  /** Why the authored example fits; not a clinician-approved score rubric. */
  explanation: string;
}

export interface ReasoningChoiceStep extends BaseStep {
  kind: 'choice';
  options: readonly string[];
  bestChoice: number;
}
export interface ReasoningOpenStep extends BaseStep {
  kind: 'open';
  /** Not revealed until an attempt/skip or on explicit request. */
  modelExample: string;
}
export type ReasoningPracticeStep = ReasoningChoiceStep | ReasoningOpenStep;
export interface ReasoningPracticeScene {
  id: string;
  title: string;
  context: string;
  steps: readonly [ReasoningPracticeStep, ReasoningPracticeStep];
}
export interface ReasoningPracticeStage {
  level: ReasoningPracticeLevel;
  title: string;
  instruction: string;
  goal: string;
  practiceOnly: true;
}

export const REASONING_PRACTICE_STAGES: Readonly<Record<ReasoningPracticeKind, readonly ReasoningPracticeStage[]>> = {
  'fix-sentence': [
    {level:1,title:'Spot an obvious mistake',instruction:'Listen. Find the word that does not fit.',goal:'Notice and repair clear category errors with two choices',practiceOnly:true},
    {level:2,title:'Choose a useful repair',instruction:'Listen. Choose the word that makes sense.',goal:'Repair everyday sentences without an always-highlighted answer',practiceOnly:true},
    {level:3,title:'Repair a close word',instruction:'The words are related. Choose what fits.',goal:'Discriminate related words in sentence context',practiceOnly:true},
    {level:4,title:'Match an action and object',instruction:'What does the person need to do the action?',goal:'Repair function or action-object mismatches',practiceOnly:true},
    {level:5,title:'Find two mistakes',instruction:'The same sentence has two mistakes. Fix both.',goal:'Attend to two separate errors in one sentence',practiceOnly:true},
    {level:6,title:'Fix grammar forms',instruction:'Choose the form that fits the sentence.',goal:'Contrast tense, number and agreement exactly',practiceOnly:true},
    {level:7,title:'Repair a sentence with a clause',instruction:'Look at which person or thing each part describes.',goal:'Repair meaning and agreement in embedded clauses',practiceOnly:true},
    {level:8,title:'Repair a real-world message',instruction:'Try to make the message clearer in your own words.',goal:'Rehearse open-ended, functional sentence repair without automated grading',practiceOnly:true},
  ],
  'detective-mind': [
    {level:1,title:'Find a clear fact',instruction:'Listen. Choose the fact the story tells you.',goal:'Recognize concrete details with two choices',practiceOnly:true},
    {level:2,title:'Keep two details in order',instruction:'Listen. Use the order of the story.',goal:'Recall factual sequences with three choices',practiceOnly:true},
    {level:3,title:'Find the evidence',instruction:'Look for the detail that answers the question.',goal:'Identify direct support without a displayed highlight',practiceOnly:true},
    {level:4,title:'Draw a simple conclusion',instruction:'Use a clue to decide what probably happened.',goal:'Practice straightforward causal inference',practiceOnly:true},
    {level:5,title:'Separate fact from guess',instruction:'Ask what the story proves and what it suggests.',goal:'Distinguish explicit information from reasonable inference',practiceOnly:true},
    {level:6,title:'Connect several clues',instruction:'Think about more than one clue.',goal:'Practice two-step inference and evidence selection',practiceOnly:true},
    {level:7,title:'Compare explanations',instruction:'One idea may be more supported. What else could explain it?',goal:'Contrast competing hypotheses and missing evidence',practiceOnly:true},
    {level:8,title:'Reason about a new situation',instruction:'Try an unfamiliar problem. There may be more than one explanation.',goal:'Explore novel abstract evidence and open alternative explanations',practiceOnly:true},
  ],
};

const C = (id:string,question:string,options:readonly string[],bestChoice:number,clue:string,skill:ReasoningPracticeSkill,explanation:string):ReasoningChoiceStep =>
  ({id,kind:'choice',question,options,bestChoice,clue,skill,explanation});
const O = (id:string,question:string,modelExample:string,clue:string,skill:ReasoningPracticeSkill,explanation:string):ReasoningOpenStep =>
  ({id,kind:'open',question,modelExample,clue,skill,explanation});
const S = (id:string,title:string,context:string,a:ReasoningPracticeStep,b:ReasoningPracticeStep):ReasoningPracticeScene =>
  ({id,title,context,steps:[a,b]});
type Bank = Readonly<Record<ReasoningPracticeLevel, readonly [ReasoningPracticeScene,ReasoningPracticeScene]>>;

const FIX_SCENES:Bank={
  1:[
    S('fs-p1-bathroom','Getting ready','I brushed my teeth with a hammer.',
      C('fs-p1-bathroom-a','Which word does not belong?',['teeth','hammer'],1,'A hammer is a tool for building, not brushing.','detect_error','Hammer is the mismatched word.'),
      C('fs-p1-bathroom-b','Which tool could replace hammer?',['toothbrush','shoe'],0,'What do you hold while brushing?','select_repair','A toothbrush is used to brush teeth.')),
    S('fs-p1-weather','A rainy walk','I went outside in the rain and opened my sandwich.',
      C('fs-p1-weather-a','Which word is out of place?',['sandwich','rain'],0,'Think about something used in rain.','detect_error','Sandwich does not fit the rainy-walk context.'),
      C('fs-p1-weather-b','What could be opened in the rain?',['umbrella','pillow'],0,'It keeps the rain off your head.','select_repair','An umbrella can be opened outside in the rain.')),
  ],
  2:[
    S('fs-p2-kitchen','Making breakfast','I poured orange juice into a shoe.',
      C('fs-p2-kitchen-a','What should replace shoe?',['cup','spoon','blanket'],0,'Choose something that can hold a drink.','select_repair','A cup holds juice.'),
      C('fs-p2-kitchen-b','Which corrected sentence fits?',['I poured orange juice into a cup.','I poured orange juice into a coat.','I poured orange juice into a book.'],0,'The drink needs a container.','select_repair','A cup is an appropriate container.')),
    S('fs-p2-door','Leaving home','I turned the doorknob with my bicycle.',
      C('fs-p2-door-a','What can replace bicycle?',['hand','bed','radio'],0,'You can turn a doorknob with this.','select_repair','A hand can turn a doorknob.'),
      C('fs-p2-door-b','What is the repaired action?',['I turned the doorknob with my hand.','I ate the doorknob.','I drove the doorknob.'],0,'Keep the action of opening the door.','select_repair','Turning the doorknob with a hand fits the situation.')),
  ],
  3:[
    S('fs-p3-table','Setting a table','I ate the soup with a fork.',
      C('fs-p3-table-a','Which utensil usually fits soup?',['spoon','knife','plate'],0,'Soup is a liquid.','semantic_repair','A spoon is suited to eating soup.'),
      C('fs-p3-table-b','Which sentence best repairs the original?',['I ate the soup with a spoon.','I drank the soup with a pencil.','I ate the soup with a ruler.'],0,'Keep the soup and the action.','semantic_repair','The spoon repairs the utensil choice.')),
    S('fs-p3-clothing','Getting dressed','I put my feet into gloves.',
      C('fs-p3-clothing-a','What should replace gloves?',['socks','mittens','hats'],0,'Choose clothing normally worn on feet.','semantic_repair','Socks fit the feet.'),
      C('fs-p3-clothing-b','Which sentence keeps the same meaning?',['I put my feet into socks.','I put my hands into socks.','I put my feet into hats.'],0,'Only the wrong clothing word needs changing.','semantic_repair','Changing gloves to socks repairs the sentence.')),
  ],
  4:[
    S('fs-p4-garden','Working in the garden','Nina watered the plants with a broom.',
      C('fs-p4-garden-a','What tool would work for watering?',['watering can','rake','scissors','hammer'],0,'Choose a tool that carries water.','functional_repair','A watering can is used for watering plants.'),
      C('fs-p4-garden-b','What should Nina use to sweep the path?',['broom','watering can','screwdriver','whisk'],0,'The action changed from watering to sweeping.','functional_repair','A broom is suited to sweeping.')),
    S('fs-p4-mail','Sending a letter','James sealed the envelope with a flashlight.',
      C('fs-p4-mail-a','What makes the envelope stay closed?',['tape','thermometer','keys','glass'],0,'Think of something sticky.','functional_repair','Tape can seal an envelope.'),
      C('fs-p4-mail-b','What would James use to read it in the dark?',['flashlight','tape','stamp','rubber band'],0,'Now the action is reading in darkness.','functional_repair','A flashlight provides light.')),
  ],
  5:[
    S('fs-p5-breakfast','Two breakfast mistakes','I cut the bread with a sock and drank tea from a fork.',
      C('fs-p5-breakfast-a','First, what replaces sock?',['knife','pillow','soap','plate'],0,'Choose a tool for cutting bread.','two_error_repair','A knife can cut bread.'),
      C('fs-p5-breakfast-b','Second, what replaces fork?',['cup','hammer','napkin','clock'],0,'Tea needs a container.','two_error_repair','A cup holds tea. Both repairs are needed.')),
    S('fs-p5-outside','Two mistakes outside','Maya opened her sandwich in the rain and dried her hair with a ladder.',
      C('fs-p5-outside-a','First, what replaces sandwich?',['umbrella','fork','blanket','clock'],0,'What can be opened for shelter from rain?','two_error_repair','An umbrella protects from rain.'),
      C('fs-p5-outside-b','Second, what replaces ladder?',['towel','knife','shoes','brush'],0,'What can absorb water from hair?','two_error_repair','A towel can dry wet hair.')),
  ],
  6:[
    S('fs-p6-yesterday','Talking about yesterday','Yesterday, I walk to the library.',
      C('fs-p6-yesterday-a','Which verb form fits yesterday?',['walked','walk','walking','walks'],0,'Yesterday is in the past.','morphology','Walked is the regular past-tense form.'),
      C('fs-p6-yesterday-b','Which is the correctly repaired sentence?',['Yesterday, I walked to the library.','Yesterday, I walks to the library.','Yesterday, I walking to the library.'],0,'Keep yesterday and make the verb past tense.','morphology','Yesterday I walked is the grammatical repair.')),
    S('fs-p6-agreement','Talking about a group','The children has new coats.',
      C('fs-p6-agreement-a','Which verb agrees with children?',['have','has','having','had'],0,'Children means more than one person.','morphology','The children have new coats.'),
      C('fs-p6-agreement-b','Choose the matching plural sentence.',['The children have coats.','The children has coats.','The child have coats.'],0,'Both the subject and verb must agree.','morphology','Children have is correct plural agreement.')),
  ],
  7:[
    S('fs-p7-relative','A person and a group','The neighbor who helps the children are friendly.',
      C('fs-p7-relative-a','Who is being described as friendly?',['The neighbor','The children','The street','The school'],0,'Which person comes before who helps the children?','embedded_clause','The main subject is the singular neighbor.'),
      C('fs-p7-relative-b','Which verb repairs the main clause?',['is','are','were','have'],0,'The neighbor is one person.','embedded_clause','The neighbor who helps the children is friendly.')),
    S('fs-p7-which','A package','The package that arrived yesterday were heavy.',
      C('fs-p7-which-a','What arrived yesterday?',['The package','The driver','The house','The truck'],0,'The clause that arrived yesterday describes the package.','embedded_clause','The embedded clause modifies the package.'),
      C('fs-p7-which-b','Which verb matches the main subject?',['was','were','have','are'],0,'Package is singular, even though a clause separates it from the verb.','embedded_clause','The package that arrived yesterday was heavy.')),
  ],
  8:[
    S('fs-p8-appointment','Clarifying an appointment','A message says: "Come when it is ready." The listener does not know when.',
      O('fs-p8-appointment-a','How could you make the appointment time clearer?','Please come at two o’clock on Tuesday.','Give a day and a time.','open_repair','Many clear time-and-day requests could work; no automatic score is assigned.'),
      O('fs-p8-appointment-b','The listener asks which building. How would you repair the message?','Please come to the clinic on Main Street at two on Tuesday.','Add a place without removing the time.','open_repair','A clear message can identify the place and time.')),
    S('fs-p8-order','Correcting an order','A restaurant order says: "Bring the other one." There are three drinks.',
      O('fs-p8-order-a','How could you say which drink you want?','Please bring the small glass of water, not the orange juice.','Name the drink and a distinguishing detail.','open_repair','Several specific descriptions are acceptable; this is not machine-graded.'),
      O('fs-p8-order-b','The server brings the wrong drink. Try a polite repair.','Thank you, but I asked for the small water. Could I have that instead?','Say what went wrong and what you need.','open_repair','A polite, specific correction can help the listener.')),
  ],
};

const DETECTIVE_SCENES:Bank={
  1:[
    S('dm-p1-keys','Keys by the door','Sam put his keys on the kitchen table. Then he made tea.',
      C('dm-p1-keys-a','Where did Sam put his keys?',['Kitchen table','Garden'],0,'The first sentence tells you.','literal_fact','The story explicitly says kitchen table.'),
      C('dm-p1-keys-b','What did Sam make?',['Tea','Soup'],0,'Listen to the second sentence.','literal_fact','Sam made tea.')),
    S('dm-p1-rain','A rainy morning','Rain started before breakfast. Lee took an umbrella.',
      C('dm-p1-rain-a','What started before breakfast?',['Rain','Snow'],0,'Think about the weather word.','literal_fact','The story says rain started.'),
      C('dm-p1-rain-b','What did Lee take?',['Umbrella','Helmet'],0,'Think of protection from rain.','literal_fact','Lee took an umbrella.')),
  ],
  2:[
    S('dm-p2-errands','Running errands','Ada visited the post office. She bought stamps. Then she went to the grocery store.',
      C('dm-p2-errands-a','Which place did Ada visit first?',['Post office','Grocery store','Library'],0,'The place first named comes first.','fact_sequence','Ada visited the post office before the grocery store.'),
      C('dm-p2-errands-b','What did Ada buy before shopping?',['Stamps','Milk','Bread'],0,'Think about what people buy at a post office.','fact_sequence','She bought stamps before going to the grocery store.')),
    S('dm-p2-dinner','Preparing dinner','Paul washed the carrots. Next, he chopped them. Last, he put them in the pot.',
      C('dm-p2-dinner-a','What happened just before chopping?',['Washing','Cooking','Eating'],0,'Look for what happened first.','fact_sequence','Paul washed the carrots before chopping.'),
      C('dm-p2-dinner-b','What was the last step?',['Put carrots in the pot','Washed the carrots','Bought carrots'],0,'The word last gives a clue.','fact_sequence','The carrots went into the pot last.')),
  ],
  3:[
    S('dm-p3-porch','At the porch','The parcel delivery note said "left beside the blue planter." Emma walked to the porch and saw a parcel there.',
      C('dm-p3-porch-a','What proves where the parcel was left?',['Delivery note','Weather report','Recipe'],0,'Look for the written location.','evidence_location','The note names the location.'),
      C('dm-p3-porch-b','Which detail supports that the note was accurate?',['Emma saw the parcel beside the planter','A car passed the house','The door was red'],0,'Find the matching observation.','evidence_location','Emma saw the parcel where the note described.')),
    S('dm-p3-clock','Arriving on time','The ticket says the bus leaves at 8:15. The station clock reads 8:05.',
      C('dm-p3-clock-a','Which detail states the departure time?',['The ticket','The wall color','The driver’s coat'],0,'The written ticket gives the departure time.','evidence_location','The ticket lists 8:15.'),
      C('dm-p3-clock-b','Which detail tells us the current time?',['The station clock','The bus number','The ticket price'],0,'A clock tells the current time.','evidence_location','The clock reads 8:05.')),
  ],
  4:[
    S('dm-p4-wet','The wet doorway','Nora came home. The doormat was wet and a folded umbrella stood by the door. Nora had been out for a walk.',
      C('dm-p4-wet-a','What probably happened outside?',['It rained','It snowed','A pipe burst','A fire started'],0,'Think about the umbrella and wet mat.','inference','The wet mat and umbrella suggest rain.'),
      C('dm-p4-wet-b','Which clue best supports the rain idea?',['Wet mat and umbrella','Nora’s name','A folded letter','The wall color'],0,'Use two clues together.','inference','Wet items near the entrance support the rain inference.')),
    S('dm-p4-cookies','The empty cookie tin','A full cookie tin was on the counter. After lunch it was empty. Joe had crumbs around his mouth.',
      C('dm-p4-cookies-a','Who may have eaten the cookies?',['Joe','A delivery driver','The neighbor','A stranger'],0,'Look for a sign that someone ate.','inference','Joe’s crumbs are a clue, though not proof.'),
      C('dm-p4-cookies-b','Which new clue would strengthen that guess?',['Joe says he ate the cookies','The lights are on','The clock is loud','A towel is blue'],0,'Look for direct confirmation.','inference','Joe confirming it would support the hypothesis.')),
  ],
  5:[
    S('dm-p5-train','A delayed train','The platform sign says the 9 o’clock train is delayed. Three passengers are checking the timetable. A worker is speaking on a radio.',
      C('dm-p5-train-a','Which is a fact stated in the story?',['The sign says delayed','The train has broken down','The worker caused the delay','The train was canceled'],0,'A fact is directly said or seen.','fact_vs_inference','The sign explicitly says delayed; no cause is given.'),
      C('dm-p5-train-b','Which is only a possible explanation?',['There may be a mechanical issue','The sign says delayed','The worker has a radio','Passengers check the timetable'],0,'The story does not say why the train is late.','fact_vs_inference','A mechanical problem is possible but unconfirmed.')),
    S('dm-p5-garden','A quiet garden','The vegetable beds are damp. A watering can is by the gate. Nobody is in the garden now.',
      C('dm-p5-garden-a','Which detail is directly observed?',['The beds are damp','The gardener watered at sunrise','A storm passed overnight','The hose is broken'],0,'Find what the story actually tells you.','fact_vs_inference','The beds are observed to be damp.'),
      C('dm-p5-garden-b','Which statement is an inference, not a fact?',['Someone may have watered the plants','A can is by the gate','No one is in the garden','The beds are damp'],0,'Think what the clues suggest but do not prove.','fact_vs_inference','Someone watering is plausible but not observed.')),
  ],
  6:[
    S('dm-p6-store','A locked shop','Mira arrived at the bakery at 7:30. The sign said "Opens at eight." The lights were off, but fresh bread was visible inside.',
      C('dm-p6-store-a','Why was the bakery likely locked?',['It was not opening time','It had shut permanently','There was no bread','Mira was at the wrong street'],0,'Combine arrival time with the sign.','multi_step_inference','7:30 is before the posted eight o’clock opening.'),
      C('dm-p6-store-b','Which observation suggests staff may be preparing inside?',['Fresh bread visible','A blue car outside','Mira is hungry','The street is quiet'],0,'Look for what could require work before opening.','multi_step_inference','Fresh bread may indicate early preparation, without proving anyone is inside.')),
    S('dm-p6-invitation','A meeting change','The printed invitation says Thursday at noon. A later email says "Moved to Friday, same time." Dani is putting Friday into her calendar.',
      C('dm-p6-invitation-a','When should Dani plan to attend?',['Friday at noon','Thursday at noon','Friday at six','Saturday morning'],0,'The later message changes the day only.','multi_step_inference','The updated day is Friday and the original noon time remains.'),
      C('dm-p6-invitation-b','What evidence would help if the messages conflict?',['Ask the organizer to confirm','Ignore the email','Guess from the weather','Ask a stranger'],0,'Choose a source that can verify the final plan.','multi_step_inference','An organizer can confirm the current schedule.')),
  ],
  7:[
    S('dm-p7-missing','The missing library book','A library book is absent from its shelf. The return cart contains several books. A clerk has not yet checked the cart.',
      C('dm-p7-missing-a','Which explanation is most supported without assuming theft?',['The book could be on the return cart','Someone certainly stole it','The library never owned the book','The shelf label is always wrong'],0,'What is still unchecked?','alternative_hypothesis','An unchecked cart is a plausible, testable explanation.'),
      C('dm-p7-missing-b','What should be checked next?',['Search the return cart','Accuse a patron','Close the library','Throw out the shelf label'],0,'Test the simplest unresolved possibility first.','alternative_hypothesis','Checking the return cart could confirm or rule out that possibility.')),
    S('dm-p7-power','A dark classroom','The projector stopped displaying an image. The computer stayed on. A cable looked loose behind the projector.',
      C('dm-p7-power-a','What is a reasonable first hypothesis?',['A loose projector cable','The entire building lost power','Every file was deleted','The computer was stolen'],0,'Which device is still running, and which connection looks loose?','alternative_hypothesis','A loose display cable fits the available clues.'),
      C('dm-p7-power-b','Which check could test the hypothesis?',['Secure the cable and try again','Erase the computer','Replace all the lights','Leave the room forever'],0,'Test the connection before assuming a larger failure.','alternative_hypothesis','Reseating the cable is an appropriate test; it may or may not solve the problem.')),
  ],
  8:[
    S('dm-p8-sensor','An unfamiliar greenhouse system','A greenhouse sensor reports high humidity. An air vent shows "open" in the control panel. Plants look healthy. The sensor was installed yesterday.',
      C('dm-p8-sensor-a','Which conclusion is justified by the available evidence?',['The sensor reading needs checking','All plants are dying','The vent caused a flood','The new sensor cannot be wrong'],0,'A new sensor may need calibration; one reading is not a diagnosis.','novel_abstract_reasoning','A single reading plus healthy plants does not establish a cause.'),
      O('dm-p8-sensor-b','What else could explain the high reading, and how might you check?','It may be humid today, or the sensor may need calibration. Compare it with another sensor.','Think of an alternative and a test.','novel_abstract_reasoning','Several reasonable explanations and tests exist; no automatic open-response score is assigned.')),
    S('dm-p8-pattern','A new library system','An automatic book sorter puts two novels into the history bin. It sorted other books correctly. Both novels had temporary handwritten labels.',
      C('dm-p8-pattern-a','What is the strongest starting hypothesis?',['The handwritten labels may be confusing the sorter','The novels are now history books','All books are mislabeled','The sorter can never work'],0,'Look for what the two mis-sorted books have in common.','novel_abstract_reasoning','The temporary labels are a shared, testable feature; not proven to be the cause.'),
      O('dm-p8-pattern-b','How could someone test that idea without assuming it is right?','Try the same books with standard labels and see whether the sorter behaves differently.','Change one possible cause and compare results.','novel_abstract_reasoning','A controlled comparison tests the hypothesis; this open explanation remains ungraded.')),
  ],
};

export const REASONING_PRACTICE_SCENES:Readonly<Record<ReasoningPracticeKind,Bank>>={
  'fix-sentence':FIX_SCENES,
  'detective-mind':DETECTIVE_SCENES,
};

export function getReasoningPracticeStage(kind:ReasoningPracticeKind, level:number):ReasoningPracticeStage|null{
  return REASONING_PRACTICE_STAGES[kind]?.find(item=>item.level===level)??null;
}

export function getReasoningPracticeScenes(kind:ReasoningPracticeKind,level:ReasoningPracticeLevel):readonly ReasoningPracticeScene[]{
  return REASONING_PRACTICE_SCENES[kind][level]??[];
}

/** A correct tile is only an authored practice-choice match. Open words
 * are never automatically graded as independent sentence repair/reasoning. */
export function evaluateReasoningChoice(step:ReasoningPracticeStep,choiceIndex:number|null):boolean|null{
  if(step.kind!=='choice'||choiceIndex===null||!Number.isInteger(choiceIndex)
    ||choiceIndex<0||choiceIndex>=step.options.length)return null;
  return choiceIndex===step.bestChoice;
}
