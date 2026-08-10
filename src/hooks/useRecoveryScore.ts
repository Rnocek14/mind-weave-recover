/**
 * useRecoveryScore — Live recovery score computation + daily snapshot persistence
 * 
 * Composite score (0-100) from 6 components:
 *   - Accuracy trajectory    (25%)
 *   - Cue independence       (25%)
 *   - Error quality          (15%)
 *   - Word mastery growth    (15%)
 *   - Response latency       (10%)
 *   - Session endurance      (10%)
 * 
 * Score version: v1
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCueIndependence } from './useCueIndependence';
import { useErrorQualityScore } from './useErrorQualityScore';
import { useWordMastery } from './useWordMastery';
import { useSessionEndurance } from './useSessionEndurance';
import { useLearningRate, findSpeechLearningRate } from './useLearningRate';
import { localYYYYMMDD } from '@/lib/localDate';

const SCORE_VERSION = 'v1';

const WEIGHTS = {
  accuracy: 0.25,
  cueIndependence: 0.25,
  errorQuality: 0.15,
  wordMastery: 0.15,
  latency: 0.10,
  endurance: 0.10,
};

export interface RecoveryScoreBreakdown {
  accuracy: number;       // 0-100
  cueIndependence: number;
  errorQuality: number;
  wordMastery: number;
  latency: number;
  endurance: number;
}

export interface RecoveryScoreResult {
  score: number | null;           // 0-100
  breakdown: RecoveryScoreBreakdown | null;
  confidence: 'high' | 'moderate' | 'low' | 'insufficient';
  trend: 'improving' | 'stable' | 'declining' | 'insufficient';
  weeklyDelta: number | null;     // change from 7 days ago
  loading: boolean;
  history: { date: string; score: number }[];
}

// Normalize accuracy slope to 0-100 score
// Slope of ~0.05/day = excellent = 100; 0 = 50; negative = below 50
function normalizeAccuracy(endAccuracy: number | null, startAccuracy: number | null, slope: number | null): number {
  if (endAccuracy == null) return 0;
  // Base: current accuracy as percentage (0-100)
  const base = Math.min(100, Math.max(0, endAccuracy * 100));
  // Bonus/penalty for slope direction
  const slopeBonus = slope != null ? Math.max(-15, Math.min(15, slope * 300)) : 0;
  return Math.min(100, Math.max(0, base * 0.7 + (50 + slopeBonus) * 0.3));
}

// Normalize cue independence (0-1) to 0-100
function normalizeCueIndependence(score: number | null): number {
  if (score == null) return 0;
  return Math.min(100, Math.max(0, score * 100));
}

// Normalize error quality (0-1) to 0-100
function normalizeErrorQuality(score: number | null): number {
  if (score == null) return 0;
  return Math.min(100, Math.max(0, score * 100));
}

// Normalize word mastery: more words mastered = higher score
// 0 words = 0; 5 = ~50; 15+ = ~90-100
function normalizeWordMastery(mastered: number, total: number): number {
  if (total === 0) return 0;
  const ratio = mastered / Math.max(total, 1);
  // Logarithmic scaling: fast early gains, diminishing returns
  const countScore = Math.min(100, Math.log2(mastered + 1) * 25);
  const ratioScore = ratio * 100;
  return Math.min(100, countScore * 0.6 + ratioScore * 0.4);
}

// Normalize latency improvement: negative RT slope = improving
function normalizeLatency(rtSlope: number | null): number {
  if (rtSlope == null) return 50; // neutral when unknown
  // RT slope of -5ms/day = good; -10+ = excellent; positive = declining
  const normalized = 50 + Math.max(-50, Math.min(50, rtSlope * -5));
  return Math.min(100, Math.max(0, normalized));
}

// Normalize endurance ratio (0-1.5) to 0-100
function normalizeEndurance(ratio: number | null): number {
  if (ratio == null) return 50;
  // 1.0 = perfect (no decay); <0.7 = poor; >1.0 = great (improving through session)
  return Math.min(100, Math.max(0, Math.min(ratio, 1.2) * 83));
}

function computeConfidence(trialCount: number, activeDays: number): 'high' | 'moderate' | 'low' | 'insufficient' {
  if (trialCount < 10) return 'insufficient';
  if (trialCount >= 30 && activeDays >= 3) return 'high';
  if (trialCount >= 10) return 'moderate';
  return 'low';
}

export function useRecoveryScore(
  userId: string | undefined,
  profileId: string | undefined,
  options: { enabled?: boolean; persistSnapshot?: boolean } = {}
): RecoveryScoreResult {
  const { enabled = true, persistSnapshot = true } = options;
  const [history, setHistory] = useState<{ date: string; score: number }[]>([]);
  const [snapshotPersisted, setSnapshotPersisted] = useState(false);

  // Gather all component hooks
  const { learningRates, isLoading: lrLoading } = useLearningRate(userId, { enabled });
  const { currentScore: cueScore, dataPoints: cueData, loading: cueLoading } = useCueIndependence(userId, { enabled });
  const { currentScore: errorScore, loading: errorLoading } = useErrorQualityScore(userId, { enabled });
  const { mastered, words, loading: wordLoading } = useWordMastery(userId, { enabled });
  const { currentRatio: enduranceRatio, loading: enduranceLoading } = useSessionEndurance(userId, { enabled });

  const loading = lrLoading || cueLoading || errorLoading || wordLoading || enduranceLoading;

  // Compute live score
  const { score, breakdown, confidence } = useMemo(() => {
    if (loading || !userId) return { score: null, breakdown: null, confidence: 'insufficient' as const };

    const speechRate = findSpeechLearningRate(learningRates);

    const accuracyComponent = normalizeAccuracy(
      speechRate?.endAccuracy ?? null,
      speechRate?.startAccuracy ?? null,
      speechRate?.accuracySlope ?? null
    );
    const cueComponent = normalizeCueIndependence(cueScore);
    const errorComponent = normalizeErrorQuality(errorScore);
    const masteryComponent = normalizeWordMastery(mastered, words.length);
    const latencyComponent = normalizeLatency(speechRate?.rtSlope ?? null);
    const enduranceComponent = normalizeEndurance(enduranceRatio);

    const bd: RecoveryScoreBreakdown = {
      accuracy: Math.round(accuracyComponent * 10) / 10,
      cueIndependence: Math.round(cueComponent * 10) / 10,
      errorQuality: Math.round(errorComponent * 10) / 10,
      wordMastery: Math.round(masteryComponent * 10) / 10,
      latency: Math.round(latencyComponent * 10) / 10,
      endurance: Math.round(enduranceComponent * 10) / 10,
    };

    const composite = Math.round(
      bd.accuracy * WEIGHTS.accuracy +
      bd.cueIndependence * WEIGHTS.cueIndependence +
      bd.errorQuality * WEIGHTS.errorQuality +
      bd.wordMastery * WEIGHTS.wordMastery +
      bd.latency * WEIGHTS.latency +
      bd.endurance * WEIGHTS.endurance
    );

    const trialCount = (speechRate?.trialCount ?? 0) + (cueData?.length ?? 0);
    const activeDays = cueData?.length ?? 0;
    const conf = computeConfidence(trialCount, activeDays);

    return { score: composite, breakdown: bd, confidence: conf };
  }, [loading, userId, learningRates, cueScore, errorScore, mastered, words.length, enduranceRatio, cueData?.length]);

  // Fetch historical snapshots
  useEffect(() => {
    if (!userId || !profileId || !enabled) return;
    
    supabase
      .from('recovery_score_snapshots')
      .select('snapshot_date, recovery_score')
      .eq('user_id', userId)
      .eq('profile_id', profileId)
      .order('snapshot_date', { ascending: true })
      .limit(90)
      .then(({ data }) => {
        if (data) {
          setHistory(data.map(d => ({ date: d.snapshot_date, score: Number(d.recovery_score) })));
        }
      });
  }, [userId, profileId, enabled]);

  // Persist daily snapshot
  const persistSnapshotFn = useCallback(async () => {
    if (!userId || !profileId || score == null || !persistSnapshot || snapshotPersisted || confidence === 'insufficient') return;

    // Local calendar day — a UTC date rolls the snapshot into "tomorrow"
    // for evening sessions west of UTC.
    const today = localYYYYMMDD();

    try {
      const speechRate = findSpeechLearningRate(learningRates);

      await supabase
        .from('recovery_score_snapshots')
        .upsert({
          user_id: userId,
          profile_id: profileId,
          snapshot_date: today,
          recovery_score: score,
          accuracy_score: breakdown?.accuracy ?? null,
          latency_score: breakdown?.latency ?? null,
          cue_independence_score: breakdown?.cueIndependence ?? null,
          error_quality_score: breakdown?.errorQuality ?? null,
          consistency_score: breakdown?.wordMastery ?? null,
          endurance_score: breakdown?.endurance ?? null,
          confidence_level: confidence,
          trial_count: speechRate?.trialCount ?? 0,
          session_count: cueData?.length ?? 0,
          score_version: SCORE_VERSION,
          component_details: { weights: WEIGHTS, version: SCORE_VERSION },
        }, { onConflict: 'user_id,profile_id,snapshot_date' });

      setSnapshotPersisted(true);
    } catch (err) {
      console.error('[useRecoveryScore] Snapshot persistence error:', err);
    }
  }, [userId, profileId, score, breakdown, confidence, persistSnapshot, snapshotPersisted, learningRates, cueData?.length]);

  useEffect(() => {
    if (!loading && score != null) {
      persistSnapshotFn();
    }
  }, [loading, score, persistSnapshotFn]);

  // Compute trend from history
  const trend = useMemo((): RecoveryScoreResult['trend'] => {
    if (history.length < 7) return 'insufficient';
    const recent = history.slice(-7);
    const older = history.slice(-14, -7);
    if (older.length < 3) return 'insufficient';
    const recentAvg = recent.reduce((s, h) => s + h.score, 0) / recent.length;
    const olderAvg = older.reduce((s, h) => s + h.score, 0) / older.length;
    const delta = recentAvg - olderAvg;
    if (delta > 3) return 'improving';
    if (delta < -3) return 'declining';
    return 'stable';
  }, [history]);

  // Weekly delta
  const weeklyDelta = useMemo(() => {
    if (history.length < 2 || score == null) return null;
    const weekAgo = history.find(h => {
      const daysDiff = Math.abs((Date.now() - new Date(h.date).getTime()) / 86400000);
      return daysDiff >= 6 && daysDiff <= 8;
    });
    return weekAgo ? Math.round(score - weekAgo.score) : null;
  }, [history, score]);

  return { score, breakdown, confidence, trend, weeklyDelta, loading, history };
}
