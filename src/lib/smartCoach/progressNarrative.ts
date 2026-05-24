/**
 * Smart Coach — Cross-Session Progress Narrative
 * 
 * Generates human-readable progress comparisons across sessions.
 * Loads last session summary and builds orientation + wrap-up text.
 */

import { supabase } from '@/integrations/supabase/client';
import type { SessionMetrics } from './types';

// ─── Types ──────────────────────────────────────────────────

export interface LastSessionSummary {
  primaryDomain: string | null;
  topWins: string[];
  topStruggles: string[];
  mayaSummary: string | null;
  avgScore: number | null;
  metadata: {
    metrics?: Partial<SessionMetrics>;
    strategies?: string[];
    topic?: string;
  } | null;
  createdAt: string;
}

export interface ProgressComparison {
  /** Text for orientation card */
  orientationText: string;
  /** Text for wrap-up comparison */
  wrapupComparison: string | null;
  /** Whether we have prior data */
  hasPriorSession: boolean;
  /** Last session summary for prompt injection */
  lastSessionContext: string | null;
}

// ─── Load Last Session ──────────────────────────────────────

/** Load the most recent session summary for a user/profile */
export async function loadLastSessionSummary(
  userId: string,
  profileId?: string | null,
): Promise<LastSessionSummary | null> {
  try {
    let query = supabase
      .from('coach_conversation_summaries')
      .select('primary_domain, top_wins, top_struggles, maya_summary, avg_score, metadata, created_at')
      .eq('user_id', userId);

    // Scope to current patient profile to avoid mixing summaries across patients
    if (profileId) query = query.eq('profile_id', profileId);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      primaryDomain: data.primary_domain,
      topWins: data.top_wins || [],
      topStruggles: data.top_struggles || [],
      mayaSummary: data.maya_summary,
      avgScore: data.avg_score,
      metadata: data.metadata as LastSessionSummary['metadata'],
      createdAt: data.created_at,
    };
  } catch {
    console.warn('[ProgressNarrative] Failed to load last session');
    return null;
  }
}

// ─── Build Narrative ────────────────────────────────────────

/** Build progress comparison from last session + current topic */
export function buildProgressComparison(
  lastSession: LastSessionSummary | null,
  currentTopic: string,
  currentMetrics?: SessionMetrics,
): ProgressComparison {
  if (!lastSession) {
    return {
      orientationText: "This is your first session — let's see where you are and build from there.",
      wrapupComparison: null,
      hasPriorSession: false,
      lastSessionContext: null,
    };
  }

  // Build orientation text
  const lastTopic = lastSession.metadata?.topic || lastSession.primaryDomain || 'conversation';
  const lastWin = lastSession.topWins?.[0];
  const daysSince = Math.floor((Date.now() - new Date(lastSession.createdAt).getTime()) / 86400000);
  const timeAgo = daysSince === 0 ? 'earlier today' : daysSince === 1 ? 'yesterday' : `${daysSince} days ago`;

  let orientationText = `Last time (${timeAgo}), you practiced ${lastTopic}`;
  if (lastWin) {
    orientationText += ` and ${lastWin.toLowerCase()}`;
  }
  orientationText += '. ';

  if (currentTopic === lastTopic) {
    orientationText += "Let's build on that progress today.";
  } else {
    orientationText += `Today we're working on ${currentTopic} — different focus, same skills.`;
  }

  // Build wrap-up comparison (only if we have current metrics)
  let wrapupComparison: string | null = null;
  if (currentMetrics && lastSession.metadata?.metrics) {
    const lastMetrics = lastSession.metadata.metrics;
    const comparisons: string[] = [];

    if (lastMetrics.independentResponses !== undefined && currentMetrics.independentResponses > (lastMetrics.independentResponses || 0)) {
      comparisons.push(`${currentMetrics.independentResponses} independent responses today vs ${lastMetrics.independentResponses} last time`);
    }
    if (lastMetrics.cueAssistedCount !== undefined && currentMetrics.cueAssistedCount < (lastMetrics.cueAssistedCount || 999)) {
      comparisons.push(`fewer cues needed this time`);
    }
    if (lastMetrics.longestResponse !== undefined && currentMetrics.longestResponse > (lastMetrics.longestResponse || 0)) {
      comparisons.push(`your longest response grew to ${currentMetrics.longestResponse} words`);
    }

    if (comparisons.length > 0) {
      wrapupComparison = comparisons.join('. ') + '.';
    }
  }

  // Build prompt context for AI
  const lastSessionContext = [
    `Previous session: ${lastTopic} (${timeAgo})`,
    lastWin ? `What went well: ${lastWin}` : null,
    lastSession.topStruggles?.[0] ? `What was hard: ${lastSession.topStruggles[0]}` : null,
    lastSession.metadata?.strategies?.length ? `Strategies used: ${lastSession.metadata.strategies.join(', ')}` : null,
  ].filter(Boolean).join('. ');

  return {
    orientationText,
    wrapupComparison,
    hasPriorSession: true,
    lastSessionContext,
  };
}

// ─── Save Session Summary ───────────────────────────────────

/** Save current session metrics as a summary for future reference */
export async function saveSessionSummary(
  userId: string,
  sessionId: string | null,
  topic: string,
  metrics: SessionMetrics,
  strategies: string[],
): Promise<void> {
  try {
    const wins: string[] = [];
    if (metrics.independentResponses > 0) wins.push(`gave ${metrics.independentResponses} independent responses`);
    if (metrics.longestResponse >= 5) wins.push(`produced responses up to ${metrics.longestResponse} words`);

    const struggles: string[] = [];
    if (metrics.hesitationCount > 2) struggles.push(`hesitated ${metrics.hesitationCount} times`);
    if (metrics.cueAssistedCount > 2) struggles.push(`needed ${metrics.cueAssistedCount} cues`);

    await supabase
      .from('coach_conversation_summaries')
      .insert({
        user_id: userId,
        session_id: sessionId,
        primary_domain: topic,
        top_wins: wins,
        top_struggles: struggles,
        maya_summary: `Practiced ${topic}. ${wins[0] || 'Completed session'}.`,
        avg_score: metrics.independentResponses > 0 
          ? Math.min(1, parseFloat((metrics.independentResponses / (metrics.independentResponses + metrics.cueAssistedCount)).toFixed(3)))
          : null,
        metadata: { metrics, strategies, topic } as any,
      });
  } catch (err) {
    console.warn('[ProgressNarrative] Failed to save summary:', err);
  }
}
