/**
 * Session Simulator
 *
 * Drives the REAL adaptation primitives end-to-end without any UI:
 *   AdaptiveDifficultyController  +  EngagementMonitor
 * wired together with the same cue-dependency safety gate that
 * `useInGameAdaptation` enforces in production.
 *
 * Goal: validate that the closed loop behaves correctly under
 * realistic patient archetypes BEFORE any clinician sees it.
 */

import { AdaptiveDifficultyController } from '@/lib/adaptiveDifficulty';
import { EngagementMonitor } from '@/lib/engagementMonitor';
import { classifyReason, narrateAdaptation } from '@/lib/adaptationNarrator';
import {
  getProfile,
  mulberry32,
  type ProfileId,
  type SimulatedTrial,
} from './userProfiles';

export interface SimulationConfig {
  profileId: ProfileId;
  trials?: number;                 // default 40
  seed?: number;                   // default 1
  initialDifficulty?: number;      // default 3
  floor?: number;                  // default 1
  ceiling?: number;                // default 10
  windowSize?: number;             // default 5
  targetSuccessRate?: number;      // default 0.8
  adjustmentThreshold?: number;    // default 0.1
  cueDependencyEscalationThreshold?: number; // default 0.5
  minTrialsAtLevelForEscalation?: number;    // default 8
  /** Cap on cue level the game offers. Used by profiles that lean on cues. */
  maxCueLevel?: number;            // default 3
}

export interface TrialLogEntry {
  trialIndex: number;
  difficulty: number;
  cueLevelUsed: number;
  correct: boolean;
  reactionTimeMs: number;
  timeout: boolean;
  successRate: number;
  cueDependency: number;
  frustration: string;
  fatigue: string;
  recommendedAction: string;
  trialsAtLevel: number;
  // Adaptation event for THIS trial (if any)
  difficultyChange?: {
    direction: 'up' | 'down';
    from: number;
    to: number;
    reason: string;
    narration: string;
  };
  escalationBlocked?: {
    reason: string;
    cueDependencyScore: number;
    trialsAtLevel: number;
    level: number;
  };
}

export interface SimulationResult {
  config: Required<SimulationConfig>;
  log: TrialLogEntry[];
  summary: {
    totalTrials: number;
    finalDifficulty: number;
    minDifficulty: number;
    maxDifficulty: number;
    upChanges: number;
    downChanges: number;
    blockedEscalations: number;
    finalSuccessRate: number;
    finalCueDependency: number;
    peakFrustration: string;
    peakFatigue: string;
  };
  assertions: AssertionReport;
}

export interface AssertionReport {
  passed: AssertionResult[];
  failed: AssertionResult[];
  inconsistencies: string[];
}

export interface AssertionResult {
  id: string;
  description: string;
  ok: boolean;
  detail?: string;
}

const DEFAULTS: Required<Omit<SimulationConfig, 'profileId'>> = {
  trials: 40,
  seed: 1,
  initialDifficulty: 3,
  floor: 1,
  ceiling: 10,
  windowSize: 5,
  targetSuccessRate: 0.8,
  adjustmentThreshold: 0.1,
  cueDependencyEscalationThreshold: 0.5,
  minTrialsAtLevelForEscalation: 8,
  maxCueLevel: 3,
};

const RANK = { none: 0, low: 1, medium: 2, high: 3 } as const;
type Level = keyof typeof RANK;
const peak = (a: string, b: string): string =>
  RANK[(b as Level)] > RANK[(a as Level)] ? b : a;

export function runSimulation(config: SimulationConfig): SimulationResult {
  const cfg: Required<SimulationConfig> = { ...DEFAULTS, ...config };
  const profile = getProfile(cfg.profileId);
  const rng = mulberry32(cfg.seed);

  const controller = new AdaptiveDifficultyController(
    cfg.windowSize,
    cfg.targetSuccessRate,
    cfg.adjustmentThreshold,
    { floor: cfg.floor, ceiling: cfg.ceiling, suggestedStart: cfg.initialDifficulty },
  );
  const monitor = new EngagementMonitor(10);

  let difficulty = cfg.initialDifficulty;
  let trialsAtLevel = 0;
  let upChanges = 0;
  let downChanges = 0;
  let blockedEscalations = 0;
  let peakFrustration: string = 'none';
  let peakFatigue: string = 'none';

  const log: TrialLogEntry[] = [];

  for (let i = 0; i < cfg.trials; i++) {
    const offeredCueLevel = Math.min(cfg.maxCueLevel, cfg.ceiling);
    const trial: SimulatedTrial = profile.generate({
      trialIndex: i,
      difficulty,
      offeredCueLevel,
      rng,
    });

    // Feed engagement monitor
    monitor.addTrial({
      correct: trial.correct,
      reactionTimeMs: trial.reactionTimeMs,
      timeout: trial.timeout,
      cueLevel: trial.cueLevel,
      timestamp: Date.now() + i,
    });

    // Update controller
    controller.update(trial.correct);
    trialsAtLevel += 1;

    const state = monitor.assessState();
    const cueDependencyScore = state.signals.cueDependency / 3; // normalize 0..1
    const previousLevel = difficulty;

    let entry: TrialLogEntry = {
      trialIndex: i,
      difficulty,
      cueLevelUsed: trial.cueLevel,
      correct: trial.correct,
      reactionTimeMs: trial.reactionTimeMs,
      timeout: trial.timeout,
      successRate: controller.getSuccessRate(),
      cueDependency: Number(cueDependencyScore.toFixed(3)),
      frustration: state.frustration,
      fatigue: state.fatigue,
      recommendedAction: state.recommendedAction,
      trialsAtLevel,
    };

    // Frustration emergency step-down (mirrors useInGameAdaptation)
    if (state.frustration === 'high') {
      const next = controller.handleFrustration(previousLevel);
      if (next !== previousLevel) {
        difficulty = next;
        trialsAtLevel = 0;
        downChanges += 1;
        const reason = 'Frustration detected - reducing difficulty';
        entry.difficultyChange = {
          direction: 'down',
          from: previousLevel,
          to: next,
          reason,
          narration: narrateAdaptation({
            direction: 'down',
            reasonKind: classifyReason(reason),
          }),
        };
      }
    } else {
      const adjusted = controller.adjustLevel(previousLevel);
      if (adjusted !== previousLevel) {
        const direction = adjusted > previousLevel ? 'up' : 'down';

        if (direction === 'up') {
          // Apply cue-dependency safety gate
          if (
            cueDependencyScore > cfg.cueDependencyEscalationThreshold &&
            trialsAtLevel < cfg.minTrialsAtLevelForEscalation
          ) {
            blockedEscalations += 1;
            const blockReason =
              `Escalation blocked: cue_dependency=${cueDependencyScore.toFixed(2)} > ${cfg.cueDependencyEscalationThreshold}, ` +
              `trials_at_level=${trialsAtLevel} < ${cfg.minTrialsAtLevelForEscalation}. Holding level ${previousLevel}.`;
            entry.escalationBlocked = {
              reason: blockReason,
              cueDependencyScore,
              trialsAtLevel,
              level: previousLevel,
            };
            entry.difficultyChange = {
              direction: 'down', // hold rendered as "stay/fade cues"
              from: previousLevel,
              to: previousLevel,
              reason: blockReason,
              narration: narrateAdaptation({
                direction: 'hold',
                reasonKind: 'cue_dependency_hold',
              }),
            };
          } else {
            difficulty = adjusted;
            trialsAtLevel = 0;
            upChanges += 1;
            const sr = controller.getSuccessRate();
            const reason = `Success rate ${(sr * 100).toFixed(0)}% - increasing challenge`;
            entry.difficultyChange = {
              direction: 'up',
              from: previousLevel,
              to: adjusted,
              reason,
              narration: narrateAdaptation({
                direction: 'up',
                reasonKind: classifyReason(reason),
              }),
            };
          }
        } else {
          difficulty = adjusted;
          trialsAtLevel = 0;
          downChanges += 1;
          const sr = controller.getSuccessRate();
          const reason = `Success rate ${(sr * 100).toFixed(0)}% - providing support`;
          entry.difficultyChange = {
            direction: 'down',
            from: previousLevel,
            to: adjusted,
            reason,
            narration: narrateAdaptation({
              direction: 'down',
              reasonKind: classifyReason(reason),
            }),
          };
        }
      }
    }

    peakFrustration = peak(peakFrustration, state.frustration);
    peakFatigue = peak(peakFatigue, state.fatigue);
    log.push(entry);
  }

  const finalEntry = log[log.length - 1];
  const summary = {
    totalTrials: log.length,
    finalDifficulty: difficulty,
    minDifficulty: Math.min(...log.map((l) => l.difficulty)),
    maxDifficulty: Math.max(...log.map((l) => l.difficulty)),
    upChanges,
    downChanges,
    blockedEscalations,
    finalSuccessRate: finalEntry?.successRate ?? 0,
    finalCueDependency: finalEntry?.cueDependency ?? 0,
    peakFrustration,
    peakFatigue,
  };

  return { config: cfg, log, summary, assertions: validate(cfg, log, summary) };
}

// ---------------------------------------------------------------------------
// Behavior validation
// ---------------------------------------------------------------------------

function validate(
  cfg: Required<SimulationConfig>,
  log: TrialLogEntry[],
  summary: SimulationResult['summary'],
): AssertionReport {
  const passed: AssertionResult[] = [];
  const failed: AssertionResult[] = [];
  const inconsistencies: string[] = [];

  // 1. Cue-dependency gate: every up-escalation must have cueDep <= threshold
  //    OR trialsAtLevel >= minTrials. Otherwise the gate failed to fire.
  const upEvents = log.filter((l) => l.difficultyChange?.direction === 'up');
  const violations = upEvents.filter(
    (l) =>
      l.cueDependency > cfg.cueDependencyEscalationThreshold &&
      l.trialsAtLevel < cfg.minTrialsAtLevelForEscalation,
  );
  pushAssert(
    passed,
    failed,
    {
      id: 'gate.no_unsafe_escalations',
      description: 'No escalation occurred while cue dependency was high and trials_at_level was low',
      ok: violations.length === 0,
      detail:
        violations.length === 0
          ? undefined
          : `${violations.length} unsafe escalation(s) at trials [${violations.map((v) => v.trialIndex).join(', ')}]`,
    },
  );

  // 2. Gate must actually fire when conditions are met (only assert if conditions occurred)
  const opportunities = log.filter(
    (l) => l.cueDependency > cfg.cueDependencyEscalationThreshold && l.trialsAtLevel < cfg.minTrialsAtLevelForEscalation,
  );
  if (opportunities.length > 0 && summary.blockedEscalations === 0 && upEvents.length > 0) {
    inconsistencies.push(
      'Conditions for blocking were observed but no escalation was ever blocked.',
    );
  }

  // 3. Regression: if frustration ever reached high, at least one down-change should follow.
  const firstHighFrustration = log.findIndex((l) => l.frustration === 'high');
  if (firstHighFrustration >= 0) {
    const followingDown = log
      .slice(firstHighFrustration)
      .some((l) => l.difficultyChange?.direction === 'down');
    pushAssert(passed, failed, {
      id: 'regression.frustration_step_down',
      description: 'High frustration eventually triggers a difficulty step-down',
      ok: followingDown,
      detail: followingDown ? undefined : 'High frustration observed but no down-change followed',
    });
  }

  // 4. Progression: if final success rate sustained > targetSuccessRate + threshold for a window
  //    AND cue dependency low → at least one up-change should have occurred.
  const tail = log.slice(-cfg.windowSize);
  const tailHighSuccess =
    tail.length === cfg.windowSize &&
    tail.every((l) => l.successRate > cfg.targetSuccessRate + cfg.adjustmentThreshold) &&
    tail.every((l) => l.cueDependency <= cfg.cueDependencyEscalationThreshold);
  if (tailHighSuccess && summary.maxDifficulty === cfg.initialDifficulty) {
    inconsistencies.push(
      'Sustained high accuracy with low cue dependency but no upward escalation occurred.',
    );
  }

  // 5. Narration sanity: every difficulty change must produce non-empty narration.
  const emptyNarrations = log.filter(
    (l) => l.difficultyChange && l.difficultyChange.narration.trim() === '',
  );
  pushAssert(passed, failed, {
    id: 'narration.non_empty',
    description: 'Every difficulty change emits non-empty patient-facing narration',
    ok: emptyNarrations.length === 0,
    detail:
      emptyNarrations.length === 0
        ? undefined
        : `Empty narration at trials [${emptyNarrations.map((l) => l.trialIndex).join(', ')}]`,
  });

  // 6. Bounds: difficulty never crosses floor/ceiling.
  const outOfBounds = log.filter(
    (l) => l.difficulty < cfg.floor || l.difficulty > cfg.ceiling,
  );
  pushAssert(passed, failed, {
    id: 'bounds.respected',
    description: `Difficulty stays within [${cfg.floor}, ${cfg.ceiling}]`,
    ok: outOfBounds.length === 0,
  });

  return { passed, failed, inconsistencies };
}

function pushAssert(passed: AssertionResult[], failed: AssertionResult[], r: AssertionResult) {
  (r.ok ? passed : failed).push(r);
}
