/**
 * Hook to compute analytics snapshot data for the dashboard
 * 
 * Answers the 5 user questions:
 * 1. Am I improving?
 * 2. What's hard for me?
 * 3. What's helping?
 * 4. What should I focus on?
 * 5. Anything concerning?
 */

import { useMemo } from 'react';
import { useLearningRate } from '@/hooks/useLearningRate';
import { useWeeklyTrends } from '@/hooks/useWeeklyTrends';
import { useStrugglingWords, type StrugglingWord } from '@/hooks/useStrugglingWords';
import { useStrugglingPhonemes, type StrugglingPhoneme } from '@/hooks/useStrugglingPhonemes';
import { useErrorPatternAnalytics } from '@/hooks/useErrorPatternAnalytics';
import { useRedFlagDetection } from '@/hooks/useRedFlagDetection';
import { 
  narrateRecoveryTrend, 
  narrateChallenges, 
  narrateStrategies,
  type RecoveryNarrative,
  type ChallengeNarrative,
  type StrategyNarrative,
} from '@/lib/insightNarrator';

export interface AnalyticsSnapshot {
  isLoading: boolean;
  
  // Question 1: Am I improving?
  recovery: RecoveryNarrative;
  
  // Question 2: What's hard for me?
  challenges: ChallengeNarrative[];
  hardestWords: StrugglingWord[];
  strugglingPhonemes: StrugglingPhoneme[];
  
  // Question 3: What's helping?
  bestStrategy: StrategyNarrative | null;
  
  // Question 4: What should I focus on?
  focusWords: string[];
  focusPhonemes: string[];
  
  // Question 5: Anything concerning?
  alertCount: number;
  alertSummary: string | null;
  
  // Data quality
  hasEnoughData: boolean;
  totalTrials: number;
}

export function useAnalyticsSnapshot(userId: string | undefined): AnalyticsSnapshot {
  const enabled = !!userId;
  
  // Fetch all data sources
  const { learningRates, isLoading: lrLoading } = useLearningRate(userId, { enabled });
  const { trends: weeklyTrends, loading: trendsLoading } = useWeeklyTrends();
  const { strugglingWords, focusWords, loading: wordsLoading } = useStrugglingWords({ userId, enabled });
  const { strugglingPhonemes, targetWords, loading: phonemesLoading, hasReadyPhonemes: phonemeDataOk } = useStrugglingPhonemes(userId, { profileId: undefined });
  const { analytics: errorAnalytics, isLoading: errorLoading } = useErrorPatternAnalytics(userId, { weeksBack: 4, enabled });
  const { flags: redFlags, isLoading: flagsLoading } = useRedFlagDetection(userId, { enabled });

  const isLoading = enabled && (lrLoading || trendsLoading || wordsLoading || phonemesLoading || errorLoading || flagsLoading);

  return useMemo<AnalyticsSnapshot>(() => {
    // Q1: Am I improving?
    const recovery = narrateRecoveryTrend(learningRates, weeklyTrends);
    
    // Q2: What's hard for me?
    const challenges = narrateChallenges(
      errorAnalytics?.challengingTargets || [],
      errorAnalytics?.fluencyMetrics || null,
      errorAnalytics?.errorBreakdown || null
    );
    
    // Q3: What's helping?
    const bestStrategy = narrateStrategies(
      errorAnalytics?.cueEfficacy || null,
      null
    );
    
    // Q5: Anything concerning?
    const alertCount = redFlags.length;
    const alertSummary = alertCount > 0 
      ? redFlags[0].message 
      : null;
    
    // Total trials for data quality
    const totalTrials = weeklyTrends.reduce((sum, t) => sum + t.totalTrials, 0);
    const hasEnoughData = totalTrials >= 10;
    
    return {
      isLoading,
      recovery,
      challenges,
      hardestWords: strugglingWords.slice(0, 3),
      strugglingPhonemes: strugglingPhonemes.slice(0, 3),
      bestStrategy,
      focusWords,
      focusPhonemes: strugglingPhonemes.slice(0, 3).map(p => p.phoneme),
      alertCount,
      alertSummary,
      hasEnoughData,
      totalTrials,
    };
  }, [
    isLoading,
    learningRates,
    weeklyTrends,
    strugglingWords,
    strugglingPhonemes,
    errorAnalytics,
    redFlags,
    focusWords,
  ]);
}
