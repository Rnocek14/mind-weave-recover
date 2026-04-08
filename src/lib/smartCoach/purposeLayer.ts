/**
 * Smart Coach — Purpose Layer
 * 
 * Generates clinically purposeful narration for every phase of the session.
 * Every line answers: what are we doing, why it matters, how it connects to real life.
 * 
 * Tone: adult, calm, direct, warm, never cheesy.
 */

import type { TopicDefinition } from './topicPurposeMap';
import type { GameDefinition } from './gameTrigger';
import type { NormalizedExerciseResult } from '@/lib/normalizedExerciseResult';
import type { SeverityProfile } from './types';
import type { CrossSessionGoals } from '@/hooks/useCoachProfile';

// ─── Session Arc Labels ─────────────────────────────────────

export type SessionArcPhase = 'warmup' | 'core' | 'transfer' | 'review';

export const ARC_PHASE_LABELS: Record<SessionArcPhase, string> = {
  warmup: 'Warm-up',
  core: 'Core practice',
  transfer: 'Transfer',
  review: 'Review',
};

/** Map SmartCoach session phases to arc phases */
export function getArcPhase(sessionPhase: string): SessionArcPhase {
  switch (sessionPhase) {
    case 'plan': return 'warmup';
    case 'game1_intro': return 'warmup';
    case 'game1_playing': return 'core';
    case 'transfer_check': return 'transfer';
    case 'game2_playing': return 'core';
    case 'complete': return 'review';
    default: return 'warmup';
  }
}

// ─── Plan Card Purpose Text ─────────────────────────────────

export function buildPlanPurpose(
  topic: TopicDefinition,
  lastSession: CrossSessionGoals | null,
): { headline: string; why: string; measure: string } {
  const headline = topic.purpose.skillTarget;
  const why = `This helps with ${topic.purpose.transferTarget}.`;
  const measure = topic.purpose.measure;

  return { headline, why, measure };
}

// ─── Game Intro Purpose ─────────────────────────────────────

/** Build a purpose-rich intro for game 1 that connects to real life */
export function buildGame1Intro(
  topic: TopicDefinition,
  game: GameDefinition,
  lastSession: CrossSessionGoals | null,
  severity: SeverityProfile,
): { narration: string; subtitle: string } {
  const skillFocus = topic.purpose.skillTarget.toLowerCase();
  const realWorld = topic.purpose.transferTarget.toLowerCase();

  // Continuity bridge from last session
  let continuityLine = '';
  if (lastSession?.continuityOpener) {
    continuityLine = lastSession.continuityOpener + '\n\n';
  }

  // Exercise-specific setup + purpose connection
  const setupMap: Record<string, string> = {
    'photo-naming': `Name the pictures as quickly as you can. This builds the speed you need for ${realWorld}.`,
    'category-fluency': `Name as many as you can, quickly. Fluency practice like this strengthens the same pathways you use when ${realWorld}.`,
    'semantic-features': `Describe what you see — what it's for, where you find it. Knowing the connections around a word helps you find it faster in real conversation.`,
    'sentence-construction': `Build sentences from the words I give you. Sentence practice transfers directly to ${realWorld}.`,
    'yes-no-comprehension': `Quick decisions — yes or no. This strengthens how quickly you process language, which matters for following conversations.`,
    'meaning-match': `Match words with their meanings. Strengthening these connections helps you recognize and use words more reliably.`,
    'describe-guess': `Describe what you see without saying its name. This is the same skill you use when a word doesn't come — finding another way to communicate.`,
    'narrative-retell': `Listen, then retell in your own words. Retelling builds the sequencing you need for ${realWorld}.`,
    'synonym-generator': `Think of words that mean the same thing. Building word networks gives you more paths to the word you need.`,
    'minimal-pairs': `Listen carefully to similar sounds. Sharpening sound discrimination helps you understand speech more clearly.`,
  };

  const setup = setupMap[game.exerciseSlug] || `This exercise works on ${skillFocus}. It helps with ${realWorld}.`;

  const narration = `${continuityLine}Today: ${skillFocus}.\n\n${setup}`;
  const subtitle = `We're tracking: ${topic.purpose.measure.toLowerCase()}.`;

  return { narration, subtitle };
}

// ─── Post-Game Micro-Reflections ────────────────────────────

/**
 * Generate a specific, function-tied reflection after a game.
 * Never generic praise. Always tied to behavior or skill.
 */
export function buildPostGameReflection(
  result: NormalizedExerciseResult,
  gameSlot: 1 | 2,
  topic: TopicDefinition,
  game1Result?: NormalizedExerciseResult | null,
): string {
  const pct = Math.round(result.score * 100);
  const words = result.targetWords || [];
  const realWorld = topic.purpose.transferTarget.toLowerCase();

  // High performance — tie to function
  if (result.score >= 0.85) {
    if (words.length > 0) {
      return `${pct}% — "${words[0]}" came out quickly. That retrieval speed is what you need for ${realWorld}.`;
    }
    return `${pct}% — words came out with less effort. That speed transfers directly to real conversation.`;
  }

  // Good performance — note specific progress
  if (result.score >= 0.6) {
    if (gameSlot === 2 && game1Result) {
      const delta = pct - Math.round(game1Result.score * 100);
      if (delta > 0) {
        return `${pct}% — ${delta} points higher than the first round. The practice is working.`;
      }
      return `${pct}% — steady across both rounds. Consistency builds reliability.`;
    }
    if (words.length > 0) {
      return `${pct}% — you found "${words[0]}" with less effort. We'll reinforce that next.`;
    }
    return `${pct}% — building momentum. Let's use this in context.`;
  }

  // Moderate performance — acknowledge difficulty, point forward
  if (result.score >= 0.4) {
    if (words.length > 0) {
      return `${pct}% — "${words[0]}" took extra work. That's exactly why we practiced it. It'll come faster next time.`;
    }
    return `${pct}% — some were hard. That means we're working at the right level.`;
  }

  // Low performance — supportive, never dismissive
  if (words.length > 0) {
    return `${pct}% — tough round, but now "${words[0]}" has been activated. Your brain processes it even when it feels hard.`;
  }
  return `${pct}% — that was challenging. The effort still counts — those pathways are being strengthened.`;
}

// ─── Transfer Prompt ────────────────────────────────────────

/** Build a purposeful transfer prompt that connects drill to real life */
export function buildTransferPrompt(
  topic: TopicDefinition,
  drilledWords: string[],
): string {
  const realWorld = topic.purpose.transferTarget.toLowerCase();

  if (drilledWords.length > 0) {
    const word = drilledWords[0];
    // Context-specific prompts based on topic
    const contextMap: Record<string, string> = {
      food: `Now use "${word}" the way you would when ${realWorld}. Try a short sentence.`,
      family: `Use "${word}" like you're telling someone about your family. Just a sentence or two.`,
      hobbies: `Use "${word}" — how would you bring it up in conversation?`,
      daily_routine: `Use "${word}" to describe part of your day.`,
      travel: `Use "${word}" — how would you use it when describing a trip?`,
      pets: `Use "${word}" the way you would when talking about pets.`,
    };
    return contextMap[topic.id] || `Use "${word}" in a sentence — the way you would in real life.`;
  }

  return `Try using one of those words the way you would when ${realWorld}.`;
}

// ─── Session Summary Purpose ────────────────────────────────

/** Build a purposeful closing message that ties back to goals */
export function buildSessionClosing(
  topic: TopicDefinition,
  game1Result: NormalizedExerciseResult | null,
  game2Result: NormalizedExerciseResult | null,
  transferScore: number,
): string {
  const realWorld = topic.purpose.transferTarget.toLowerCase();
  const parts: string[] = [];

  // Performance arc
  if (game1Result && game2Result) {
    const s1 = Math.round(game1Result.score * 100);
    const s2 = Math.round(game2Result.score * 100);
    const delta = s2 - s1;
    if (delta >= 10) {
      parts.push(`You improved from ${s1}% to ${s2}% across two different exercises. That's your brain finding words through multiple pathways.`);
    } else if (s2 >= 80) {
      parts.push(`${s2}% — reliable retrieval. Those words are becoming available for real conversation.`);
    } else {
      parts.push(`You worked through two rounds of targeted practice. Every repetition strengthens the connection.`);
    }
  } else if (game1Result) {
    const s = Math.round(game1Result.score * 100);
    parts.push(`${s}% — focused practice on ${topic.purpose.skillTarget.toLowerCase()}.`);
  }

  // Transfer connection
  if (transferScore >= 3) {
    parts.push(`You used the words in context — that's the bridge between practice and ${realWorld}.`);
  } else if (transferScore > 0) {
    parts.push(`Transfer is building. Using words in sentences is where real progress shows.`);
  }

  // Forward look
  parts.push(`Next session will build on this. The more you practice, the faster the words come.`);

  return parts.join(' ');
}

// ─── Phase Progress Labels ──────────────────────────────────

/** Get clinically meaningful progress labels for the session */
export const SESSION_PROGRESS_LABELS = ['Warm-up', 'Practice', 'Transfer', 'Practice', 'Review'];
