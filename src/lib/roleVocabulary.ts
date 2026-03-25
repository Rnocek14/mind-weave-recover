/**
 * Role-based vocabulary system.
 * 
 * Ensures every concept renders with the correct label for each audience.
 * Central source of truth — no hardcoded role-specific strings in components.
 */

export type UiRole = "patient" | "caregiver" | "clinician";

// ─── Section headings ───

const SECTION_LABELS: Record<string, Record<UiRole, string>> = {
  strength:   { patient: "Doing Well",   caregiver: "Strengths",        clinician: "Strengths" },
  maintained: { patient: "Practicing",   caregiver: "Monitoring",       clinician: "Maintained Areas" },
  focus:      { patient: "Working On",   caregiver: "Focus Areas",      clinician: "Focus Areas" },
  uncovered:  { patient: "Coming Soon",  caregiver: "Coverage Gaps",    clinician: "Coverage Gaps" },
};

export function getSectionLabel(
  classification: "strength" | "maintained" | "focus" | "uncovered",
  role: UiRole,
): string {
  return SECTION_LABELS[classification]?.[role] ?? classification;
}

// ─── Row / field labels ───

const FIELD_LABELS: Record<string, Record<UiRole, string>> = {
  primary_challenge: { patient: "Working on",       caregiver: "Primary challenge",  clinician: "Primary challenge" },
  current_focus:     { patient: "Games",             caregiver: "Current activities",  clinician: "Current focus" },
  why_adapted:       { patient: "Adjusted for",      caregiver: "Why this plan",       clinician: "Why adapted" },
  expected_gain:     { patient: "Goal",              caregiver: "Expected improvement", clinician: "Expected gain" },
  exercises:         { patient: "Games",             caregiver: "Activities",           clinician: "Exercises" },
  adaptation:        { patient: "Your support",      caregiver: "Current adjustment",   clinician: "Adaptation" },
  plan:              { patient: "What's next",       caregiver: "Plan",                 clinician: "Plan" },
  supports:          { patient: "Helps with",        caregiver: "Supports",             clinician: "Supports" },
  progress:          { patient: "Progress",          caregiver: "Progress",             clinician: "Progress" },
  card_title:        { patient: "Your Recovery Focus", caregiver: "Recovery Focus",     clinician: "Recovery Focus Summary" },
  alerts:            { patient: "Things to know",    caregiver: "Concerns",             clinician: "Alerts" },
  session:           { patient: "Session",           caregiver: "Session",              clinician: "Session" },
  clinical_docs:     { patient: "My documents",      caregiver: "Medical documents",    clinician: "Clinical documents" },
};

export function getFieldLabel(field: string, role: UiRole): string {
  return FIELD_LABELS[field]?.[role] ?? field.replace(/_/g, " ");
}

// ─── Confidence labels ───

export type ConfidenceLevel = "high" | "moderate" | "low";

const CONFIDENCE_LABELS: Record<ConfidenceLevel, Record<UiRole, string>> = {
  high:     { patient: "Clear picture",        caregiver: "Strong evidence",    clinician: "High confidence" },
  moderate: { patient: "Building your picture", caregiver: "Moderate evidence",  clinician: "Moderate confidence" },
  low:      { patient: "Still learning",        caregiver: "Limited evidence",   clinician: "Low confidence" },
};

export function getConfidenceLabel(level: ConfidenceLevel, role: UiRole): string {
  return CONFIDENCE_LABELS[level]?.[role] ?? level;
}

// ─── Provenance labels ───

const PROVENANCE_LABELS: Record<string, Record<UiRole, string>> = {
  clinician: { patient: "Adjusted by your therapist",              caregiver: "Adjusted by therapist",     clinician: "Clinician override" },
  system:    { patient: "Adjusted automatically based on practice", caregiver: "System adjustment",         clinician: "System adaptation" },
  mixed:     { patient: "Adjusted by therapist and system",         caregiver: "Therapist + system",        clinician: "Clinician + system" },
  default:   { patient: "",                                         caregiver: "",                           clinician: "Default" },
};

export function getProvenanceLabel(
  provenance: "clinician" | "system" | "mixed" | "default",
  role: UiRole,
): string {
  return PROVENANCE_LABELS[provenance]?.[role] ?? "";
}

// ─── Outcome metric labels ───

const OUTCOME_METRIC_LABELS: Record<string, Record<UiRole, { short: string; full: string; tooltip: string }>> = {
  word_mastery: {
    patient:   { short: "Words",        full: "Words You Know",    tooltip: "Words you can say on your own" },
    caregiver: { short: "Word Mastery", full: "Word Mastery",      tooltip: "Words reliably retrieved without help" },
    clinician: { short: "Word Mastery", full: "Word Mastery",      tooltip: "Words reliably retrieved without cueing support" },
  },
  cue_independence: {
    patient:   { short: "Independence", full: "Doing It Yourself", tooltip: "How often you get it right without help" },
    caregiver: { short: "Independence", full: "Cue Independence",  tooltip: "Less support needed over time" },
    clinician: { short: "Cue Indep.",   full: "Cue Independence",  tooltip: "Rate of correct responses without cueing support" },
  },
  error_quality: {
    patient:   { short: "Getting Closer", full: "Getting Closer",  tooltip: "Your answers are getting closer to correct" },
    caregiver: { short: "Error Quality",  full: "Error Quality",   tooltip: "Responses getting closer to correct" },
    clinician: { short: "Error Quality",  full: "Error Quality",   tooltip: "Semantic/phonological distance of errors from targets" },
  },
};

export function getOutcomeLabel(
  metric: string,
  role: UiRole,
): { short: string; full: string; tooltip: string } {
  return OUTCOME_METRIC_LABELS[metric]?.[role] ?? { short: metric, full: metric, tooltip: metric };
}

// ─── Gap action suggestions ───

export function getGapActionText(role: UiRole): string {
  switch (role) {
    case "patient":
      return "This is an area we may work on later";
    case "caregiver":
      return "Ask the therapist whether this area should be added to the plan";
    case "clinician":
      return "Consider adding exercise coverage for this deficit";
  }
}
