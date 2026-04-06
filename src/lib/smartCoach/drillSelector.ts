/**
 * Smart Coach — Drill Selector
 * 
 * Selects which exercise to run based on detected issues, topic,
 * profile weaknesses, and recency. Uses weighted scoring.
 * 
 * Design rules:
 * - Never repeat same game twice in one session
 * - Prefer short games for micro-drills (3-5 trials)
 * - Prefer objective games for targeted practice
 * - Use "practice" language, never "game"
 */

import type { CoachState } from './types';
import type { DrillTriggerReason } from './drillTriggerEvaluator';
import { GAME_CATALOG, type GameDefinition } from './gameTrigger';

// ─── Types ───────────────────────────────────────────────────

export interface DrillSelection {
  drill: GameDefinition;
  /** Why this drill was selected */
  rationale: string;
  /** Overridden config for micro-drill (fewer trials) */
  configOverrides: {
    totalTrials?: number;
    difficultyTier?: number;
    cueLevel?: number;
  };
}

export interface DrillSelectionContext {
  state: CoachState;
  reason: DrillTriggerReason;
  /** Signals from the trigger evaluator */
  signals: string[];
  /** Game IDs already used this session */
  usedGameIds: string[];
  /** Whether this is a micro-drill or targeted practice */
  kind: 'micro_drill' | 'targeted_practice';
}

// ─── Issue → Game Mapping ───────────────────────────────────

/** Primary game for each detected issue pattern */
const ISSUE_TO_GAME: Record<string, { primary: string; backup: string }> = {
  hesitation_cluster:     { primary: 'photo_naming',          backup: 'category_fluency' },
  circumlocution:         { primary: 'semantic_features',     backup: 'photo_naming' },
  consecutive_hesitation: { primary: 'category_fluency',      backup: 'photo_naming' },
  low_content_response:   { primary: 'yes_no_comprehension',  backup: 'meaning_match' },
  phonological_error:     { primary: 'photo_naming',          backup: 'meaning_match' },
  weak_sentence:          { primary: 'sentence_construction', backup: 'photo_naming' },
};

/** Topic → recommended games */
const TOPIC_TO_GAMES: Record<string, string[]> = {
  food:          ['photo_naming', 'category_fluency', 'semantic_features'],
  family:        ['sentence_construction', 'photo_naming', 'meaning_match'],
  daily_routine: ['sentence_construction', 'category_fluency', 'photo_naming'],
  hobbies:       ['category_fluency', 'sentence_construction', 'photo_naming'],
  travel:        ['photo_naming', 'sentence_construction', 'category_fluency'],
  pets:          ['photo_naming', 'semantic_features', 'category_fluency'],
};

// ─── Main Selector ──────────────────────────────────────────

export function selectDrill(ctx: DrillSelectionContext): DrillSelection {
  const candidates = Object.values(GAME_CATALOG)
    .filter(g => !ctx.usedGameIds.includes(g.id));

  if (candidates.length === 0) {
    // Fallback: allow repeats if nothing else available
    return buildSelection(GAME_CATALOG['photo_naming'], ctx, 'Fallback — all games used');
  }

  // Score each candidate
  const scored = candidates.map(game => ({
    game,
    score: scoreGame(game, ctx),
  }));

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  return buildSelection(best.game, ctx, `Best match (score: ${best.score.toFixed(1)})`);
}

/**
 * Select a targeted practice block (1-2 games for end-of-session).
 */
export function selectPracticeBlock(ctx: Omit<DrillSelectionContext, 'kind'>): DrillSelection[] {
  const fullCtx: DrillSelectionContext = { ...ctx, kind: 'targeted_practice' };
  
  const primary = selectDrill(fullCtx);
  
  // Try to get a second game if user was strong
  const isStrong = ctx.state.supportLevel <= 1 && 
    ctx.state.sessionMetrics.independentResponses >= 3;
  
  if (isStrong) {
    const secondCtx: DrillSelectionContext = {
      ...fullCtx,
      usedGameIds: [...ctx.usedGameIds, primary.drill.id],
    };
    const secondary = selectDrill(secondCtx);
    if (secondary.drill.id !== primary.drill.id) {
      return [primary, secondary];
    }
  }

  return [primary];
}

// ─── Scoring ────────────────────────────────────────────────

function scoreGame(game: GameDefinition, ctx: DrillSelectionContext): number {
  let score = 0;

  // Issue match (highest weight)
  for (const signal of ctx.signals) {
    const mapping = ISSUE_TO_GAME[signal];
    if (mapping) {
      if (game.id === mapping.primary) score += 4;
      else if (game.id === mapping.backup) score += 2;
    }
  }

  // Topic match
  const topicGames = TOPIC_TO_GAMES[ctx.state.topic] || [];
  const topicIdx = topicGames.indexOf(game.id);
  if (topicIdx === 0) score += 3;
  else if (topicIdx === 1) score += 2;
  else if (topicIdx >= 2) score += 1;

  // Deficit match
  if (ctx.state.primaryDeficit === 'expressive' && game.skillTarget.includes('retrieval')) {
    score += 2;
  }
  if (ctx.state.primaryDeficit === 'receptive' && game.skillTarget.includes('comprehension')) {
    score += 2;
  }

  // Severity match — severe profiles prefer simpler games
  if (ctx.state.severityProfile === 'severe') {
    if (game.id === 'yes_no_comprehension' || game.id === 'photo_naming') score += 1;
  }

  // Challenge trigger prefers harder/faster games
  if (ctx.reason === 'challenge') {
    if (game.id === 'sentence_construction' || game.id === 'category_fluency') score += 2;
  }

  // Support trigger prefers accessible games
  if (ctx.reason === 'support') {
    if (game.id === 'photo_naming' || game.id === 'yes_no_comprehension') score += 1;
  }

  // Recency penalty (already used this session — shouldn't happen due to filter, but safety)
  if (ctx.usedGameIds.includes(game.id)) score -= 5;

  return score;
}

// ─── Build Selection ────────────────────────────────────────

function buildSelection(
  game: GameDefinition,
  ctx: DrillSelectionContext,
  rationale: string
): DrillSelection {
  // Micro-drills get fewer trials
  const isMicro = ctx.kind === 'micro_drill';

  return {
    drill: game,
    rationale,
    configOverrides: {
      totalTrials: isMicro 
        ? Math.min(game.defaultConfig.totalTrials || 5, 4) 
        : game.defaultConfig.totalTrials,
      difficultyTier: game.defaultConfig.difficultyTier,
      cueLevel: ctx.reason === 'support' 
        ? Math.max(game.defaultConfig.cueLevel || 0, 2) 
        : game.defaultConfig.cueLevel,
    },
  };
}
