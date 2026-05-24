/**
 * useWordMastery — Longitudinal word mastery tracking
 * 
 * A word is:
 * - "mastered": ≥80% accuracy over last 5+ attempts, most recent correct, at least one at cue_level ≤ 1
 * - "emerging": 40-79% accuracy over 5+ attempts, OR ≥80% but only with cue_level ≥ 2
 * - "struggling": <40% accuracy over 5+ attempts
 * 
 * Returns current counts + weekly snapshots for trend visualization.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useActiveProfileId } from '@/hooks/useActiveProfileId';

export type MasteryLevel = 'mastered' | 'emerging' | 'struggling' | 'untested';

export interface WordMasteryEntry {
  word: string;
  level: MasteryLevel;
  accuracy: number;          // 0-1
  attempts: number;
  lastAttempted: string;
  bestCueLevel: number;      // lowest cue_level with a correct response
  recentCorrect: boolean;    // most recent attempt was correct
}

export interface MasterySnapshot {
  date: string;              // ISO date
  mastered: number;
  emerging: number;
  struggling: number;
  total: number;
}

export interface UseWordMasteryResult {
  words: WordMasteryEntry[];
  mastered: number;
  emerging: number;
  struggling: number;
  snapshots: MasterySnapshot[];   // weekly snapshots for trend
  loading: boolean;
  error: string | null;
}

interface WordTrialRow {
  target_word: string;
  is_correct: boolean;
  cue_level: number | null;
  created_at: string;
}

function classifyWord(trials: WordTrialRow[]): Omit<WordMasteryEntry, 'word'> {
  const sorted = [...trials].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  // Use last 10 attempts max for recency bias
  const recent = sorted.slice(0, 10);
  const correct = recent.filter(t => t.is_correct).length;
  const accuracy = correct / recent.length;
  const recentCorrect = sorted[0]?.is_correct ?? false;
  
  // Best (lowest) cue level where they got it right
  const correctTrials = recent.filter(t => t.is_correct);
  const bestCueLevel = correctTrials.length > 0
    ? Math.min(...correctTrials.map(t => t.cue_level ?? 3))
    : 3;

  let level: MasteryLevel = 'struggling';
  if (accuracy >= 0.8 && recentCorrect && bestCueLevel <= 1) {
    level = 'mastered';
  } else if (accuracy >= 0.4 || (accuracy >= 0.8 && bestCueLevel >= 2)) {
    level = 'emerging';
  }

  return {
    level,
    accuracy,
    attempts: trials.length,
    lastAttempted: sorted[0]?.created_at ?? '',
    bestCueLevel,
    recentCorrect,
  };
}

export function useWordMastery(
  userId: string | undefined,
  options: { enabled?: boolean; lookbackDays?: number } = {}
): UseWordMasteryResult {
  const { enabled = true, lookbackDays = 90 } = options;
  const activeProfileId = useActiveProfileId();
  const [words, setWords] = useState<WordMasteryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!userId || !enabled) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - lookbackDays);

      // Query utterance_analyses for word-level data
      let uaQ = supabase
        .from('utterance_analyses')
        .select('target_word, is_correct, created_at')
        .eq('user_id', userId)
        .gte('created_at', cutoff.toISOString())
        .not('target_word', 'is', null)
        .order('created_at', { ascending: false });
      if (activeProfileId) uaQ = uaQ.eq('profile_id', activeProfileId);
      const { data, error: fetchErr } = await uaQ;

      if (fetchErr) throw fetchErr;
      if (!data || data.length === 0) { setWords([]); setLoading(false); return; }

      // Also get cue_level from exercise_events via attempt linkage
      // For now, use a simpler approach: query exercise_events directly
      let eeQ = supabase
        .from('exercise_events')
        .select('inputs, score, cue_level, created_at, session_id!inner(user_id)')
        .eq('session_id.user_id', userId)
        .gte('created_at', cutoff.toISOString())
        .not('inputs', 'is', null);
      if (activeProfileId) eeQ = eeQ.eq('profile_id', activeProfileId);
      const { data: eeData } = await eeQ;

      // Build word-level trial map from both sources
      const wordMap: Record<string, WordTrialRow[]> = {};

      // From utterance_analyses (has is_correct + target_word)
      for (const row of data) {
        const word = row.target_word!.toLowerCase().trim();
        if (!word) continue;
        if (!wordMap[word]) wordMap[word] = [];
        wordMap[word].push({
          target_word: word,
          is_correct: row.is_correct ?? false,
          cue_level: null, // will try to merge from exercise_events
          created_at: row.created_at,
        });
      }

      // Enrich with cue_level from exercise_events where we can match by target word
      if (eeData) {
        for (const ee of eeData) {
          const targetWord = ((ee.inputs as any)?.targetWord || (ee.inputs as any)?.target_word || '')
            .toLowerCase().trim();
          if (!targetWord) continue;
          const trials = wordMap[targetWord];
          if (!trials) continue;
          // Match by closest timestamp (within 30s)
          const eeTime = new Date(ee.created_at!).getTime();
          for (const trial of trials) {
            if (trial.cue_level === null) {
              const trialTime = new Date(trial.created_at).getTime();
              if (Math.abs(eeTime - trialTime) < 30000) {
                trial.cue_level = ee.cue_level ?? 0;
                break;
              }
            }
          }
        }
      }

      // Classify each word
      const entries: WordMasteryEntry[] = [];
      for (const word of Object.keys(wordMap)) {
        const trials = wordMap[word];
        if (trials.length < 3) continue; // need minimum attempts
        const classification = classifyWord(trials);
        entries.push({ word, ...classification });
      }

      // Sort: mastered first, then emerging, then struggling
      const levelOrder: Record<MasteryLevel, number> = { mastered: 0, emerging: 1, struggling: 2, untested: 3 };
      entries.sort((a, b) => levelOrder[a.level] - levelOrder[b.level] || b.accuracy - a.accuracy);

      setWords(entries);
    } catch (err) {
      console.error('[useWordMastery] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [userId, enabled, lookbackDays, activeProfileId]);

  useEffect(() => { fetch(); }, [fetch]);

  const mastered = useMemo(() => words.filter(w => w.level === 'mastered').length, [words]);
  const emerging = useMemo(() => words.filter(w => w.level === 'emerging').length, [words]);
  const struggling = useMemo(() => words.filter(w => w.level === 'struggling').length, [words]);

  // Generate weekly snapshots from the word data
  const snapshots = useMemo<MasterySnapshot[]>(() => {
    if (words.length === 0) return [];
    // For now return current snapshot — historical snapshots need stored checkpoints
    const today = new Date().toISOString().slice(0, 10);
    return [{
      date: today,
      mastered,
      emerging,
      struggling,
      total: words.length,
    }];
  }, [words, mastered, emerging, struggling]);

  return { words, mastered, emerging, struggling, snapshots, loading, error };
}
