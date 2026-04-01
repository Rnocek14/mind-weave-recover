/**
 * Game Transition System — Seamless entry/exit for mini-games
 * 
 * Ensures games feel like "a helpful moment" not "a mode switch":
 * - Contextual intro tied to conversation topic
 * - Anchored return that connects game results back to chat
 * - No "Let's play a game!" — always purposeful
 */

export interface GameTransitionContext {
  currentTopic: string | null;
  triggerType: 'confidence_rebuild' | 'targeted_drill' | 'scaffolded_choice_game';
  gameSlug: string;
  userLastWords: string;
  trlLevel: number;
}

export interface GameReturnContext {
  gameSlug: string;
  currentTopic: string | null;
  wasSuccessful: boolean;
  score: number;
  accuracy: number;
  /** Specific words/items the user got right */
  successItems: string[];
}

/**
 * Generate a natural transition INTO a game
 * The intro should feel like part of the conversation, not a mode switch
 */
export function generateGameIntro(ctx: GameTransitionContext): string {
  const { currentTopic, triggerType, trlLevel } = ctx;

  // Level 4 / confidence rebuild — ultra gentle + purposeful + emotional
  if (triggerType === 'confidence_rebuild' || trlLevel >= 4) {
    return pickRandom(
      currentTopic
        ? [
            `That's okay — let's do something quick to loosen things up. It makes finding words easier. Still thinking about ${currentTopic}.`,
            `No pressure — quick warm-up. It takes the edge off and helps words come out smoother. We'll come back to ${currentTopic}.`,
            `Let's try something simple — takes the pressure off a bit.`,
            `Quick one to get things moving again — then back to ${currentTopic}.`,
          ]
        : [
            `That's okay — let's do something quick to loosen things up. It helps.`,
            `No pressure — quick warm-up. Takes the edge off.`,
            `Let's try something simple — makes everything flow a bit better after.`,
            `Quick one to get things moving. No rush.`,
          ]
    );
  }

  // Targeted drill — specific practice
  if (triggerType === 'targeted_drill') {
    const drillIntros = currentTopic
      ? [
          `Since we're talking about ${currentTopic} — quick listening exercise. It helps you catch words more clearly when someone's talking.`,
          `Here's a quick one — sharpens how you hear similar words. Makes a real difference in everyday situations.`,
          `Quick exercise — helps your brain tell similar sounds apart. You'll notice the difference when you're listening to someone.`,
        ]
      : [
          `Quick listening exercise — it helps you catch words more clearly when people talk to you.`,
          `Here's a quick one — makes it easier to tell similar words apart in everyday situations.`,
          `Try this — it helps your brain process what you hear. You'll feel sharper after.`,
        ];
    return pickRandom(drillIntros);
  }

  // Scaffolded choice — momentum builder
  if (triggerType === 'scaffolded_choice_game') {
    const matchIntros = currentTopic
      ? [
          `You're doing great — quick round. This gets the word connections flowing. Still on ${currentTopic}.`,
          `Quick one — makes it easier to grab the right word when you're explaining something.`,
          `Here's a fun one — it loosens up the connections so words come faster. Then back to ${currentTopic}.`,
        ]
      : [
          `You're doing great — quick round to get the connections flowing.`,
          `Quick one — makes it easier to grab the right word when you need it.`,
          `Here's a fun one — it loosens things up so words come to you faster.`,
        ];
    return pickRandom(matchIntros);
  }

  // Fallback
  return currentTopic
    ? `Quick practice — makes everything flow better. Back to ${currentTopic} right after.`
    : "Quick practice — makes it easier to find words when you need them.";
}

/**
 * Generate a natural transition OUT of a game, back into conversation
 * Must anchor to the conversation topic AND reference game performance
 */
export function generateGameReturn(ctx: GameReturnContext): string {
  const { currentTopic, wasSuccessful, successItems } = ctx;

  // Successful game + has topic → anchor back with real-life connection
  if (wasSuccessful && currentTopic) {
    const successReturns = [
      `Nice — that was quicker than before. Back to ${currentTopic} — what else happened?`,
      `Smoother already. That's what we want. So, ${currentTopic} — where were we?`,
      `That was solid — everything should flow easier now. Okay, back to ${currentTopic}.`,
      `Good warm-up. Words should come a bit quicker now. So, ${currentTopic}?`,
    ];
    if (successItems.length > 0) {
      const item = successItems[0];
      successReturns.push(
        `"${item}" — no hesitation on that one. Nice. Speaking of ${currentTopic}...`,
      );
    }
    return pickRandom(successReturns);
  }

  // Successful game + no topic
  if (wasSuccessful) {
    return pickRandom([
      "Nice — that loosened things up. What's on your mind?",
      "That was good. Words should come a bit easier now. Keep going.",
      "Good warm-up — everything flows better after that. What were you thinking about?",
      "Smooth. Go ahead — what's on your mind?",
    ]);
  }

  // Struggled but completed + has topic
  if (!wasSuccessful && currentTopic) {
    return pickRandom([
      `Good effort — it gets a little easier each time. Back to ${currentTopic}?`,
      `That was tough, but each try helps. Back to ${currentTopic}?`,
      `No worries — this kind of practice adds up over time. So, ${currentTopic}...`,
      `That's okay — it'll come easier next time. So, ${currentTopic}?`,
    ]);
  }

  // Struggled + no topic
  return pickRandom([
    "Good effort — every try makes a difference over time.",
    "That's okay — it'll come easier with practice.",
    "No worries. Each time helps more than you think. What were you thinking about?",
    "That'll get easier. What's on your mind?",
  ]);
}

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}
