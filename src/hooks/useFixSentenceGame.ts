/**
 * Fix the Sentence Game Hook
 * 
 * State machine for the Fix the Sentence exercise.
 * Manages trial progression, answer matching (local + semantic fallback),
 * and multi-accept scoring with self-correction bonus.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { FixSentenceTrial, getFixSentenceTrials } from '@/data/fixSentenceBank';
import { getSemanticSimilarity, hasLexicalOverlap } from '@/lib/semanticSimilarity';
import { useGameSounds } from '@/hooks/useGameSounds';
import { useRecencyExclusion } from '@/lib/recency/useRecencyExclusion';
import {
  selectFixSentencePool,
  writeFixSentenceSelectorDiagnostics,
} from '@/lib/progression/fixSentenceContentSelector';

export interface FixSentenceTrialResult {
  trialId: string;
  sentence: string;
  wrongWord: string;
  spokenWord: string;
  matchedFix: string | null;
  isCorrect: boolean;
  isPartialCredit: boolean;
  selfCorrected: boolean;
  semanticSimilarity: number | null;
  reactionTimeMs: number;
  attemptNumber: number;
  difficulty: number;
  phonemeTargets: string[];
  /**
   * L5 two-error trials. `phaseAdvance: true` marks the INTERIM result
   * returned when the first of two errors is repaired — the component must
   * NOT submit it; it prompts for the remaining error and re-listens.
   * Aggregate (submittable) results carry the per-phase fixes instead.
   */
  phaseAdvance?: boolean;
  phase1Fix?: string | null;
  phase2Fix?: string | null;
}

interface UseFixSentenceGameOptions {
  trialCount?: number;
  difficulty?: 1 | 2 | 3;
  /**
   * Clinical level (1–8). When ≥ 4 the PR6 content selector is applied to
   * filter the trial pool. When the selector falls back (tier not
   * implemented), the legacy difficulty-based bank pick is used and a
   * diagnostic is recorded for /dev/progression-state.
   */
  clinicalLevel?: number;
  focusPhonemes?: string[];
  onTrialComplete?: (result: FixSentenceTrialResult) => void;
  onGameComplete?: (results: FixSentenceTrialResult[]) => void;
}

export function useFixSentenceGame(options: UseFixSentenceGameOptions = {}) {
  const {
    trialCount = 5,
    difficulty = 2,
    clinicalLevel,
    focusPhonemes = [],
    onTrialComplete,
    onGameComplete,
  } = options;

  const { playSuccess, playError } = useGameSounds();
  const roundStartTimeRef = useRef<number>(Date.now());
  const pendingTrialRef = useRef<FixSentenceTrialResult | null>(null);

  // Recency exclusion (per-tier LRU, localStorage-backed). Read recent IDs
  // for the current tier and pass them to the bank selector. Marking happens
  // when a trial advances (see nextTrial).
  const recency = useRecencyExclusion<FixSentenceTrial>('fix_sentence', [], {
    lookback: 20,
    tierAware: true,
    getTier: (t) => t.difficulty,
    getId: (t) => t.id,
  });
  const tierForRecency = (typeof difficulty === 'number' ? difficulty : 2);
  const initialRecentIds = useMemo(
    () => recency.getRecent(tierForRecency),
    // Capture once per mount; we want a stable initial selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // CRITICAL: difficulty is intentionally NOT a dep below — mid-session
  // difficulty changes must NOT reset score/progress. Use setActiveDifficulty().
  const initialTrials = useMemo(
    () => {
      // Legacy difficulty-banded selection (always available).
      const baseline = getFixSentenceTrials({
        difficulty,
        count: trialCount,
        focusPhonemes,
        recentIds: initialRecentIds,
      });
      // PR6: clinical content selector applied when clinicalLevel ≥ 4.
      if (typeof clinicalLevel === 'number' && clinicalLevel >= 4) {
        const result = selectFixSentencePool(clinicalLevel);
        writeFixSentenceSelectorDiagnostics(result, clinicalLevel);
        // If selector falls back / skips, keep baseline trials — do NOT
        // silently downgrade by pretending the tier was applied.
        if (result.fallback?.skipped || result.pool.length < trialCount) {
          return baseline;
        }
        // Use selector pool, intersected with the requested baseline order
        // when possible, otherwise just sample fresh from the tier pool.
        const tierIds = new Set(result.pool.map((t) => t.id));
        const fromBaseline = baseline.filter((t) => tierIds.has(t.id));
        if (fromBaseline.length >= trialCount) return fromBaseline.slice(0, trialCount);
        // Pad from the selector pool, oldest-recency last.
        const recentSet = new Set(initialRecentIds);
        const fresh = result.pool.filter((t) => !recentSet.has(t.id));
        const filler = [...fromBaseline, ...fresh.filter((t) => !fromBaseline.some((b) => b.id === t.id))];
        return filler.slice(0, trialCount);
      }
      return baseline;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trialCount, focusPhonemes.join(',')]
  );

  const [trials, setTrials] = useState(initialTrials);
  const [currentIndex, setCurrentIndex] = useState(0);

  /**
   * Mid-session difficulty shift. Replaces ONLY upcoming (unplayed) trials.
   * Preserves currentIndex, results, attempt history.
   */
  const setActiveDifficulty = useCallback((newLevel: number) => {
    // Pass the engine level straight through. The bank centrally maps
    // engine level → tier and now uses BAND-ISOLATED selection so adjacent
    // engine levels in the same tier still produce that tier's content,
    // but cross-tier moves swap pools cleanly (no cumulative `<=` overlap).
    setTrials(prev => {
      const upcomingNeeded = prev.length - (currentIndex + 1);
      if (upcomingNeeded <= 0) return prev;
      const fresh = getFixSentenceTrials({
        difficulty: newLevel,
        count: upcomingNeeded * 3,
        focusPhonemes,
        recentIds: recency.getRecent(newLevel),
      }).filter(t => !prev.slice(0, currentIndex + 1).some(p => p.id === t.id))
        .slice(0, upcomingNeeded);
      if (fresh.length === 0) return prev;
      const padded = fresh.length < upcomingNeeded
        ? [...fresh, ...prev.slice(currentIndex + 1 + fresh.length)]
        : fresh;
      return [...prev.slice(0, currentIndex + 1), ...padded];
    });
  }, [currentIndex, focusPhonemes]);
  const [results, setResults] = useState<FixSentenceTrialResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [lastResult, setLastResult] = useState<FixSentenceTrialResult | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState(1);

  // L5 two-error repair phase (spec: docs/fix-sentence-two-error-spec.md).
  // Phase 1 accepts a fix for EITHER error (order-agnostic); phase 2 targets
  // the remaining one. phase1RepairRef is the pending half of the aggregate.
  const [repairPhase, setRepairPhase] = useState<1 | 2>(1);
  const phase1RepairRef = useRef<{
    errorNum: 1 | 2;
    fix: string;
    spoken: string;
    selfCorrected: boolean;
  } | null>(null);

  const currentTrial = trials[currentIndex] ?? null;

  // Accepted fixes for the REMAINING error during phase 2 (attempt
  // telemetry + hints). phase1RepairRef is a ref, but repairPhase state
  // changes force the re-render that makes this read fresh.
  const phase2TargetFixes = useMemo(() => {
    if (repairPhase !== 2 || !currentTrial?.secondError) return null;
    return phase1RepairRef.current?.errorNum === 1
      ? currentTrial.secondError.acceptedFixes
      : currentTrial.acceptedFixes;
  }, [repairPhase, currentTrial]);

  /**
   * Match a spoken answer against one accepted-fix set (+ aliases).
   */
  const matchFixSet = useCallback((
    spoken: string,
    acceptedFixes: string[],
    fixAliases: Record<string, string[]>,
  ): string | null => {
    const normalized = spoken.toLowerCase().trim().replace(/[^a-z\s]/g, '');
    if (!normalized || normalized.length < 2) return null;

    // Check direct matches
    for (const fix of acceptedFixes) {
      const f = fix.toLowerCase();
      if (normalized === f || normalized === f + 's' || normalized + 's' === f) return fix;
      // Check "a knife" → "knife"
      if (normalized.startsWith('a ') && normalized.slice(2) === f) return fix;
      if (normalized.startsWith('the ') && normalized.slice(4) === f) return fix;
    }

    // Check aliases
    for (const [canonical, aliases] of Object.entries(fixAliases)) {
      for (const alias of aliases) {
        const a = alias.toLowerCase();
        if (normalized === a || normalized === a + 's' || normalized + 's' === a) return canonical;
      }
    }

    return null;
  }, []);

  /**
   * Local match against a trial's primary error (single-error path).
   */
  const localMatch = useCallback((spoken: string, trial: FixSentenceTrial): string | null => {
    return matchFixSet(spoken, trial.acceptedFixes, trial.fixAliases);
  }, [matchFixSet]);

  /**
   * Score a spoken answer — local match first, semantic fallback
   */
  const scoreAnswer = useCallback(async (
    spoken: string,
    selfCorrected: boolean = false
  ): Promise<FixSentenceTrialResult | null> => {
    if (!currentTrial) return null;

    const reactionTimeMs = Date.now() - roundStartTimeRef.current;
    const normalized = spoken.toLowerCase().trim();

    // ── L5 two-error trials: two-phase repair ──────────────────────────
    const second = currentTrial.secondError;
    if (second) {
      const baseResult = {
        trialId: currentTrial.id,
        sentence: currentTrial.sentence,
        wrongWord: currentTrial.wrongWord,
        spokenWord: spoken,
        selfCorrected,
        reactionTimeMs, // roundStart is NOT reset at phase change → total across phases
        attemptNumber: currentAttempt,
        difficulty: currentTrial.difficulty,
        phonemeTargets: currentTrial.phonemeTargets,
      };

      if (repairPhase === 1) {
        // Order-agnostic: primary error's list is checked first, which is
        // also the spec's ambiguity rule (a fix accepted by both errors
        // credits the one that ranks it first).
        const m1 = matchFixSet(normalized, currentTrial.acceptedFixes, currentTrial.fixAliases);
        const m2 = m1 ? null : matchFixSet(normalized, second.acceptedFixes, second.fixAliases);
        const matchedErr: 1 | 2 | null = m1 ? 1 : m2 ? 2 : null;
        const matchedFix = m1 ?? m2;

        if (matchedErr && matchedFix) {
          playSuccess();
          phase1RepairRef.current = { errorNum: matchedErr, fix: matchedFix, spoken, selfCorrected };
          setRepairPhase(2);
          // INTERIM — component must not submit this; it prompts for the
          // remaining error and re-listens.
          return {
            ...baseResult,
            matchedFix,
            isCorrect: false,
            isPartialCredit: false,
            semanticSimilarity: 1.0,
            phaseAdvance: true,
            phase1Fix: matchedFix,
          };
        }

        // No local hit on either error → plain wrong attempt (component
        // drives the usual retry). No semantic fallback in phase 1: with
        // two targets live, embedding noise against the union is too
        // permissive to credit a detection.
        playError();
        return {
          ...baseResult,
          matchedFix: null,
          isCorrect: false,
          isPartialCredit: false,
          semanticSimilarity: null,
        };
      }

      // Phase 2 — the remaining error is the sole target.
      const p1 = phase1RepairRef.current;
      const target = p1?.errorNum === 1
        ? second
        : { acceptedFixes: currentTrial.acceptedFixes, fixAliases: currentTrial.fixAliases };
      const m = matchFixSet(normalized, target.acceptedFixes, target.fixAliases);
      if (m && p1) {
        playSuccess();
        phase1RepairRef.current = null; // aggregate owns the pair now
        return {
          ...baseResult,
          matchedFix: m,
          isCorrect: true,
          isPartialCredit: false,
          semanticSimilarity: 1.0,
          phase1Fix: p1.fix,
          phase2Fix: m,
          selfCorrected: selfCorrected || p1.selfCorrected,
        };
      }
      playError();
      return {
        ...baseResult,
        matchedFix: null,
        isCorrect: false,
        isPartialCredit: false,
        semanticSimilarity: null,
        phase1Fix: p1?.fix ?? null,
      };
    }

    // 1) Local match
    const matched = localMatch(normalized, currentTrial);
    if (matched) {
      playSuccess();
      const result: FixSentenceTrialResult = {
        trialId: currentTrial.id,
        sentence: currentTrial.sentence,
        wrongWord: currentTrial.wrongWord,
        spokenWord: spoken,
        matchedFix: matched,
        isCorrect: true,
        isPartialCredit: false,
        selfCorrected,
        semanticSimilarity: 1.0,
        reactionTimeMs,
        attemptNumber: currentAttempt,
        difficulty: currentTrial.difficulty,
        phonemeTargets: currentTrial.phonemeTargets,
      };
      return result;
    }

    // 2) Semantic similarity fallback — compare to each acceptedFix
    let bestSim = 0;
    let bestFix: string | null = null;
    for (const fix of currentTrial.acceptedFixes) {
      const sim = await getSemanticSimilarity(normalized, fix, currentTrial.category);
      if (sim > bestSim) {
        bestSim = sim;
        bestFix = fix;
      }
    }

    // Tightened thresholds (Apr 2026 signal-quality fix):
    //  - "correct" requires strong embedding agreement (semantic match)
    //  - "partial" requires BOTH a moderate embedding score AND lexical
    //    overlap with at least one accepted fix. Without that overlap,
    //    embedding noise alone is not enough to award partial credit.
    const isCorrect = bestSim >= 0.78;
    const hasOverlapWithAnyFix = currentTrial.acceptedFixes.some(f => hasLexicalOverlap(spoken, f));
    const isPartialCredit = !isCorrect && bestSim >= 0.55 && hasOverlapWithAnyFix;

    if (isCorrect) {
      playSuccess();
    } else if (!isPartialCredit) {
      playError();
    }

    return {
      trialId: currentTrial.id,
      sentence: currentTrial.sentence,
      wrongWord: currentTrial.wrongWord,
      spokenWord: spoken,
      matchedFix: isCorrect ? bestFix : null,
      isCorrect,
      isPartialCredit,
      selfCorrected,
      semanticSimilarity: bestSim > 0 ? bestSim : null,
      reactionTimeMs,
      attemptNumber: currentAttempt,
      difficulty: currentTrial.difficulty,
      phonemeTargets: currentTrial.phonemeTargets,
    };
  }, [currentTrial, currentAttempt, localMatch, matchFixSet, repairPhase, playSuccess, playError]);

  /**
   * Submit a scored result
   */
  const submitResult = useCallback((result: FixSentenceTrialResult) => {
    setResults(prev => [...prev, result]);
    setLastResult(result);
    setCurrentAttempt(prev => prev + 1);
    pendingTrialRef.current = result;

    queueMicrotask(() => {
      const pending = pendingTrialRef.current;
      if (pending) {
        onTrialComplete?.(pending);
        pendingTrialRef.current = null;
      }
    });
  }, [onTrialComplete]);

  /**
   * Advance to next trial
   */
  const nextTrial = useCallback(() => {
    // Two-error abandonment safety (spec §3.5): leaving a trial after a
    // phase-1 repair but before phase 2 completes must still submit the
    // aggregate as PARTIAL — never leave a sentence half-submitted. This
    // covers skip buttons and retry-exhaustion advances.
    const abandoning = trials[currentIndex];
    const pendingP1 = phase1RepairRef.current;
    let finalResults = results;
    if (abandoning?.secondError && pendingP1) {
      phase1RepairRef.current = null;
      const partial: FixSentenceTrialResult = {
        trialId: abandoning.id,
        sentence: abandoning.sentence,
        wrongWord: abandoning.wrongWord,
        spokenWord: pendingP1.spoken,
        matchedFix: pendingP1.fix,
        isCorrect: false,
        isPartialCredit: true,
        selfCorrected: pendingP1.selfCorrected,
        semanticSimilarity: 1.0,
        reactionTimeMs: Date.now() - roundStartTimeRef.current,
        attemptNumber: currentAttempt,
        difficulty: abandoning.difficulty,
        phonemeTargets: abandoning.phonemeTargets,
        phase1Fix: pendingP1.fix,
        phase2Fix: null,
      };
      setResults(prev => [...prev, partial]);
      setLastResult(partial);
      finalResults = [...results, partial]; // completion below must see it
      onTrialComplete?.(partial);
    }
    setRepairPhase(1);

    // Mark the just-completed trial as used (per its own tier) BEFORE advancing.
    const completed = trials[currentIndex];
    if (completed) {
      recency.markUsed(completed.id, completed.difficulty);
      if (typeof window !== 'undefined' && import.meta.env?.DEV) {
        // eslint-disable-next-line no-console
        console.debug('[recency:fix_sentence] markUsed id=%s tier=%d recent=%d',
          completed.id, completed.difficulty, recency.getRecent(completed.difficulty).length);
      }
    }
    const nextIdx = currentIndex + 1;
    if (nextIdx >= trials.length) {
      setIsComplete(true);
      onGameComplete?.(finalResults);
      return;
    }
    setCurrentIndex(nextIdx);
    setLastResult(null);
    setCurrentAttempt(1);
    roundStartTimeRef.current = Date.now();
  }, [currentIndex, trials, results, currentAttempt, onGameComplete, onTrialComplete, recency]);

  /**
   * Start round timer
   */
  const startRound = useCallback(() => {
    roundStartTimeRef.current = Date.now();
  }, []);

  const progress = trials.length > 0 ? (currentIndex / trials.length) * 100 : 0;
  const correctCount = results.filter(r => r.isCorrect).length;
  const partialCount = results.filter(r => r.isPartialCredit && !r.isCorrect).length;

  return {
    currentTrial,
    currentIndex,
    totalTrials: trials.length,
    results,
    isComplete,
    lastResult,
    currentAttempt,
    progress,
    correctCount,
    partialCount,
    scoreAnswer,
    submitResult,
    nextTrial,
    startRound,
    setActiveDifficulty,
    /** L5 two-error trials: which repair phase is active (1 or 2). */
    repairPhase,
    /** Accepted fixes for the remaining error while repairPhase === 2. */
    phase2TargetFixes,
  };
}
