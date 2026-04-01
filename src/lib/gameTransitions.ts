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

  // Level 4 / confidence rebuild — ultra gentle + purposeful
  if (triggerType === 'confidence_rebuild' || trlLevel >= 4) {
    return pickRandom(
      currentTopic
        ? [
            `That's okay — let's do something quick to get the words flowing. This helps your brain pull words faster when you're talking. Still thinking about ${currentTopic}.`,
            `No pressure — here's a quick warm-up. It helps with finding words in real conversations. We'll come back to ${currentTopic}.`,
            `Let's try something simple — this makes it easier to say what you mean when it matters.`,
          ]
        : [
            `That's okay — let's do something quick to get the words flowing. This helps your brain pull words faster when you're talking.`,
            `No pressure — here's a quick warm-up. It makes finding words easier in real conversations.`,
            `Let's try something simple — this helps when you're talking to someone and need the right word.`,
          ]
    );
  }

  // Targeted drill — specific practice
  if (triggerType === 'targeted_drill') {
    const drillIntros = currentTopic
      ? [
          `Since we're talking about ${currentTopic} — let me give you a quick listening exercise. This helps you catch words more clearly in conversations.`,
          `Here's a quick one — it sharpens how you hear the difference between similar words. Useful in real conversations.`,
          `Quick exercise — this helps your brain tell similar sounds apart, like when someone's talking to you.`,
        ]
      : [
          `Let me give you a quick listening exercise — it helps you catch words more clearly when people talk to you.`,
          `Here's a quick one — it sharpens how you hear differences between words in real conversations.`,
          `Try this — it helps your brain process words faster, like when you're listening to someone.`,
        ];
    return pickRandom(drillIntros);
  }

  // Scaffolded choice — momentum builder
  if (triggerType === 'scaffolded_choice_game') {
    const matchIntros = currentTopic
      ? [
          `You're doing great — let's do a quick round. This helps you match words to meanings faster, like in real conversations. Still on ${currentTopic}.`,
          `Quick one — this gets the word connections flowing, so it's easier when you're talking to someone.`,
          `Here's a fun one — it helps your brain link words faster. Useful when you're explaining something.`,
        ]
      : [
          `You're doing great — let's do a quick round. This helps you connect words faster in real conversations.`,
          `Quick one — this gets your word connections flowing, like when you're talking to someone.`,
          `Here's a fun one — it helps your brain link words to meanings faster.`,
        ];
    return pickRandom(matchIntros);
  }

  // Fallback
  return currentTopic
    ? `Quick practice round — this helps with real conversations. We'll get back to ${currentTopic} right after.`
    : "Quick practice round — this helps you find words faster when you're talking to someone.";
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
      `Nice — you got those fast. That speed is what helps in real conversations. Back to ${currentTopic} — what else happened?`,
      `See? You're quicker now. That's exactly how it gets easier when you're talking to someone. So, ${currentTopic} — where were we?`,
      `That was solid — your brain just got warmed up. Okay, back to ${currentTopic}.`,
    ];
    if (successItems.length > 0) {
      const item = successItems[0];
      successReturns.push(
        `"${item}" — no hesitation. That's the kind of speed that helps when you're explaining something. Speaking of ${currentTopic}...`,
      );
    }
    return pickRandom(successReturns);
  }

  // Successful game + no topic
  if (wasSuccessful) {
    return pickRandom([
      "Nice work — your word finding is getting faster. What's on your mind?",
      "See? Getting quicker. That's what makes real conversations easier. Keep going.",
      "That was good — your brain is warmed up now. What were you thinking about?",
    ]);
  }

  // Struggled but completed + has topic
  if (!wasSuccessful && currentTopic) {
    return pickRandom([
      `Good effort — those get easier with practice, and it all helps when you're talking to someone. Back to ${currentTopic}?`,
      `That was tough, but every time you try it gets a little easier in real conversations. Back to ${currentTopic}?`,
      `No worries — this kind of practice adds up. So, ${currentTopic}...`,
    ]);
  }

  // Struggled + no topic
  return pickRandom([
    "Good effort — every try makes it a little easier when you're talking to someone.",
    "That's okay — this kind of practice helps your brain find words faster over time.",
    "No worries. Each time helps. What were you thinking about before?",
  ]);
}

function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}
