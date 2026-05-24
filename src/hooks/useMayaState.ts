/**
 * useMayaState — Single source of truth for Maya intelligence across all surfaces.
 * 
 * Composes:
 *   - useMayaInsight (current cognitive/session narrative)
 *   - loadLatestCoachSummary (persisted cross-session memory)
 *   - Word mastery + session metrics
 * 
 * Returns a unified MayaState that every surface consumes.
 */

import { useMemo, useState, useEffect } from 'react';
import { useMayaInsight } from './useMayaInsight';
import { useSessionHistory } from './useSessionHistory';
import { useWordMastery } from './useWordMastery';
import { useLastSessionFeedback } from './useLastSessionFeedback';
import { loadLatestCoachSummary, type CoachSessionSummary } from '@/lib/coachSessionMemory';
import { buildMayaState, type MayaState } from '@/lib/buildMayaState';

interface UseMayaStateOptions {
  userId: string;
  profileId: string;
}

export interface UseMayaStateResult {
  state: MayaState | null;
  isLoading: boolean;
}

export function useMayaState({ userId, profileId }: UseMayaStateOptions): UseMayaStateResult {
  const { insight, isLoading: insightLoading } = useMayaInsight({ userId, profileId });
  const { sessions, loading: sessionsLoading } = useSessionHistory(userId);
  const { mastered, emerging, struggling, loading: masteryLoading } = useWordMastery(userId);
  const { feedback } = useLastSessionFeedback(userId, profileId);

  // Load persisted coach summary
  const [priorSummary, setPriorSummary] = useState<CoachSessionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    // Use aggregated memory (last 10 sessions) for richer cross-session context
    import('@/lib/coachSessionMemory').then(({ loadAggregatedMemory }) => {
      loadAggregatedMemory(userId, 10, profileId).then(summary => {
        if (!cancelled) {
          setPriorSummary(summary);
          setSummaryLoading(false);
        }
      });
    });
    return () => { cancelled = true; };
  }, [userId]);

  const isLoading = insightLoading || sessionsLoading || masteryLoading || summaryLoading;

  // Compute session metrics
  const sessionMetrics = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    const twoWeeksAgo = Date.now() - 14 * 86_400_000;

    const recentSessionCount = sessions.filter(
      s => new Date(s.startedAt).getTime() > weekAgo
    ).length;
    const previousWeekSessionCount = sessions.filter(s => {
      const t = new Date(s.startedAt).getTime();
      return t > twoWeeksAgo && t <= weekAgo;
    }).length;
    const totalSessionsLast14Days = sessions.filter(
      s => new Date(s.startedAt).getTime() > twoWeeksAgo
    ).length;

    // Compute streak
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      const hasSession = sessions.some(s => s.startedAt.split('T')[0] === dateStr);
      if (hasSession) streak++;
      else if (i > 0) break;
    }

    return { streak, recentSessionCount, previousWeekSessionCount, totalSessionsLast14Days };
  }, [sessions]);

  // Independence percentage from last session
  const independencePct = useMemo(() => {
    if (feedback && feedback.total > 0) {
      return Math.round((feedback.independentCorrect / feedback.total) * 100);
    }
    return null;
  }, [feedback]);

  // Build unified state
  const state = useMemo<MayaState | null>(() => {
    if (sessionsLoading) return null;

    return buildMayaState({
      userId,
      insight,
      priorSummary,
      sessionMetrics,
      masteryMetrics: { mastered, emerging, struggling },
      independencePct,
    });
  }, [userId, insight, priorSummary, sessionMetrics, mastered, emerging, struggling, independencePct, sessionsLoading]);

  return { state, isLoading };
}
