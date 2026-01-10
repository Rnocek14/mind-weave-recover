/**
 * Conversation Cue Engine
 * 
 * Maps real-time speech analysis to appropriate cue actions.
 * Determines what support to show in the Assistive Panel based on
 * user's current utterance characteristics.
 * 
 * Evidence-based cue hierarchy:
 * 1. Semantic cues (category, use, description)
 * 2. Phonemic cues (first sound, syllable count)
 * 3. Full word (as last resort)
 */

import { getWordsForTopic, getFramesForTopic, getRelatedWords } from './topicWordBanks';

// Types for cue recommendations
export type CueAction = 
  | 'show_tiles'      // Show word choice tiles
  | 'show_frames'     // Show sentence frames
  | 'show_semantic'   // Show semantic hint
  | 'show_phonemic'   // Show phonemic hint
  | 'show_word'       // Show the target word
  | 'reduce_options'  // Narrow choices to 2
  | 'escalate'        // Move to next cue level
  | 'celebrate'       // User succeeded!
  | 'none';           // No action needed

export interface CueRecommendation {
  action: CueAction;
  tiles?: string[];
  frames?: string[];
  cueText?: string;
  cueLevel: number;
  reasoning: string;
}

export interface UtteranceSignals {
  // From speech analysis
  effortfulSpeech: boolean;
  circumlocutionDetected: boolean;
  pausePattern: 'fluent' | 'hesitant' | 'very_slow';
  wordCount: number;
  filledPauseCount: number;
  fluencyScore: number;
  
  // From silence detection
  silenceMs: number;
  
  // Context
  lastUserWords?: string[];
  primedVocabulary?: string[];
}

interface CueState {
  currentLevel: number;
  lastActionTime: number;
  escalationCount: number;
  targetWord?: string;
}

const CUE_ESCALATION_THRESHOLD_MS = 5000; // Escalate if no progress after 5s

/**
 * Main function: analyze utterance signals and recommend cue action
 */
export function getCueForUtterance(
  signals: UtteranceSignals,
  topic: string | null,
  primedVocabulary: string[],
  currentCueState: CueState
): CueRecommendation {
  const { 
    effortfulSpeech, 
    circumlocutionDetected, 
    pausePattern, 
    wordCount,
    filledPauseCount,
    silenceMs,
    fluencyScore,
  } = signals;

  // 1. User is flowing well - no intervention needed
  if (fluencyScore > 75 && wordCount >= 3 && !effortfulSpeech && pausePattern === 'fluent') {
    return {
      action: wordCount >= 5 ? 'celebrate' : 'none',
      cueLevel: 0,
      reasoning: 'User flowing well, no support needed',
    };
  }

  // 2. Complete silence (>3s) - show tiles immediately
  if (silenceMs > 3000 && wordCount === 0) {
    const tiles = primedVocabulary.length > 0 
      ? primedVocabulary.slice(0, 4)
      : getWordsForTopic(topic, [], 4);
    
    return {
      action: 'show_tiles',
      tiles,
      frames: getFramesForTopic(topic, 2),
      cueLevel: 1,
      reasoning: 'Extended silence - offering word choices',
    };
  }

  // 3. Long silence with some attempt (user struggling)
  if (silenceMs > 5000 && wordCount < 3) {
    const tiles = getWordsForTopic(topic, signals.lastUserWords || [], 4);
    
    return {
      action: 'show_tiles',
      tiles,
      frames: getFramesForTopic(topic, 2),
      cueLevel: 2,
      reasoning: 'User struggling with long pause',
    };
  }

  // 4. High filled pause count (um, uh, er) - needs structure
  if (filledPauseCount >= 3 || pausePattern === 'very_slow') {
    return {
      action: 'show_frames',
      frames: getFramesForTopic(topic, 3),
      cueLevel: 2,
      reasoning: 'Multiple filled pauses - offering sentence structure',
    };
  }

  // 5. Circumlocution detected - help find the word
  if (circumlocutionDetected) {
    // Try to guess what word they're looking for from primed vocabulary
    const relatedWords = primedVocabulary.length > 0
      ? primedVocabulary.slice(0, 3)
      : getWordsForTopic(topic, [], 3);
    
    return {
      action: 'show_tiles',
      tiles: relatedWords,
      cueText: 'Looking for a word? Try one of these:',
      cueLevel: 3,
      reasoning: 'Circumlocution detected - showing related words',
    };
  }

  // 6. Effortful speech with some output - gentle support
  if (effortfulSpeech && wordCount >= 1) {
    // User is trying, give subtle help
    return {
      action: 'show_frames',
      frames: getFramesForTopic(topic, 2),
      cueLevel: 1,
      reasoning: 'Effortful but producing - light scaffold',
    };
  }

  // 7. Hesitant pattern - offer choices
  if (pausePattern === 'hesitant' && wordCount < 3) {
    const tiles = getWordsForTopic(topic, signals.lastUserWords || [], 4);
    
    return {
      action: 'show_tiles',
      tiles,
      cueLevel: 2,
      reasoning: 'Hesitant pattern - offering word choices',
    };
  }

  // 8. Brief response (1-2 words) - could offer expansion
  if (wordCount === 1 || wordCount === 2) {
    // Get words related to what they said
    const relatedWords = signals.lastUserWords?.[0]
      ? getRelatedWords(signals.lastUserWords[0], 3)
      : getWordsForTopic(topic, [], 3);
    
    return {
      action: 'show_tiles',
      tiles: relatedWords,
      cueLevel: 1,
      reasoning: 'Brief response - offering related words to expand',
    };
  }

  // Default: no intervention
  return {
    action: 'none',
    cueLevel: 0,
    reasoning: 'No clear signal for intervention',
  };
}

/**
 * Create initial cue state
 */
export function createInitialCueState(): CueState {
  return {
    currentLevel: 0,
    lastActionTime: Date.now(),
    escalationCount: 0,
    targetWord: undefined,
  };
}

/**
 * Update cue state after an action
 */
export function updateCueState(
  state: CueState,
  action: CueAction,
  success: boolean
): CueState {
  if (success || action === 'celebrate') {
    // Reset on success
    return createInitialCueState();
  }

  if (action === 'escalate' || action === 'show_phonemic' || action === 'show_word') {
    return {
      ...state,
      currentLevel: Math.min(state.currentLevel + 1, 4),
      lastActionTime: Date.now(),
      escalationCount: state.escalationCount + 1,
    };
  }

  return {
    ...state,
    lastActionTime: Date.now(),
  };
}

/**
 * Check if we should auto-escalate based on time
 */
export function shouldEscalate(state: CueState): boolean {
  const timeSinceAction = Date.now() - state.lastActionTime;
  return timeSinceAction > CUE_ESCALATION_THRESHOLD_MS && state.currentLevel < 4;
}

/**
 * Get cue text for a specific level
 */
export function getCueTextForLevel(
  level: number,
  targetWord?: string,
  topic?: string
): string {
  switch (level) {
    case 1:
      return topic 
        ? `Think about ${topic}...`
        : 'Take your time...';
    case 2:
      return targetWord
        ? `It's something you ${getSemanticHint(targetWord)}`
        : 'What category is it?';
    case 3:
      return targetWord
        ? `It starts with "${targetWord.charAt(0)}..."`
        : 'Think about the first sound...';
    case 4:
      return targetWord
        ? `The word is "${targetWord}"`
        : 'Here\'s a hint...';
    default:
      return '';
  }
}

// Helper to generate semantic hints
function getSemanticHint(word: string): string {
  const hints: Record<string, string> = {
    'eggs': 'eat for breakfast',
    'toast': 'eat with butter',
    'coffee': 'drink in the morning',
    'shower': 'do in the bathroom',
    'walk': 'do outside for exercise',
    'wife': 'is close family',
    'daughter': 'is your child',
  };
  
  return hints[word.toLowerCase()] || 'use every day';
}
