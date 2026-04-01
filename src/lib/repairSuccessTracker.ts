/**
 * Repair Success Tracker — computes repair effectiveness metrics
 * from conversation turn telemetry.
 * 
 * repair_success_rate = successful_recoveries / total_repair_attempts
 * 
 * Tracked by:
 * - TRL level
 * - Cue type
 * - Session progression (first half vs second half)
 */

import type { ResponseLevel } from './therapeuticResponseLadder';

export interface RepairAttempt {
  turnNumber: number;
  trlLevel: ResponseLevel;
  cueType: string | null;       // 'semantic' | 'phonemic' | 'full_word' | null
  wasSuccessful: boolean;       // Did user produce meaningful speech after?
  wordCountBefore: number;      // User words on the struggling turn
  wordCountAfter: number;       // User words after repair
  latencyMs: number | null;
}

export interface RepairMetrics {
  totalAttempts: number;
  successfulRepairs: number;
  repairSuccessRate: number;     // 0-100

  // By TRL level
  byLevel: Record<number, { attempts: number; successes: number; rate: number }>;
  
  // By cue type
  byCueType: Record<string, { attempts: number; successes: number; rate: number }>;
  
  // Session progression
  firstHalfRate: number;
  secondHalfRate: number;
  progressionDelta: number;     // positive = improving within session
  
  // Anchor depth distribution
  anchorUsageBreakdown: Record<string, number>;
}

export class RepairSuccessTracker {
  private attempts: RepairAttempt[] = [];
  private anchorUsage: Record<string, number> = {
    passive_reference: 0,
    guided_prompt: 0,
    scaffolded_choice: 0,
    targeted_cue: 0,
    recovery_rebuild: 0,
  };

  recordRepairAttempt(attempt: RepairAttempt) {
    this.attempts.push(attempt);
  }

  recordAnchorUsage(type: string) {
    this.anchorUsage[type] = (this.anchorUsage[type] ?? 0) + 1;
  }

  /**
   * Detect if a repair attempt just happened based on turn signals.
   * A repair attempt = cue was given (cueLevel > 0) AND user was struggling.
   */
  static isRepairAttempt(
    cueLevel: number,
    effortfulSpeech: boolean,
    previousWordCount: number,
  ): boolean {
    return cueLevel > 0 && (effortfulSpeech || previousWordCount <= 2);
  }

  /**
   * Determine if a repair was successful.
   * Success = user produced ≥3 words after the cue.
   */
  static wasRepairSuccessful(wordCountAfter: number): boolean {
    return wordCountAfter >= 3;
  }

  getMetrics(): RepairMetrics {
    const total = this.attempts.length;
    if (total === 0) {
      return {
        totalAttempts: 0,
        successfulRepairs: 0,
        repairSuccessRate: 0,
        byLevel: {},
        byCueType: {},
        firstHalfRate: 0,
        secondHalfRate: 0,
        progressionDelta: 0,
        anchorUsageBreakdown: { ...this.anchorUsage },
      };
    }

    const successes = this.attempts.filter(a => a.wasSuccessful).length;

    // By TRL level
    const byLevel: Record<number, { attempts: number; successes: number; rate: number }> = {};
    for (const a of this.attempts) {
      if (!byLevel[a.trlLevel]) byLevel[a.trlLevel] = { attempts: 0, successes: 0, rate: 0 };
      byLevel[a.trlLevel].attempts++;
      if (a.wasSuccessful) byLevel[a.trlLevel].successes++;
    }
    for (const k of Object.keys(byLevel)) {
      const lvl = byLevel[Number(k)];
      lvl.rate = Math.round((lvl.successes / lvl.attempts) * 100);
    }

    // By cue type
    const byCueType: Record<string, { attempts: number; successes: number; rate: number }> = {};
    for (const a of this.attempts) {
      const ct = a.cueType || 'none';
      if (!byCueType[ct]) byCueType[ct] = { attempts: 0, successes: 0, rate: 0 };
      byCueType[ct].attempts++;
      if (a.wasSuccessful) byCueType[ct].successes++;
    }
    for (const k of Object.keys(byCueType)) {
      const ct = byCueType[k];
      ct.rate = Math.round((ct.successes / ct.attempts) * 100);
    }

    // Session progression
    const mid = Math.floor(total / 2);
    const firstHalf = this.attempts.slice(0, mid);
    const secondHalf = this.attempts.slice(mid);
    const firstRate = firstHalf.length > 0 
      ? Math.round((firstHalf.filter(a => a.wasSuccessful).length / firstHalf.length) * 100) 
      : 0;
    const secondRate = secondHalf.length > 0 
      ? Math.round((secondHalf.filter(a => a.wasSuccessful).length / secondHalf.length) * 100) 
      : 0;

    return {
      totalAttempts: total,
      successfulRepairs: successes,
      repairSuccessRate: Math.round((successes / total) * 100),
      byLevel,
      byCueType,
      firstHalfRate: firstRate,
      secondHalfRate: secondRate,
      progressionDelta: secondRate - firstRate,
      anchorUsageBreakdown: { ...this.anchorUsage },
    };
  }

  reset() {
    this.attempts = [];
    this.anchorUsage = {
      passive_reference: 0,
      guided_prompt: 0,
      scaffolded_choice: 0,
      targeted_cue: 0,
      recovery_rebuild: 0,
    };
  }
}
