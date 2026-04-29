/**
 * useDiscourseAdaptation
 *
 * React wrapper around the Discourse Adaptation Bridge.
 * Conversational exercises call `recordTurn(signals)` after each user turn;
 * the hook returns the current adaptive `level`, plus a transient
 * `direction`/`reason` pair that drives the AdaptationBadge.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decideDiscourseShift,
  scoreDiscourseTurn,
  type DiscourseAdaptationDecision,
  type DiscourseDirection,
  type DiscourseTurnSignals,
} from "@/lib/discourseAdaptation";
import { tierToLevel } from "@/lib/gameLevels";
import {
  publishAdaptiveLevel,
  clearAdaptiveLevel,
} from "@/lib/adaptiveLevelRegistry";

interface UseDiscourseAdaptationOptions {
  /** Starting level (1..5). Defaults to 2 (a comfortable middle). */
  initialLevel?: number;
  /** ms before the visible badge auto-clears. */
  badgeAutoClearMs?: number;
  /** Optional logger called on every shift. */
  onShift?: (decision: DiscourseAdaptationDecision) => void;
  /**
   * Optional context so this hook can publish its current 1–10 game level
   * into the adaptive level registry. Required for `game_level` telemetry
   * on discourse exercises (ThoughtContinuation, ConversationPartner, …).
   */
  sessionId?: string | null;
  exerciseSlug?: string;
}

export interface DiscourseAdaptationState {
  /** Current discourse difficulty level 1..5. */
  level: number;
  /** Most recent shift direction (transient — clears after badgeAutoClearMs). */
  shiftDirection: DiscourseDirection | null;
  /** Reason text for the badge tooltip. */
  shiftReason: string | undefined;
  /** Rolling success rate in the current window (0..1). */
  successRate: number;
  /** Number of turns observed. */
  turnCount: number;
  /** Record one user turn and (maybe) shift. */
  recordTurn: (signals: DiscourseTurnSignals) => DiscourseAdaptationDecision;
  /** Reset back to the initial level. */
  reset: () => void;
}

export function useDiscourseAdaptation(
  options: UseDiscourseAdaptationOptions = {},
): DiscourseAdaptationState {
  const {
    initialLevel = 2,
    badgeAutoClearMs = 4000,
    onShift,
  } = options;

  const [level, setLevel] = useState(initialLevel);
  const [shiftDirection, setShiftDirection] = useState<DiscourseDirection | null>(null);
  const [shiftReason, setShiftReason] = useState<string | undefined>(undefined);
  const [successRate, setSuccessRate] = useState(0);
  const [turnCount, setTurnCount] = useState(0);

  const scoresRef = useRef<number[]>([]);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelRef = useRef(initialLevel);

  const recordTurn = useCallback(
    (signals: DiscourseTurnSignals): DiscourseAdaptationDecision => {
      const { successScore } = scoreDiscourseTurn(signals);
      scoresRef.current.push(successScore);
      // Keep only the last 6 to bound memory
      if (scoresRef.current.length > 6) scoresRef.current.shift();

      const decision = decideDiscourseShift(
        scoresRef.current,
        levelRef.current,
        signals,
      );

      // Badge MUST reflect what actually happened to difficulty, not the
      // raw scorer recommendation. If the bridge wanted "up" but is holding
      // (window not yet stable, ceiling/floor reached, etc.) the user must
      // see "Holding steady" — never "Made it harder" with no change.
      const levelChanged = decision.level !== levelRef.current;
      const effectiveDirection: DiscourseDirection =
        decision.direction !== "hold" && levelChanged
          ? decision.direction
          : "hold";

      if (levelChanged) {
        levelRef.current = decision.level;
        setLevel(decision.level);
      }

      setSuccessRate(decision.successRateInWindow);
      setTurnCount(t => t + 1);

      // Show real shifts immediately. Show "hold" sparingly (every 3rd turn)
      // to confirm the system is alive without being noisy.
      const shouldShowHold = effectiveDirection === "hold" && (turnCount + 1) % 3 === 0;
      const willShowBadge = effectiveDirection !== "hold" || shouldShowHold;

      if (willShowBadge) {
        setShiftDirection(effectiveDirection);
        setShiftReason(decision.reason);
        if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
        clearTimerRef.current = setTimeout(() => {
          setShiftDirection(null);
          setShiftReason(undefined);
        }, badgeAutoClearMs);
      }

      onShift?.(decision);
      return decision;
    },
    [badgeAutoClearMs, onShift, turnCount],
  );

  const reset = useCallback(() => {
    scoresRef.current = [];
    levelRef.current = initialLevel;
    setLevel(initialLevel);
    setShiftDirection(null);
    setShiftReason(undefined);
    setSuccessRate(0);
    setTurnCount(0);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
  }, [initialLevel]);

  return {
    level,
    shiftDirection,
    shiftReason,
    successRate,
    turnCount,
    recordTurn,
    reset,
  };
}
