import { BrainRegion } from './brainRegionMapper';
import { supabase } from '@/integrations/supabase/client';

export interface RegionFunctionalScore {
  regionId: string;
  baselineImpairment: number; // 0-100 (higher = more impaired)
  currentScore: number; // 0-100 (higher = better function)
  trend: 'improving' | 'stable' | 'declining';
  trendValue: number; // percentage change
  confidence: 'high' | 'medium' | 'low';
  lastUpdated: Date;
  contributingMetrics: {
    accuracy: number;
    reactionTime: number;
    cueLevel: number;
    trialCount: number;
  };
  affectedDeficits: string[];
}

interface ExerciseMetrics {
  accuracy: number;
  reactionTime: number;
  cueLevel: number;
  trialCount: number;
}

async function aggregateExerciseMetrics(
  userId: string,
  exerciseSlugs: string[]
): Promise<ExerciseMetrics> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // DB stores slugs in both formats (hyphens and underscores), so query both
  const allVariants = [
    ...exerciseSlugs,
    ...exerciseSlugs.map(s => s.replace(/-/g, '_')),
  ];
  const uniqueVariants = [...new Set(allVariants)];

  const { data: events, error } = await supabase
    .from('exercise_events')
    .select('score, reaction_time_ms, cue_level, session_id!inner(user_id)')
    .eq('session_id.user_id', userId)
    .in('exercise_slug', uniqueVariants)
    .gte('created_at', thirtyDaysAgo.toISOString());

  if (error || !events || events.length === 0) {
    return { accuracy: 0, reactionTime: 0, cueLevel: 0, trialCount: 0 };
  }

  // Normalize scores: some exercises store 0/1 (binary), others store 0/100
  // Treat score > 1 as already a percentage, score <= 1 as a fraction
  const validEvents = events.filter(e => e.score !== null);
  const accuracy = validEvents.length > 0
    ? validEvents.reduce((sum, e) => {
        const s = e.score || 0;
        return sum + (s > 1 ? s / 100 : s);
      }, 0) / validEvents.length
    : 0;

  const validRTs = events.filter(e => e.reaction_time_ms !== null && e.reaction_time_ms > 0);
  const reactionTime = validRTs.length > 0
    ? validRTs.reduce((sum, e) => sum + (e.reaction_time_ms || 0), 0) / validRTs.length
    : 0;

  const validCues = events.filter(e => e.cue_level !== null);
  const cueLevel = validCues.length > 0
    ? validCues.reduce((sum, e) => sum + (e.cue_level || 0), 0) / validCues.length
    : 0;

  return {
    accuracy,
    reactionTime,
    cueLevel,
    trialCount: events.length
  };
}

async function calculateTrend(
  userId: string,
  exerciseSlugs: string[]
): Promise<{ trend: 'improving' | 'stable' | 'declining'; value: number }> {
  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  // Recent performance (last 2 weeks)
  const { data: recentEvents } = await supabase
    .from('exercise_events')
    .select('score, session_id!inner(user_id)')
    .eq('session_id.user_id', userId)
    .in('exercise_slug', exerciseSlugs)
    .gte('created_at', twoWeeksAgo.toISOString());

  // Previous performance (2-4 weeks ago)
  const { data: previousEvents } = await supabase
    .from('exercise_events')
    .select('score, session_id!inner(user_id)')
    .eq('session_id.user_id', userId)
    .in('exercise_slug', exerciseSlugs)
    .gte('created_at', fourWeeksAgo.toISOString())
    .lt('created_at', twoWeeksAgo.toISOString());

  if (!recentEvents || recentEvents.length < 5 || !previousEvents || previousEvents.length < 5) {
    return { trend: 'stable', value: 0 };
  }

  const recentAvg = recentEvents.reduce((sum, e) => sum + (e.score || 0), 0) / recentEvents.length;
  const previousAvg = previousEvents.reduce((sum, e) => sum + (e.score || 0), 0) / previousEvents.length;

  const change = recentAvg - previousAvg;
  const percentChange = previousAvg > 0 ? (change / previousAvg) * 100 : 0;

  if (percentChange > 5) return { trend: 'improving', value: percentChange };
  if (percentChange < -5) return { trend: 'declining', value: percentChange };
  return { trend: 'stable', value: percentChange };
}

function calculateNormalizedScore(metrics: ExerciseMetrics): number {
  if (metrics.trialCount === 0) return 0;

  // Accuracy contributes 50%
  const accuracyScore = metrics.accuracy * 50;

  // Cue independence contributes 30% (lower cue level = better)
  const maxCueLevel = 3;
  const cueScore = ((maxCueLevel - metrics.cueLevel) / maxCueLevel) * 30;

  // Reaction time contributes 20% (faster = better, normalized to 0-20 range)
  const normalizedRT = Math.max(0, Math.min(1, 1 - (metrics.reactionTime / 5000)));
  const rtScore = normalizedRT * 20;

  return Math.round(Math.max(0, Math.min(100, accuracyScore + cueScore + rtScore)));
}

function getBaselineImpairment(
  profile: any,
  region: BrainRegion
): number {
  if (!profile?.clinical_profile) return 0;

  const cp = profile.clinical_profile;
  let impairmentLevel = 0;

  // Check if region domains match profile deficits
  const deficits = [
    ...(cp.impairments?.motor || []),
    ...(cp.impairments?.speech || []),
    ...(cp.impairments?.visual || []),
    ...(cp.impairments?.cognitive || [])
  ];

  // Simple heuristic: more deficits in this domain = higher baseline impairment
  const domainDeficits = deficits.filter((d: string) =>
    region.functionalDomains.some(domain =>
      d.toLowerCase().includes(domain) ||
      (domain === 'motor' && (d.includes('arm') || d.includes('leg') || d.includes('weakness'))) ||
      (domain === 'speech' && (d.includes('aphasia') || d.includes('speech'))) ||
      (domain === 'visual' && (d.includes('visual') || d.includes('neglect'))) ||
      (domain === 'cognitive' && (d.includes('memory') || d.includes('attention')))
    )
  );

  impairmentLevel = Math.min(100, domainDeficits.length * 25);

  // Adjust based on severity
  if (cp.severity?.overall === 'severe') impairmentLevel *= 1.2;
  if (cp.severity?.overall === 'mild') impairmentLevel *= 0.8;

  return Math.round(Math.max(0, Math.min(100, impairmentLevel)));
}

function getAffectedDeficits(profile: any, region: BrainRegion): string[] {
  if (!profile?.clinical_profile) return [];

  const cp = profile.clinical_profile;
  const allDeficits = [
    ...(cp.impairments?.motor || []),
    ...(cp.impairments?.speech || []),
    ...(cp.impairments?.visual || []),
    ...(cp.impairments?.cognitive || [])
  ];

  return allDeficits.filter((d: string) =>
    region.functionalDomains.some(domain =>
      d.toLowerCase().includes(domain) ||
      (domain === 'motor' && (d.includes('arm') || d.includes('leg') || d.includes('weakness'))) ||
      (domain === 'speech' && (d.includes('aphasia') || d.includes('speech'))) ||
      (domain === 'visual' && (d.includes('visual') || d.includes('neglect'))) ||
      (domain === 'cognitive' && (d.includes('memory') || d.includes('attention')))
    )
  );
}

export async function calculateRegionScore(
  region: BrainRegion,
  profile: any,
  userId: string
): Promise<RegionFunctionalScore> {
  // Get performance metrics
  const metrics = await aggregateExerciseMetrics(userId, region.exerciseSlugs);
  
  // Calculate current functional score
  const currentScore = calculateNormalizedScore(metrics);
  
  // Get baseline impairment
  const baselineImpairment = getBaselineImpairment(profile, region);
  
  // Calculate trend
  const { trend, value: trendValue } = await calculateTrend(userId, region.exerciseSlugs);
  
  // Determine confidence based on trial count
  let confidence: 'high' | 'medium' | 'low';
  if (metrics.trialCount >= 50) confidence = 'high';
  else if (metrics.trialCount >= 20) confidence = 'medium';
  else confidence = 'low';

  // Get affected deficits for this region
  const affectedDeficits = getAffectedDeficits(profile, region);
  
  return {
    regionId: region.id,
    baselineImpairment,
    currentScore,
    trend,
    trendValue,
    confidence,
    lastUpdated: new Date(),
    contributingMetrics: metrics,
    affectedDeficits
  };
}
