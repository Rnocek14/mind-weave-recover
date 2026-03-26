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
  sessionId: string | null;
  popupResults: NormalizedExerciseResult[];
  turnsCompleted: number;
  avgFluency?: number;
  fluencyTrend?: string;
  primaryDomain?: string;
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
      session_id: input.sessionId,
      ...summary,
    } as any);

  if (error) {
    console.error('[CoachMemory] Failed to save session summary:', error);
  }
}

// ─── Load Latest ───

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
