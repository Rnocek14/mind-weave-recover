/**
 * Two Clues Word Association Game - Game State Hook
 * 
 * Manages game flow, scoring, and round progression
 * for the Two Clues word association exercise.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { TwoCluesPuzzle, shufflePuzzles, getPuzzles } from '@/data/twoCluesBank';
import { orderFreshFirst, markManyUsed } from '@/lib/recency/selectWithRecency';
import { filterKidsTwoCluesPuzzles } from '@/data/kidsContent';
import { useKidsMode } from '@/contexts/KidsModeContext';
import { scoreAnswer, ScoringResult } from '@/lib/twoCluesScorer';
import { useGameSounds } from '@/hooks/useGameSounds';

export interface TwoCluesTrialResult {
  puzzleId: string;
  clues: string[];
  anchors: string[];
  spokenWord: string;
  matchedWord?: string;
  tier: ScoringResult['tier'];
  score: number;
  reachedAnchor: boolean;
  semanticSimilarity: number | null;
  reactionTimeMs: number;
  coachResponse?: string;
  attemptNumber: number;
}

export interface TwoCluesGameState {
  puzzles: TwoCluesPuzzle[];
  currentIndex: number;
  currentPuzzle: TwoCluesPuzzle | null;
  results: TwoCluesTrialResult[];
  totalScore: number;
  isComplete: boolean;
  isPaused: boolean;
  roundStartTime: number | null;
  currentAttempt: number;
  lastResult: ScoringResult | null;
  uniqueAnswersThisRound: Set<string>;
}

interface UseTwoCluesGameOptions {
  roundCount?: number;
  category?: string;
  difficulty?: 1 | 2 | 3;
  focusPhonemes?: string[];
  onTrialComplete?: (result: TwoCluesTrialResult) => void;
  onGameComplete?: (results: TwoCluesTrialResult[]) => void;
}

export function useTwoCluesGame(options: UseTwoCluesGameOptions = {}) {
  const {
    roundCount = 10,
    category,
    difficulty,
    focusPhonemes,
    onTrialComplete,
    onGameComplete,
  } = options;

  const { playSuccess, playError } = useGameSounds();
  const { kidsMode } = useKidsMode();
  const roundStartTimeRef = useRef<number | null>(null);

  // Initialize puzzles with phoneme targeting
  const initialPuzzles = useMemo(() => {
    let puzzles = getPuzzles({
      category: category as any,
      difficulty,
      focusPhonemes,
    });
    // Kids Mode narrows to easy, kid-world puzzles — but never overrides an
    // explicit clinician-configured category or difficulty.
    if (kidsMode && !category && !difficulty) {
      puzzles = filterKidsTwoCluesPuzzles(puzzles);
    }
    // Cross-session recency: prefer puzzles not seen in the last ~2 sessions
    // (T2/T3 pools are ~20 items with 10-round sessions — naive shuffle
    // repeats within two days). Soft: never yields fewer than roundCount.
    const ordered = orderFreshFirst('two_clues', shufflePuzzles(puzzles), {
      tier: difficulty ?? '*',
    });
    const picked = ordered.slice(0, roundCount);
    markManyUsed('two_clues', picked.map((p) => p.id), { tier: difficulty ?? '*' });
    return picked;
  }, [category, difficulty, roundCount, focusPhonemes?.join(','), kidsMode]);

  const [state, setState] = useState<TwoCluesGameState>(() => ({
    puzzles: initialPuzzles,
    currentIndex: 0,
    currentPuzzle: initialPuzzles[0] || null,
    results: [],
    totalScore: 0,
    isComplete: false,
    isPaused: false,
    roundStartTime: null,
    currentAttempt: 1,
    lastResult: null,
    uniqueAnswersThisRound: new Set(),
  }));

  // Start a new round (reset timer)
  const startRound = useCallback(() => {
    roundStartTimeRef.current = Date.now();
    setState(prev => ({
      ...prev,
      roundStartTime: Date.now(),
      currentAttempt: 1,
      lastResult: null,
      uniqueAnswersThisRound: new Set(),
    }));
  }, []);

  // Submit an answer with a pre-computed scoring result (avoids double-scoring)
  // Uses functional setState for fresh state + fires callback outside updater
  const pendingTrialRef = useRef<TwoCluesTrialResult | null>(null);

  const submitAnswer = useCallback((spokenWord: string, precomputedResult?: ScoringResult): ScoringResult => {
    const result: ScoringResult = precomputedResult ?? {
      tier: 'uncertain',
      score: 0,
      reasoning: 'No scoring result provided',
      reachedAnchor: false,
      semanticSimilarity: null,
    };

    const reactionTimeMs = roundStartTimeRef.current
      ? Date.now() - roundStartTimeRef.current
      : 0;

    if (result.tier === 'strong' || result.tier === 'related') {
      playSuccess();
    } else if (result.tier === 'uncertain') {
      playError();
    }

    // Pure state update — no side effects inside updater
    setState(prev => {
      if (!prev.currentPuzzle) return prev;

      const canonical = (result.matchedWord ?? spokenWord).toLowerCase().trim();
      const newUniqueAnswers = new Set(prev.uniqueAnswersThisRound);
      if (result.tier !== 'uncertain') {
        newUniqueAnswers.add(canonical);
      }

      const trialResult: TwoCluesTrialResult = {
        puzzleId: prev.currentPuzzle.id,
        clues: prev.currentPuzzle.clues,
        anchors: prev.currentPuzzle.anchors,
        spokenWord,
        matchedWord: result.matchedWord,
        tier: result.tier,
        score: result.score,
        reachedAnchor: result.reachedAnchor,
        semanticSimilarity: result.semanticSimilarity,
        reactionTimeMs,
        coachResponse: result.coachResponse,
        attemptNumber: prev.currentAttempt,
      };

      // Stash for callback outside updater
      pendingTrialRef.current = trialResult;

      return {
        ...prev,
        results: [...prev.results, trialResult],
        totalScore: prev.totalScore + result.score,
        currentAttempt: prev.currentAttempt + 1,
        lastResult: result,
        uniqueAnswersThisRound: newUniqueAnswers,
      };
    });

    // Fire callback on microtask queue so setState updater has definitely run
    queueMicrotask(() => {
      const pending = pendingTrialRef.current;
      if (pending) {
        onTrialComplete?.(pending);
        pendingTrialRef.current = null;
      }
    });

    return result;
  }, [playSuccess, playError, onTrialComplete]);

  // Move to next puzzle
  const nextRound = useCallback(() => {
    setState(prev => {
      const nextIndex = prev.currentIndex + 1;
      const isComplete = nextIndex >= prev.puzzles.length;

      if (isComplete) {
        // Game complete
        onGameComplete?.(prev.results);
        return {
          ...prev,
          isComplete: true,
          currentPuzzle: null,
        };
      }

      // Move to next puzzle
      roundStartTimeRef.current = Date.now();
      return {
        ...prev,
        currentIndex: nextIndex,
        currentPuzzle: prev.puzzles[nextIndex],
        roundStartTime: Date.now(),
        currentAttempt: 1,
        lastResult: null,
        uniqueAnswersThisRound: new Set(),
      };
    });
  }, [onGameComplete]);

  // Skip current puzzle
  const skipRound = useCallback(() => {
    // Log skip with no score
    const { currentPuzzle } = state;
    if (currentPuzzle) {
      const skipResult: TwoCluesTrialResult = {
        puzzleId: currentPuzzle.id,
        clues: currentPuzzle.clues,
        anchors: currentPuzzle.anchors,
        spokenWord: '',
        tier: 'uncertain',
        score: 0,
        reachedAnchor: false,
        semanticSimilarity: null,
        reactionTimeMs: roundStartTimeRef.current
          ? Date.now() - roundStartTimeRef.current
          : 0,
        attemptNumber: 0,
      };
      onTrialComplete?.(skipResult);
    }
    nextRound();
  }, [state, nextRound, onTrialComplete]);

  // Pause/resume
  const togglePause = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  // Reset game
  const resetGame = useCallback(() => {
    const newPuzzles = shufflePuzzles(initialPuzzles);
    roundStartTimeRef.current = Date.now();
    setState({
      puzzles: newPuzzles,
      currentIndex: 0,
      currentPuzzle: newPuzzles[0] || null,
      results: [],
      totalScore: 0,
      isComplete: false,
      isPaused: false,
      roundStartTime: Date.now(),
      currentAttempt: 1,
      lastResult: null,
      uniqueAnswersThisRound: new Set(),
    });
  }, [initialPuzzles]);

  // Computed values
  const progress = state.puzzles.length > 0
    ? (state.currentIndex / state.puzzles.length) * 100
    : 0;

  const averageScore = state.results.length > 0
    ? state.totalScore / state.results.length
    : 0;

  const strongCount = state.results.filter(r => r.tier === 'strong').length;
  const relatedCount = state.results.filter(r => r.tier === 'related').length;
  const creativeCount = state.results.filter(r => r.tier === 'creative').length;

  return {
    // State
    currentPuzzle: state.currentPuzzle,
    currentIndex: state.currentIndex,
    totalRounds: state.puzzles.length,
    results: state.results,
    totalScore: state.totalScore,
    isComplete: state.isComplete,
    isPaused: state.isPaused,
    lastResult: state.lastResult,
    uniqueAnswersThisRound: state.uniqueAnswersThisRound,
    currentAttempt: state.currentAttempt,

    // Computed
    progress,
    averageScore,
    strongCount,
    relatedCount,
    creativeCount,

    // Actions
    startRound,
    submitAnswer,
    nextRound,
    skipRound,
    togglePause,
    resetGame,
  };
}
