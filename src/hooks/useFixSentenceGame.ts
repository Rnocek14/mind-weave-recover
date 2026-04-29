/**
 * Fix the Sentence Game Hook
 * 
 * State machine for the Fix the Sentence exercise.
 * Manages trial progression, answer matching (local + semantic fallback),
 * and multi-accept scoring with self-correction bonus.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { FixSentenceTrial, getFixSentenceTrials } from '@/data/fixSentenceBank';
import { getSemanticSimilarity } from '@/lib/semanticSimilarity';
import { useGameSounds } from '@/hooks/useGameSounds';

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
}

interface UseFixSentenceGameOptions {
  trialCount?: number;
  difficulty?: 1 | 2 | 3;
  focusPhonemes?: string[];
  onTrialComplete?: (result: FixSentenceTrialResult) => void;
  onGameComplete?: (results: FixSentenceTrialResult[]) => void;
}

export function useFixSentenceGame(options: UseFixSentenceGameOptions = {}) {
  const {
    trialCount = 5,
    difficulty = 2,
    focusPhonemes = [],
    onTrialComplete,
    onGameComplete,
  } = options;

  const { playSuccess, playError } = useGameSounds();
  const roundStartTimeRef = useRef<number>(Date.now());
  const pendingTrialRef = useRef<FixSentenceTrialResult | null>(null);

  // CRITICAL: difficulty is intentionally NOT a dep below — mid-session
  // difficulty changes must NOT reset score/progress. Use setActiveDifficulty().
  const initialTrials = useMemo(
    () => getFixSentenceTrials({ difficulty, count: trialCount, focusPhonemes }),
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
    const tier = (Math.min(3, Math.max(1, Math.ceil(newLevel / 3.5))) as 1 | 2 | 3);
    setTrials(prev => {
      const upcomingNeeded = prev.length - (currentIndex + 1);
      if (upcomingNeeded <= 0) return prev;
      const fresh = getFixSentenceTrials({
        difficulty: tier,
        count: upcomingNeeded * 3,
        focusPhonemes,
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

  const currentTrial = trials[currentIndex] ?? null;

  /**
   * Local match against acceptedFixes + fixAliases
   */
  const localMatch = useCallback((spoken: string, trial: FixSentenceTrial): string | null => {
    const normalized = spoken.toLowerCase().trim().replace(/[^a-z\s]/g, '');
    if (!normalized || normalized.length < 2) return null;

    // Check direct matches
    for (const fix of trial.acceptedFixes) {
      const f = fix.toLowerCase();
      if (normalized === f || normalized === f + 's' || normalized + 's' === f) return fix;
      // Check "a knife" → "knife"
      if (normalized.startsWith('a ') && normalized.slice(2) === f) return fix;
      if (normalized.startsWith('the ') && normalized.slice(4) === f) return fix;
    }

    // Check aliases
    for (const [canonical, aliases] of Object.entries(trial.fixAliases)) {
      for (const alias of aliases) {
        const a = alias.toLowerCase();
        if (normalized === a || normalized === a + 's' || normalized + 's' === a) return canonical;
      }
    }

    return null;
  }, []);

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

    const isCorrect = bestSim >= 0.80;
    const isPartialCredit = !isCorrect && bestSim >= 0.60;

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
  }, [currentTrial, currentAttempt, localMatch, playSuccess, playError]);

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
    const nextIdx = currentIndex + 1;
    if (nextIdx >= trials.length) {
      setIsComplete(true);
      onGameComplete?.(results);
      return;
    }
    setCurrentIndex(nextIdx);
    setLastResult(null);
    setCurrentAttempt(1);
    roundStartTimeRef.current = Date.now();
  }, [currentIndex, trials.length, results, onGameComplete]);

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
  };
}
