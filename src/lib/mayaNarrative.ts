/**
 * Maya Narrative Engine
 * 
 * Pure logic module that transforms clinical data into human-readable
 * recovery narratives. Deterministic, rule-based — no LLM.
 * 
 * Produces: continuity lines, interpretations, anticipation, milestones.
 */

import { COGNITIVE_DOMAINS } from "@/lib/cognitiveStateEngine";

// ── Types ──

export interface MayaDomainInput {
  domainSlug: string;
  score: number;         // 0-1
  trialCount: number;
  trend?: "improving" | "declining" | "stable";
}

export interface MayaSessionInput {
  sessionCount: number;       // total sessions
  recentSessionCount: number; // sessions this week
  lastSessionCorrect?: number;
  lastSessionTotal?: number;
  lastSessionIndependent?: number;
  correctDelta?: number;      // vs previous session
  streak: number;
  previousWeekSessionCount?: number; // sessions last week (for week-over-week)
  totalSessionsLast14Days?: number;
}

export interface MayaCueInput {
  cueType: string;
  efficacyRate: number;  // 0-1
  totalGiven: number;
}

export interface MayaMasteryInput {
  mastered: number;
  emerging: number;
  struggling: number;
  previousMastered?: number; // mastered count ~7 days ago (for delta)
}

export type MayaVerbosity = "minimal" | "standard" | "detailed";

export interface MayaInsight {
  continuityLine: string;
  summary: string | null;
  rightNow: string | null;
  memoryLine: string | null;         // longitudinal: "Over the last 2 weeks..."
  interpretation: {
    seeing: string[];
    helping: string[];
    workingOn: string[];
  };
  anticipation: string | null;
  milestone: MayaMilestone | null;
  verbosity: MayaVerbosity;          // controls how much detail to show
}

export interface MayaMilestone {
  type: "words" | "streak" | "independence";
  message: string;
  emoji: string;
}

// ── Helpers ──

function getDomainLabel(slug: string): string {
  const meta = COGNITIVE_DOMAINS.find(d => d.slug === slug);
  return meta?.patientLabel?.toLowerCase() || slug.replace(/_/g, " ");
}

const CUE_LABELS: Record<string, string> = {
  phonemic: "hearing the first sound",
  semantic: "category hints",
  full_word: "hearing the full word",
  none: "answering on your own",
};

function getCuePlainLabel(cueType: string): string {
  return CUE_LABELS[cueType] || cueType.replace(/_/g, " ");
}

// ── Continuity Line (Home) ──

export function generateContinuityLine(session: MayaSessionInput, domains: MayaDomainInput[]): string {
  if (session.sessionCount === 0) {
    return "Your recovery journey starts here — let's begin 💛";
  }

  if (session.lastSessionIndependent && session.lastSessionIndependent >= 3) {
    return `Last time you answered more on your own — that's real progress ⭐`;
  }

  if (session.correctDelta && session.correctDelta > 0) {
    return `You got stronger since last time — keep it going 📈`;
  }

  if (session.streak >= 7) {
    return `${session.streak} days of practice — what incredible dedication 🌟`;
  }
  if (session.streak >= 3) {
    return `${session.streak} days in a row — your consistency is paying off 🔥`;
  }

  const improving = domains.filter(d => d.trend === "improving" && d.trialCount >= 5);
  if (improving.length > 0) {
    return `You've been getting better at ${getDomainLabel(improving[0].domainSlug)} — nice work ✨`;
  }

  if (session.recentSessionCount >= 3) {
    return "Great week of practice — every session makes a difference ✨";
  }
  if (session.recentSessionCount > 0) {
    return "Ready to pick up where you left off? 💪";
  }

  return "Every session builds stronger connections 🧠";
}

// ── Verbosity Decision ──

export function determineVerbosity(
  domains: MayaDomainInput[],
  session: MayaSessionInput,
): MayaVerbosity {
  // Detailed: significant changes detected
  const declining = domains.filter(d => d.trend === "declining" && d.trialCount >= 5);
  const improving = domains.filter(d => d.trend === "improving" && d.trialCount >= 5);
  if (declining.length >= 2 || (session.correctDelta && session.correctDelta < -3)) return "detailed";
  if (improving.length >= 2 || (session.correctDelta && session.correctDelta >= 5)) return "detailed";

  // Minimal: steady state, nothing dramatic
  const allStable = domains.every(d => !d.trend || d.trend === "stable");
  if (allStable && session.recentSessionCount >= 3 && !session.correctDelta) return "minimal";

  return "standard";
}

// ── Longitudinal Memory Line ──

export function generateMemoryLine(
  domains: MayaDomainInput[],
  session: MayaSessionInput,
  mastery: MayaMasteryInput,
): string | null {
  // Need enough history for longitudinal statements
  if (session.sessionCount < 5) return null;

  // Week-over-week session comparison
  if (session.previousWeekSessionCount !== undefined && session.recentSessionCount > 0) {
    const delta = session.recentSessionCount - session.previousWeekSessionCount;
    if (delta >= 2) {
      return "You've been practicing more this week than last — that dedication shows";
    }
  }

  // Multi-week domain improvement
  const consistentlyImproving = domains.filter(
    d => d.trend === "improving" && d.trialCount >= 10
  );
  if (consistentlyImproving.length > 0) {
    const label = getDomainLabel(consistentlyImproving[0].domainSlug);
    return `Over the past weeks, your ${label} has been steadily getting stronger`;
  }

  // Mastery growth
  if (mastery.previousMastered !== undefined && mastery.mastered > mastery.previousMastered) {
    const newWords = mastery.mastered - mastery.previousMastered;
    if (newWords >= 3) {
      return `You've learned ${newWords} new words this week — your vocabulary is growing`;
    }
  }

  // Consistency narrative
  if (session.totalSessionsLast14Days && session.totalSessionsLast14Days >= 8) {
    return "You've been showing up consistently — that's what builds lasting progress";
  }

  return null;
}

// ── Summary Sentence (cohesive narrative) ──

export function buildSummary(
  interpretation: MayaInsight["interpretation"],
  cues: MayaCueInput[],
  verbosity: MayaVerbosity,
): string | null {
  const { seeing, helping } = interpretation;
  if (seeing.length === 0) return null;

  // Minimal: just the key observation
  if (verbosity === "minimal") {
    return `${seeing[0].replace(/\.$/, "")}.`;
  }

  // Standard/detailed: weave observation + strategy
  const observation = seeing[0].replace(/\.$/, "");
  
  if (helping.length > 0 && !helping[0].includes("Keep practicing")) {
    const strategy = helping[0].charAt(0).toLowerCase() + helping[0].slice(1);
    return `${observation}, and ${strategy}.`;
  }
  
  return `${observation}.`;
}

// ── "Right Now" Line ──

export function generateRightNow(domains: MayaDomainInput[], session: MayaSessionInput): string | null {
  if (session.sessionCount === 0) return "Start with your first session — even 5 minutes helps";

  const sorted = [...domains].filter(d => d.trialCount >= 3).sort((a, b) => a.score - b.score);
  
  if (sorted.length > 0) {
    const weakest = sorted[0];
    const label = getDomainLabel(weakest.domainSlug);
    if (weakest.score < 0.4) {
      return `Let's focus on ${label} today — short practice goes a long way`;
    }
    return `Today's a great day to practice ${label}`;
  }

  if (session.streak >= 1) {
    return "Keep the momentum — start today's session";
  }
  
  return "A quick practice session will make a difference today";
}

// ── Interpretation (My Progress) ──

export function generateInterpretation(
  domains: MayaDomainInput[],
  cues: MayaCueInput[],
  mastery: MayaMasteryInput,
  session: MayaSessionInput,
): MayaInsight["interpretation"] {
  const seeing: string[] = [];
  const helping: string[] = [];
  const workingOn: string[] = [];

  // Sort domains by score
  const sorted = [...domains].filter(d => d.trialCount >= 3).sort((a, b) => b.score - a.score);
  const strong = sorted.filter(d => d.score >= 0.6);
  const weak = sorted.filter(d => d.score < 0.5);

  // "What I'm Seeing"
  if (strong.length > 0) {
    const best = strong[0];
    const label = getDomainLabel(best.domainSlug);
    if (best.trend === "improving") {
      seeing.push(`You're getting faster at ${label}`);
    } else {
      seeing.push(`${label.charAt(0).toUpperCase() + label.slice(1)} is a real strength`);
    }
  }

  if (weak.length > 0) {
    const weakest = weak[weak.length - 1];
    const label = getDomainLabel(weakest.domainSlug);
    if (weakest.trend === "declining") {
      seeing.push(`${label.charAt(0).toUpperCase() + label.slice(1)} is a bit harder right now — that's okay`);
    } else {
      seeing.push(`${label.charAt(0).toUpperCase() + label.slice(1)} needs more practice`);
    }
  }

  if (mastery.mastered > 0) {
    seeing.push(`You've mastered ${mastery.mastered} word${mastery.mastered !== 1 ? "s" : ""} so far`);
  }

  // "What's Helping"
  const effectiveCues = [...cues]
    .filter(c => c.totalGiven >= 3 && c.efficacyRate >= 0.5)
    .sort((a, b) => b.efficacyRate - a.efficacyRate);

  if (effectiveCues.length > 0) {
    const best = effectiveCues[0];
    helping.push(`${getCuePlainLabel(best.cueType).charAt(0).toUpperCase() + getCuePlainLabel(best.cueType).slice(1)} helps you find the word`);
  }

  if (session.streak >= 3) {
    helping.push("Practicing regularly is making a real difference");
  }

  if (session.lastSessionIndependent && session.lastSessionIndependent >= 2) {
    helping.push("You're answering more without hints — great sign");
  }

  if (helping.length === 0) {
    helping.push("Keep practicing — your brain is building new pathways");
  }

  // "What We're Working On"
  if (weak.length > 0) {
    const focus = weak[weak.length - 1];
    workingOn.push(`We're focusing on ${getDomainLabel(focus.domainSlug)}`);
  }

  const improving = sorted.filter(d => d.trend === "improving");
  if (improving.length > 0 && improving[0].score >= 0.5) {
    workingOn.push(`You're ready for more challenge in ${getDomainLabel(improving[0].domainSlug)}`);
  }

  if (workingOn.length === 0 && sorted.length > 0) {
    workingOn.push("We're building a strong foundation across all areas");
  }

  return { seeing, helping, workingOn };
}

// ── Anticipation (Forward-Looking) ──

export function generateAnticipation(domains: MayaDomainInput[]): string | null {
  const sorted = [...domains].filter(d => d.trialCount >= 3).sort((a, b) => a.score - b.score);
  if (sorted.length === 0) return null;

  const weakest = sorted[0];
  const label = getDomainLabel(weakest.domainSlug);

  if (weakest.trend === "improving") {
    return `You're ready for more challenge in ${label} — let's push a little further`;
  }
  if (weakest.trend === "declining") {
    return `We'll take it easier on ${label} to rebuild confidence`;
  }
  return `Tomorrow we'll keep strengthening ${label}`;
}

// ── Milestones ──

const MILESTONE_THRESHOLDS = {
  words: [10, 20, 50, 100, 200],
  streak: [7, 14, 30, 60],
  independence: [50, 70], // percentage thresholds
};

const MILESTONE_KEY = "maya-milestones-fired";

function getFiredMilestones(): Set<string> {
  try {
    const raw = localStorage.getItem(MILESTONE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markMilestoneFired(key: string): void {
  try {
    const fired = getFiredMilestones();
    fired.add(key);
    localStorage.setItem(MILESTONE_KEY, JSON.stringify([...fired]));
  } catch { /* noop */ }
}

export function checkMilestone(
  mastery: MayaMasteryInput,
  streak: number,
  independencePct: number | null,
): MayaMilestone | null {
  const fired = getFiredMilestones();

  // Word milestones
  for (const threshold of MILESTONE_THRESHOLDS.words) {
    const key = `words-${threshold}`;
    if (mastery.mastered >= threshold && !fired.has(key)) {
      markMilestoneFired(key);
      return {
        type: "words",
        message: `You've mastered ${threshold} words!`,
        emoji: threshold >= 100 ? "🏆" : threshold >= 50 ? "🌟" : "🎉",
      };
    }
  }

  // Streak milestones
  for (const threshold of MILESTONE_THRESHOLDS.streak) {
    const key = `streak-${threshold}`;
    if (streak >= threshold && !fired.has(key)) {
      markMilestoneFired(key);
      return {
        type: "streak",
        message: `${threshold}-day streak — incredible dedication!`,
        emoji: threshold >= 30 ? "🏆" : "🔥",
      };
    }
  }

  // Independence milestones
  if (independencePct !== null) {
    for (const threshold of MILESTONE_THRESHOLDS.independence) {
      const key = `independence-${threshold}`;
      if (independencePct >= threshold && !fired.has(key)) {
        markMilestoneFired(key);
        return {
          type: "independence",
          message: `${threshold}% of answers without help — amazing independence!`,
          emoji: "💪",
        };
      }
    }
  }

  return null;
}

// ── Main Generator ──

export function generateMayaInsight(
  domains: MayaDomainInput[],
  session: MayaSessionInput,
  cues: MayaCueInput[],
  mastery: MayaMasteryInput,
  independencePct: number | null,
): MayaInsight {
  const verbosity = determineVerbosity(domains, session);
  const continuityLine = generateContinuityLine(session, domains);
  const interpretation = generateInterpretation(domains, cues, mastery, session);
  const anticipation = generateAnticipation(domains);
  const milestone = checkMilestone(mastery, session.streak, independencePct);
  const summary = buildSummary(interpretation, cues, verbosity);
  const rightNow = generateRightNow(domains, session);
  const memoryLine = generateMemoryLine(domains, session, mastery);

  return { continuityLine, summary, rightNow, memoryLine, interpretation, anticipation, milestone, verbosity };
}

// ── Caregiver Urgency ──

export function getCaregiverUrgency(score: number, trend?: string): {
  level: "urgent" | "moderate" | "positive";
  signal: string;
} {
  if (score < 0.3) {
    return { level: "urgent", signal: "Important to focus on this now" };
  }
  if (score < 0.5 || trend === "declining") {
    return { level: "moderate", signal: "Needs extra support this week" };
  }
  return { level: "positive", signal: "Making strong progress" };
}
