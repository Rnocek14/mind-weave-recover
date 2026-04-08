/**
 * Smart Coach — Continuity Engine
 * 
 * Converts raw prior-session data into behavioral signals that drive:
 * - Session opener copy
 * - Game selection bias
 * - Transfer framing
 * - Closing summary
 * 
 * This replaces generic "last session you worked on X" with actual
 * performance-driven continuity like "Yesterday you slowed down most
 * on quick naming, so we're starting there."
 */

import type { CrossSessionGoals, ExercisePerformance, DomainScore } from '@/hooks/useCoachProfile';
import type { StrugglingPhoneme } from '@/hooks/useStrugglingPhonemes';

// ─── Types ──────────────────────────────────────────────────

export interface ContinuitySignals {
  /** Behavioral opener — what Maya says at session start */
  opener: string;
  /** Weakest domain slug for game selection bias */
  weakestDomain: string | null;
  /** Whether cue dependency is high (drives cue fading) */
  cueDependencyHigh: boolean;
  /** Whether transfer was weak last time */
  transferWeak: boolean;
  /** Specific words that were hard last session */
  carryForwardWords: string[];
  /** Short insight for closing comparison */
  closingComparison: string | null;
  /** Whether this is the user's first session */
  isFirstSession: boolean;
}

// ─── Continuity Builder ─────────────────────────────────────

export function buildContinuitySignals(
  lastSession: CrossSessionGoals | null,
  domainScores: DomainScore[],
  exerciseHistory: ExercisePerformance[],
  strugglingPhonemes: StrugglingPhoneme[],
): ContinuitySignals {
  if (!lastSession) {
    return {
      opener: "First session — let's see where you are and build from there.",
      weakestDomain: null,
      cueDependencyHigh: false,
      transferWeak: false,
      carryForwardWords: [],
      closingComparison: null,
      isFirstSession: true,
    };
  }

  // ── Find weakest domain ──
  const scoredDomains = domainScores
    .filter(d => d.trialCount >= 5)
    .sort((a, b) => a.score - b.score);
  const weakestDomain = scoredDomains.length > 0 ? scoredDomains[0].domainSlug : null;
  const weakestScore = scoredDomains.length > 0 ? scoredDomains[0].score : null;

  // ── Find weakest exercise ──
  const weakExercises = exerciseHistory
    .filter(e => e.trialCount >= 5 && e.avgAccuracy < 0.5)
    .sort((a, b) => a.avgAccuracy - b.avgAccuracy);

  // ── Detect cue dependency ──
  // If last session avg score was low, user likely needed more cues
  const cueDependencyHigh = (lastSession.lastAvgScore ?? 1) < 0.5;

  // ── Detect weak transfer ──
  const transferWeak = lastSession.priorStruggles.some(s =>
    s.toLowerCase().includes('transfer') || s.toLowerCase().includes('sentence')
  );

  // ── Build behavioral opener ──
  const parts: string[] = [];

  // Performance-based line (not just topic)
  if (weakestScore !== null && weakestScore < 0.4 && weakestDomain) {
    const domainLabel = humanizeDomain(weakestDomain);
    parts.push(`${domainLabel} has been your toughest area — today targets that.`);
  } else if (weakExercises.length > 0) {
    const exerciseName = weakExercises[0].exerciseSlug.replace(/-/g, ' ');
    const acc = Math.round(weakExercises[0].avgAccuracy * 100);
    parts.push(`${exerciseName} was at ${acc}% — today we push that higher.`);
  } else if (lastSession.priorWins.length > 0) {
    parts.push(`Last time: ${lastSession.priorWins[0].toLowerCase()}. Building on that.`);
  }

  // Phoneme-specific line
  if (strugglingPhonemes.length > 0) {
    const p = strugglingPhonemes[0];
    const acc = Math.round(p.accuracy * 100);
    if (acc < 60) {
      parts.push(`The "${p.phoneme}" sound needs work (${acc}%) — exercises today include that.`);
    }
  }

  // Cue dependency line
  if (cueDependencyHigh) {
    parts.push("You needed more support last time, so today we're fading cues slightly.");
  }

  const opener = parts.length > 0
    ? parts.slice(0, 2).join(' ')
    : "Continuing where we left off.";

  // ── Carry-forward words ──
  const carryForwardWords = lastSession.lastDrilledWords.slice(0, 3);

  // ── Closing comparison seed ──
  let closingComparison: string | null = null;
  if (lastSession.lastAvgScore !== null) {
    closingComparison = `last_avg:${lastSession.lastAvgScore}`;
  }

  return {
    opener,
    weakestDomain,
    cueDependencyHigh,
    transferWeak,
    carryForwardWords,
    closingComparison,
    isFirstSession: false,
  };
}

// ─── Closing comparison using continuity ────────────────────

export function buildContinuityClosing(
  signals: ContinuitySignals,
  currentGame1Score: number | null,
  currentGame2Score: number | null,
): string | null {
  if (signals.isFirstSession || !signals.closingComparison) return null;

  const lastAvg = parseFloat(signals.closingComparison.replace('last_avg:', ''));
  if (isNaN(lastAvg)) return null;

  const currentScores = [currentGame1Score, currentGame2Score].filter((s): s is number => s !== null);
  if (currentScores.length === 0) return null;

  const currentAvg = currentScores.reduce((a, b) => a + b, 0) / currentScores.length;
  const lastPct = Math.round(lastAvg * 100);
  const currPct = Math.round(currentAvg * 100);
  const delta = currPct - lastPct;

  if (delta >= 10) {
    return `${delta} points higher than last session — the practice is paying off.`;
  } else if (delta >= 0) {
    return `Holding steady at ${currPct}%. Consistency builds reliability.`;
  } else if (delta > -10) {
    return `Slightly tougher today — that means we're working at the right level.`;
  }
  return null;
}

// ─── Helpers ────────────────────────────────────────────────

function humanizeDomain(slug: string): string {
  const map: Record<string, string> = {
    lexical_retrieval: 'Word finding',
    semantic_depth: 'Word meaning',
    semantic: 'Word meaning',
    phonology: 'Sound processing',
    phonological: 'Sound processing',
    syntax: 'Sentence building',
    discourse: 'Connected speech',
    comprehension: 'Understanding',
    executive_function: 'Planning & flexibility',
  };
  return map[slug] || slug.replace(/_/g, ' ');
}
