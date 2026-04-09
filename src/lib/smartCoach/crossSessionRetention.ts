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
  /** Cue level needed last time (0 = none, 1–4 = escalating) */
  lastCueLevel: number;
  /** Best (lowest) cue level ever achieved for this word */
  bestCueLevel: number;
  /** Initial cue level when this word was first practiced */
  initialCueLevel: number;
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
  /** Words where cue level decreased (faded) */
  cueFades: { word: string; fromCue: string; toCue: string }[];
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

const CUE_LABELS: Record<number, string> = {
  0: 'no cue',
  1: 'light prompt',
  2: 'semantic cue',
  3: 'phonemic cue',
  4: 'full model',
};

function scoreLabel(score: number): string {
  return SCORE_LABELS[Math.min(4, Math.max(0, score))] || 'not yet';
}

function cueLabel(level: number): string {
  return CUE_LABELS[Math.min(4, Math.max(0, level))] || 'full support';
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
            bestCueLevel: 0,
            initialCueLevel: 0,
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
 * High-frequency English words that should be excluded from retention tracking.
 * These are too common to be meaningful clinical signals — a user saying "good"
 * in session N+1 is not evidence of neuroplasticity from practicing "good" in session N.
 */
const HIGH_FREQUENCY_EXCLUSIONS = new Set([
  'good', 'nice', 'yes', 'no', 'okay', 'ok', 'well', 'like', 'just', 'really',
  'very', 'big', 'small', 'new', 'old', 'thing', 'things', 'time', 'day', 'way',
  'home', 'house', 'man', 'woman', 'people', 'right', 'left', 'back', 'down', 'up',
  'out', 'here', 'there', 'now', 'then', 'know', 'think', 'want', 'need', 'feel',
  'make', 'take', 'give', 'come', 'go', 'get', 'put', 'see', 'look', 'help',
  'one', 'two', 'three', 'four', 'five', 'lot', 'little', 'much', 'more', 'some',
  'all', 'other', 'long', 'great', 'fine', 'sure', 'hard', 'easy', 'name',
  'water', 'food', 'eat', 'drink', 'sleep', 'work', 'walk', 'talk', 'call',
]);

/** Minimum word length to be considered for retention tracking */
const MIN_RETENTION_WORD_LENGTH = 4;

/**
 * Check if a user's utterance contains previously-practiced words.
 * Returns retention checks for any matched words.
 * 
 * Filters out high-frequency words that would cause false positives.
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
    
    // Skip high-frequency words — not clinically meaningful
    if (HIGH_FREQUENCY_EXCLUSIONS.has(wordLower)) continue;
    
    // Skip very short words (< 4 chars) — too likely to be coincidental
    if (wordLower.length < MIN_RETENTION_WORD_LENGTH) continue;
    
    // Require word-boundary match to avoid partial matches (e.g., "cat" in "catch")
    const wordBoundaryRegex = new RegExp(`\\b${wordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (wordBoundaryRegex.test(lower)) {
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
  const cueFades: ProgressDelta['cueFades'] = [];

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

    // Cue fade: if initial cue was higher than current best
    if (prev.initialCueLevel > prev.bestCueLevel && prev.sessionCount >= 2) {
      cueFades.push({
        word: result.target,
        fromCue: cueLabel(prev.initialCueLevel),
        toCue: cueLabel(prev.bestCueLevel),
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

  if (cueFades.length > 0) {
    const fadeExamples = cueFades.slice(0, 2).map(
      f => `"${f.word}" needed ${f.fromCue} before — now ${f.toCue}`
    );
    parts.push(fadeExamples.join('. '));
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
    cueFades,
    narrative: parts.length > 0 ? parts.join('. ') + '.' : '',
  };
}

// ─── Retention Feedback Lines ───────────────────────────────

/**
 * Generate Maya feedback when a previously-practiced word is detected
 * spontaneously in a new session.
 * Only fires for meaningful retention (score improvement or multi-session words).
 */
export function getRetentionFeedback(checks: RetentionCheck[]): string | null {
  if (checks.length === 0) return null;

  // Only trigger for real improvement or multi-session retention
  const improved = checks.filter(c => c.delta === 'improved' && c.previousBest < 4);
  const maintained = checks.filter(c => c.delta === 'maintained');

  if (improved.length > 0) {
    const word = improved[0].word;
    const prevLabel = scoreLabel(improved[0].previousBest);
    return `You used "${word}" on your own — last time it was ${prevLabel}. That's real progress.`;
  }

  if (maintained.length > 0) {
    const word = maintained[0].word;
    return `"${word}" is sticking — you used it last time too, and it's still strong.`;
  }

  return null;
}

// ─── Cue Fade Summary ───────────────────────────────────────

/**
 * Build cue fade narrative from word history.
 * Shows words that progressed from needing support to independence.
 */
export function buildCueFadeSummary(wordHistory: WordHistory[]): string | null {
  const faded = wordHistory.filter(w => 
    w.sessionCount >= 2 && w.initialCueLevel > w.bestCueLevel
  );
  if (faded.length === 0) return null;

  const strongFades = faded
    .filter(w => w.bestScore >= 3)
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, 3);

  if (strongFades.length === 0) return null;

  const descriptions = strongFades.map(w => 
    `"${w.word}" (${cueLabel(w.initialCueLevel)} → ${cueLabel(w.bestCueLevel)})`
  );
  return `Less support needed: ${descriptions.join(', ')}.`;
}

// ─── Retained Words for Summary ─────────────────────────────

/**
 * Get words retained from previous sessions for the "What stuck" summary.
 */
export function getRetainedWords(wordHistory: WordHistory[]): { word: string; sessions: number; level: string }[] {
  return wordHistory
    .filter(w => w.sessionCount >= 2 && w.bestScore >= 3)
    .sort((a, b) => b.sessionCount - a.sessionCount)
    .slice(0, 5)
    .map(w => ({
      word: w.word,
      sessions: w.sessionCount,
      level: scoreLabel(w.bestScore),
    }));
}

// ─── Difficulty Adjustment from Retention ───────────────────

export interface RetentionDifficultyHint {
  /** Words that are retained → can use harder contexts */
  retainedWords: string[];
  /** Words not retained → re-expose at lower difficulty */
  weakWords: string[];
  /** Suggested difficulty adjustment (-1, 0, +1) */
  difficultyDelta: number;
}

/**
 * Use word history to suggest difficulty adjustments for the next drill.
 * Retained words → increase complexity. Weak words → lower difficulty.
 */
export function getRetentionDifficultyHint(wordHistory: WordHistory[]): RetentionDifficultyHint {
  const retained = wordHistory.filter(w => w.sessionCount >= 2 && w.bestScore >= 3);
  const weak = wordHistory.filter(w => w.sessionCount >= 2 && w.bestScore <= 1);

  let difficultyDelta = 0;
  if (retained.length >= 3 && weak.length === 0) {
    difficultyDelta = 1; // User is retaining well → push harder
  } else if (weak.length >= 2) {
    difficultyDelta = -1; // Multiple weak words → ease up
  }

  return {
    retainedWords: retained.map(w => w.word),
    weakWords: weak.map(w => w.word),
    difficultyDelta,
  };
}

// ─── Persist Retention Snapshots ────────────────────────────

/**
 * Persist current word histories to the retention_snapshots table.
 * Called on session end to make retention data queryable for cohort analysis.
 */
export async function persistRetentionSnapshots(
  userId: string,
  profileId: string,
  wordHistories: WordHistory[],
): Promise<void> {
  if (!wordHistories.length || !userId || !profileId) return;

  const today = new Date().toISOString().slice(0, 10);

  const rows = wordHistories.map((wh) => ({
    user_id: userId,
    profile_id: profileId,
    word: wh.word.toLowerCase(),
    best_score: wh.bestScore,
    best_cue_level: wh.bestCueLevel,
    last_score: wh.lastScore,
    last_cue_level: wh.lastCueLevel,
    session_count: wh.sessionCount,
    last_practiced_at: wh.lastPracticedAt,
    topic: wh.topic || null,
    snapshot_date: today,
  }));

  try {
    const { error } = await supabase
      .from('retention_snapshots')
      .upsert(rows, { onConflict: 'profile_id,word,snapshot_date' });

    if (error) {
      console.warn('[CrossSessionRetention] Failed to persist snapshots:', error);
    }
  } catch (err) {
    console.warn('[CrossSessionRetention] Error persisting snapshots:', err);
  }
}
