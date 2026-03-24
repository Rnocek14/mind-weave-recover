/**
 * Structured Clinical Interpretation Engine
 * 
 * Rule-based state classification with 3-part output:
 * headline, evidence, recommendation.
 * 
 * This is the SINGLE narrative layer on the Weekly Review page.
 * All other sections support it — they do not restate it.
 */

import type { PeriodSummary, WeekOverWeekDelta } from "@/hooks/useWeekOverWeek";
import type { RecoveryAlert } from "@/hooks/useRecoveryAlerts";

export type PatientWeekState =
  | "improving"
  | "stable"
  | "declining"
  | "low_engagement"
  | "high_fatigue_risk"
  | "mixed";

export interface StructuredInterpretation {
  state: PatientWeekState;
  headline: string;
  evidence: string;
  recommendation: string;
  confidence: "low" | "moderate" | "high";
  drivers: string[];
}

interface InterpretationInputs {
  current: PeriodSummary;
  prior: PeriodSummary;
  hasPriorData: boolean;
  alerts: RecoveryAlert[];
  accuracySlope: number | null;
  profileName: string;
}

// ── State Classification (precedence-ordered) ─────────────────────────

function classifyState(inputs: InterpretationInputs): {
  state: PatientWeekState;
  drivers: string[];
} {
  const { current, prior, hasPriorData, alerts } = inputs;
  const drivers: string[] = [];

  const accDelta =
    current.avgAccuracy !== null && prior.avgAccuracy !== null
      ? current.avgAccuracy - prior.avgAccuracy
      : null;
  const trialsDelta =
    prior.totalTrials > 0
      ? current.totalTrials - prior.totalTrials
      : null;
  const fatigueDelta =
    current.avgFatigue !== null && prior.avgFatigue !== null
      ? current.avgFatigue - prior.avgFatigue
      : null;

  const unresolvedAlerts = alerts.filter(
    (a) => !a.resolved_at && (a.severity === "critical" || a.severity === "warning")
  );

  // 1. Low engagement (highest precedence)
  if (current.activeDays <= 2 && current.totalSessions <= 1) {
    drivers.push("very low activity");
    if (current.totalSessions === 0) drivers.push("no sessions recorded");
    else drivers.push(`only ${current.activeDays} active day${current.activeDays !== 1 ? "s" : ""}`);
    return { state: "low_engagement", drivers };
  }

  // 2. High fatigue risk
  if (
    current.avgFatigue !== null &&
    (current.avgFatigue >= 4 || (fatigueDelta !== null && fatigueDelta >= 0.7))
  ) {
    drivers.push(`fatigue ${current.avgFatigue}/5`);
    if (fatigueDelta !== null && fatigueDelta > 0)
      drivers.push(`fatigue increased +${fatigueDelta.toFixed(1)}`);
    if (accDelta !== null && accDelta < 0) drivers.push("accuracy also declining");
    return { state: "high_fatigue_risk", drivers };
  }

  // 3. Declining
  if (hasPriorData && accDelta !== null && accDelta <= -5) {
    drivers.push(`accuracy dropped ${Math.abs(accDelta)}%`);
    if (trialsDelta !== null && trialsDelta < 0) drivers.push("practice volume also decreased");
    if (fatigueDelta !== null && fatigueDelta > 0.3) drivers.push("fatigue trending higher");
    return { state: "declining", drivers };
  }

  // 4. Improving
  if (hasPriorData && accDelta !== null && accDelta >= 5) {
    drivers.push(`accuracy improved +${accDelta}%`);
    if (trialsDelta !== null && trialsDelta > 0) drivers.push("practice volume increased");
    if (current.avgFatigue !== null && current.avgFatigue <= 3) drivers.push("fatigue manageable");
    return { state: "improving", drivers };
  }

  // 5. Stable
  if (hasPriorData && accDelta !== null && Math.abs(accDelta) <= 4) {
    const isStable =
      (trialsDelta === null || Math.abs(trialsDelta) < 20) &&
      (fatigueDelta === null || Math.abs(fatigueDelta) < 0.5) &&
      unresolvedAlerts.length === 0;

    if (isStable) {
      drivers.push("accuracy within ±4%");
      drivers.push("practice volume roughly stable");
      return { state: "stable", drivers };
    }
  }

  // 6. Mixed / watch closely
  if (hasPriorData) {
    if (accDelta !== null && accDelta > 0 && trialsDelta !== null && trialsDelta < -15)
      drivers.push("better accuracy but fewer trials");
    if (accDelta !== null && accDelta < 0 && trialsDelta !== null && trialsDelta > 15)
      drivers.push("more trials but lower accuracy");
    if (fatigueDelta !== null && Math.abs(fatigueDelta) > 0.5)
      drivers.push(`fatigue shifted ${fatigueDelta > 0 ? "higher" : "lower"}`);
    if (unresolvedAlerts.length > 0)
      drivers.push(`${unresolvedAlerts.length} unresolved alert${unresolvedAlerts.length > 1 ? "s" : ""}`);
    if (drivers.length > 0) return { state: "mixed", drivers };
  }

  // Fallback: no prior data or insufficient signal
  if (!hasPriorData) {
    drivers.push("first review period");
    return { state: "stable", drivers };
  }

  drivers.push("no strong signals detected");
  return { state: "stable", drivers };
}

// ── Confidence ────────────────────────────────────────────────────────

function computeConfidence(
  totalTrials: number,
  activeDays: number
): "low" | "moderate" | "high" {
  if (totalTrials >= 30 && activeDays >= 3) return "high";
  if (totalTrials >= 10) return "moderate";
  return "low";
}

// ── Headline Templates ───────────────────────────────────────────────

function generateHeadline(
  state: PatientWeekState,
  inputs: InterpretationInputs
): string {
  const name = inputs.profileName;
  switch (state) {
    case "low_engagement":
      return inputs.current.totalSessions === 0
        ? `${name} had no therapy sessions this period.`
        : `${name} showed minimal engagement with only ${inputs.current.activeDays} active day${inputs.current.activeDays !== 1 ? "s" : ""}.`;
    case "high_fatigue_risk":
      return `${name}'s fatigue is elevated, which may be limiting practice quality.`;
    case "declining":
      return `Performance declined this week, with lower accuracy and reduced practice effectiveness.`;
    case "improving":
      return `Meaningful improvement this week, with accuracy trending upward.`;
    case "stable":
      return `Recovery is stable, with consistent practice and no major new concerns.`;
    case "mixed":
      return `Mixed signals this week — some metrics improved while others softened.`;
  }
}

// ── Evidence Paragraph ───────────────────────────────────────────────

function generateEvidence(
  state: PatientWeekState,
  inputs: InterpretationInputs
): string {
  const { current, prior, hasPriorData } = inputs;
  const parts: string[] = [];

  const accDelta =
    current.avgAccuracy !== null && prior.avgAccuracy !== null
      ? current.avgAccuracy - prior.avgAccuracy
      : null;
  const fatigueDelta =
    current.avgFatigue !== null && prior.avgFatigue !== null
      ? current.avgFatigue - prior.avgFatigue
      : null;

  // Accuracy change
  if (accDelta !== null && hasPriorData) {
    if (Math.abs(accDelta) > 2) {
      parts.push(
        `Accuracy ${accDelta > 0 ? "rose" : "fell"} from ${prior.avgAccuracy}% to ${current.avgAccuracy}%`
      );
    } else {
      parts.push(`Accuracy held steady at ${current.avgAccuracy}%`);
    }
  } else if (current.avgAccuracy !== null) {
    parts.push(`Current accuracy is ${current.avgAccuracy}%`);
  }

  // Volume
  if (hasPriorData && prior.totalTrials > 0) {
    const volChange = Math.round(
      ((current.totalTrials - prior.totalTrials) / prior.totalTrials) * 100
    );
    if (Math.abs(volChange) > 15) {
      parts.push(
        `practice volume ${volChange > 0 ? "increased" : "decreased"} ${Math.abs(volChange)}% (${prior.totalTrials} → ${current.totalTrials} trials)`
      );
    }
  } else if (current.totalTrials > 0) {
    parts.push(`${current.totalTrials} trials across ${current.activeDays} days`);
  }

  // Fatigue
  if (current.avgFatigue !== null) {
    if (fatigueDelta !== null && Math.abs(fatigueDelta) > 0.3) {
      parts.push(
        `fatigue ${fatigueDelta > 0 ? "rose" : "improved"} to ${current.avgFatigue}/5`
      );
    } else if (current.avgFatigue >= 3.5) {
      parts.push(`fatigue remains elevated at ${current.avgFatigue}/5`);
    }
  }

  // Contextual modifier
  if (state === "declining" && current.avgFatigue !== null && current.avgFatigue >= 3.5) {
    parts.push(
      "which may indicate reduced tolerance rather than isolated regression"
    );
  }
  if (state === "improving" && current.activeDays >= 5) {
    parts.push("supported by consistent daily engagement");
  }
  if (state === "low_engagement") {
    parts.push("consider barriers to practice or need for outreach");
  }

  if (parts.length === 0) {
    return "Insufficient data to generate a detailed evidence summary for this period.";
  }

  // Join: first part capitalized sentence, rest lowercase joined
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  if (parts.length === 1) return first + ".";
  return first + ", " + parts.slice(1).join(", ") + ".";
}

// ── Recommendation ───────────────────────────────────────────────────

function generateRecommendation(
  state: PatientWeekState,
  inputs: InterpretationInputs
): string {
  switch (state) {
    case "low_engagement":
      return "Schedule outreach and assign structured home practice to address low engagement.";
    case "high_fatigue_risk":
      return "Consider reducing session length or difficulty and monitoring fatigue closely over the next week.";
    case "declining":
      return "Lower difficulty one level, prioritize shorter high-success sessions, and review cueing strategy.";
    case "improving":
      return inputs.current.avgAccuracy !== null && inputs.current.avgAccuracy >= 85
        ? "Consider advancing difficulty or reducing cue support to maintain challenge."
        : "Maintain current plan and continue monitoring — trajectory is positive.";
    case "stable":
      return "Maintain current exercise regimen. Consider adjusting task variety if progress has plateaued.";
    case "mixed":
      return "Monitor closely over the next 2–3 sessions before adjusting. Review individual exercise performance for specific patterns.";
  }
}

// ── Main Export ───────────────────────────────────────────────────────

export function generateStructuredInterpretation(
  inputs: InterpretationInputs
): StructuredInterpretation {
  const { state, drivers } = classifyState(inputs);
  const confidence = computeConfidence(
    inputs.current.totalTrials,
    inputs.current.activeDays
  );

  return {
    state,
    headline: generateHeadline(state, inputs),
    evidence: generateEvidence(state, inputs),
    recommendation: generateRecommendation(state, inputs),
    confidence,
    drivers,
  };
}
