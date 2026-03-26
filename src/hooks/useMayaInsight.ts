/**
 * useMayaInsight — Orchestrator hook for the Maya Intelligence Layer.
 * 
 * Aggregates data from existing hooks and feeds it into the
 * mayaNarrative engine. Returns a typed MayaInsight object.
 */

import { useMemo } from "react";
import { useCognitiveState } from "@/hooks/useCognitiveState";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useWordMastery } from "@/hooks/useWordMastery";
import { useErrorPatternAnalytics } from "@/hooks/useErrorPatternAnalytics";
import { useLastSessionFeedback } from "@/hooks/useLastSessionFeedback";
import {
  generateMayaInsight,
  type MayaInsight,
  type MayaDomainInput,
  type MayaSessionInput,
  type MayaCueInput,
  type MayaMasteryInput,
} from "@/lib/mayaNarrative";

interface UseMayaInsightOptions {
  userId: string;
  profileId: string;
}

export function useMayaInsight({ userId, profileId }: UseMayaInsightOptions): {
  insight: MayaInsight | null;
  isLoading: boolean;
} {
  const { snapshot, isLoading: cogLoading } = useCognitiveState({ userId, profileId });
  const { sessions, loading: sessLoading } = useSessionHistory(userId);
  const { mastered, emerging, struggling, loading: masteryLoading } = useWordMastery(userId);
  const { analytics, isLoading: analyticsLoading } = useErrorPatternAnalytics(userId, { weeksBack: 4 });
  const { feedback } = useLastSessionFeedback(userId, profileId);

  const isLoading = cogLoading || sessLoading || masteryLoading || analyticsLoading;

  const insight = useMemo<MayaInsight | null>(() => {
    // Need at least session data to generate anything meaningful
    if (sessLoading) return null;

    // Build domain inputs
    const domains: MayaDomainInput[] = (snapshot?.domains || [])
      .filter(d => d.trialCount >= 3)
      .map(d => ({
        domainSlug: d.domainSlug,
        score: d.score,
        trialCount: d.trialCount,
        trend: d.trend as "improving" | "declining" | "stable" | undefined,
      }));

    // Build session input
    const weekAgo = Date.now() - 7 * 86_400_000;
    const recentSessionCount = sessions.filter(
      s => new Date(s.startedAt).getTime() > weekAgo
    ).length;

    // Compute streak
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split("T")[0];
      const hasSession = sessions.some(s => s.startedAt.split("T")[0] === dateStr);
      if (hasSession) streak++;
      else if (i > 0) break;
    }

    const sessionInput: MayaSessionInput = {
      sessionCount: sessions.length,
      recentSessionCount,
      lastSessionCorrect: feedback?.correct,
      lastSessionTotal: feedback?.total,
      lastSessionIndependent: feedback?.independentCorrect,
      correctDelta: feedback?.correctDelta,
      streak,
    };

    // Build cue inputs
    const cues: MayaCueInput[] = (analytics?.cueEfficacy || []).map(c => ({
      cueType: c.cueType,
      efficacyRate: c.efficacyRate,
      totalGiven: c.totalGiven,
    }));

    // Build mastery input
    const masteryInput: MayaMasteryInput = { mastered, emerging, struggling };

    // Compute independence percentage
    let independencePct: number | null = null;
    if (feedback && feedback.total > 0) {
      independencePct = Math.round((feedback.independentCorrect / feedback.total) * 100);
    }

    return generateMayaInsight(domains, sessionInput, cues, masteryInput, independencePct);
  }, [snapshot, sessions, sessLoading, feedback, analytics, mastered, emerging, struggling]);

  return { insight, isLoading };
}
