/**
 * Smart Coach — Turn Logger
 * 
 * Logs every turn for debugging, tuning, and clinical review.
 */

import type { CoachTurnLog } from './types';

// In-memory log for the current session (cleared on reset)
let turnLogs: CoachTurnLog[] = [];

export function logCoachTurn(log: CoachTurnLog): void {
  turnLogs.push(log);
  
  // Console log for development debugging
  console.log(
    `[SmartCoach] Turn ${turnLogs.length}:`,
    `mode=${log.mode}`,
    `support=${log.supportLevel}`,
    `cue=${log.cueDecision.cueType}`,
    `valid=${log.validationPassed}`,
    `fallback=${log.usedFallback}`,
    `| "${log.coachLine.slice(0, 60)}"`
  );
}

export function getSessionLogs(): CoachTurnLog[] {
  return [...turnLogs];
}

export function clearSessionLogs(): void {
  turnLogs = [];
}

/** Export logs as JSON for persistence or review */
export function exportLogsAsJson(): string {
  return JSON.stringify(turnLogs, null, 2);
}
