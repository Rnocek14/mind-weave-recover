/**
 * Session Plan Generator
 * 
 * Auto-selects today's therapy focus and game sequence using the REAL
 * adaptive engine (dailyLessonEngine scoring, domain priorities, speech profile).
 * 
 * Games are selected by the same scoring system that powers daily adaptive sessions,
 * not by static deficit→game lookup tables.
 */

import type { TopicDefinition } from './topicPurposeMap';
import { getAllTopics } from './topicPurposeMap';
import { GAME_CATALOG, type GameDefinition } from './gameTrigger';
import type { SeverityProfile, PrimaryDeficit } from './types';
import type { DomainScore, ExercisePerformance, CrossSessionGoals } from '@/hooks/useCoachProfile';
import type { StrugglingPhoneme } from '@/hooks/useStrugglingPhonemes';
import { scoreExercise, calculateDomainPriorities } from '@/lib/dailyLessonEngine';
import type { ClinicalProfile } from '@/lib/clinicalProfileMapper';

// ─── Types ──────────────────────────────────────────────────

export interface SessionPlan {
  /** Auto-selected topic */
  topic: TopicDefinition;
  /** Why this topic was chosen */
  topicRationale: string;
  /** Game 1: core practice (pre-selected) */
  game1: GameDefinition;
  /** Game 2: initial recommendation (may be overridden after game 1) */
  game2: GameDefinition;
  /** Trial counts for each game (adaptive, not static) */
  game1Trials: number;
  game2Trials: number;
  /** Adaptive difficulty from profile data */
  game1Difficulty: number;
  game2Difficulty: number;
  /** Cue levels from profile */
  game1CueLevel: number;
  game2CueLevel: number;
  /** What Maya says at the start */
  opener: string;
  /** What Maya says before game 1 */
  game1Setup: string;
  /** Session focus description for the plan card */
  focusDescription: string;
  /** Continuity context from last session */
  continuityNote: string | null;
  /** All scored games for reactive Game 2 selection */
  rankedGames: ScoredGame[];
}

export interface ScoredGame {
  game: GameDefinition;
  score: number;
  reasons: string[];
}

export interface SessionPlanInput {
  severityProfile: SeverityProfile;
  primaryDeficit: PrimaryDeficit;
  strugglingPhonemes: StrugglingPhoneme[];
  domainScores: DomainScore[];
  exerciseHistory: ExercisePerformance[];
  lastSessionGoals: CrossSessionGoals | null;
  /** Raw clinical profile for domain priority calculation */
  clinicalProfile?: ClinicalProfile | null;
}

// ─── Topic Selection ────────────────────────────────────────

/** Domain → topic affinity mapping */
const DOMAIN_TOPIC_AFFINITY: Record<string, string[]> = {
  lexical_retrieval: ['food', 'pets'],
  semantic_depth: ['food', 'hobbies'],
  syntax: ['daily_routine', 'family'],
  phonology: ['food', 'pets'],
  discourse: ['travel', 'daily_routine'],
  comprehension: ['family', 'pets'],
};

function selectTopic(input: SessionPlanInput): { topic: TopicDefinition; rationale: string } {
  const topics = getAllTopics();
  const lastTopic = input.lastSessionGoals?.lastTopic;
  
  const scored = topics.map(topic => {
    let score = 0;
    let reasons: string[] = [];
    
    if (topic.id === lastTopic) {
      score -= 5;
    }
    
    if (input.domainScores.length > 0) {
      const weakest = [...input.domainScores]
        .filter(d => d.trialCount >= 5)
        .sort((a, b) => a.score - b.score);
      
      for (const weak of weakest.slice(0, 3)) {
        const affinityTopics = DOMAIN_TOPIC_AFFINITY[weak.domainSlug] || [];
        if (affinityTopics.includes(topic.id)) {
          const boost = Math.max(0, (1 - weak.score) * 4);
          score += boost;
          reasons.push(`weak ${weak.domainSlug}`);
        }
      }
    }
    
    if (input.severityProfile === 'severe' && topic.purpose.expectedDifficulty === 'easy') {
      score += 2;
      reasons.push('severity-appropriate');
    }
    
    if (input.strugglingPhonemes.length > 0 && 
        (topic.id === 'food' || topic.id === 'pets')) {
      score += 1;
      reasons.push('phoneme practice');
    }
    
    score += Math.random() * 1.5;
    
    return { topic, score, reasons };
  });
  
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  
  const rationale = best.reasons.length > 0 
    ? `Based on ${best.reasons.join(', ')}`
    : 'Rotating for variety';
  
  return { topic: best.topic, rationale };
}

// ─── Game Selection (Adaptive Engine) ───────────────────────

/**
 * Map game catalog entries to their canonical exercise domains.
 * This bridges GAME_CATALOG → dailyLessonEngine scoring.
 */
const GAME_ENGINE_DOMAINS: Record<string, string[]> = {
  category_fluency: ['expressive_language', 'semantic_systems'],
  photo_naming: ['expressive_language', 'phonology'],
  yes_no_comprehension: ['receptive_language'],
  meaning_match: ['receptive_language', 'semantic_systems'],
  sentence_construction: ['expressive_language'],
  semantic_features: ['semantic_systems', 'expressive_language'],
};

/**
 * Score all games using the REAL adaptive engine scoring,
 * then layer on exercise history and phoneme data.
 */
function scoreAllGames(input: SessionPlanInput): ScoredGame[] {
  const catalog = Object.values(GAME_CATALOG);
  
  // Build domain priorities from clinical profile (same as dailyLessonEngine)
  const domainPriorities = input.clinicalProfile
    ? calculateDomainPriorities(input.clinicalProfile)
    : inferDomainPrioritiesFromCoachData(input);
  
  // Convert domain scores to learning rates format for scoring
  const learningRates = input.domainScores
    .filter(d => d.trialCount >= 5)
    .map(d => ({
      domain: d.domainSlug,
      accuracySlope: d.score > 0.7 ? 0.05 : d.score > 0.4 ? 0.02 : 0.005,
      rtSlope: 0,
      confidenceScore: d.trialCount >= 20 ? 0.9 : d.trialCount >= 10 ? 0.7 : 0.5,
      trialCount: d.trialCount,
    }));
  
  // Build error patterns from exercise history
  const errorPatterns = {
    semantic: 0,
    phonological: 0,
    omissions: 0,
    perseverations: 0,
  };
  // Infer error patterns from struggling phonemes and domain scores
  const phonologyScore = input.domainScores.find(d => d.domainSlug === 'phonology' || d.domainSlug === 'phonological');
  const semanticScore = input.domainScores.find(d => d.domainSlug === 'semantic_depth' || d.domainSlug === 'semantic');
  if (phonologyScore && phonologyScore.score < 0.5) errorPatterns.phonological = 0.4;
  if (semanticScore && semanticScore.score < 0.5) errorPatterns.semantic = 0.4;
  if (input.strugglingPhonemes.length >= 3) errorPatterns.phonological = Math.max(errorPatterns.phonological, 0.35);

  return catalog.map(game => {
    const gameDomains = GAME_ENGINE_DOMAINS[game.id] || [];
    let reasons: string[] = [];
    
    // === Core: Use the REAL adaptive engine scoring function ===
    let score = scoreExercise(
      game.exerciseSlug,
      gameDomains,
      domainPriorities,
      learningRates,
      errorPatterns,
    );
    reasons.push(`engine score: ${score}`);
    
    // === Layer: Exercise history (weak exercises get boosted) ===
    const perf = input.exerciseHistory.find(e => e.exerciseSlug === game.exerciseSlug);
    if (perf) {
      if (perf.avgAccuracy < 0.5 && perf.trialCount >= 5) {
        score += 3;
        reasons.push(`weak history (${Math.round(perf.avgAccuracy * 100)}%)`);
      } else if (perf.avgAccuracy > 0.85 && perf.trialCount >= 10) {
        score -= 2;
        reasons.push(`mastered (${Math.round(perf.avgAccuracy * 100)}%)`);
      }
    }
    
    // === Layer: Phoneme needs → boost speech-producing games ===
    if (input.strugglingPhonemes.length > 0) {
      if (game.id === 'photo_naming') {
        score += 2;
        reasons.push('phoneme practice needed');
      } else if (game.id === 'category_fluency') {
        score += 1;
        reasons.push('fluency + phoneme overlap');
      }
    }
    
    // === Layer: Domain score weakness (direct from data) ===
    for (const ds of input.domainScores) {
      if (ds.trialCount < 5) continue;
      if (ds.score < 0.4) {
        // Check if this game's domains overlap with weak domain
        const weakDomainMapped = mapCognitiveDomainToEngine(ds.domainSlug);
        if (gameDomains.some(gd => weakDomainMapped.includes(gd))) {
          score += 4;
          reasons.push(`weak domain: ${ds.domainSlug} (${Math.round(ds.score * 100)}%)`);
        }
      }
    }
    
    // === Layer: Severity guard ===
    if (input.severityProfile === 'severe') {
      if (game.id === 'sentence_construction') {
        score -= 3;
        reasons.push('too complex for severity');
      }
      if (game.id === 'yes_no_comprehension' || game.id === 'photo_naming') {
        score += 1;
        reasons.push('severity-appropriate');
      }
    }
    
    return { game, score, reasons };
  }).sort((a, b) => b.score - a.score);
}

/** Map cognitive domain slugs to engine domain names */
function mapCognitiveDomainToEngine(domainSlug: string): string[] {
  const map: Record<string, string[]> = {
    'lexical_retrieval': ['expressive_language'],
    'semantic_depth': ['semantic_systems'],
    'semantic': ['semantic_systems'],
    'phonology': ['phonology'],
    'phonological': ['phonology'],
    'discourse': ['expressive_language'],
    'comprehension': ['receptive_language'],
    'executive_function': ['attention'],
    'syntax': ['expressive_language'],
  };
  return map[domainSlug] || [domainSlug];
}

/** Infer domain priorities when no raw ClinicalProfile is available */
function inferDomainPrioritiesFromCoachData(input: SessionPlanInput) {
  const priorities: Record<string, 'high' | 'medium' | 'low'> = {
    expressive_language: 'medium',
    receptive_language: 'medium',
    semantic_systems: 'medium',
    phonology: 'medium',
    motor_control: 'low',
    attention: 'low',
    visual_processing: 'low',
  };
  
  // Use deficit type to set priorities (same logic as dailyLessonEngine aphasia mapping)
  if (input.primaryDeficit === 'expressive') {
    priorities.expressive_language = 'high';
    priorities.semantic_systems = 'high';
  } else if (input.primaryDeficit === 'receptive') {
    priorities.receptive_language = 'high';
    priorities.semantic_systems = 'high';
  } else {
    priorities.expressive_language = 'high';
    priorities.receptive_language = 'high';
    priorities.semantic_systems = 'high';
  }
  
  if (input.strugglingPhonemes.length >= 2) {
    priorities.phonology = 'high';
  }
  
  return priorities as any;
}

function selectGames(input: SessionPlanInput): {
  game1: GameDefinition;
  game2: GameDefinition;
  game1Trials: number;
  game2Trials: number;
  game1Difficulty: number;
  game2Difficulty: number;
  game1CueLevel: number;
  game2CueLevel: number;
  rankedGames: ScoredGame[];
} {
  const rankedGames = scoreAllGames(input);
  
  const game1 = rankedGames[0].game;
  // Game 2: different game, next highest score
  const game2 = rankedGames.find(s => s.game.id !== game1.id)?.game || rankedGames[1].game;
  
  // === Adaptive trial counts from exercise history + severity ===
  const game1Perf = input.exerciseHistory.find(e => e.exerciseSlug === game1.exerciseSlug);
  const game2Perf = input.exerciseHistory.find(e => e.exerciseSlug === game2.exerciseSlug);
  
  // Base trials: more for weak exercises, fewer for strong ones
  function getAdaptiveTrials(perf: ExercisePerformance | undefined, severity: SeverityProfile): number {
    const severityBase = severity === 'severe' ? 4 : severity === 'moderate' ? 6 : 8;
    if (!perf || perf.trialCount < 5) return severityBase; // Not enough data, use severity default
    if (perf.avgAccuracy < 0.4) return Math.max(3, severityBase - 1); // Struggling → slightly fewer to avoid frustration
    if (perf.avgAccuracy < 0.6) return severityBase; // Working range → standard
    if (perf.avgAccuracy > 0.85) return severityBase + 2; // Mastered → push harder
    return severityBase;
  }
  
  // === Adaptive difficulty from domain scores ===
  function getAdaptiveDifficulty(game: GameDefinition, perf: ExercisePerformance | undefined): number {
    if (!perf || perf.trialCount < 5) return 1;
    if (perf.avgAccuracy > 0.85) return 3;
    if (perf.avgAccuracy > 0.7) return 2;
    return 1;
  }
  
  // === Adaptive cue level from severity + performance ===
  function getAdaptiveCueLevel(perf: ExercisePerformance | undefined, severity: SeverityProfile): number {
    if (severity === 'severe') return 2;
    if (!perf || perf.trialCount < 5) return 1;
    if (perf.avgAccuracy > 0.8) return 0; // Good performer → minimal cues
    if (perf.avgAccuracy < 0.4) return 2; // Struggling → more support
    return 1;
  }
  
  return {
    game1,
    game2,
    game1Trials: getAdaptiveTrials(game1Perf, input.severityProfile),
    game2Trials: getAdaptiveTrials(game2Perf, input.severityProfile),
    game1Difficulty: getAdaptiveDifficulty(game1, game1Perf),
    game2Difficulty: getAdaptiveDifficulty(game2, game2Perf),
    game1CueLevel: getAdaptiveCueLevel(game1Perf, input.severityProfile),
    game2CueLevel: getAdaptiveCueLevel(game2Perf, input.severityProfile),
    rankedGames,
  };
}

// ─── Reactive Game 2 Selection ──────────────────────────────

/**
 * Re-select Game 2 after Game 1 completes, using actual results.
 * This is the key difference from static pre-planning.
 */
export function selectReactiveGame2(
  rankedGames: ScoredGame[],
  game1Id: string,
  game1Score: number,
  game1TargetWords: string[],
  transferScore: number | null,
  input: SessionPlanInput,
): { game: GameDefinition; rationale: string; trials: number; difficulty: number; cueLevel: number } {
  // Filter out game 1
  const candidates = rankedGames.filter(g => g.game.id !== game1Id);
  if (candidates.length === 0) {
    const fallback = rankedGames[0];
    return { game: fallback.game, rationale: 'Only option', trials: 5, difficulty: 1, cueLevel: 1 };
  }
  
  // Re-score based on Game 1 performance
  const reScored = candidates.map(c => {
    let adjustedScore = c.score;
    let rationale = '';
    
    if (game1Score < 0.4) {
      // Struggled heavily → pick something easier/different domain
      if (c.game.id === 'yes_no_comprehension') {
        adjustedScore += 5;
        rationale = 'Confidence builder after tough practice';
      }
      // Avoid same-difficulty games
      if (c.game.id === 'sentence_construction') {
        adjustedScore -= 3;
      }
    } else if (game1Score >= 0.8) {
      // Did well → push harder
      if (c.game.id === 'sentence_construction' || c.game.id === 'semantic_features') {
        adjustedScore += 3;
        rationale = 'Advancing to more complex practice';
      }
    }
    
    // Transfer failed → reinforce with different modality
    if (transferScore !== null && transferScore < 2) {
      if (c.game.id === 'semantic_features') {
        adjustedScore += 4;
        rationale = 'Strengthening word connections after weak transfer';
      } else if (c.game.id === 'meaning_match') {
        adjustedScore += 3;
        rationale = 'Building semantic network after weak transfer';
      }
    }
    
    // Transfer succeeded → advance
    if (transferScore !== null && transferScore >= 3) {
      if (c.game.id === 'sentence_construction') {
        adjustedScore += 2;
        rationale = 'Good transfer — advancing to sentence level';
      }
    }
    
    return { ...c, score: adjustedScore, rationale: rationale || c.reasons.join(', ') };
  });
  
  reScored.sort((a, b) => b.score - a.score);
  const best = reScored[0];
  
  // Adaptive params for game 2
  const perf = input.exerciseHistory.find(e => e.exerciseSlug === best.game.exerciseSlug);
  const severityBase = input.severityProfile === 'severe' ? 4 : input.severityProfile === 'moderate' ? 6 : 8;
  
  return {
    game: best.game,
    rationale: best.rationale,
    trials: perf && perf.avgAccuracy > 0.85 ? severityBase + 2 : severityBase,
    difficulty: perf && perf.avgAccuracy > 0.85 ? 3 : perf && perf.avgAccuracy > 0.7 ? 2 : 1,
    cueLevel: input.severityProfile === 'severe' ? 2 : perf && perf.avgAccuracy < 0.4 ? 2 : perf && perf.avgAccuracy > 0.8 ? 0 : 1,
  };
}

// ─── Opener Builder ─────────────────────────────────────────

function buildOpener(
  topic: TopicDefinition,
  game1: GameDefinition,
  continuity: CrossSessionGoals | null,
): string {
  const parts: string[] = [];
  
  if (continuity?.continuityOpener) {
    parts.push(continuity.continuityOpener);
  }
  
  parts.push(`Today we're working on ${topic.purpose.skillTarget.toLowerCase()}.`);
  parts.push(`We'll start with a quick warm-up, then do some focused practice.`);
  
  return parts.join('\n\n');
}

function buildGame1Setup(
  topic: TopicDefinition,
  game1: GameDefinition,
): string {
  const setupMap: Record<string, string> = {
    photo_naming: `Let's see how quickly you can name some pictures. I'll show you images one at a time — just say what you see.`,
    category_fluency: `Name as many ${topic.id === 'food' ? 'foods' : topic.id === 'pets' ? 'animals' : 'items'} as you can — quick, don't overthink it.`,
    semantic_features: `I'll show you a word and you tell me what it's used for, where you find it, what it looks like.`,
    sentence_construction: `I'll give you some words — put them together into a sentence that makes sense.`,
    yes_no_comprehension: `Quick round — I'll ask you yes or no questions. Just tap your answer.`,
    meaning_match: `Match each word with the one that means the same thing.`,
  };
  
  return setupMap[game1.id] || `Let's practice with a quick exercise.`;
}

// ─── Main Generator ─────────────────────────────────────────

export function generateSessionPlan(input: SessionPlanInput): SessionPlan {
  const { topic, rationale: topicRationale } = selectTopic(input);
  
  const {
    game1, game2, game1Trials, game2Trials,
    game1Difficulty, game2Difficulty, game1CueLevel, game2CueLevel,
    rankedGames,
  } = selectGames(input);
  
  const opener = buildOpener(topic, game1, input.lastSessionGoals);
  const game1Setup = buildGame1Setup(topic, game1);
  const focusDescription = `${topic.purpose.skillTarget} — like ${topic.purpose.transferTarget}.`;
  const continuityNote = input.lastSessionGoals?.continuityOpener || null;

  console.log('[SessionPlanGenerator] Game selection:', {
    game1: { id: game1.id, score: rankedGames[0].score, reasons: rankedGames[0].reasons },
    game2: { id: game2.id },
    allScores: rankedGames.map(g => ({ id: g.game.id, score: g.score })),
  });

  return {
    topic,
    topicRationale,
    game1,
    game2,
    game1Trials,
    game2Trials,
    game1Difficulty,
    game2Difficulty,
    game1CueLevel,
    game2CueLevel,
    opener,
    game1Setup,
    focusDescription,
    continuityNote,
    rankedGames,
  };
}
