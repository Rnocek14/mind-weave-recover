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
    drivers.push("limited recorded practice activity");
    if (current.totalSessions === 0) drivers.push("no app sessions recorded");
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
    drivers.push(`app score decreased ${Math.abs(accDelta)} percentage points`);
    if (trialsDelta !== null && trialsDelta < 0) drivers.push("practice volume also decreased");
    if (fatigueDelta !== null && fatigueDelta > 0.3) drivers.push("fatigue trending higher");
    return { state: "declining", drivers };
  }

  // 4. Improving
  if (hasPriorData && accDelta !== null && accDelta >= 5) {
    drivers.push(`app score increased ${accDelta} percentage points`);
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
      drivers.push("app task scores within 4 percentage points");
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
        ? `No app practice sessions were recorded for ${name} this period.`
        : `Only ${inputs.current.activeDays} day${inputs.current.activeDays !== 1 ? "s" : ""} of app practice ${inputs.current.activeDays !== 1 ? "were" : "was"} recorded for ${name}.`;
    case "high_fatigue_risk":
      return `Higher fatigue ratings were reported in ${name}'s app check-ins.`;
    case "declining":
      return `App practice scores were lower than in the previous review period.`;
    case "improving":
      return `App practice scores were higher than in the previous review period.`;
    case "stable":
      return `No clear directional change was identified in the app practice summary.`;
    case "mixed":
      return `App practice measurements changed in different directions.`;
  }
}

// ── Evidence Paragraph ───────────────────────────────────────────────

function generateEvidence(
  _state: PatientWeekState,
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
        `App task score ${accDelta > 0 ? "rose" : "fell"} from ${prior.avgAccuracy}% to ${current.avgAccuracy}%`
      );
    } else {
      parts.push(`App task score was similar at ${current.avgAccuracy}%`);
    }
  } else if (current.avgAccuracy !== null) {
    parts.push(`App task score was ${current.avgAccuracy}%`);
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
        `reported fatigue ${fatigueDelta > 0 ? "increased" : "decreased"} to ${current.avgFatigue}/5`
      );
    } else if (current.avgFatigue >= 3.5) {
      parts.push(`reported fatigue averaged ${current.avgFatigue}/5`);
    }
  }

  // Do not infer recovery, adherence, treatment tolerance or the cause of a
  // score change from app telemetry alone. Keep those as clinician questions.

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
  _inputs: InterpretationInputs
): string {
  switch (state) {
    case "low_engagement":
      return "Check the patient's planned practice schedule and barriers before deciding whether outreach is needed.";
    case "high_fatigue_risk":
      return "Review the fatigue ratings with the patient or caregiver and assess session context before adjusting the plan.";
    case "declining":
      return "Compare tasks, support levels, recording quality and examples before deciding whether a clinical change occurred.";
    case "improving":
      return "Review independent responses and real-world communication goals before deciding whether to change difficulty or cues.";
    case "stable":
      return "Review skill-specific evidence and communication goals; similar app scores do not establish stable neurological function.";
    case "mixed":
      return "Review individual activities, their recording quality and support requirements before changing the therapy plan.";
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
