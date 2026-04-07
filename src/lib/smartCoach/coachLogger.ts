/**
 * Smart Coach — Turn Logger
 * 
 * Logs every turn for debugging, tuning, and clinical review.
 * Now tracks fallback rate — the single most important quality metric.
 */

import type { CoachTurnLog } from './types';

// In-memory log for the current session (cleared on reset)
let turnLogs: CoachTurnLog[] = [];

export function logCoachTurn(log: CoachTurnLog): void {
  turnLogs.push(log);
  
  const totalTurns = turnLogs.length;
  const fallbackCount = turnLogs.filter(l => l.usedFallback).length;
  const fallbackRate = totalTurns > 0 ? Math.round((fallbackCount / totalTurns) * 100) : 0;
  const validationFailReasons = log.usedFallback && !log.validationPassed
    ? ` [REJECTED: ${(log as any).validationReasons?.join(', ') || 'unknown'}]`
    : '';

  // Console log for development debugging
  console.log(
    `[SmartCoach] Turn ${totalTurns}:`,
    `mode=${log.mode}`,
    `support=${log.supportLevel}`,
    `cue=${log.cueDecision.cueType}`,
    `valid=${log.validationPassed}`,
    `fallback=${log.usedFallback}`,
    `fallbackRate=${fallbackRate}%`,
    `| "${log.coachLine.slice(0, 60)}"${validationFailReasons}`
  );

  // Warn if fallback rate is getting high
  if (totalTurns >= 3 && fallbackRate > 30) {
    console.warn(
      `[SmartCoach] ⚠️ HIGH FALLBACK RATE: ${fallbackRate}% (${fallbackCount}/${totalTurns} turns).`,
      `The validator or LLM is failing too often — conversations will feel robotic.`
    );
  }
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

/** Get fallback rate for the current session (0-100) */
export function getSessionFallbackRate(): { rate: number; total: number; fallbacks: number; rejectionReasons: Record<string, number> } {
  const total = turnLogs.length;
  const fallbacks = turnLogs.filter(l => l.usedFallback).length;
  const rate = total > 0 ? Math.round((fallbacks / total) * 100) : 0;
  
  // Aggregate rejection reasons
  const rejectionReasons: Record<string, number> = {};
  turnLogs.forEach(log => {
    if (log.usedFallback && (log as any).validationReasons) {
      ((log as any).validationReasons as string[]).forEach(r => {
        rejectionReasons[r] = (rejectionReasons[r] || 0) + 1;
      });
    }
  });

  return { rate, total, fallbacks, rejectionReasons };
}
