/**
 * Thought Continuation Game Types
 * 
 * This game type uses "flow" evaluation - no right/wrong answers,
 * only momentum-based metrics that measure continuation and completion.
 */

// =============================================================================
// Prompt Types
// =============================================================================

export type IntentType = 
  | 'explain_reason'      // "The reason I stopped..."
  | 'describe_event'      // "Talk about the last time..."
  | 'express_opinion'     // "What I don't like about..."
  | 'recall_recent'       // "The last thing I..."
  | 'describe_feeling'    // "How I felt when..."
  | 'compare_contrast'    // "The difference between..."
  | 'solve_problem';      // "How I would fix..."

export type PromptTheme = 
  | 'daily_routine'
  | 'home'
  | 'family'
  | 'preferences'
  | 'memories'
  | 'health'
  | 'hobbies'
  | 'food'
  | 'weather'
  | 'travel';

export type TimeAnchor = 
  | 'last'        // "The last time..."
  | 'recent'      // "Recently..."
  | 'today'       // "Today..."
  | 'yesterday'   // "Yesterday..."
  | 'this_week';  // "This week..."

export interface NarrowingStep {
  level: number;  // 1, 2, 3...
  text: string;   // The narrowing hint text
}

export interface ThoughtPrompt {
  id: string;
  intentType: IntentType;
  theme: PromptTheme;
  promptText: string;
  narrowingSteps: NarrowingStep[];
  difficultyTier: 1 | 2 | 3;  // 1 = easiest (most constrained), 3 = broadest
  timeAnchor?: TimeAnchor;
  isActive: boolean;
}

// =============================================================================
// Flow Metrics (No Correctness)
// =============================================================================

export interface MomentumComponents {
  pauseRatio: number;           // Total pause time / total duration
  prewordPauseAvgMs: number;    // Average pause before words
  filledPauseRate: number;      // Filled pauses (um, uh) per word
  burstCount: number;           // Number of speech bursts
  longestPauseMs: number;       // Longest single pause
  trailingOffDetected: boolean; // Ended with "and... yeah..." pattern
}

export interface FlowMetrics {
  didSpeak: boolean;
  utteranceComplete: boolean;
  coherenceScore?: number;      // 0-1, optional in MVP
  momentumScore: number;        // 0-1, computed from components
  momentumComponents: MomentumComponents;
  latencyToFirstWordMs: number;
  narrowingLevelUsed: number;   // 0 = no hints needed
  narrowingTrigger?: 'auto_silence' | 'user_request';
}

// =============================================================================
// Attempt/Session Types
// =============================================================================

export interface ThoughtAttempt {
  attemptId: string;
  sessionId: string;
  userId: string;
  profileId: string;
  prompt: ThoughtPrompt;
  transcript?: string;
  flowMetrics: FlowMetrics;
  recordingDurationMs?: number;
  audioStoragePath?: string;
  createdAt: Date;
}

export interface ThoughtSessionSummary {
  totalPrompts: number;
  promptsSpoken: number;
  avgMomentumScore: number;
  avgLatencyMs: number;
  hintsUsedCount: number;
  completedThoughts: number;
  longestUtterance?: string;
}

// =============================================================================
// Game State
// =============================================================================

export type ThoughtGamePhase = 
  | 'idle'           // Showing prompt, mic warm
  | 'listening'      // Detected speech, updating transcript
  | 'processing'     // Speech ended, calculating flow metrics
  | 'celebrated'     // Showing positive feedback
  | 'narrowing';     // Showing hint, waiting to continue

export interface ThoughtGameState {
  phase: ThoughtGamePhase;
  currentPrompt: ThoughtPrompt | null;
  currentAttemptId: string | null;
  transcript: string;
  narrowingLevel: number;
  silenceStartedAt: number | null;
  speechStartedAt: number | null;
  promptIndex: number;
  totalPrompts: number;
}

// =============================================================================
// Positive Feedback (Never "wrong")
// =============================================================================

export type FeedbackType = 
  | 'kept_going'        // Any speech at all
  | 'clear_finish'      // Completed a thought
  | 'added_detail'      // Longer than minimum
  | 'good_recovery'     // Used hint and continued
  | 'smooth_flow';      // High momentum score

export const FEEDBACK_MESSAGES: Record<FeedbackType, string[]> = {
  kept_going: [
    "Nice, you kept it moving.",
    "That works.",
    "Good answer.",
  ],
  clear_finish: [
    "You finished that thought.",
    "That was clear.",
    "Nice complete thought.",
  ],
  added_detail: [
    "Good detail.",
    "You added more, nice.",
    "That's helpful context.",
  ],
  good_recovery: [
    "Good recovery.",
    "The hint helped, nice.",
    "You found your way.",
  ],
  smooth_flow: [
    "Smooth.",
    "That flowed well.",
    "Nice and steady.",
  ],
};

// =============================================================================
// Helper Functions
// =============================================================================

export function selectFeedback(types: FeedbackType[]): string {
  if (types.length === 0) {
    return "Nice."; // Fallback
  }
  // Pick the "best" feedback type (later ones are more specific)
  const bestType = types[types.length - 1];
  const messages = FEEDBACK_MESSAGES[bestType];
  return messages[Math.floor(Math.random() * messages.length)];
}

export function determineFeedbackTypes(metrics: FlowMetrics): FeedbackType[] {
  const types: FeedbackType[] = [];
  
  if (metrics.didSpeak) {
    types.push('kept_going');
  }
  
  if (metrics.utteranceComplete) {
    types.push('clear_finish');
  }
  
  if (metrics.narrowingLevelUsed > 0 && metrics.didSpeak) {
    types.push('good_recovery');
  }
  
  if (metrics.momentumScore >= 0.7) {
    types.push('smooth_flow');
  }
  
  return types;
}
