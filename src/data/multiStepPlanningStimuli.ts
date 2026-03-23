/**
 * Multi-Step Planning Stimuli
 * 
 * "Plan [goal] in steps" prompts for executive sequencing assessment.
 * Each item has expected key steps and an ideal ordering.
 */

export interface PlanningItem {
  id: string;
  goal: string;
  /** Emoji for visual context */
  emoji: string;
  /** Key steps a good plan should include */
  keySteps: string[];
  /** Ideal step ordering (indices into keySteps) — for sequenceScore */
  idealOrder: number[];
  tier: 1 | 2 | 3;
}

export const PLANNING_ITEMS: PlanningItem[] = [
  // Tier 1 — Familiar, daily routines
  {
    id: 'plan-01', goal: 'Make a cup of tea', emoji: '☕',
    keySteps: ['boil water', 'get cup', 'put tea bag', 'pour water', 'add milk or sugar'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1,
  },
  {
    id: 'plan-02', goal: 'Get ready for bed', emoji: '🛏️',
    keySteps: ['brush teeth', 'change clothes', 'set alarm', 'turn off lights', 'get into bed'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1,
  },
  {
    id: 'plan-03', goal: 'Make a sandwich', emoji: '🥪',
    keySteps: ['get bread', 'choose filling', 'spread butter', 'add filling', 'cut in half'],
    idealOrder: [0, 2, 1, 3, 4], tier: 1,
  },
  {
    id: 'plan-04', goal: 'Do a load of laundry', emoji: '🧺',
    keySteps: ['sort clothes', 'put in machine', 'add detergent', 'start machine', 'hang to dry'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1,
  },

  // Tier 2 — Multi-step, some decision points
  {
    id: 'plan-05', goal: 'Go grocery shopping', emoji: '🛒',
    keySteps: ['make a list', 'drive to store', 'find items', 'pay at checkout', 'bring groceries home'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2,
  },
  {
    id: 'plan-06', goal: 'Get ready for a doctor appointment', emoji: '🏥',
    keySteps: ['check appointment time', 'gather documents', 'plan transport', 'arrive early', 'check in at reception'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2,
  },
  {
    id: 'plan-07', goal: 'Cook dinner for a friend', emoji: '🍽️',
    keySteps: ['choose recipe', 'buy ingredients', 'prepare food', 'cook the meal', 'set the table'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2,
  },

  // Tier 3 — More abstract, requires initiative
  {
    id: 'plan-08', goal: 'Plan a birthday party', emoji: '🎉',
    keySteps: ['choose date', 'invite guests', 'buy decorations', 'order cake', 'prepare activities'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3,
  },
  {
    id: 'plan-09', goal: 'Start a new exercise routine', emoji: '🏃',
    keySteps: ['set a goal', 'choose activities', 'pick a schedule', 'get equipment', 'track progress'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3,
  },
  {
    id: 'plan-10', goal: 'Organize a room that is messy', emoji: '🧹',
    keySteps: ['decide what to keep', 'throw away trash', 'sort into categories', 'find storage', 'clean surfaces'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3,
  },

  // Additional Tier 1
  {
    id: 'plan-11', goal: 'Water the plants', emoji: '🪴',
    keySteps: ['fill watering can', 'check which plants need water', 'water each plant', 'empty extra water', 'put can away'],
    idealOrder: [1, 0, 2, 3, 4], tier: 1,
  },
  {
    id: 'plan-12', goal: 'Set the table for dinner', emoji: '🍽️',
    keySteps: ['count how many people', 'put out plates', 'add forks and knives', 'put out glasses', 'add napkins'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1,
  },

  // Additional Tier 2
  {
    id: 'plan-13', goal: 'Mail a package', emoji: '📦',
    keySteps: ['pack the item securely', 'write the address', 'weigh the package', 'go to the post office', 'pay for postage'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2,
  },
  {
    id: 'plan-14', goal: 'Take a pet to the vet', emoji: '🐕',
    keySteps: ['make an appointment', 'bring pet carrier', 'drive to the vet', 'check in at reception', 'wait for the doctor'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2,
  },
  {
    id: 'plan-15', goal: 'Return something to a store', emoji: '🏬',
    keySteps: ['find the receipt', 'pack the item', 'drive to the store', 'go to customer service', 'explain the return'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2,
  },

  // Additional Tier 3
  {
    id: 'plan-16', goal: 'Prepare for a job interview', emoji: '💼',
    keySteps: ['research the company', 'practice answers', 'choose an outfit', 'plan your route', 'arrive early'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3,
  },
  {
    id: 'plan-17', goal: 'Move to a new apartment', emoji: '🏠',
    keySteps: ['pack belongings in boxes', 'hire movers or ask friends', 'load the truck', 'drive to new place', 'unpack essentials first'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3,
  },
];

export function getPlanningItemsByTier(tier: number): PlanningItem[] {
  return PLANNING_ITEMS.filter(item => item.tier === tier);
}
