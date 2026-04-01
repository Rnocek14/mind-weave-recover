/**
 * TRL Game Triggers — launches targeted mini-games when
 * therapeutic response levels persist, indicating the user
 * needs structured intervention beyond conversational scaffolding.
 * 
 * Rules:
 * - Level 2 persists 3+ turns → scaffolded mini-game (choice-based)
 * - Level 3 repeats 2+ turns → targeted drill (phonemic/semantic)
 * - Level 4 → ultra-simple exercise (confidence rebuild)
 */

import type { ResponseLevel, AnchorUsageType } from './therapeuticResponseLadder';

export type GameTriggerType = 
  | 'scaffolded_choice_game'   // Two-option naming or meaning match
  | 'targeted_drill'           // Phonemic or semantic practice
  | 'confidence_rebuild'       // Ultra-simple success-guaranteed exercise
  | null;                      // No game needed

export interface GameTriggerResult {
  trigger: GameTriggerType;
  slug: string | null;
  reason: string;
  difficultyHint: 'easier' | 'same' | 'harder';
}

interface TriggerState {
  recentLevels: ResponseLevel[];
  lastGameTurn: number;
  gamesTriggeredThisSession: number;
}

const MAX_GAMES_PER_SESSION = 5;
const MIN_TURNS_BETWEEN_GAMES = 4;

export function createTriggerState(): TriggerState {
  return {
    recentLevels: [],
    lastGameTurn: -999,
    gamesTriggeredThisSession: 0,
  };
}

export function evaluateGameTrigger(
  state: TriggerState,
  currentLevel: ResponseLevel,
  turnNumber: number,
  /** Emergency override: consecutive struggle count from TRL tracker */
  consecutiveStruggles?: number,
): { result: GameTriggerResult; newState: TriggerState } {
  // Update recent levels (keep last 5)
  const recentLevels = [...state.recentLevels, currentLevel].slice(-5);
  const newState: TriggerState = { ...state, recentLevels };

  // Session cap
  if (state.gamesTriggeredThisSession >= MAX_GAMES_PER_SESSION) {
    return { result: { trigger: null, slug: null, reason: 'session_cap', difficultyHint: 'same' }, newState };
  }

  // Cooldown check — BUT skip cooldown for emergency (2+ consecutive struggles)
  const isEmergency = (consecutiveStruggles ?? 0) >= 2;
  if (!isEmergency && turnNumber - state.lastGameTurn < MIN_TURNS_BETWEEN_GAMES) {
    return { result: { trigger: null, slug: null, reason: 'cooldown', difficultyHint: 'same' }, newState };
  }

  // ── EMERGENCY: 2+ consecutive struggles → immediate confidence rebuild ──
  // This is the "never let user get stuck" rule
  if (isEmergency) {
    return {
      result: {
        trigger: 'confidence_rebuild',
        slug: 'photo-naming',
        reason: `${consecutiveStruggles} consecutive struggles — emergency rescue`,
        difficultyHint: 'easier',
      },
      newState: {
        ...newState,
        lastGameTurn: turnNumber,
        gamesTriggeredThisSession: state.gamesTriggeredThisSession + 1,
      },
    };
  }

  // ── Level 4: Immediate confidence rebuild ──
  if (currentLevel === 4) {
    return {
      result: {
        trigger: 'confidence_rebuild',
        slug: 'photo-naming',
        reason: 'Recovery mode — ultra-simple exercise to rebuild confidence',
        difficultyHint: 'easier',
      },
      newState: {
        ...newState,
        lastGameTurn: turnNumber,
        gamesTriggeredThisSession: state.gamesTriggeredThisSession + 1,
      },
    };
  }

  // ── Level 3 persists 2+ turns: Targeted drill ──
  const level3Count = recentLevels.slice(-3).filter(l => l >= 3).length;
  if (level3Count >= 2) {
    return {
      result: {
        trigger: 'targeted_drill',
        slug: 'minimal-pairs',
        reason: `${level3Count} high-support turns — targeted phonemic drill`,
        difficultyHint: 'easier',
      },
      newState: {
        ...newState,
        lastGameTurn: turnNumber,
        gamesTriggeredThisSession: state.gamesTriggeredThisSession + 1,
      },
    };
  }

  // ── Level 2 persists 3+ turns: Scaffolded choice game ──
  const level2Count = recentLevels.slice(-4).filter(l => l === 2).length;
  if (level2Count >= 3) {
    return {
      result: {
        trigger: 'scaffolded_choice_game',
        slug: 'meaning-match',
        reason: `${level2Count} scaffolded turns — structured choice exercise`,
        difficultyHint: 'same',
      },
      newState: {
        ...newState,
        lastGameTurn: turnNumber,
        gamesTriggeredThisSession: state.gamesTriggeredThisSession + 1,
      },
    };
  }

  return { result: { trigger: null, slug: null, reason: 'no_trigger', difficultyHint: 'same' }, newState };
}

/**
 * Maps a TRL game trigger to the orchestrator's popup exercise format
 */
export function triggerToPopupExercise(result: GameTriggerResult): {
  slug: string;
  reason: 'repeated_struggle' | 'targeted_probe' | 'domain_boost' | 'fatigue_safe_switch';
  difficultyHint: 'easier' | 'same' | 'harder';
} | null {
  if (!result.trigger || !result.slug) return null;
  
  return {
    slug: result.slug,
    reason: result.trigger === 'confidence_rebuild' ? 'repeated_struggle' : 'targeted_probe',
    difficultyHint: result.difficultyHint,
  };
}
