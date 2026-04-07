/**
 * Cross-Session Retention Tracking
 * 
 * Loads word-level transfer history from previous sessions and detects
 * whether users retain practiced vocabulary across sessions.
 * 
 * This is the strongest clinical signal: if a word transfers in session N
 * and appears again unprompted in session N+1, that's real neuroplasticity.
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Types ──────────────────────────────────────────────────

export interface WordHistory {
  word: string;
  /** Best transfer score ever achieved (0–4) */
  bestScore: number;
  /** Last transfer score */
  lastScore: number;
  /** Cue level needed last time */
  lastCueLevel: number;
  /** How many sessions this word appeared in */
  sessionCount: number;
  /** When it was last practiced */
  lastPracticedAt: string;
  /** Topic it was practiced in */
  topic: string;
}

export interface RetentionCheck {
  word: string;
  /** Previous best score */
  previousBest: number;
  /** Previous cue level */
  previousCueLevel: number;
  /** What happened this session */
  currentScore: number;
  currentCueLevel: number;
  /** Delta interpretation */
  delta: 'improved' | 'maintained' | 'declined' | 'new_retention';
}

export interface ProgressDelta {
  /** Words that improved since last session */
  improved: { word: string; from: string; to: string }[];
  /** Words retained across sessions */
  retained: { word: string; score: number }[];
  /** Words that need more work */
  declined: { word: string; from: string; to: string }[];
  /** Summary narrative */
  narrative: string;
}

// ─── Score labels for display ───────────────────────────────

const SCORE_LABELS: Record<number, string> = {
  0: 'not yet',
  1: 'recognized',
  2: 'with help',
  3: 'functional',
  4: 'independent',
};

function scoreLabel(score: number): string {
  return SCORE_LABELS[Math.min(4, Math.max(0, score))] || 'not yet';
}

// ─── Load Word History ──────────────────────────────────────

/**
 * Load word-level transfer history from previous sessions.
 * Queries exercise_events with subtype transfer_check.
 */
export async function loadWordHistory(userId: string, limit = 50): Promise<WordHistory[]> {
  try {
    // Get sessions for this user first
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(20);

    if (!sessions?.length) return [];

    const sessionIds = sessions.map(s => s.id);

    const { data: events, error } = await supabase
      .from('exercise_events')
      .select('outputs, task_parameters, created_at, inputs')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !events?.length) return [];

    // Aggregate by word
    const wordMap = new Map<string, WordHistory>();

    for (const ev of events) {
      const taskParams = ev.task_parameters as any;
      const outputs = ev.outputs as any;
      const inputs = ev.inputs as any;

      if (taskParams?.event_subtype !== 'transfer_check') continue;

      const targets = inputs?.transfer_targets as { value: string; type: string; functional_context: string }[] | undefined;
      const targetResults = outputs?.target_results as { target: string; found: boolean }[] | undefined;
      const transferScore = outputs?.transfer_score as number | undefined;

      if (!targets?.length || transferScore === undefined) continue;

      for (const t of targets) {
        const key = t.value.toLowerCase();
        const found = targetResults?.find(r => r.target.toLowerCase() === key)?.found ?? false;
        const existing = wordMap.get(key);

        if (existing) {
          existing.sessionCount++;
          if (transferScore > existing.bestScore) existing.bestScore = transferScore;
          // Keep latest as "last"
          if (ev.created_at && ev.created_at > existing.lastPracticedAt) {
            existing.lastScore = transferScore;
            existing.lastPracticedAt = ev.created_at;
          }
        } else {
          wordMap.set(key, {
            word: t.value,
            bestScore: transferScore,
            lastScore: transferScore,
            lastCueLevel: 0,
            sessionCount: 1,
            lastPracticedAt: ev.created_at || new Date().toISOString(),
            topic: taskParams?.drill_slug || '',
          });
        }
      }
    }

    return Array.from(wordMap.values())
      .sort((a, b) => b.sessionCount - a.sessionCount)
      .slice(0, 30);
  } catch (err) {
    console.warn('[CrossSessionRetention] Failed to load word history:', err);
    return [];
  }
}

// ─── Check Retention ────────────────────────────────────────

/**
 * Check if a user's utterance contains previously-practiced words.
 * Returns retention checks for any matched words.
 */
export function checkRetention(
  utterance: string,
  wordHistory: WordHistory[],
): RetentionCheck[] {
  if (!wordHistory.length || !utterance.trim()) return [];

  const lower = utterance.toLowerCase();
  const checks: RetentionCheck[] = [];

  for (const wh of wordHistory) {
    const wordLower = wh.word.toLowerCase();
    if (lower.includes(wordLower)) {
      // Word from a previous session appeared spontaneously
      checks.push({
        word: wh.word,
        previousBest: wh.bestScore,
        previousCueLevel: wh.lastCueLevel,
        currentScore: 4, // Spontaneous cross-session = max
        currentCueLevel: 0,
        delta: wh.bestScore >= 4 ? 'maintained' : 'improved',
      });
    }
  }

  return checks;
}

// ─── Build Progress Delta ───────────────────────────────────

/**
 * Compare current session transfer results against word history
 * to build a progress narrative.
 */
export function buildProgressDelta(
  currentResults: { target: string; score: number }[],
  wordHistory: WordHistory[],
): ProgressDelta {
  const improved: ProgressDelta['improved'] = [];
  const retained: ProgressDelta['retained'] = [];
  const declined: ProgressDelta['declined'] = [];

  for (const result of currentResults) {
    const key = result.target.toLowerCase();
    const prev = wordHistory.find(w => w.word.toLowerCase() === key);

    if (!prev) continue; // New word, no comparison

    if (result.score > prev.lastScore) {
      improved.push({
        word: result.target,
        from: scoreLabel(prev.lastScore),
        to: scoreLabel(result.score),
      });
    } else if (result.score === prev.lastScore && result.score >= 3) {
      retained.push({ word: result.target, score: result.score });
    } else if (result.score < prev.lastScore) {
      declined.push({
        word: result.target,
        from: scoreLabel(prev.lastScore),
        to: scoreLabel(result.score),
      });
    }
  }

  // Build narrative
  const parts: string[] = [];

  if (improved.length > 0) {
    const examples = improved.slice(0, 2).map(
      i => `"${i.word}" went from ${i.from} to ${i.to}`
    );
    parts.push(examples.join('. '));
  }

  if (retained.length > 0) {
    const words = retained.slice(0, 3).map(r => `"${r.word}"`).join(', ');
    parts.push(`${words} — still strong`);
  }

  if (declined.length > 0 && improved.length === 0) {
    parts.push(`Some words need more practice — that's normal`);
  }

  return {
    improved,
    retained,
    declined,
    narrative: parts.length > 0 ? parts.join('. ') + '.' : '',
  };
}

// ─── Retention Feedback Lines ───────────────────────────────

/**
 * Generate Maya feedback when a previously-practiced word is detected
 * spontaneously in a new session.
 */
export function getRetentionFeedback(checks: RetentionCheck[]): string | null {
  if (checks.length === 0) return null;

  const improved = checks.filter(c => c.delta === 'improved' || c.delta === 'new_retention');
  const maintained = checks.filter(c => c.delta === 'maintained');

  if (improved.length > 0) {
    const word = improved[0].word;
    return `You used "${word}" on your own — you practiced that before, and it came back. That's real progress.`;
  }

  if (maintained.length > 0) {
    const word = maintained[0].word;
    return `"${word}" is sticking — you used it last time too.`;
  }

  return null;
}

// ─── Cue Fade Summary ───────────────────────────────────────

/**
 * Build cue fade narrative from word history.
 * Shows words that progressed from needing support to independence.
 */
export function buildCueFadeSummary(wordHistory: WordHistory[]): string | null {
  const faded = wordHistory.filter(w => w.sessionCount >= 2 && w.bestScore > w.lastCueLevel);
  if (faded.length === 0) return null;

  // Words that went from needing help to independent
  const strongFades = faded
    .filter(w => w.bestScore >= 3)
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, 3);

  if (strongFades.length === 0) return null;

  const words = strongFades.map(w => `"${w.word}"`).join(', ');
  return `${words} — needed help before, now coming more naturally.`;
}
