/**
 * Therapist Feedback Library
 * 
 * Replaces robotic "Correct!" / "You got 7/10" with
 * contextual, therapist-like feedback that references
 * what the user actually did.
 * 
 * Categories:
 * 1. In-conversation success feedback
 * 2. Post-card transition feedback (performance-aware)
 * 3. Difficulty change narration
 * 4. Circumlocution help responses
 */

// ═══════════════════════════════════════════════════════════════
// 1. In-conversation success feedback (replaces "Correct!")
// ═══════════════════════════════════════════════════════════════

const QUICK_SUCCESS = [
  "You didn't even hesitate on that one.",
  "That came right out — nice!",
  "Smooth. Really smooth.",
  "Ha, no pause at all!",
  "That was effortless.",
  "See? Rolled right off.",
];

const RECOVERED_SUCCESS = [
  "You got there — and you got there yourself.",
  "Took a second, but you found it.",
  "See? You knew it. Just needed a moment.",
  "It came to you — that's what matters.",
  "A little work, but you got it.",
];

const IMPROVED_FROM_BEFORE = [
  "That one used to trip you up — not anymore.",
  "Remember when that was harder? Look at you now.",
  "That's getting easier for you, I can tell.",
  "Way smoother than last time.",
  "You're getting faster with those.",
];

const STRUGGLE_ENCOURAGEMENT = [
  "That's a tough one. Don't worry about it.",
  "Hey, that's hard for anyone.",
  "Almost! You were really close.",
  "Good try — we'll come back to that one.",
  "That word is tricky. You'll get it.",
];

// ═══════════════════════════════════════════════════════════════
// 2. Post-card transition (performance-aware returns)
// ═══════════════════════════════════════════════════════════════

interface PostCardContext {
  success: boolean;
  cardType: string;
  userResponse?: string;
  topic: string | null;
  /** Did user succeed quickly (e.g. first attempt, no cue) */
  wasQuick?: boolean;
  /** Has user struggled with this type before */
  wasHardBefore?: boolean;
}

const POST_CARD_SUCCESS_WITH_TOPIC = [
  "Nice! That was clean. So, back to {topic} — what else?",
  "Ha, smooth! Okay — you were telling me about {topic}...",
  "Got it! Alright, more about {topic}?",
  "That came easy! So — {topic}. Where were we?",
];

const POST_CARD_SUCCESS_IMPROVEMENT = [
  "Oh, that's way better than before! Okay — so {topic}?",
  "See the difference? That was smoother. Anyway — {topic}?",
  "You're getting quicker at those! So — what about {topic}?",
];

const POST_CARD_SUCCESS_NO_TOPIC = [
  "Nice! Okay, what were you telling me?",
  "Got it! So, where were we?",
  "That was good! Alright, keep going.",
];

const POST_CARD_STRUGGLE = [
  "No worries at all. So — what were you telling me?",
  "That's okay! Let's go back to chatting.",
  "Don't even sweat it. What else is going on?",
  "Hey, that's a tough one. Anyway — you were saying?",
];

// ═══════════════════════════════════════════════════════════════
// 3. Difficulty change narration
// ═══════════════════════════════════════════════════════════════

const DIFFICULTY_DOWN = [
  "Let's try something a little easier.",
  "How about we make this simpler?",
  "Let me try a different angle on that.",
  "Okay, let's take it down a notch.",
];

const DIFFICULTY_UP = [
  "You're ready for a bit more. Let's stretch it.",
  "That was smooth — want to try something a little harder?",
  "You're doing great. Let me make it a tiny bit trickier.",
  "I think you can handle more. Let's see.",
];

// ═══════════════════════════════════════════════════════════════
// 4. Circumlocution help (in-conversation word-finding)
// ═══════════════════════════════════════════════════════════════

const CIRCUMLOCUTION_OFFER = [
  "I think I know what you mean —",
  "Are you thinking of",
  "You might be looking for —",
  "Oh, do you mean",
  "Sounds like you're thinking of",
];

// Dedup
const _usedFeedback = new Map<string, string[]>();

function pickFeedback(pool: string[], category: string): string {
  const used = _usedFeedback.get(category) || [];
  const available = pool.filter(l => !used.includes(l));
  const usePool = available.length > 0 ? available : pool;
  const picked = usePool[Math.floor(Math.random() * usePool.length)];
  used.push(picked);
  if (used.length > 4) used.shift();
  _usedFeedback.set(category, used);
  return picked;
}

// ═══════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════

export function getSuccessFeedback(opts: {
  wasQuick?: boolean;
  wasHardBefore?: boolean;
  wasEffortful?: boolean;
}): string {
  if (opts.wasHardBefore) return pickFeedback(IMPROVED_FROM_BEFORE, 'improved');
  if (opts.wasQuick) return pickFeedback(QUICK_SUCCESS, 'quick');
  if (opts.wasEffortful) return pickFeedback(RECOVERED_SUCCESS, 'recovered');
  return pickFeedback(QUICK_SUCCESS, 'quick');
}

export function getStruggleFeedback(): string {
  return pickFeedback(STRUGGLE_ENCOURAGEMENT, 'struggle');
}

export function getPostCardReturn(ctx: PostCardContext): string {
  if (ctx.success) {
    if (ctx.wasHardBefore && ctx.topic) {
      return pickFeedback(POST_CARD_SUCCESS_IMPROVEMENT, 'post_improve')
        .replace('{topic}', ctx.topic);
    }
    if (ctx.topic) {
      return pickFeedback(POST_CARD_SUCCESS_WITH_TOPIC, 'post_success_topic')
        .replace(/{topic}/g, ctx.topic);
    }
    return pickFeedback(POST_CARD_SUCCESS_NO_TOPIC, 'post_success');
  }
  return pickFeedback(POST_CARD_STRUGGLE, 'post_struggle');
}

export function getDifficultyNarration(direction: 'easier' | 'harder'): string {
  return direction === 'easier'
    ? pickFeedback(DIFFICULTY_DOWN, 'diff_down')
    : pickFeedback(DIFFICULTY_UP, 'diff_up');
}

export function getCircumlocutionOffer(suggestedWord?: string): string {
  const opener = pickFeedback(CIRCUMLOCUTION_OFFER, 'circum');
  if (suggestedWord) return `${opener} "${suggestedWord}"?`;
  return opener;
}

export function resetFeedbackTracking(): void {
  _usedFeedback.clear();
}
