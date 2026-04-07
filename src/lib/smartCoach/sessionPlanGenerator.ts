/**
 * Session Plan Generator
 * 
 * Auto-selects today's therapy focus and game sequence based on:
 * - Speech profile (severity, deficit, phonemes)
 * - Domain scores (weakest areas)
 * - Exercise history (what needs work)
 * - Last session (continuity, variety)
 * - Topic rotation (avoid repeating same topic)
 * 
 * Output: A concrete session plan Maya can announce and execute.
 */

import type { TopicDefinition } from './topicPurposeMap';
import { getAllTopics } from './topicPurposeMap';
import { GAME_CATALOG, type GameDefinition } from './gameTrigger';
import type { SeverityProfile, PrimaryDeficit } from './types';
import type { DomainScore, ExercisePerformance, CrossSessionGoals } from '@/hooks/useCoachProfile';
import type { StrugglingPhoneme } from '@/hooks/useStrugglingPhonemes';

// ─── Types ──────────────────────────────────────────────────

export interface SessionPlan {
  /** Auto-selected topic */
  topic: TopicDefinition;
  /** Why this topic was chosen */
  topicRationale: string;
  /** Game 1: core practice */
  game1: GameDefinition;
  /** Game 2: adaptive follow-up */
  game2: GameDefinition;
  /** Trial counts for each game */
  game1Trials: number;
  game2Trials: number;
  /** What Maya says at the start */
  opener: string;
  /** What Maya says before game 1 */
  game1Setup: string;
  /** Session focus description for the plan card */
  focusDescription: string;
  /** Continuity context from last session */
  continuityNote: string | null;
}

export interface SessionPlanInput {
  severityProfile: SeverityProfile;
  primaryDeficit: PrimaryDeficit;
  strugglingPhonemes: StrugglingPhoneme[];
  domainScores: DomainScore[];
  exerciseHistory: ExercisePerformance[];
  lastSessionGoals: CrossSessionGoals | null;
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
  
  // Score each topic
  const scored = topics.map(topic => {
    let score = 0;
    let reasons: string[] = [];
    
    // Avoid repeating last session's topic
    if (topic.id === lastTopic) {
      score -= 5;
    }
    
    // Boost topics aligned with weak domains
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
    
    // Boost easier topics for severe profiles
    if (input.severityProfile === 'severe' && topic.purpose.expectedDifficulty === 'easy') {
      score += 2;
      reasons.push('severity-appropriate');
    }
    
    // Boost topics with phoneme practice opportunity
    if (input.strugglingPhonemes.length > 0 && 
        (topic.id === 'food' || topic.id === 'pets')) {
      score += 1;
      reasons.push('phoneme practice');
    }
    
    // Default variety bonus: prefer topics not recently used
    score += Math.random() * 1.5; // Small random factor for variety
    
    return { topic, score, reasons };
  });
  
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  
  const rationale = best.reasons.length > 0 
    ? `Based on ${best.reasons.join(', ')}`
    : 'Rotating for variety';
  
  return { topic: best.topic, rationale };
}

// ─── Game Selection ─────────────────────────────────────────

/** Deficit → primary game mapping */
const DEFICIT_GAMES: Record<PrimaryDeficit, string[]> = {
  expressive: ['photo_naming', 'category_fluency', 'semantic_features'],
  receptive: ['yes_no_comprehension', 'meaning_match', 'semantic_features'],
  mixed: ['photo_naming', 'yes_no_comprehension', 'meaning_match'],
};

/** Topic → game affinity */
const TOPIC_GAMES: Record<string, string[]> = {
  food: ['photo_naming', 'category_fluency', 'semantic_features'],
  family: ['sentence_construction', 'photo_naming'],
  hobbies: ['category_fluency', 'sentence_construction'],
  daily_routine: ['sentence_construction', 'category_fluency'],
  travel: ['photo_naming', 'sentence_construction'],
  pets: ['photo_naming', 'semantic_features'],
};

function selectGames(
  input: SessionPlanInput, 
  topicId: string
): { game1: GameDefinition; game2: GameDefinition; game1Trials: number; game2Trials: number } {
  const catalog = Object.values(GAME_CATALOG);
  
  // Score all games for game 1 (core practice)
  const scored = catalog.map(game => {
    let score = 0;
    
    // Deficit match (strongest signal)
    const deficitGames = DEFICIT_GAMES[input.primaryDeficit] || [];
    const deficitIdx = deficitGames.indexOf(game.id);
    if (deficitIdx === 0) score += 5;
    else if (deficitIdx === 1) score += 3;
    else if (deficitIdx >= 2) score += 1;
    
    // Topic match
    const topicGames = TOPIC_GAMES[topicId] || [];
    const topicIdx = topicGames.indexOf(game.id);
    if (topicIdx === 0) score += 4;
    else if (topicIdx === 1) score += 2;
    else if (topicIdx >= 2) score += 1;
    
    // Domain score weakness boost
    for (const ds of input.domainScores) {
      if (ds.trialCount < 5) continue;
      if (ds.domainSlug === 'lexical_retrieval' && game.skillTarget.includes('retrieval')) {
        score += Math.max(0, (1 - ds.score) * 3);
      }
      if (ds.domainSlug === 'semantic_depth' && game.skillTarget.includes('semantic')) {
        score += Math.max(0, (1 - ds.score) * 3);
      }
    }
    
    // Exercise history: boost games where user needs practice
    const perf = input.exerciseHistory.find(e => e.exerciseSlug === game.exerciseSlug);
    if (perf) {
      if (perf.avgAccuracy < 0.5 && perf.trialCount >= 5) score += 2;
      else if (perf.avgAccuracy > 0.85 && perf.trialCount >= 10) score -= 2;
    }
    
    // Phoneme boost
    if (input.strugglingPhonemes.length > 0 && game.id === 'photo_naming') {
      score += 2;
    }
    
    // Severity: severe → simpler games
    if (input.severityProfile === 'severe') {
      if (game.id === 'photo_naming' || game.id === 'yes_no_comprehension') score += 1;
      if (game.id === 'sentence_construction') score -= 1;
    }
    
    return { game, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  
  const game1 = scored[0].game;
  // Game 2: different game, second-highest score
  const game2 = scored.find(s => s.game.id !== game1.id)?.game || scored[1].game;
  
  // Trial counts based on severity
  const trialMap: Record<SeverityProfile, number> = { mild: 8, moderate: 6, severe: 4 };
  const baseTrials = trialMap[input.severityProfile];
  
  return {
    game1,
    game2,
    game1Trials: baseTrials,
    game2Trials: Math.max(3, baseTrials - 1), // Slightly fewer for game 2
  };
}

// ─── Opener Builder ─────────────────────────────────────────

function buildOpener(
  topic: TopicDefinition,
  game1: GameDefinition,
  continuity: CrossSessionGoals | null,
): string {
  const parts: string[] = [];
  
  // Continuity first
  if (continuity?.continuityOpener) {
    parts.push(continuity.continuityOpener);
  }
  
  // Today's focus
  parts.push(`Today we're working on ${topic.purpose.skillTarget.toLowerCase()}.`);
  
  // Brief plan
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
  // 1. Select topic
  const { topic, rationale: topicRationale } = selectTopic(input);
  
  // 2. Select games
  const { game1, game2, game1Trials, game2Trials } = selectGames(input, topic.id);
  
  // 3. Build opener and setup
  const opener = buildOpener(topic, game1, input.lastSessionGoals);
  const game1Setup = buildGame1Setup(topic, game1);
  
  // 4. Focus description for plan card
  const focusDescription = `${topic.purpose.skillTarget} — like ${topic.purpose.transferTarget}.`;
  
  // 5. Continuity note
  const continuityNote = input.lastSessionGoals?.continuityOpener || null;
  
  return {
    topic,
    topicRationale,
    game1,
    game2,
    game1Trials,
    game2Trials,
    opener,
    game1Setup,
    focusDescription,
    continuityNote,
  };
}
