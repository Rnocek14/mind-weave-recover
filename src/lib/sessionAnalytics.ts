/**
 * Session Analytics — Clinician-Ready Metrics Layer
 * 
 * Turns raw exercise_events + session data into structured,
 * clinician-usable metrics per domain and across sessions.
 */

import { supabase } from '@/integrations/supabase/client';
import type { NormalizedExerciseResult } from './normalizedExerciseResult';

// ── Domain Definitions ──

export type ClinicalDomain = 
  | 'expressive_language'
  | 'receptive_language'
  | 'phonology'
  | 'semantic_processing'
  | 'sentence_production'
  | 'discourse';

export const DOMAIN_LABELS: Record<ClinicalDomain, string> = {
  expressive_language: 'Word Finding',
  receptive_language: 'Comprehension',
  phonology: 'Sound Processing',
  semantic_processing: 'Semantic Processing',
  sentence_production: 'Sentence Building',
  discourse: 'Connected Speech',
};

const SLUG_TO_DOMAIN: Record<string, ClinicalDomain> = {
  'photo-naming': 'expressive_language',
  'semantic-features': 'semantic_processing',
  'meaning-match': 'receptive_language',
  'minimal-pairs': 'phonology',
  'sentence-construction': 'sentence_production',
  'yes-no-comprehension': 'receptive_language',
  'story-retell': 'discourse',
  'word-practice': 'expressive_language',
  'describe-and-guess': 'expressive_language',
  'narrative-retell': 'discourse',
  'follow-directions': 'receptive_language',
  'category-fluency': 'expressive_language',
  'sequence-builder': 'discourse',
};

// ── Per-Session Metrics ──

export interface SessionDomainMetrics {
  domain: ClinicalDomain;
  label: string;
  accuracy: number; // 0-1
  avgLatencyMs: number | null;
  avgCueLevel: number;
  successBand: 'low' | 'target' | 'high';
  trialCount: number;
}

export interface SessionAnalyticsSummary {
  sessionId: string;
  domainMetrics: SessionDomainMetrics[];
  primaryStruggle: string | null;
  strongestArea: string | null;
  fatigueLevel: 'low' | 'moderate' | 'high';
  engagementLevel: 'low' | 'moderate' | 'high';
  totalTrials: number;
  overallAccuracy: number;
}

/**
 * Build a session-level analytics summary from normalized results.
 */
export function buildSessionAnalytics(
  sessionId: string,
  results: NormalizedExerciseResult[],
  sessionDurationSec?: number
): SessionAnalyticsSummary {
  // Group by domain
  const byDomain = new Map<ClinicalDomain, NormalizedExerciseResult[]>();
  
  for (const r of results) {
    const domain = SLUG_TO_DOMAIN[r.slug] || 'expressive_language';
    const existing = byDomain.get(domain) || [];
    existing.push(r);
    byDomain.set(domain, existing);
  }

  const domainMetrics: SessionDomainMetrics[] = [];
  
  for (const [domain, domainResults] of byDomain) {
    const scores = domainResults.map(r => r.score);
    const accuracy = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    const latencies = domainResults
      .map(r => r.reactionTimeMs)
      .filter((l): l is number => l !== undefined);
    const avgLatencyMs = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;
    
    const cueLevels = domainResults
      .map(r => r.cueLevelUsed ?? 0);
    const avgCueLevel = cueLevels.reduce((a, b) => a + b, 0) / cueLevels.length;

    const successBand: 'low' | 'target' | 'high' =
      accuracy < 0.5 ? 'low' : accuracy <= 0.85 ? 'target' : 'high';

    domainMetrics.push({
      domain,
      label: DOMAIN_LABELS[domain],
      accuracy,
      avgLatencyMs,
      avgCueLevel,
      successBand,
      trialCount: domainResults.length,
    });
  }

  // Sort by accuracy to find strongest/weakest
  const sorted = [...domainMetrics].sort((a, b) => a.accuracy - b.accuracy);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];

  // Fatigue: infer from late-session accuracy drop
  const totalTrials = results.length;
  let fatigueLevel: 'low' | 'moderate' | 'high' = 'low';
  if (results.length >= 6) {
    const firstHalf = results.slice(0, Math.floor(results.length / 2));
    const secondHalf = results.slice(Math.floor(results.length / 2));
    const firstAvg = firstHalf.reduce((s, r) => s + r.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, r) => s + r.score, 0) / secondHalf.length;
    const drop = firstAvg - secondAvg;
    if (drop > 0.2) fatigueLevel = 'high';
    else if (drop > 0.1) fatigueLevel = 'moderate';
  }

  // Engagement from trial count + duration
  let engagementLevel: 'low' | 'moderate' | 'high' = 'moderate';
  if (totalTrials >= 15) engagementLevel = 'high';
  else if (totalTrials <= 3) engagementLevel = 'low';

  const overallAccuracy = results.length > 0
    ? results.reduce((s, r) => s + r.score, 0) / results.length
    : 0;

  return {
    sessionId,
    domainMetrics,
    primaryStruggle: weakest && weakest.accuracy < 0.7 ? weakest.label : null,
    strongestArea: strongest && strongest.accuracy >= 0.7 ? strongest.label : null,
    fatigueLevel,
    engagementLevel,
    totalTrials,
    overallAccuracy,
  };
}

// ── Cross-Session Trends ──

export interface DomainTrend {
  domain: ClinicalDomain;
  label: string;
  direction: 'improving' | 'stable' | 'declining';
  changePercent: number;
  currentAccuracy: number;
  previousAccuracy: number;
  avgCueLevel: number;
  trialCount: number;
  persistentStruggle: boolean;
}

/**
 * Compute cross-session trends from exercise_events.
 * Compares last 7 days vs previous 7 days.
 */
export async function computeDomainTrends(
  userId: string,
  profileId?: string
): Promise<DomainTrend[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Get sessions for this user in last 14 days
  let sessionsQuery = supabase
    .from('sessions')
    .select('id, started_at')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .gte('started_at', fourteenDaysAgo.toISOString());

  if (profileId) {
    sessionsQuery = sessionsQuery.eq('profile_id', profileId);
  }

  const { data: sessions } = await sessionsQuery;
  if (!sessions?.length) return [];

  const sessionIds = sessions.map(s => s.id);

  // Get events for those sessions
  const { data: events } = await supabase
    .from('exercise_events')
    .select('exercise_slug, score, cue_level, reaction_time_ms, created_at, session_id')
    .in('session_id', sessionIds);

  if (!events?.length) return [];

  // Split into recent (7d) and previous (7-14d)
  const recentEvents = events.filter(e => new Date(e.created_at!) >= sevenDaysAgo);
  const previousEvents = events.filter(e => new Date(e.created_at!) < sevenDaysAgo);

  // Aggregate by domain
  const trends: DomainTrend[] = [];

  for (const [slug, domain] of Object.entries(SLUG_TO_DOMAIN)) {
    const recent = recentEvents.filter(e => e.exercise_slug === slug);
    const previous = previousEvents.filter(e => e.exercise_slug === slug);

    if (recent.length === 0 && previous.length === 0) continue;

    const recentAcc = recent.length > 0
      ? recent.reduce((s, e) => s + ((e.score ?? 0) > 1 ? (e.score ?? 0) / 100 : (e.score ?? 0)), 0) / recent.length
      : null;
    const previousAcc = previous.length > 0
      ? previous.reduce((s, e) => s + ((e.score ?? 0) > 1 ? (e.score ?? 0) / 100 : (e.score ?? 0)), 0) / previous.length
      : null;

    const currentAccuracy = recentAcc ?? previousAcc ?? 0;
    const prevAccuracy = previousAcc ?? currentAccuracy;
    const change = currentAccuracy - prevAccuracy;

    let direction: 'improving' | 'stable' | 'declining' = 'stable';
    if (change > 0.05) direction = 'improving';
    else if (change < -0.05) direction = 'declining';

    const allCues = [...recent, ...previous].map(e => e.cue_level ?? 0);
    const avgCueLevel = allCues.length > 0 ? allCues.reduce((a, b) => a + b, 0) / allCues.length : 0;

    // Check if existing trends entry for this domain
    const existing = trends.find(t => t.domain === domain);
    if (existing) {
      // Merge — add trial counts
      existing.trialCount += recent.length + previous.length;
      continue;
    }

    trends.push({
      domain,
      label: DOMAIN_LABELS[domain],
      direction,
      changePercent: Math.round(change * 100),
      currentAccuracy,
      previousAccuracy: prevAccuracy,
      avgCueLevel,
      trialCount: recent.length + previous.length,
      persistentStruggle: currentAccuracy < 0.6 && prevAccuracy < 0.6,
    });
  }

  return trends.sort((a, b) => a.currentAccuracy - b.currentAccuracy);
}

/**
 * Format trends into clinician-readable strings.
 */
export function formatTrendsForClinician(trends: DomainTrend[]): string[] {
  return trends.map(t => {
    const acc = Math.round(t.currentAccuracy * 100);
    const arrow = t.direction === 'improving' ? '↑' : t.direction === 'declining' ? '↓' : '→';
    const change = t.changePercent !== 0 ? ` (${t.changePercent > 0 ? '+' : ''}${t.changePercent}%)` : '';
    const cue = t.avgCueLevel > 1 ? ` | High cue dependency` : '';
    const struggle = t.persistentStruggle ? ' ⚠️ Persistent' : '';
    return `${t.label}: ${acc}% ${arrow}${change}${cue}${struggle} (${t.trialCount} trials)`;
  });
}
