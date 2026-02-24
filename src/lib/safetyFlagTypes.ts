/**
 * Flag types from useWeeklyRecoverySnapshot that represent safety concerns.
 * Used to decide whether to print "Safety flags: none detected" in EHR exports.
 *
 * Keep in sync with RecoveryFlag['type'] in useWeeklyRecoverySnapshot.ts
 * and DetectedAlert['alert_type'] in recoveryAlertDetector.ts.
 */
export const SAFETY_FLAG_TYPES = new Set([
  // Snapshot flags (RecoveryFlag.type)
  'fatigue_spike',
  'no_signal',
  // Recovery alert types (DetectedAlert.alert_type)
  'overexertion_risk',
  'deconditioning_risk',
  'engagement_failure',
  'fatigue_risk',
]);

/** Returns true if a flag/alert type represents a safety concern */
export function isSafetyFlag(type: string): boolean {
  return SAFETY_FLAG_TYPES.has(type) || type.includes('risk');
}
