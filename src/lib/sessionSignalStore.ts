/**
 * Session Signal Store — localStorage-based history of session-level insights.
 * 
 * After each session, the reflection engine output (strength, nextStep, per-exercise
 * weighted signals) is saved here. The recommendation engine reads the last N sessions
 * to detect trends and choose the best next session.
 */

import type { SessionInsight } from './reflectionEngine';

const STORAGE_KEY = 'sessionSignalHistory';
const MAX_HISTORY = 10;

export interface SessionSignalEntry {
  timestamp: number;
  insight: SessionInsight;
  /** Per-exercise scores from the session */
  exerciseScores: Array<{
    exerciseId: string;
    avgScore: number;
    trialCount: number;
  }>;
  /** Which template was used (if any) */
  templateId?: string;
  /** Whether the session was completed or abandoned */
  completed: boolean;
  /** Number of exercises skipped */
  skippedCount?: number;
}

/** Save a session's signals to history */
export function saveSessionSignals(entry: SessionSignalEntry): void {
  try {
    const history = loadSessionHistory();
    history.push(entry);
    // Keep only the most recent entries
    const trimmed = history.slice(-MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* ignore quota errors */ }
}

/** Load all saved session signal history */
export function loadSessionHistory(): SessionSignalEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Get the last N session entries */
export function getRecentSessions(count: number = 3): SessionSignalEntry[] {
  return loadSessionHistory().slice(-count);
}

/** Detect repeated weaknesses across recent sessions */
export function detectRepeatedWeaknesses(recentCount: number = 3): string[] {
  const recent = getRecentSessions(recentCount);
  if (recent.length < 2) return [];

  // Count nextStep occurrences
  const stepCounts = new Map<string, number>();
  for (const entry of recent) {
    const step = entry.insight.nextStep;
    if (step) {
      stepCounts.set(step, (stepCounts.get(step) || 0) + 1);
    }
  }

  // Return any nextStep that appeared in 2+ of last N sessions
  return Array.from(stepCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([step]) => step);
}

/** Detect fatigue/skip patterns */
export function detectFatiguePattern(recentCount: number = 3): boolean {
  const recent = getRecentSessions(recentCount);
  if (recent.length < 2) return false;

  const incompleteCount = recent.filter(r => !r.completed).length;
  const highSkipCount = recent.filter(r => (r.skippedCount ?? 0) >= 2).length;
  
  return incompleteCount >= 2 || highSkipCount >= 2;
}

/** Get average scores per exercise across recent sessions */
export function getRecentExerciseAverages(recentCount: number = 3): Map<string, number> {
  const recent = getRecentSessions(recentCount);
  const totals = new Map<string, { sum: number; count: number }>();

  for (const entry of recent) {
    for (const es of entry.exerciseScores) {
      const existing = totals.get(es.exerciseId) || { sum: 0, count: 0 };
      existing.sum += es.avgScore;
      existing.count += 1;
      totals.set(es.exerciseId, existing);
    }
  }

  const averages = new Map<string, number>();
  for (const [id, { sum, count }] of totals) {
    averages.set(id, sum / count);
  }
  return averages;
}

/** Clear all session history (for testing/reset) */
export function clearSessionHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
