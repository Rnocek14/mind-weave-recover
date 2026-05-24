/**
 * Coach Session Memory — Persistence layer for cross-session Maya memory
 * 
 * Save: builds a lightweight summary from session data at session end
 * Load: fetches the most recent summary for AI context injection
 */

import { supabase } from '@/integrations/supabase/client';
import type { NormalizedExerciseResult } from './normalizedExerciseResult';

// ─── Types ───

export interface CoachSessionSummary {
  id: string;
  user_id: string;
  session_id: string | null;
  created_at: string;
  primary_domain: string | null;
  top_struggles: string[];
  top_wins: string[];
  exercise_summaries: { slug: string; summary: string; score: number }[];
  maya_summary: string | null;
  avg_score: number | null;
  total_popup_exercises: number;
}

export interface SessionSummaryInput {
  userId: string;
  /** Profile (patient) the session belongs to — required to scope clinician aggregates per patient */
  profileId?: string | null;
  sessionId: string | null;
  popupResults: NormalizedExerciseResult[];
  turnsCompleted: number;
  avgFluency?: number;
  fluencyTrend?: string;
  primaryDomain?: string;
  /** Serialized session intelligence snapshot for cross-session persistence */
  sessionIntelligence?: Record<string, unknown>;
  /** Full conversation transcript for session review */
  conversationTranscript?: { role: string; text: string; timestamp?: string }[];
}

// ─── Build Summary ───

export function buildSessionSummary(input: SessionSummaryInput): {
  primary_domain: string | null;
  top_struggles: string[];
  top_wins: string[];
  exercise_summaries: { slug: string; summary: string; score: number }[];
  maya_summary: string | null;
  avg_score: number | null;
  total_popup_exercises: number;
} {
  const { popupResults, turnsCompleted, avgFluency, fluencyTrend, primaryDomain } = input;

  // Extract struggles and wins from popup results
  const struggles: string[] = [];
  const wins: string[] = [];

  for (const r of popupResults) {
    if (r.struggleSignal === 'moderate' || r.struggleSignal === 'high') {
      struggles.push(r.targetDomain || r.slug);
      if (r.errorTypes?.length) struggles.push(...r.errorTypes);
    }
    if (r.successBand === 'high' || r.successBand === 'target') {
      wins.push(r.targetDomain || r.slug);
    }
  }

  const exerciseSummaries = popupResults.map(r => ({
    slug: r.slug,
    summary: r.summary,
    score: r.score,
  }));

  const avgScore = popupResults.length > 0
    ? popupResults.reduce((sum, r) => sum + r.score, 0) / popupResults.length
    : null;

  // Build maya_summary
  const parts: string[] = [];
  if (turnsCompleted > 0) parts.push(`${turnsCompleted} conversation turns`);
  if (popupResults.length > 0) parts.push(`${popupResults.length} practice exercises`);
  if (avgFluency !== undefined) parts.push(`fluency ${avgFluency}%${fluencyTrend === 'improving' ? ' (improving)' : fluencyTrend === 'declining' ? ' (declining)' : ''}`);
  if (struggles.length > 0) parts.push(`struggled with ${[...new Set(struggles)].slice(0, 2).join(', ')}`);
  if (wins.length > 0) parts.push(`strong on ${[...new Set(wins)].slice(0, 2).join(', ')}`);

  const mayaSummary = parts.length > 0 ? parts.join('. ') + '.' : null;

  return {
    primary_domain: primaryDomain || (popupResults[0]?.targetDomain ?? null),
    top_struggles: [...new Set(struggles)].slice(0, 5),
    top_wins: [...new Set(wins)].slice(0, 5),
    exercise_summaries: exerciseSummaries,
    maya_summary: mayaSummary,
    avg_score: avgScore !== null ? Math.round(avgScore * 1000) / 1000 : null,
    total_popup_exercises: popupResults.length,
  };
}

// ─── Save ───

export async function saveCoachSessionSummary(input: SessionSummaryInput): Promise<void> {
  const summary = buildSessionSummary(input);

  const { error } = await supabase
    .from('coach_conversation_summaries' as any)
    .insert({
      user_id: input.userId,
      profile_id: input.profileId ?? null,
      session_id: input.sessionId,
      ...summary,
      // Persist session intelligence + conversation transcript in metadata column
      metadata: {
        ...(input.sessionIntelligence || {}),
        conversation_transcript: input.conversationTranscript || [],
      },
    } as any);

  if (error) {
    console.error('[CoachMemory] Failed to save session summary:', error);
  }
}

// ─── Load Latest (single) ───

export async function loadLatestCoachSummary(userId: string): Promise<CoachSessionSummary | null> {
  const { data, error } = await (supabase as any)
    .from('coach_conversation_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as CoachSessionSummary;
}

// ─── Load Aggregated (multi-session memory) ───

export async function loadAggregatedMemory(userId: string, limit = 10): Promise<CoachSessionSummary | null> {
  const { data, error } = await (supabase as any)
    .from('coach_conversation_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) return null;

  const summaries = data as CoachSessionSummary[];
  const latest = summaries[0];

  // Aggregate struggles and wins across sessions (deduplicated, weighted by recency)
  const allStruggles: string[] = [];
  const allWins: string[] = [];
  const allExercises: { slug: string; summary: string; score: number }[] = [];

  for (const s of summaries) {
    if (s.top_struggles) allStruggles.push(...s.top_struggles);
    if (s.top_wins) allWins.push(...s.top_wins);
    if (s.exercise_summaries) {
      for (const e of s.exercise_summaries as any[]) {
        allExercises.push({ slug: e.slug ?? '', summary: e.summary ?? '', score: e.score ?? 0 });
      }
    }
  }

  // Count frequency for persistent patterns
  const struggleCounts = countFrequency(allStruggles);
  const winCounts = countFrequency(allWins);

  // Persistent = appeared in 2+ sessions
  const persistentStruggles = Object.entries(struggleCounts)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .map(([item]) => item)
    .slice(0, 5);

  const persistentWins = Object.entries(winCounts)
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .map(([item]) => item)
    .slice(0, 5);

  // Build aggregated summary narrative
  const parts: string[] = [];
  parts.push(`${summaries.length} sessions tracked`);
  if (persistentStruggles.length > 0) parts.push(`persistent challenges: ${persistentStruggles.join(', ')}`);
  if (persistentWins.length > 0) parts.push(`consistent strengths: ${persistentWins.join(', ')}`);

  const avgScore = summaries
    .filter(s => s.avg_score !== null)
    .reduce((sum, s) => sum + (s.avg_score ?? 0), 0) / Math.max(summaries.filter(s => s.avg_score !== null).length, 1);

  return {
    ...latest,
    top_struggles: persistentStruggles.length > 0 ? persistentStruggles : latest.top_struggles,
    top_wins: persistentWins.length > 0 ? persistentWins : latest.top_wins,
    maya_summary: parts.join('. ') + '.',
    avg_score: Math.round(avgScore * 1000) / 1000,
    exercise_summaries: allExercises.slice(0, 10),
  };
}

function countFrequency(items: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = item.toLowerCase().trim();
    if (key) counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

// ─── Format for AI Prompt ───

export function formatMemoryForPrompt(summary: CoachSessionSummary | null): string {
  if (!summary) return '';

  const parts: string[] = ['PRIOR SESSION CONTEXT (use naturally, do not repeat verbatim):'];

  if (summary.maya_summary) {
    parts.push(`Last session: ${summary.maya_summary}`);
  }
  if (summary.top_struggles.length > 0) {
    parts.push(`Recent challenges: ${summary.top_struggles.join(', ')}`);
  }
  if (summary.top_wins.length > 0) {
    parts.push(`Recent strengths: ${summary.top_wins.join(', ')}`);
  }
  if (summary.exercise_summaries.length > 0) {
    const exSummaries = summary.exercise_summaries
      .map((e: any) => e.summary)
      .slice(0, 3)
      .join('; ');
    parts.push(`Recent exercises: ${exSummaries}`);
  }

  return parts.join('\n');
}
