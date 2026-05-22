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

  // === Tier 1 expansion (familiar daily routines) ===
  { id: 'plan-18', goal: 'Brush your teeth', emoji: '🪥',
    keySteps: ['get toothbrush', 'put toothpaste on', 'brush all teeth', 'rinse mouth', 'rinse brush and put away'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },
  { id: 'plan-19', goal: 'Make toast', emoji: '🍞',
    keySteps: ['get bread', 'put bread in toaster', 'wait for it to pop', 'put on a plate', 'spread butter or jam'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },
  { id: 'plan-20', goal: 'Wash your hands', emoji: '🧼',
    keySteps: ['turn on water', 'wet hands', 'rub with soap', 'rinse off', 'dry with towel'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },
  { id: 'plan-21', goal: 'Take a shower', emoji: '🚿',
    keySteps: ['get towel ready', 'turn on water and adjust temperature', 'wash body and hair', 'rinse off soap', 'dry off with towel'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },
  { id: 'plan-22', goal: 'Get dressed in the morning', emoji: '👕',
    keySteps: ['choose clothes', 'put on underwear', 'put on shirt', 'put on pants', 'put on shoes'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },
  { id: 'plan-23', goal: 'Take out the trash', emoji: '🗑️',
    keySteps: ['tie up the bag', 'lift bag from bin', 'carry to outside bin', 'drop in outside bin', 'put new bag inside'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },
  { id: 'plan-24', goal: 'Wash the dishes', emoji: '🍽️',
    keySteps: ['scrape off food scraps', 'fill sink with soapy water', 'scrub each dish', 'rinse with clean water', 'set on rack to dry'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },
  { id: 'plan-25', goal: 'Make a bowl of cereal', emoji: '🥣',
    keySteps: ['get bowl from cabinet', 'pour cereal in bowl', 'pour milk on top', 'get a spoon', 'sit down to eat'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },
  { id: 'plan-26', goal: 'Feed a pet dog', emoji: '🐕',
    keySteps: ['get food bowl', 'measure out food', 'pour into bowl', 'set on floor for dog', 'fill water bowl too'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },

  // === Tier 2 expansion ===
  { id: 'plan-27', goal: 'Pay your bills', emoji: '💸',
    keySteps: ['gather all bills', 'check account balance', 'pay each bill online or by mail', 'mark as paid', 'file the receipts'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },
  { id: 'plan-28', goal: 'Pick someone up from the airport', emoji: '✈️',
    keySteps: ['confirm arrival time', 'leave with extra time for traffic', 'park or use cell phone lot', 'meet at the agreed door', 'help with luggage and drive home'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },
  { id: 'plan-29', goal: 'Wrap a gift', emoji: '🎁',
    keySteps: ['get paper, scissors, and tape', 'measure paper to size of gift', 'cut the paper', 'fold and tape neatly', 'add a card or bow'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },
  { id: 'plan-30', goal: 'Pack for a weekend trip', emoji: '🧳',
    keySteps: ['check the weather forecast', 'choose clothes for each day', 'pack toiletries', 'pack chargers and documents', 'close and lock the suitcase'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },
  { id: 'plan-31', goal: 'Make a phone call to a friend', emoji: '📞',
    keySteps: ['find the phone number', 'pick a good time when they are free', 'dial the number', 'talk and catch up', 'end the call politely'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },
  { id: 'plan-32', goal: 'Refill a prescription', emoji: '💊',
    keySteps: ['check what medication is low', 'call the pharmacy or use the app', 'wait for it to be ready', 'go pick it up', 'put it where you keep it'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },
  { id: 'plan-33', goal: 'Wash and fold clothes', emoji: '👚',
    keySteps: ['sort lights and darks', 'wash one load at a time', 'move to dryer', 'fold while still warm', 'put clothes away'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },
  { id: 'plan-34', goal: 'Fix a flat bicycle tire', emoji: '🚲',
    keySteps: ['remove the wheel', 'take out the inner tube', 'find and patch the hole', 'put tube back in tire', 'reattach wheel and pump up'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },

  // === Tier 3 expansion (initiative + abstract) ===
  { id: 'plan-35', goal: 'Plan a family vacation', emoji: '🏖️',
    keySteps: ['pick destination together', 'set a budget', 'book flights and hotel', 'plan activities', 'pack and travel'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },
  { id: 'plan-36', goal: 'Apply for a new job', emoji: '💼',
    keySteps: ['update resume', 'search for openings', 'submit applications', 'prepare for interviews', 'follow up after interviews'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },
  { id: 'plan-37', goal: 'Sell something online', emoji: '💻',
    keySteps: ['take clear photos of item', 'write an honest description', 'set a fair price', 'post the listing', 'arrange shipping or pickup'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },
  { id: 'plan-38', goal: 'Host a small dinner party', emoji: '🍷',
    keySteps: ['decide on the date and guests', 'plan a menu', 'shop for ingredients', 'cook and set the table', 'greet guests and serve'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },
  { id: 'plan-39', goal: 'Save up for a big purchase', emoji: '🏦',
    keySteps: ['decide on the goal amount', 'review monthly income and expenses', 'cut non-essential spending', 'set aside money each week', 'buy when you reach the goal'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },
  { id: 'plan-40', goal: 'Start a small garden from scratch', emoji: '🌻',
    keySteps: ['pick a sunny spot', 'prepare the soil', 'choose easy plants', 'plant seeds or seedlings', 'water regularly and weed'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },
  { id: 'plan-41', goal: 'Resolve a disagreement with a friend', emoji: '🤝',
    keySteps: ['take time to calm down', 'reach out and ask to talk', 'listen to their side', 'share how you feel calmly', 'agree on next steps together'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },
  { id: 'plan-42', goal: 'Learn a new skill (like cooking)', emoji: '🎓',
    keySteps: ['pick the specific skill', 'find lessons or videos', 'gather tools or ingredients', 'practice a little each day', 'track progress and adjust'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },

  // === Phase 2 floor-completion fill (Apr 2026) ===
  // T2 +1 — coordinated multi-actor errand
  { id: 'plan-43', goal: 'Drop a friend at the airport', emoji: '🛫',
    keySteps: ['confirm flight time and terminal', 'plan to leave with extra time for traffic', 'help load luggage in the car', 'drive to the correct departures door', 'say goodbye and drive away'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },

  // T3 +2 — abstract / decision-heavy initiation
  { id: 'plan-44', goal: 'Set up a weekly home budget', emoji: '📊',
    keySteps: ['list all monthly income', 'review recent expenses by category', 'decide spending limits per category', 'choose a tool to track it weekly', 'review and adjust each month'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },
  { id: 'plan-45', goal: 'Plan a return to driving after a long break', emoji: '🚗',
    keySteps: ['decide on a goal date and route', 'review traffic rules and any new laws', 'practice in an empty lot first', 'take a few short supervised drives', 'gradually drive on busier roads alone'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },

  // === Phase 6 expansion — +5 per tier toward Target=20 ===
  // T1 — familiar daily routines
  { id: 'plan-46', goal: 'Make a piece of toast with jam', emoji: '🍞',
    keySteps: ['take bread from the bag', 'place it in the toaster', 'wait until it pops up', 'spread jam on top', 'put it on a plate to eat'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },
  { id: 'plan-47', goal: 'Make the bed', emoji: '🛏️',
    keySteps: ['pull off the old sheets if needed', 'straighten the bottom sheet', 'pull the blanket up evenly', 'arrange the pillows at the top', 'smooth out any wrinkles'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },
  { id: 'plan-48', goal: 'Sweep the kitchen floor', emoji: '🧹',
    keySteps: ['move chairs out of the way', 'get the broom and dustpan', 'sweep into one pile', 'scoop pile into dustpan', 'empty dustpan into trash'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },
  { id: 'plan-49', goal: 'Pour a glass of water', emoji: '💧',
    keySteps: ['get a clean glass from the cabinet', 'walk to the sink or fridge', 'pour water into the glass', 'turn off the tap if used', 'carry the glass carefully'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },
  { id: 'plan-50', goal: 'Put on a coat to go outside', emoji: '🧥',
    keySteps: ['take coat off the hook', 'put one arm in a sleeve', 'put the other arm in', 'zip or button it up', 'check pockets for keys'],
    idealOrder: [0, 1, 2, 3, 4], tier: 1 },

  // T2 — multi-stage with mild decision points
  { id: 'plan-51', goal: 'Schedule a haircut appointment', emoji: '✂️',
    keySteps: ['look up the salon phone number', 'check your calendar for free times', 'call and ask for an opening', 'confirm date and stylist', 'write it in your calendar'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },
  { id: 'plan-52', goal: 'Order food for delivery', emoji: '🥡',
    keySteps: ['decide what kind of food you want', 'open the menu or app', 'pick items and add to cart', 'enter address and payment', 'wait and tip the driver'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },
  { id: 'plan-53', goal: 'Change the sheets on a bed', emoji: '🛌',
    keySteps: ['take pillows and blankets off', 'strip the old sheets', 'put on the fitted sheet', 'add the flat sheet and blanket', 'put pillows back on'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },
  { id: 'plan-54', goal: 'Book a ride share to an appointment', emoji: '🚕',
    keySteps: ['check what time you need to arrive', 'open the ride share app', 'enter pickup and drop-off', 'request the ride and confirm', 'wait outside at pickup spot'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },
  { id: 'plan-55', goal: 'Return a library book', emoji: '📚',
    keySteps: ['find the book at home', 'check the due date', 'bring it to the library', 'drop it in the return slot', 'check if you owe a fine'],
    idealOrder: [0, 1, 2, 3, 4], tier: 2 },

  // T3 — abstract / initiative-heavy
  { id: 'plan-56', goal: 'Choose a new hobby to try this month', emoji: '🎨',
    keySteps: ['list what interests you', 'check time and budget you have', 'pick one to try first', 'gather any needed supplies', 'schedule a first session this week'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },
  { id: 'plan-57', goal: 'Prepare to host a holiday gathering', emoji: '🎄',
    keySteps: ['decide on date and guest list', 'plan the menu', 'send invitations', 'shop and cook ahead', 'set up the space and welcome guests'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },
  { id: 'plan-58', goal: 'Plan a weekly meal prep routine', emoji: '🥗',
    keySteps: ['pick recipes for the week', 'make a grocery list', 'shop for ingredients', 'cook and portion meals', 'store them in the fridge or freezer'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },
  { id: 'plan-59', goal: 'Reconnect with an old friend', emoji: '💌',
    keySteps: ['find their current contact info', 'decide on a friendly opening message', 'reach out by text, call, or email', 'suggest a time to catch up', 'follow through with the plan'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },
  { id: 'plan-60', goal: 'Plan a volunteer day in your community', emoji: '🤲',
    keySteps: ['decide what cause matters to you', 'search local organizations', 'sign up for a shift', 'plan transport and what to bring', 'show up and follow their lead'],
    idealOrder: [0, 1, 2, 3, 4], tier: 3 },
];

export function getPlanningItemsByTier(tier: number): PlanningItem[] {
  return PLANNING_ITEMS.filter(item => item.tier === tier);
}

// ─── Phase 1.5 Adaptive Standard ───────────────────────────────────────────
// Strict 3-tier mapping for executive-function exercise.
// Engine level (1-10) → tier (1|2|3). No ±tolerance, no blending.

export type PlanningTier = 1 | 2 | 3;

export const mapEngineLevelToPlanningTier = (level: number): PlanningTier => {
  if (level <= 3) return 1;
  if (level <= 7) return 2;
  return 3;
};

/**
 * Strict tier-isolated selector (Phase 1.5 contract).
 * Returns ONLY items at the tier corresponding to the engine level.
 */
export function getPlanningItemsForLevel(
  level: number,
  count: number,
  excludeIds: string[] = []
): PlanningItem[] {
  const targetTier = mapEngineLevelToPlanningTier(level);
  const excludeSet = new Set(excludeIds);
  let pool = PLANNING_ITEMS.filter(
    item => item.tier === targetTier && !excludeSet.has(item.id)
  );
  if (pool.length === 0) {
    // Pool exhausted by exclusions — allow repeats WITHIN tier (never blend).
    pool = PLANNING_ITEMS.filter(item => item.tier === targetTier);
  }
  const order = pool.map(p => [Math.random(), p] as const).sort((a, b) => a[0] - b[0]);
  return order.slice(0, Math.min(count, order.length)).map(([, p]) => p);
}

/**
 * Perceptual difficulty score per item — used by the audit harness to
 * confirm an L1 → L10 curve actually exists for executive function.
 *   • step_density: avg chars per keyStep (proxy for sub-planning depth)
 *   • initiative: count of decision/abstraction verbs in goal + steps
 */
export function computePlanningDifficulty(item: PlanningItem): {
  step_density: number;
  initiative: number;
  composite: number;
} {
  const stepLens = item.keySteps.map(s => s.length);
  const step_density = stepLens.reduce((a, b) => a + b, 0) / Math.max(1, stepLens.length);

  const INITIATIVE_TOKENS = [
    'plan', 'decide', 'choose', 'set', 'pick', 'review', 'research',
    'budget', 'schedule', 'goal', 'arrange', 'follow up', 'practice',
    'track', 'adjust', 'apply', 'prepare', 'organize', 'host',
    'resolve', 'invite', 'design', 'manage', 'consider',
  ];
  const haystack = (item.goal + ' ' + item.keySteps.join(' ')).toLowerCase();
  let initiative = 0;
  for (const tok of INITIATIVE_TOKENS) if (haystack.includes(tok)) initiative++;

  const composite = (step_density / 60) * 0.5 + (initiative / 6) * 0.5;
  return { step_density, initiative, composite };
}
