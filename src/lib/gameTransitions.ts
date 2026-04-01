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
  const { currentTopic, triggerType, gameSlug, trlLevel } = ctx;

  // Level 4 / confidence rebuild — ultra gentle
  if (triggerType === 'confidence_rebuild' || trlLevel >= 4) {
    return pickRandom(
      currentTopic
        ? [
            `That's okay — let's do something quick and easy to get the words flowing. Still thinking about ${currentTopic}.`,
            `No pressure — here's a quick one to warm up. We'll come back to ${currentTopic}.`,
            `Let's try something simple to build momentum.`,
          ]
        : [
            `That's okay — let's do something quick and easy to get the words flowing.`,
            `No pressure — here's a quick warm-up.`,
            `Let's try something simple to build momentum.`,
          ]
    );
  }

  // Targeted drill — specific practice
  if (triggerType === 'targeted_drill') {
    const drillIntros = currentTopic
      ? [
          `Since we're talking about ${currentTopic} — let me give you a quick listening exercise.`,
          `Here's a quick one that'll help with those sounds.`,
          `Let's sharpen those ears real quick — this'll help.`,
        ]
      : [
          `Let me give you a quick listening exercise — it'll help.`,
          `Here's a quick one to sharpen those ears.`,
          `Try this — it's quick and it'll help with those sounds.`,
        ];
    return pickRandom(drillIntros);
  }

  // Scaffolded choice — momentum builder
  if (triggerType === 'scaffolded_choice_game') {
    const matchIntros = currentTopic
      ? [
          `You're doing great — let's do a quick round to build momentum. Still on ${currentTopic}.`,
          `Quick one — this'll get the words flowing faster.`,
          `Here's a fun one to keep that momentum going.`,
        ]
      : [
          `You're doing great — let's do a quick round to build momentum.`,
          `Quick one — this'll get the words flowing faster.`,
          `Here's a fun one to keep the momentum.`,
        ];
    return pickRandom(matchIntros);
  }

  // Fallback
  return currentTopic
    ? `Quick practice round — we'll get back to ${currentTopic} right after.`
    : "Quick practice round — this'll help.";
}

/**
 * Generate a natural transition OUT of a game, back into conversation
 * Must anchor to the conversation topic AND reference game performance
 */
export function generateGameReturn(ctx: GameReturnContext): string {
  const { currentTopic, wasSuccessful, score, successItems } = ctx;

  // Successful game + has topic → anchor back
  if (wasSuccessful && currentTopic) {
    const successReturns = [
      `Nice — you got those fast. Back to ${currentTopic} — what else happened?`,
      `See? You're quicker now. So, ${currentTopic} — where were we?`,
      `That was solid! Okay, back to ${currentTopic}.`,
    ];
    // If we have specific success items, reference them
    if (successItems.length > 0) {
      const item = successItems[0];
      successReturns.push(
        `"${item}" — no hesitation. Speaking of ${currentTopic}...`,
      );
    }
    return pickRandom(successReturns);
  }

  // Successful game + no topic
  if (wasSuccessful) {
    return pickRandom([
      "Nice work! You're warmed up — what's on your mind?",
      "See? Getting faster. Okay — keep going.",
      "That was good. What were you thinking about?",
    ]);
  }

  // Struggled but completed + has topic
  if (!wasSuccessful && currentTopic) {
    return pickRandom([
      `Good effort — those are tricky. Let's get back to ${currentTopic} — that was more fun.`,
      `That was tough, but you stuck with it. Back to ${currentTopic}?`,
      `No worries — we'll practice more. So, ${currentTopic}...`,
    ]);
  }

  // Struggled + no topic
  return pickRandom([
    "Good effort — those are tricky. What else is on your mind?",
    "That's okay — those take practice. Keep talking to me.",
    "No worries. What were you thinking about before?",
  ]);
}

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}
