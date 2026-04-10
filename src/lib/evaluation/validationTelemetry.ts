/**
 * Validation Telemetry — tracks rejection rates by exercise and reason.
 * 
 * In-memory counters for the current session.
 * Logs a summary periodically and on demand for debugging.
 */

import type { RejectionReason, ValidationResult } from './responseValidation';

interface RejectionCounter {
  total: number;
  passed: number;
  rejected: number;
  byReason: Record<RejectionReason, number>;
}

const REJECTION_REASONS: RejectionReason[] = [
  'empty', 'filler', 'instruction_echo', 'prompt_repeat', 'too_short', 'non_answer',
];

function emptyCounter(): RejectionCounter {
  return {
    total: 0,
    passed: 0,
    rejected: 0,
    byReason: {
      empty: 0,
      filler: 0,
      instruction_echo: 0,
      prompt_repeat: 0,
      too_short: 0,
      non_answer: 0,
    },
  };
}

const counters: Record<string, RejectionCounter> = {};

/**
 * Record a validation result for an exercise.
 * Call this right after validateSpokenResponse().
 */
export function trackValidation(exerciseSlug: string, result: ValidationResult): void {
  if (!counters[exerciseSlug]) {
    counters[exerciseSlug] = emptyCounter();
  }
  const c = counters[exerciseSlug];
  c.total++;
  if (result.valid) {
    c.passed++;
  } else {
    c.rejected++;
    if (result.rejectionReason) {
      c.byReason[result.rejectionReason]++;
    }
  }
}

/**
 * Get a snapshot of all counters (for dev tools / console inspection).
 */
export function getValidationTelemetry(): Record<string, RejectionCounter> {
  return JSON.parse(JSON.stringify(counters));
}

/**
 * Print a summary table to console.
 */
export function logValidationSummary(): void {
  const exercises = Object.keys(counters);
  if (exercises.length === 0) {
    console.log('[ValidationTelemetry] No validation events recorded yet.');
    return;
  }

  console.group('[ValidationTelemetry] Session Summary');
  for (const slug of exercises) {
    const c = counters[slug];
    const rejectRate = c.total > 0 ? ((c.rejected / c.total) * 100).toFixed(1) : '0';
    console.log(
      `${slug}: ${c.total} total | ${c.passed} passed | ${c.rejected} rejected (${rejectRate}%)`,
    );
    const activeReasons = REJECTION_REASONS.filter(r => c.byReason[r] > 0);
    if (activeReasons.length > 0) {
      console.log(
        `  reasons: ${activeReasons.map(r => `${r}=${c.byReason[r]}`).join(', ')}`,
      );
    }
  }
  console.groupEnd();
}

/**
 * Log a detailed validation result for dev debugging.
 */
export function logValidationDetail(
  exerciseSlug: string,
  transcript: string,
  result: ValidationResult,
): void {
  const prefix = result.valid ? '✅' : '❌';
  console.log(
    `[ValidationDetail] ${prefix} ${exerciseSlug}`,
    {
      transcript,
      valid: result.valid,
      rejectionReason: result.rejectionReason,
      cleanedTranscript: result.cleanedTranscript,
      answerOnlyText: result.answerOnlyText,
      contentWordCount: result.contentWordCount,
      instructionEchoScore: result.instructionEchoScore.toFixed(2),
      confidence: result.confidence.toFixed(2),
      matchedInstructionPhrases: result.matchedInstructionPhrases,
    },
  );
}

// Expose on window for dev console access
if (typeof window !== 'undefined') {
  (window as any).__validationTelemetry = {
    get: getValidationTelemetry,
    log: logValidationSummary,
  };
}
