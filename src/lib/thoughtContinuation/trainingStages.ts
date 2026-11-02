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

export type ThoughtTrainingStageLevel = 1 | 2 | 3;
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
    difficultyTier: level,
    isActive: true,
  }));
}

const BANK: Readonly<Record<ThoughtTrainingStageLevel, readonly ThoughtPrompt[]>> = {
  1: makePrompts(1),
  2: makePrompts(2),
  3: makePrompts(3),
};

export function getThoughtTrainingStage(level: number | null | undefined): ThoughtTrainingStage | null {
  if (level == null || !Number.isInteger(level) || level < 1 || level > 3) return null;
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
