/**
 * Functional language practice content: Word Finding and Sentence Game.
 * Eight **actual playable practice formats** per game. This is not a
 * clinician-validated clinical ladder, and it never upgrades mastery.
 *
 * A single stage has a primary skill target. A task with open language is
 * never automatically judged right or wrong from browser ASR or keywords.
 */
export type FunctionalPracticeKind = 'word-finding' | 'sentence-game';
export type FunctionalPracticeLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type FunctionalPracticeSupport = 'full_model' | 'phonemic_cue' | 'semantic_cue' | 'none';

export interface FunctionalPracticeStage {
  level: FunctionalPracticeLevel;
  title: string;
  instruction: string;
  support: FunctionalPracticeSupport;
  description: string;
}

interface TrialBase {
  id: string;
  title: string;
  prompt: string;
  clue: string;
}
export interface ChoicePracticeTrial extends TrialBase {
  kind: 'choice';
  options: readonly [string, string];
  correctIndex: 0 | 1;
}
export interface OrderPracticeTrial extends TrialBase {
  kind: 'order';
  ordered: readonly [string, string, string];
}
export interface OpenPracticeTrial extends TrialBase {
  kind: 'open';
  prompts: readonly string[];
}
export type FunctionalPracticeTrial = ChoicePracticeTrial | OrderPracticeTrial | OpenPracticeTrial;

const WORD_FINDING_STAGES: readonly FunctionalPracticeStage[] = [
  { level: 1, title: 'Hear and recognize a word', instruction: 'Hear the word, then choose it.', support: 'full_model',
    description: 'Recognize a fully modeled everyday noun.' },
  { level: 2, title: 'Use the first sound', instruction: 'Listen to the first sound and choose a word.', support: 'phonemic_cue',
    description: 'Phonemic support for familiar word retrieval.' },
  { level: 3, title: 'Find a word from its meaning', instruction: 'Listen to what something does. Choose the word.', support: 'semantic_cue',
    description: 'Semantic feature recognition, not independent naming.' },
  { level: 4, title: 'Try the word yourself', instruction: 'Name a familiar item without hearing its name first.', support: 'none',
    description: 'Unprompted retrieval practice with no automatic open-speech correctness claim.' },
  { level: 5, title: 'Less common everyday words', instruction: 'Try finding a less familiar concrete word.', support: 'none',
    description: 'Lexical retrieval with a lower-frequency stimulus, not a timed test.' },
  { level: 6, title: 'Describe it another way', instruction: 'If a word gets stuck, explain what it does or looks like.', support: 'none',
    description: 'Circumlocution and communication alternatives to exact naming.' },
  { level: 7, title: 'Switch topics', instruction: 'Find words when the conversation changes topics.', support: 'none',
    description: 'Alternating semantic contexts with generous response time.' },
  { level: 8, title: 'Find words in conversation', instruction: 'Express an important idea in a new everyday situation.', support: 'none',
    description: 'Unscripted functional wording and alternatives, requiring human review.' },
];

const SENTENCE_GAME_STAGES: readonly FunctionalPracticeStage[] = [
  { level: 1, title: 'Who is doing what?', instruction: 'Hear a whole sentence, then find the matching action.', support: 'full_model',
    description: 'Identify an agent-action relation from a full model.' },
  { level: 2, title: 'Finish a short sentence', instruction: 'Choose the word that completes the sentence.', support: 'semantic_cue',
    description: 'Complete subject-verb relations with two choices.' },
  { level: 3, title: 'Put a sentence in order', instruction: 'Move the words into a meaningful sentence.', support: 'none',
    description: 'Construct a simple agent-action-object message using word tiles.' },
  { level: 4, title: 'Say a complete message', instruction: 'Use a subject and action to tell what happened.', support: 'none',
    description: 'Self-generated short clause including necessary grammar.' },
  { level: 5, title: 'Explain an everyday event', instruction: 'Tell someone what happened and where or when.', support: 'none',
    description: 'A complete event description with a meaningful detail.' },
  { level: 6, title: 'Join two related ideas', instruction: 'Connect two events into one clear message.', support: 'none',
    description: 'Combining connected propositions using simple conjunctions.' },
  { level: 7, title: 'Add a reason or time', instruction: 'Use because or when to explain an event.', support: 'none',
    description: 'Subordinate cause or time relation, with optional supports.' },
  { level: 8, title: 'Explain a new situation', instruction: 'Make your own useful message for a new everyday problem.', support: 'none',
    description: 'Novel functional utterance; accuracy needs human review.' },
];

export const FUNCTIONAL_PRACTICE_STAGES: Readonly<Record<FunctionalPracticeKind, readonly FunctionalPracticeStage[]>> = {
  'word-finding': WORD_FINDING_STAGES,
  'sentence-game': SENTENCE_GAME_STAGES,
};

type TrialBank = Readonly<Record<FunctionalPracticeLevel, readonly FunctionalPracticeTrial[]>>;

const WORD_FINDING_BANK: TrialBank = {
  1: [
    { id: 'wf-model-cup', kind: 'choice', title: 'A cup', prompt: 'Listen: cup. Choose cup.',
      clue: 'The model is cup.', options: ['cup', 'chair'], correctIndex: 0 },
    { id: 'wf-model-key', kind: 'choice', title: 'A key', prompt: 'Listen: key. Choose key.',
      clue: 'The model is key.', options: ['shoe', 'key'], correctIndex: 1 },
    { id: 'wf-model-book', kind: 'choice', title: 'A book', prompt: 'Listen: book. Choose book.',
      clue: 'The model is book.', options: ['book', 'plate'], correctIndex: 0 },
  ],
  2: [
    { id: 'wf-sound-bread', kind: 'choice', title: 'Starting sound B',
      prompt: 'You eat it with butter. The word starts with the sound B.',
      clue: 'Brr... bread.', options: ['bread', 'socks'], correctIndex: 0 },
    { id: 'wf-sound-soap', kind: 'choice', title: 'Starting sound S',
      prompt: 'You wash your hands with it. It starts with the sound S.',
      clue: 'Sss... soap.', options: ['lamp', 'soap'], correctIndex: 1 },
    { id: 'wf-sound-phone', kind: 'choice', title: 'Starting sound F',
      prompt: 'You use it to call someone. The word begins with the sound F.',
      clue: 'Fff... phone.', options: ['phone', 'blanket'], correctIndex: 0 },
  ],
  3: [
    { id: 'wf-meaning-spoon', kind: 'choice', title: 'Eating soup',
      prompt: 'What do you use to eat soup?', clue: 'You hold it in your hand.',
      options: ['spoon', 'scarf'], correctIndex: 0 },
    { id: 'wf-meaning-towel', kind: 'choice', title: 'Drying off',
      prompt: 'What helps you dry your hands after washing?', clue: 'It is made of fabric.',
      options: ['calendar', 'towel'], correctIndex: 1 },
    { id: 'wf-meaning-umbrella', kind: 'choice', title: 'Rain',
      prompt: 'What can you hold to stay dry in the rain?', clue: 'You open it over your head.',
      options: ['umbrella', 'spatula'], correctIndex: 0 },
  ],
  4: [
    { id: 'wf-free-clock', kind: 'open', title: 'On the wall',
      prompt: 'What do you look at on the wall to know the time?',
      clue: 'You might see numbers and hands.', prompts: ['Try the name yourself.', 'If needed, describe what it looks like.'] },
    { id: 'wf-free-shoes', kind: 'open', title: 'Before a walk',
      prompt: 'What do you put on your feet to go for a walk?',
      clue: 'You tie or slip them on.', prompts: ['Say the name without a model.', 'A description also communicates meaning.'] },
    { id: 'wf-free-wallet', kind: 'open', title: 'Paying at a store',
      prompt: 'What might you open to take out a card or cash?',
      clue: 'Many people keep it in a pocket or bag.', prompts: ['Try the word yourself.', 'Explain its use if the word is stuck.'] },
  ],
  5: [
    { id: 'wf-concrete-colander', kind: 'open', title: 'Cooking pasta',
      prompt: 'What kitchen tool has holes and lets water drain from cooked pasta?',
      clue: 'It is a bowl-shaped strainer.', prompts: ['Try to name the tool.', 'You may describe it instead.'] },
    { id: 'wf-concrete-thermostat', kind: 'open', title: 'Home temperature',
      prompt: 'What wall device lets you set how warm your home should be?',
      clue: 'It controls heating and cooling.', prompts: ['Think of the device.', 'Try a similar word or a description.'] },
    { id: 'wf-concrete-squeegee', kind: 'open', title: 'Cleaning a window',
      prompt: 'What handheld tool has a rubber edge to pull water off glass?',
      clue: 'Window cleaners use it.', prompts: ['Find the name or explain the tool.', 'There is no timer.'] },
  ],
  6: [
    { id: 'wf-describe-kettle', kind: 'open', title: 'Explain the object',
      prompt: 'Imagine you cannot remember the name of a kettle. Tell someone what it does without using its name.',
      clue: 'Think of heating water, a kitchen and pouring.', prompts: ['What is it used for?', 'Where would you find it?', 'What does it look like?'] },
    { id: 'wf-describe-remote', kind: 'open', title: 'Make yourself understood',
      prompt: 'You want the TV remote, but the word will not come. Explain what you need without saying remote.',
      clue: 'You use buttons to change channels or volume.', prompts: ['Say what it controls.', 'Describe where someone might find it.'] },
    { id: 'wf-describe-toaster', kind: 'open', title: 'Ask for help',
      prompt: 'You need the toaster but cannot find the word. Describe it to someone.',
      clue: 'It makes bread warm and brown.', prompts: ['What does it do?', 'What would someone put inside?'] },
  ],
  7: [
    { id: 'wf-switch-garden', kind: 'open', title: 'Garden to kitchen',
      prompt: 'First name something you grow in a garden. Then switch: name something used to cook dinner.',
      clue: 'Garden example: flower. Kitchen example: pan.', prompts: ['First: garden.', 'Now change to kitchen.', 'Try two different words.'] },
    { id: 'wf-switch-travel', kind: 'open', title: 'Travel to clothing',
      prompt: 'Name something used to travel. Then switch to something you wear in the cold.',
      clue: 'Travel example: bus. Cold-weather example: coat.', prompts: ['First: travel.', 'Now change to clothing.', 'No time limit.'] },
    { id: 'wf-switch-home', kind: 'open', title: 'Home to animals',
      prompt: 'Name something in your living room. Then switch to the name of an animal.',
      clue: 'Living-room example: sofa. Animal example: dog.', prompts: ['First: living room.', 'Next: animal.', 'Either familiar or less familiar words are fine.'] },
  ],
  8: [
    { id: 'wf-transfer-charger', kind: 'open', title: 'Borrowing a charger',
      prompt: 'You need to charge your phone at a friend’s house. Ask your friend for what you need, using your own words.',
      clue: 'You can name the item or explain what it does.', prompts: ['What would you ask for?', 'Could you say it another way?'] },
    { id: 'wf-transfer-medicine', kind: 'open', title: 'At the pharmacy',
      prompt: 'You are looking for a familiar over-the-counter item but cannot recall its name. Explain what kind of item you need without guessing a medical dose.',
      clue: 'Describe its packaging or purpose; ask the pharmacist for help.', prompts: ['What type of item?', 'What help would you request?'] },
    { id: 'wf-transfer-neighbor', kind: 'open', title: 'Asking a neighbor',
      prompt: 'A light outside your home stopped working. Tell a neighbor what happened and what you want help with.',
      clue: 'A short request or description is useful.', prompts: ['What stopped working?', 'What do you need?'] },
  ],
};

const SENTENCE_GAME_BANK: TrialBank = {
  1: [
    { id: 'sg-model-cook', kind: 'choice', title: 'Who is cooking?',
      prompt: 'Listen: The cook stirs soup. Which sentence matches?',
      clue: 'The cook stirs soup.', options: ['The cook stirs soup.', 'The cook drives a bus.'], correctIndex: 0 },
    { id: 'sg-model-mail', kind: 'choice', title: 'Who carries mail?',
      prompt: 'Listen: The carrier brings a letter. Which sentence matches?',
      clue: 'The carrier brings a letter.', options: ['The carrier sleeps.', 'The carrier brings a letter.'], correctIndex: 1 },
    { id: 'sg-model-garden', kind: 'choice', title: 'Who waters plants?',
      prompt: 'Listen: The gardener waters the flowers. Which sentence matches?',
      clue: 'The gardener waters the flowers.', options: ['The gardener waters the flowers.', 'The gardener fixes a car.'], correctIndex: 0 },
  ],
  2: [
    { id: 'sg-verb-cut', kind: 'choice', title: 'Complete the action',
      prompt: 'The chef ... the vegetables. What fits?',
      clue: 'A chef uses a knife to prepare vegetables.', options: ['cuts', 'sleeps'], correctIndex: 0 },
    { id: 'sg-verb-bark', kind: 'choice', title: 'A dog outside',
      prompt: 'The dog ... at the door. What fits?',
      clue: 'What sound might the dog make?', options: ['reads', 'barks'], correctIndex: 1 },
    { id: 'sg-verb-drive', kind: 'choice', title: 'The driver',
      prompt: 'The driver ... the bus. Choose the action.',
      clue: 'The person operates the vehicle.', options: ['drives', 'cooks'], correctIndex: 0 },
  ],
  3: [
    { id: 'sg-order-nurse', kind: 'order', title: 'A hospital errand',
      prompt: 'Arrange these words into a simple message.',
      clue: 'Who? Action? What?', ordered: ['The nurse', 'carries', 'the folder.'] },
    { id: 'sg-order-friend', kind: 'order', title: 'A helpful friend',
      prompt: 'Arrange the words into a sentence.',
      clue: 'Begin with the person.', ordered: ['My friend', 'opens', 'the door.'] },
    { id: 'sg-order-child', kind: 'order', title: 'Playing outdoors',
      prompt: 'Put the parts of this sentence in order.',
      clue: 'Person, action, object.', ordered: ['The child', 'throws', 'the ball.'] },
  ],
  4: [
    { id: 'sg-clause-breakfast', kind: 'open', title: 'Breakfast yesterday',
      prompt: 'Tell someone in a complete sentence what you ate yesterday morning.',
      clue: 'Try starting with I ate...', prompts: ['Who did the action?', 'What did they eat?', 'Use past tense if you can.'] },
    { id: 'sg-clause-visit', kind: 'open', title: 'A friend called',
      prompt: 'A friend called you last night. Say what happened in one sentence.',
      clue: 'Start with My friend...', prompts: ['Who?', 'What happened?', 'When?'] },
    { id: 'sg-clause-shop', kind: 'open', title: 'At the store',
      prompt: 'You bought an item at a store. Tell someone what you bought.',
      clue: 'Use I bought...', prompts: ['Who?', 'Action?', 'What was the item?'] },
  ],
  5: [
    { id: 'sg-event-park', kind: 'open', title: 'At the park',
      prompt: 'A family went for a walk in the park. Tell a friend what happened and where.',
      clue: 'Include a location detail.', prompts: ['Who was there?', 'What did they do?', 'Where?'] },
    { id: 'sg-event-dinner', kind: 'open', title: 'At dinnertime',
      prompt: 'A neighbor cooked dinner before visitors arrived. Explain what happened and when.',
      clue: 'Use before or after if helpful.', prompts: ['Who did it?', 'What happened?', 'When?'] },
    { id: 'sg-event-bus', kind: 'open', title: 'A bus trip',
      prompt: 'A rider waited for the bus near the library. Describe the event in one complete sentence.',
      clue: 'Try including near the library.', prompts: ['Who?', 'Did what?', 'Where?'] },
  ],
  6: [
    { id: 'sg-join-train', kind: 'open', title: 'Two parts of a trip',
      prompt: 'I went to the station. I caught a train. Combine the two thoughts into one message.',
      clue: 'And or then can connect events.', prompts: ['What happened first?', 'What happened next?', 'Join them.'] },
    { id: 'sg-join-lunch', kind: 'open', title: 'Making lunch',
      prompt: 'I washed the vegetables. I made a salad. Say both events together.',
      clue: 'Try after or then.', prompts: ['First event.', 'Second event.', 'Put them together.'] },
    { id: 'sg-join-phone', kind: 'open', title: 'Calling a friend',
      prompt: 'My phone rang. I answered it. Combine these events into one message.',
      clue: 'Try and or when.', prompts: ['What happened first?', 'What did you do next?'] },
  ],
  7: [
    { id: 'sg-reason-rain', kind: 'open', title: 'Why the walk changed',
      prompt: 'We stayed inside. It was raining. Explain the reason using because.',
      clue: 'We stayed inside because...', prompts: ['What did you do?', 'Why?', 'Say both ideas.'] },
    { id: 'sg-time-bell', kind: 'open', title: 'When someone arrived',
      prompt: 'The doorbell rang. I opened the door. Combine the ideas using when.',
      clue: 'When the doorbell rang...', prompts: ['When did it happen?', 'What did you do?'] },
    { id: 'sg-reason-route', kind: 'open', title: 'Why the route changed',
      prompt: 'The road was closed. The driver took another street. Explain it using because.',
      clue: 'The driver changed streets because...', prompts: ['What changed?', 'What was the reason?'] },
  ],
  8: [
    { id: 'sg-novel-appointment', kind: 'open', title: 'Change an appointment',
      prompt: 'A medical appointment moved to a day you cannot attend. Tell the office what happened and make a polite request.',
      clue: 'State the problem and ask for another time.', prompts: ['What changed?', 'What would you request?', 'Can you make it clear?'] },
    { id: 'sg-novel-library', kind: 'open', title: 'At the library',
      prompt: 'You borrowed a book, but an emergency prevented returning it on time. Explain the situation to library staff.',
      clue: 'Say what happened and what you would like to do.', prompts: ['What happened?', 'What is your request?', 'Add a reason if useful.'] },
    { id: 'sg-novel-neighbor', kind: 'open', title: 'Asking for a favor',
      prompt: 'A package was delivered to your house by mistake. Tell your neighbor what happened and ask how to return it.',
      clue: 'Use a clear problem and request.', prompts: ['What did you receive?', 'Why is it a problem?', 'What will you ask?'] },
  ],
};

const BANKS: Readonly<Record<FunctionalPracticeKind, TrialBank>> = {
  'word-finding': WORD_FINDING_BANK,
  'sentence-game': SENTENCE_GAME_BANK,
};

export function getFunctionalPracticeStage(
  kind: FunctionalPracticeKind,
  level: unknown,
): FunctionalPracticeStage | null {
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 8) return null;
  return FUNCTIONAL_PRACTICE_STAGES[kind][level - 1] ?? null;
}

/** Returns only exact-stage content; no fallback to simpler items mislabeled Stage 8. */
export function getFunctionalPracticeTrials(
  kind: FunctionalPracticeKind,
  level: FunctionalPracticeLevel,
  count = 3,
): FunctionalPracticeTrial[] {
  if (!Number.isSafeInteger(count) || count < 1) return [];
  return BANKS[kind][level].slice(0, count);
}

export function evaluateFunctionalPracticeTrial(
  trial: FunctionalPracticeTrial,
  response: { choiceIndex?: number; order?: readonly string[] },
): { correct: boolean | null; practiceAccuracy: number | null } {
  if (trial.kind === 'open') return { correct: null, practiceAccuracy: null };
  if (trial.kind === 'choice') {
    const correct = response.choiceIndex === trial.correctIndex;
    return { correct, practiceAccuracy: correct ? 1 : 0 };
  }
  const order = response.order ?? [];
  if (order.length !== trial.ordered.length || new Set(order).size !== order.length)
    return { correct: false, practiceAccuracy: 0 };
  const matches = trial.ordered.filter((token, i) => token === order[i]).length;
  return { correct: matches === trial.ordered.length, practiceAccuracy: matches / trial.ordered.length };
}
