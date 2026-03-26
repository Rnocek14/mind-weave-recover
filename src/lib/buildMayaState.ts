/**
 * buildMayaState — Unified Maya Intelligence Composer
 * 
 * Merges two intelligence systems into one canonical state:
 *   1. mayaNarrative.ts  → current cognitive/session signals (what Maya thinks NOW)
 *   2. coachSessionMemory → persisted cross-session memory (what Maya REMEMBERS)
 * 
 * Conflict rules:
 *   - Current signal beats old memory for action (rightNow, anticipation)
 *   - Multi-session memory beats single-session noise for tone/theme
 *   - Memory enriches thread — never overrides it
 */

import type {
  MayaInsight,
  MayaNarrativeThread,
  MayaVerbosity,
  MayaMilestone,
} from './mayaNarrative';
import type { CoachSessionSummary } from './coachSessionMemory';

// ── Narrative Version ──
export const MAYA_NARRATIVE_VERSION = '2.0.0';

// ── Unified State ──

export interface MayaStateThread {
  primaryTheme: string | null;
  primaryDomainSlug: string | null;
  primaryDomainLabel: string | null;
  supportingInsight: string | null;
  tone: 'celebrating' | 'encouraging' | 'supportive' | 'steady';
  confidence: number | null;
}

export interface MayaStateMemory {
  mayaSummary: string | null;
  recentStruggles: string[];
  recentWins: string[];
  exerciseSummaries: Array<{ slug: string; summary: string; score: number | null }>;
  lastSessionAt: string | null;
  sessionsRepresented: number;
}

export interface MayaStateTrends {
  continuityLine: string | null;
  memoryLine: string | null;
  summary: string | null;
  rightNow: string | null;
  anticipation: string | null;
}

export interface MayaStateMetrics {
  streak: number;
  recentSessionCount: number;
  previousWeekSessionCount: number;
  totalSessionsLast14Days: number;
  masteredWords: number;
  emergingWords: number;
  strugglingWords: number;
  independencePct: number | null;
}

export interface MayaStateInterpretation {
  seeing: string[];
  helping: string[];
  workingOn: string[];
}

export interface MayaState {
  userId: string;
  updatedAt: string;
  narrativeVersion: string;

  thread: MayaStateThread;
  memory: MayaStateMemory;
  trends: MayaStateTrends;
  metrics: MayaStateMetrics;
  interpretation: MayaStateInterpretation;
  milestone: MayaMilestone | null;
  verbosity: MayaVerbosity;
}

// ── Builder Inputs ──

export interface BuildMayaStateInput {
  userId: string;
  insight: MayaInsight | null;
  priorSummary: CoachSessionSummary | null;
  sessionMetrics: {
    streak: number;
    recentSessionCount: number;
    previousWeekSessionCount: number;
    totalSessionsLast14Days: number;
  };
  masteryMetrics: {
    mastered: number;
    emerging: number;
    struggling: number;
  };
  independencePct: number | null;
}

// ── Builder ──

export function buildMayaState(input: BuildMayaStateInput): MayaState {
  const { userId, insight, priorSummary, sessionMetrics, masteryMetrics, independencePct } = input;

  // ── Thread: prefer current insight, enrich with memory ──
  const thread = buildThread(insight?.thread ?? null, priorSummary);

  // ── Memory: from persisted summary ──
  const memory = buildMemory(priorSummary);

  // ── Trends: current insight is authoritative ──
  const trends: MayaStateTrends = {
    continuityLine: insight?.continuityLine ?? null,
    memoryLine: insight?.memoryLine ?? null,
    summary: insight?.summary ?? null,
    rightNow: insight?.rightNow ?? null,
    anticipation: insight?.anticipation ?? null,
  };

  // ── Interpretation: merge current insight with memory context ──
  const interpretation = buildInterpretation(
    insight?.interpretation ?? null,
    priorSummary
  );

  return {
    userId,
    updatedAt: new Date().toISOString(),
    narrativeVersion: MAYA_NARRATIVE_VERSION,
    thread,
    memory,
    trends,
    metrics: {
      ...sessionMetrics,
      masteredWords: masteryMetrics.mastered,
      emergingWords: masteryMetrics.emerging,
      strugglingWords: masteryMetrics.struggling,
      independencePct,
    },
    interpretation,
    milestone: insight?.milestone ?? null,
    verbosity: insight?.verbosity ?? 'standard',
  };
}

// ── Sub-builders ──

function buildThread(
  narrativeThread: MayaNarrativeThread | null,
  memory: CoachSessionSummary | null,
): MayaStateThread {
  if (!narrativeThread) {
    // No current signal — derive from memory if available
    return {
      primaryTheme: memory?.primary_domain ? `${memory.primary_domain}_focus` : null,
      primaryDomainSlug: memory?.primary_domain ?? null,
      primaryDomainLabel: memory?.primary_domain?.replace(/_/g, ' ') ?? null,
      supportingInsight: null,
      tone: 'steady',
      confidence: memory ? 0.5 : null,
    };
  }

  // Current signal is authoritative for theme
  // Memory enriches confidence: if memory agrees with thread, confidence is higher
  let confidence = 0.6;
  if (memory?.primary_domain && narrativeThread.primaryDomainSlug) {
    if (memory.primary_domain === narrativeThread.primaryDomainSlug) {
      confidence = 0.85; // Same domain across sessions = high confidence
    }
  }

  // Multi-session pattern stabilizes tone
  // If memory shows struggles but insight says celebrating, temper to encouraging
  let tone = narrativeThread.tone;
  if (
    memory &&
    memory.top_struggles.length >= 3 &&
    narrativeThread.tone === 'celebrating'
  ) {
    tone = 'encouraging'; // Don't over-celebrate when struggles persist
  }

  return {
    primaryTheme: narrativeThread.primaryTheme,
    primaryDomainSlug: narrativeThread.primaryDomainSlug,
    primaryDomainLabel: narrativeThread.primaryDomainLabel,
    supportingInsight: narrativeThread.supportingInsight,
    tone,
    confidence,
  };
}

function buildMemory(summary: CoachSessionSummary | null): MayaStateMemory {
  if (!summary) {
    return {
      mayaSummary: null,
      recentStruggles: [],
      recentWins: [],
      exerciseSummaries: [],
      lastSessionAt: null,
      sessionsRepresented: 0,
    };
  }

  return {
    mayaSummary: summary.maya_summary,
    recentStruggles: summary.top_struggles ?? [],
    recentWins: summary.top_wins ?? [],
    exerciseSummaries: (summary.exercise_summaries ?? []).map((e: any) => ({
      slug: e.slug ?? '',
      summary: e.summary ?? '',
      score: e.score ?? null,
    })),
    lastSessionAt: summary.created_at,
    sessionsRepresented: 1, // Single summary for now; future: aggregate multiple
  };
}

function buildInterpretation(
  insightInterp: MayaInsight['interpretation'] | null,
  memory: CoachSessionSummary | null,
): MayaStateInterpretation {
  const seeing = [...(insightInterp?.seeing ?? [])];
  const helping = [...(insightInterp?.helping ?? [])];
  const workingOn = [...(insightInterp?.workingOn ?? [])];

  // Enrich with memory — add struggle context if not already present
  if (memory?.top_struggles?.length) {
    for (const struggle of memory.top_struggles.slice(0, 2)) {
      const alreadyMentioned = workingOn.some(w =>
        w.toLowerCase().includes(struggle.toLowerCase())
      );
      if (!alreadyMentioned) {
        workingOn.push(`Recent focus: ${struggle}`);
      }
    }
  }

  // Enrich with memory wins if not present
  if (memory?.top_wins?.length) {
    for (const win of memory.top_wins.slice(0, 2)) {
      const alreadyMentioned = seeing.some(s =>
        s.toLowerCase().includes(win.toLowerCase())
      );
      if (!alreadyMentioned && seeing.length < 4) {
        seeing.push(`Consistent strength: ${win}`);
      }
    }
  }

  return { seeing, helping, workingOn };
}

// ── Coach Prompt Formatter ──

/**
 * Format MayaState for injection into coach AI system prompt.
 * Lightweight — only includes what the AI needs for continuity.
 */
export function formatMayaStateForCoachPrompt(state: MayaState): string {
  const parts: string[] = [];
  parts.push('MAYA CONTEXT (use naturally, do not repeat verbatim):');

  // Thread awareness
  if (state.thread.primaryDomainLabel) {
    parts.push(`Current focus: ${state.thread.primaryDomainLabel} (${state.thread.tone})`);
  }

  // Memory from prior sessions
  if (state.memory.mayaSummary) {
    parts.push(`Prior session: ${state.memory.mayaSummary}`);
  }
  if (state.memory.recentStruggles.length > 0) {
    parts.push(`Recent challenges: ${state.memory.recentStruggles.join(', ')}`);
  }
  if (state.memory.recentWins.length > 0) {
    parts.push(`Recent strengths: ${state.memory.recentWins.join(', ')}`);
  }

  // Current signals
  if (state.trends.continuityLine) {
    parts.push(`Today's context: ${state.trends.continuityLine}`);
  }

  // Metrics snapshot
  if (state.metrics.streak > 1) {
    parts.push(`Streak: ${state.metrics.streak} days`);
  }

  return parts.length > 1 ? parts.join('\n') : '';
}
