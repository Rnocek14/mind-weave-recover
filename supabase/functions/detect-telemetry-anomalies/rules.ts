// Shared anomaly rule definitions — mirror of docs/telemetry-validation-checklist.md
// Source of truth: docs/telemetry-validation-checklist.md (v0.1)
// DO NOT add new rules here without updating the checklist first.

export type Severity = 'info' | 'warn' | 'error';
export type Scope = 'trial' | 'session' | 'user_slug_window';

export interface AnomalyRule {
  id: string;
  severity: Severity;
  scope: Scope;
  description: string;
}

export const CHECKLIST_VERSION = '0.1';

export const RULES: Record<string, AnomalyRule> = {
  // Schema cross-field (S6–S10)
  S6: { id: 'S6', severity: 'error', scope: 'trial', description: 'boolean granularity must not carry graded_score/score_vector' },
  S7: { id: 'S7', severity: 'error', scope: 'trial', description: 'graded granularity requires graded_score' },
  S8: { id: 'S8', severity: 'error', scope: 'trial', description: 'multi-dimensional granularity requires score_vector object' },
  S10: { id: 'S10', severity: 'warn', scope: 'trial', description: 'granular fields set without archetype/dominant_axis' },

  // Cross-field semantic (C1–C9)
  C1: { id: 'C1', severity: 'warn', scope: 'trial', description: 'production+correct with empty response_text (ASR misrouting suspect)' },
  C3: { id: 'C3', severity: 'warn', scope: 'trial', description: 'scaffolded trial with no scaffold signal' },
  C4: { id: 'C4', severity: 'warn', scope: 'trial', description: 'exposure trial carries correct flag (should not be judged)' },
  C6: { id: 'C6', severity: 'warn', scope: 'trial', description: 'content-expanding archetype with disallowed dominant_axis' },
  C7: { id: 'C7', severity: 'warn', scope: 'trial', description: 'performance-pressure archetype must use pressure-retention axis' },
  C8: { id: 'C8', severity: 'warn', scope: 'trial', description: 'open-ended archetype with boolean granularity (suspect)' },

  // Distributional (D1–D9) — session/window scope
  D1: { id: 'D1', severity: 'warn', scope: 'session', description: 'photo_naming production share < 30% in session' },
  D2: { id: 'D2', severity: 'warn', scope: 'session', description: 'photo_naming recognition share > 60% (recognition inflation)' },
  D3: { id: 'D3', severity: 'warn', scope: 'session', description: 'photo_naming scaffolded share > 40% (scaffold inflation)' },
  D4: { id: 'D4', severity: 'error', scope: 'session', description: 'untyped trial_mode in adopted slug (logger gap)' },
  D7: { id: 'D7', severity: 'warn', scope: 'session', description: 'production accuracy = 100% over >=10 trials (suspect mislabeling)' },
};

export const ADOPTED_SLUGS = new Set<string>(['photo_naming']);

export const ARCHETYPE_AXIS_ALLOWED: Record<string, string[]> = {
  'content-expanding': ['content-complexity', 'recognition-to-production'],
  'performance-pressure': ['pressure-retention'],
  'open-ended': ['content-complexity', 'pressure-retention', 'scaffold-independence', 'recognition-to-production', 'mixed'],
  'hybrid': ['content-complexity', 'pressure-retention', 'scaffold-independence', 'recognition-to-production', 'mixed'],
};
