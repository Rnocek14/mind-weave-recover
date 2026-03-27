/**
 * Graduated Silence Response System
 * 
 * Instead of generic "take your time", Maya provides escalating
 * therapeutic cues based on how long the user has been silent.
 * 
 * Clinical basis: Cueing hierarchy (encouragement → semantic → phonemic → model)
 * 
 * Thresholds:
 *  3s → Encouragement ("Take your time...")
 *  6s → Semantic cue ("Think about what you did this morning...")
 *  10s → Phonemic / narrowing ("How about just one word?")
 *  15s → Offer help ("Want me to give you a topic?")
 */

export interface SilenceCueLevel {
  thresholdSeconds: number;
  type: 'encouragement' | 'semantic' | 'narrowing' | 'offer_help';
  /** Whether Maya should speak this aloud (TTS) */
  spoken: boolean;
  /** Whether this should show as text only (subtitle) */
  textOnly: boolean;
}

export const SILENCE_CUE_LEVELS: SilenceCueLevel[] = [
  { thresholdSeconds: 3, type: 'encouragement', spoken: false, textOnly: true },
  { thresholdSeconds: 6, type: 'semantic', spoken: true, textOnly: false },
  { thresholdSeconds: 10, type: 'narrowing', spoken: true, textOnly: false },
  { thresholdSeconds: 15, type: 'offer_help', spoken: false, textOnly: true },
];

// Encouragement lines (3s) — shown as text, not spoken
const ENCOURAGEMENT_LINES = [
  "Take your time...",
  "No rush at all...",
  "I'm here, whenever you're ready...",
  "It's okay, think about it...",
  "Take a moment...",
];

// Semantic cues (6s) — spoken by Maya
const SEMANTIC_CUES_BY_TOPIC: Record<string, string[]> = {
  food: [
    "Think about meals... what do you usually eat?",
    "Picture your kitchen... what do you see?",
    "What's something you had to drink today?",
  ],
  family: [
    "Think about the people around you...",
    "Who did you see today?",
    "Picture someone you care about...",
  ],
  activities: [
    "Think about what you did today...",
    "Where did you go recently?",
    "What's something you like to do?",
  ],
  health: [
    "How's your body feeling?",
    "Think about how you slept...",
    "What did you do for exercise?",
  ],
};

const SEMANTIC_CUES_GENERIC = [
  "Think about your morning... what happened?",
  "Picture where you are... what do you see?",
  "What's one thing on your mind right now?",
  "Think about something that happened recently...",
];

// Narrowing cues (10s) — spoken, very simple
const NARROWING_CUES = [
  "How about just one word that comes to mind?",
  "Even a short answer works — anything at all.",
  "Just say whatever pops up first.",
  "One word is plenty. What comes to mind?",
  "Start with anything — even yes or no.",
];

// Offer help (15s) — text only
const OFFER_HELP_LINES = [
  "Want me to give you an idea?",
  "I can suggest something if you'd like.",
  "Shall I help you get started?",
];

// Dedup tracking
const _usedLines = new Map<string, string[]>();

function pickUnused(pool: string[], category: string): string {
  const used = _usedLines.get(category) || [];
  const available = pool.filter(l => !used.includes(l));
  const usePool = available.length > 0 ? available : pool;
  const picked = usePool[Math.floor(Math.random() * usePool.length)];
  used.push(picked);
  if (used.length > 3) used.shift();
  _usedLines.set(category, used);
  return picked;
}

/**
 * Get the appropriate silence cue for the current silence duration.
 * Returns null if no new cue should fire (already at this level).
 */
export function getSilenceCue(
  silenceSeconds: number,
  currentTopic: string | null,
  lastFiredLevel: number,
): { text: string; level: SilenceCueLevel; levelIndex: number } | null {
  // Find the highest applicable level
  let applicableLevel: SilenceCueLevel | null = null;
  let applicableIndex = -1;
  
  for (let i = SILENCE_CUE_LEVELS.length - 1; i >= 0; i--) {
    if (silenceSeconds >= SILENCE_CUE_LEVELS[i].thresholdSeconds) {
      applicableLevel = SILENCE_CUE_LEVELS[i];
      applicableIndex = i;
      break;
    }
  }
  
  if (!applicableLevel || applicableIndex <= lastFiredLevel) {
    return null; // Already fired this level or no level applies
  }
  
  let text: string;
  
  switch (applicableLevel.type) {
    case 'encouragement':
      text = pickUnused(ENCOURAGEMENT_LINES, 'encouragement');
      break;
    case 'semantic': {
      const topicPool = currentTopic && SEMANTIC_CUES_BY_TOPIC[currentTopic]
        ? SEMANTIC_CUES_BY_TOPIC[currentTopic]
        : SEMANTIC_CUES_GENERIC;
      text = pickUnused(topicPool, 'semantic');
      break;
    }
    case 'narrowing':
      text = pickUnused(NARROWING_CUES, 'narrowing');
      break;
    case 'offer_help':
      text = pickUnused(OFFER_HELP_LINES, 'offer_help');
      break;
  }
  
  return { text, level: applicableLevel, levelIndex: applicableIndex };
}

/** Reset dedup tracking (call on session reset) */
export function resetSilenceCueTracking(): void {
  _usedLines.clear();
}
