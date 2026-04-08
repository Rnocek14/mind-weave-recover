/**
 * Coaching Narrative — Generates coaching text for different session touchpoints
 * 
 * Provides Maya's voice across session phases:
 * - Continuity opener (Full mode): References prior performance
 * - Transition coaching (Guided/Full): Contextual between-exercise feedback
 * - Summary insights (Guided/Full): Session-level observations
 */

import type { CoachingMode } from '@/contexts/CoachingModeContext';

// ═══════ Continuity Opener (Full mode only) ═══════

const CONTINUITY_OPENERS_WITH_HISTORY = [
  "Last session you worked on {domain} — let's build on that today.",
  "You've been getting stronger at {domain}. Today we'll push a bit further.",
  "Good to see you back. We'll pick up where we left off with {domain}.",
  "You showed real progress on {domain} recently. Let's keep that going.",
];

const CONTINUITY_OPENERS_FRESH = [
  "Let's start fresh today and see where you're strongest.",
  "Every session builds on the last. Let's get started.",
  "Ready when you are — today's session is built just for you.",
  "Good to have you here. Let's make this session count.",
];

export function getContinuityOpener(lastDomain?: string | null): string {
  if (lastDomain) {
    const templates = CONTINUITY_OPENERS_WITH_HISTORY;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const domainLabel = humanizeDomain(lastDomain);
    return template.replace('{domain}', domainLabel);
  }
  const templates = CONTINUITY_OPENERS_FRESH;
  return templates[Math.floor(Math.random() * templates.length)];
}

// ═══════ Transition Coaching (Guided/Full) ═══════

interface TransitionCoachingInput {
  mode: CoachingMode;
  lastScore: number | null;
  nextExerciseName: string;
  nextExerciseId: string;
  completedCount: number;
  totalCount: number;
}

const COACHING_BRIDGES: Record<string, string[]> = {
  celebrate: [
    "That strength carries into {next} — same skills, different angle.",
    "Strong round. {next} will test that in a new way.",
    "You're finding words faster. Let's see that speed in {next}.",
  ],
  encourage: [
    "Solid work. {next} builds on what you just practiced.",
    "Good effort — {next} uses similar skills in a new context.",
    "You're building momentum. {next} keeps that going.",
  ],
  support: [
    "That was challenging — and that's where growth happens. {next} is next.",
    "Tough round, but the effort counts. {next} shifts the focus a bit.",
    "Every attempt strengthens those pathways. Let's try {next}.",
  ],
  protect: [
    "Let's shift gears. {next} is a different kind of practice.",
    "No worries — {next} takes a different approach.",
    "Let's move to {next} — fresh start.",
  ],
};

export function getTransitionCoaching(input: TransitionCoachingInput): string | null {
  if (input.mode === 'off') return null;
  
  // Only show coaching bridge ~70% of the time to avoid fatigue
  if (Math.random() > 0.7) return null;
  
  const tone = input.lastScore === null ? 'encourage'
    : input.lastScore >= 80 ? 'celebrate'
    : input.lastScore >= 55 ? 'encourage'
    : input.lastScore >= 30 ? 'support'
    : 'protect';
  
  const lines = COACHING_BRIDGES[tone];
  const line = lines[Math.floor(Math.random() * lines.length)];
  return line.replace('{next}', input.nextExerciseName);
}

// ═══════ Summary Coaching Insight (Guided/Full) ═══════

interface SummaryInsightInput {
  mode: CoachingMode;
  exerciseScores: { exercise_slug: string; avg_score: number; trial_count: number }[];
  durationMin: number;
}

export function getSummaryInsight(input: SummaryInsightInput): string | null {
  if (input.mode === 'off') return null;
  if (input.exerciseScores.length === 0) return null;
  
  const avg = input.exerciseScores.reduce((s, e) => s + e.avg_score, 0) / input.exerciseScores.length;
  const totalTrials = input.exerciseScores.reduce((s, e) => s + e.trial_count, 0);
  
  // Find strongest and weakest
  const sorted = [...input.exerciseScores].sort((a, b) => b.avg_score - a.avg_score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  
  const strongName = humanizeSlug(strongest.exercise_slug);
  const weakName = humanizeSlug(weakest.exercise_slug);
  
  if (input.mode === 'full') {
    // Full mode: richer, more specific insight
    if (avg >= 75) {
      return `Strong session — ${strongName} was your standout at ${strongest.avg_score}%. ${totalTrials} rounds of real practice in ${input.durationMin} minutes. That consistency builds lasting pathways.`;
    }
    if (avg >= 50) {
      return `Good effort across ${totalTrials} rounds. ${strongName} showed real strength. ${weakName} was tougher — we'll keep working on that. Each session gets you closer.`;
    }
    return `${totalTrials} rounds of practice — that's what matters most. ${weakName} was challenging today, and that's exactly where growth happens. We'll adjust next time.`;
  }
  
  // Guided mode: brief observation
  if (avg >= 75) {
    return `${strongName} was your strongest today. Great consistency.`;
  }
  if (avg >= 50) {
    return `${strongName} went well. ${weakName} needs more practice — we'll work on it.`;
  }
  return `Tough session, but ${totalTrials} rounds of effort builds real progress.`;
}

// ═══════ Helpers ═══════

function humanizeDomain(domain: string): string {
  const map: Record<string, string> = {
    lexical_retrieval: 'word finding',
    semantic_depth: 'word meaning',
    semantic: 'word meaning',
    phonology: 'sound awareness',
    phonological: 'sound awareness',
    syntax: 'sentence building',
    discourse: 'connected speech',
    comprehension: 'understanding',
    executive_function: 'planning',
    attention: 'attention',
  };
  return map[domain] || domain.replace(/_/g, ' ');
}

function humanizeSlug(slug: string): string {
  return slug
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
