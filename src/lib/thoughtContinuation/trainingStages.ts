/**
 * Thought Continuation: first three genuinely distinct, patient-facing PRACTICE
 * modes. These are content formats, not clinical mastery claims.
 *
 * One difficulty axis: amount of context the speaker must generate.
 * L1 = finish a highly constrained familiar stem; L2 = choose a meaningful
 * continuation to a less constrained stem; L3 = continue a two-sentence event
 * with a causal/temporal proposition. Hints are orthogonal support.
 *
 * The eight-level clinical ladder has no approved automatic advancement rules.
 * Never translate activity here into an independent clinical speech score.
 */
import type { IntentType, PromptTheme, ThoughtPrompt } from '@/types/thoughtContinuation';

export type ThoughtTrainingStageLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type ThoughtTrainingStage = {
  level: ThoughtTrainingStageLevel;
  label: string;
  instructions: string;
};

const STAGES: Readonly<Record<ThoughtTrainingStageLevel, ThoughtTrainingStage>> = {
  1: {
    level: 1,
    label: 'Finish a familiar sentence',
    instructions: 'Listen and add the missing word or words. A short answer is enough.',
  },
  2: {
    level: 2,
    label: 'Choose what happens next',
    instructions: 'Finish the sentence in your own way. There can be many good answers.',
  },
  3: {
    level: 3,
    label: 'Connect two ideas',
    instructions: 'Listen to both sentences. Tell what happens next or why it happened.',
  },
  4: {
    level: 4,
    label: 'Explain a cause or next step',
    instructions: 'Connect an everyday event to what happened because of it, or to what comes next.',
  },
  5: {
    level: 5,
    label: 'Share an opinion',
    instructions: 'Choose what you think or prefer and tell one reason, using your own words.',
  },
  6: {
    level: 6,
    label: 'Give a reason and example',
    instructions: 'Explain what you think, why, and give an everyday example if you can.',
  },
  7: {
    level: 7,
    label: 'Imagine a different outcome',
    instructions: 'What might happen if one thing were different? Connect the cause and result.',
  },
  8: {
    level: 8,
    label: 'Build a thoughtful explanation',
    instructions: 'Explain a new situation using several related ideas. Take your time, and ask for a hint if needed.',
  },
};

type Template = {
  theme: PromptTheme;
  intentType: IntentType;
  promptText: string;
  firstHint: string;
  secondHint: string;
};
const p = (
  theme: PromptTheme, intentType: IntentType,
  promptText: string, firstHint: string, secondHint: string,
): Template => ({ theme, intentType, promptText, firstHint, secondHint });

// Clinician-content review is still required; these are authored practice
// stimuli, not standardized assessment items or normed clinical probes.
const TEMPLATES: Readonly<Record<ThoughtTrainingStageLevel, readonly Template[]>> = {
  1: [
    p('food', 'recall_recent', 'When I am thirsty, I drink...', 'Think of something you like to drink.', 'What could be in your cup?'),
    p('home', 'describe_event', 'Before I eat, I wash my...', 'Think about getting clean.', 'What part of your body do you wash?'),
    p('weather', 'describe_event', 'When it rains, I take my...', 'Think about staying dry.', 'What could you carry outside?'),
    p('home', 'describe_event', 'At night I turn off the...', 'Think of something that makes a room bright.', 'What would make the room dark?'),
    p('food', 'describe_event', 'I eat soup with a...', 'Think of something on the table.', 'What do you hold to eat soup?'),
    p('home', 'describe_event', 'I open the locked door with a...', 'Think about something small you carry.', 'What fits into a lock?'),
    p('daily_routine', 'describe_event', 'I brush my teeth with a...', 'Think of something in the bathroom.', 'What do you hold to clean your teeth?'),
    p('daily_routine', 'describe_event', 'When the phone rings, I...', 'Think about a call.', 'What do you do when someone is calling?'),
    p('home', 'describe_event', 'If the room is cold, I put on a...', 'Think about warm clothing.', 'What could you wear?'),
    p('food', 'describe_event', 'I drink my coffee from a...', 'Think of something in the kitchen.', 'What can hold a hot drink?'),
    p('daily_routine', 'describe_event', 'To write a note, I pick up a...', 'Think about writing by hand.', 'What do you write with?'),
    p('home', 'describe_event', 'When I am tired, I sit in a...', 'Think about resting at home.', 'What can you sit on?'),
  ],
  2: [
    p('daily_routine', 'describe_event', 'I missed the bus, so I...', 'What would you do next?', 'Could you wait, call someone, or travel another way?'),
    p('food', 'explain_reason', 'I decided to cook dinner because...', 'Think of a reason to cook.', 'Was someone hungry or coming to visit?'),
    p('home', 'solve_problem', 'I could not find my keys, so I...', 'What might you try?', 'Where would you search first?'),
    p('weather', 'describe_event', 'The weather changed suddenly, so we...', 'How might plans change?', 'Would you go inside or change what you wear?'),
    p('family', 'describe_event', 'My friend called unexpectedly, and I...', 'How would you respond?', 'What might you say or do?'),
    p('daily_routine', 'solve_problem', 'I arrived early for an appointment, so I...', 'What could you do while waiting?', 'Would you read, sit, or speak to someone?'),
    p('home', 'solve_problem', 'The kitchen light stopped working, so I...', 'What is a safe next step?', 'Could you ask someone for help?'),
    p('hobbies', 'express_opinion', 'On a free afternoon, I would rather...', 'Think of something enjoyable.', 'Would you go outside or stay home?'),
    p('food', 'express_opinion', 'When I choose a restaurant, I look for...', 'What matters to you?', 'Think about the food, price, or atmosphere.'),
    p('family', 'describe_event', 'I wanted to thank my neighbor, so I...', 'How might you show gratitude?', 'Could you speak to them or write a note?'),
    p('daily_routine', 'solve_problem', 'I forgot something at the store, so I...', 'What might you do?', 'Would you return now or add it to a list?'),
    p('preferences', 'explain_reason', 'I enjoy the morning because...', 'What is good about it?', 'Is it quiet, bright, or part of your routine?'),
  ],
  3: [
    p('food', 'describe_event', 'The groceries were on the counter. The milk was still in the car. What happened next?', 'Think of the next action.', 'Who might go back to get it, and why?'),
    p('weather', 'solve_problem', 'The family planned a picnic. Dark clouds appeared before they left. What did they decide?', 'Think about the weather changing plans.', 'Would they postpone the picnic or find shelter?'),
    p('home', 'describe_event', 'The hallway was dark. Someone found a flashlight in the drawer. What happened next?', 'Think of the next step.', 'What could they use the light to do?'),
    p('daily_routine', 'describe_event', 'The appointment was at ten. The bus arrived late. What happened when the patient reached the clinic?', 'Think about arriving late.', 'How might the patient explain the delay?'),
    p('family', 'describe_event', 'A friend had a birthday. The card was still on the kitchen table. What happened next?', 'Think of the missing card.', 'Could someone return for it or deliver it later?'),
    p('home', 'solve_problem', 'The sink was dripping. A towel was already wet on the floor. What should happen next?', 'Think about solving a household problem.', 'What can someone do safely before getting help?'),
    p('food', 'describe_event', 'Dinner was ready. One guest was stuck in traffic. What did the others decide to do?', 'Think about timing dinner.', 'Would they wait or save the guest a plate?'),
    p('hobbies', 'describe_event', 'The garden soil was very dry. Rain was not expected for days. What did the gardener do?', 'Think about caring for plants.', 'What would the plants need?'),
    p('daily_routine', 'solve_problem', 'A person left their glasses at home. The restaurant menu had small print. How did they manage?', 'Think about reading without glasses.', 'Could someone read the menu aloud?'),
    p('family', 'describe_event', 'The grandchildren were coming to visit. There were no snacks in the house. What happened next?', 'Think about preparing for guests.', 'Where might someone go, or what might they make?'),
    p('weather', 'describe_event', 'The sidewalks were icy in the morning. A neighbor needed to get the mail. What happened next?', 'Think about moving safely.', 'Could someone wait or ask for help?'),
    p('preferences', 'explain_reason', 'Two friends wanted to watch different movies. They only had time for one. How did they choose?', 'Think of a fair decision.', 'Could they take turns or agree on a third option?'),
  ],
  4: [
    p('home', 'explain_reason', 'The power went out while dinner was cooking. Explain one problem that caused and what the family could do next.', 'Start with what stopped working.', 'What could the family use safely instead?'),
    p('travel', 'solve_problem', 'A train was delayed, and someone would miss a meeting. Explain the next steps in order.', 'What would the traveler do first?', 'Who should they contact next?'),
    p('weather', 'explain_reason', 'The road became icy overnight. Explain why the driver changed plans and what happened next.', 'What could make driving unsafe?', 'What safer choice was possible?'),
    p('food', 'describe_event', 'A cake was taken out too early and was still soft in the middle. Explain what could happen next.', 'What is the problem with the cake?', 'What could the cook check or do safely?'),
    p('family', 'explain_reason', 'A visitor arrived while the host was on the phone. Explain how the host might handle both things.', 'Which two things need attention?', 'What could the host say?'),
    p('daily_routine', 'solve_problem', 'Someone lost their house key on the way home. Explain two safe steps they could take.', 'Who might have a spare key?', 'What could they do while waiting?'),
    p('hobbies', 'describe_event', 'A gardener noticed the plants were dry. Explain what they did and what might happen afterward.', 'What do dry plants need?', 'What might change the next day?'),
    p('home', 'solve_problem', 'A parcel was delivered to the wrong neighbor. Explain a polite way to resolve it.', 'Who could be contacted first?', 'What could you ask the neighbor to do?'),
    p('health', 'explain_reason', 'The walk was too tiring today. Explain why a person might take a break and what they could do instead.', 'What is the person noticing?', 'What could help them rest?'),
    p('preferences', 'explain_reason', 'Two people wanted the same seat on the bus. Explain a fair way to decide.', 'What is the conflict?', 'Could someone offer another seat?'),
  ],
  5: [
    p('preferences', 'express_opinion', 'Some people prefer a quiet weekend; others enjoy a busy one. Which do you prefer, and why?', 'Start with what you prefer.', 'What do you like about that kind of weekend?'),
    p('food', 'express_opinion', 'Would you rather cook at home or eat at a restaurant? Explain your choice.', 'Choose home or restaurant.', 'Think about cost, taste, or company.'),
    p('travel', 'express_opinion', 'Would you rather travel by train or car for a short trip? Why?', 'Pick one kind of travel.', 'Think about convenience or comfort.'),
    p('hobbies', 'express_opinion', 'Is it better to start a hobby with a friend or alone? What do you think?', 'Think of a hobby you enjoy.', 'What does a friend change?'),
    p('family', 'express_opinion', 'Would you prefer a small family dinner or a large party? Give one reason.', 'Choose one kind of gathering.', 'What makes it enjoyable for you?'),
    p('home', 'express_opinion', 'Would you rather have a bigger kitchen or a bigger garden? Explain your preference.', 'Think of how you use your home.', 'What would you do in that space?'),
    p('weather', 'express_opinion', 'Which season is most comfortable for an outdoor walk, and why?', 'Pick one season.', 'What is the weather like then?'),
    p('daily_routine', 'express_opinion', 'Do you prefer making a list or remembering errands as you go? Why?', 'Think about how you manage tasks.', 'What might be easier with a list?'),
    p('memories', 'express_opinion', 'Is a photograph or a story a better way to remember a special day? Why?', 'Think of a special memory.', 'What can each way help you remember?'),
    p('preferences', 'express_opinion', 'Would you rather read a book or listen to a story? Explain your choice.', 'Choose reading or listening.', 'What feels easier or more enjoyable?'),
  ],
  6: [
    p('home', 'explain_reason', 'A neighbor wants to make their apartment more welcoming. What should they change first, why, and what is one example?', 'Choose one change you would make.', 'How could that change help a visitor?'),
    p('food', 'explain_reason', 'Should families plan meals for the week? Explain your opinion with a practical example.', 'Give your opinion first.', 'Imagine a busy evening. How might planning help?'),
    p('travel', 'explain_reason', 'Explain why leaving early for a trip can be useful, and give an example of when it matters.', 'What could delay a traveler?', 'What changes when there is extra time?'),
    p('daily_routine', 'explain_reason', 'Why is it helpful to keep important items in one familiar place? Give a real-life example.', 'Name an item people often lose.', 'What happens when it has a regular place?'),
    p('hobbies', 'explain_reason', 'Why might someone practice a hobby a little each day? Give an example.', 'Think about learning something.', 'What difference can a short practice make?'),
    p('family', 'explain_reason', 'Explain why listening matters when two people disagree, using a simple example.', 'What does each person want?', 'How could listening change what happens next?'),
    p('weather', 'explain_reason', 'Why might a city plant more trees? Explain a reason and an everyday benefit.', 'Think about hot days.', 'How can trees change a sidewalk or park?'),
    p('memories', 'explain_reason', 'Why do people keep objects from important occasions? Give an example of something meaningful.', 'Think of an object with a story.', 'What does it remind someone of?'),
    p('preferences', 'explain_reason', 'Why is it helpful to have both quiet and active time in a week? Give an example.', 'Think about energy and rest.', 'What might a balanced week look like?'),
    p('home', 'solve_problem', 'Someone is moving to a smaller home. What is the most important thing to plan, why, and give one example.', 'Think about what needs to fit.', 'What could be donated or stored?'),
  ],
  7: [
    p('travel', 'solve_problem', 'Suppose the bus route changed without warning. How might your day be different, and what would you try?', 'What plan would no longer work?', 'What other way could you travel?'),
    p('food', 'solve_problem', 'Imagine your grocery store no longer sold your favorite ingredients. How could you adapt a meal?', 'What ingredient would be missing?', 'What is one substitute?'),
    p('home', 'solve_problem', 'If your home lost electricity for an entire evening, how might your routine change?', 'Think about light or cooking.', 'What activities could still happen safely?'),
    p('weather', 'explain_reason', 'Imagine winter weather suddenly became warm and rainy. How would weekend plans change?', 'Think of something planned outdoors.', 'What would change about clothing or travel?'),
    p('family', 'describe_event', 'If an unexpected visitor arrived during a busy day, what might you rearrange and why?', 'What had you planned?', 'What could wait until later?'),
    p('preferences', 'compare_contrast', 'If nobody used phones for one day, what would be easier and what would be harder?', 'Think about communication.', 'How else could people reach each other?'),
    p('daily_routine', 'solve_problem', 'Suppose your morning appointment moved to the afternoon. What might change in your plan?', 'What do you usually do in the morning?', 'How would your schedule change?'),
    p('hobbies', 'explain_reason', 'Imagine a garden got only half the usual rain. How would you care for it differently?', 'Think of what plants need.', 'What could the gardener do more often?'),
    p('memories', 'express_opinion', 'If you could revisit a favorite place from long ago, what would you want to see and why?', 'Imagine the place clearly.', 'What detail matters to you?'),
    p('health', 'solve_problem', 'If a planned walk became too tiring, how might someone adjust the plan without giving up on the day?', 'Consider the person's energy.', 'What gentler option could they choose?'),
  ],
  8: [
    p('home', 'solve_problem', 'A community room is used for quiet reading, games, and group meetings. Two groups want it at the same time. Explain how you would make a fair plan, what tradeoff you would accept, and why.', 'Who needs the room?', 'What compromise could work for both groups?'),
    p('travel', 'compare_contrast', 'Two friends plan a weekend trip. One wants to save money; the other wants comfort. Explain two travel plans, compare the tradeoffs, and decide how they could agree.', 'Name one cheaper and one more comfortable option.', 'What is a fair compromise?'),
    p('food', 'solve_problem', 'A family is planning a meal for guests with different preferences and little time. Explain a practical plan, why it works, and what they could change if a guest arrives late.', 'What could everyone eat?', 'What might be prepared ahead?'),
    p('family', 'explain_reason', 'A neighborhood wants to create a shared garden. Some people can help weekly and some only occasionally. Explain how you would organize the work and why the plan is fair.', 'Think of the jobs that need doing.', 'How could everyone contribute at their own pace?'),
    p('weather', 'solve_problem', 'A town plans an outdoor festival but the forecast keeps changing. Explain how organizers could prepare two options and communicate the final decision.', 'What is the sunny-weather plan?', 'What is the rainy-weather backup?'),
    p('daily_routine', 'compare_contrast', 'A person has several errands, little free time, and an important appointment. Explain two possible schedules, compare them, and choose the more practical one.', 'Which task has a fixed time?', 'What could happen before or after it?'),
    p('hobbies', 'express_opinion', 'A small club is deciding between a big event and several small gatherings. Explain what each offers and which choice you would support.', 'Who would enjoy each option?', 'What matters most to the club?'),
    p('preferences', 'compare_contrast', 'Two neighbors disagree about keeping a shared hallway quiet. Explain both points of view, suggest a compromise, and describe how they could tell whether it worked.', 'What does each neighbor need?', 'What is one reasonable compromise?'),
    p('memories', 'explain_reason', 'Someone wants to share a family story with younger relatives. Explain how you would organize the story, why a few details matter, and how you would help listeners follow along.', 'Start with who and where.', 'What happened first, next, and last?'),
    p('home', 'solve_problem', 'A building wants to make an entrance easier for older visitors. Discuss two possible improvements, why they help, and what practical limitation must be considered.', 'Think about doors, lighting, or steps.', 'What needs to be safe and affordable?'),
  ],
};

function makePrompts(level: ThoughtTrainingStageLevel): readonly ThoughtPrompt[] {
  return TEMPLATES[level].map((item, index) => ({
    id: `thought-training-s${level}-${index + 1}`,
    theme: item.theme,
    intentType: item.intentType,
    promptText: item.promptText,
    narrowingSteps: [
      { level: 1, text: item.firstHint },
      { level: 2, text: item.secondHint },
    ],
    // The legacy discourse engine has only three difficulty bands.
    // The eight content-specific practice stages are selected independently
    // and never imply higher clinical-level success.
    difficultyTier: Math.min(level, 3) as ThoughtPrompt['difficultyTier'],
    isActive: true,
  }));
}

const BANK: Readonly<Record<ThoughtTrainingStageLevel, readonly ThoughtPrompt[]>> = {
  1: makePrompts(1),
  2: makePrompts(2),
  3: makePrompts(3),
  4: makePrompts(4),
  5: makePrompts(5),
  6: makePrompts(6),
  7: makePrompts(7),
  8: makePrompts(8),
};

export function getThoughtTrainingStage(level: number | null | undefined): ThoughtTrainingStage | null {
  if (level == null || !Number.isInteger(level) || level < 1 || level > 8) return null;
  return STAGES[level as ThoughtTrainingStageLevel];
}

export function getThoughtTrainingPrompts(level: ThoughtTrainingStageLevel): readonly ThoughtPrompt[] {
  return BANK[level];
}

/** Strict stage pool: no fallback to easier/harder content or repeated IDs. */
export function selectThoughtTrainingPrompt(
  level: ThoughtTrainingStageLevel,
  usedIds: readonly string[] = [],
): ThoughtPrompt | null {
  const available = BANK[level].filter(item => !usedIds.includes(item.id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}
