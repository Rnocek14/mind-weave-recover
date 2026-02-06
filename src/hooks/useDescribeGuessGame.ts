/**
 * Describe & Guess Game Hook
 * 
 * State machine for the circumlocution training exercise.
 * Implements the 2-of-3 guess rule and deterministic feature tracking
 * via prompt chips instead of NLP classification.
 * 
 * Guess triggers (any 2 of 3):
 * (A) best-word similarity ≥ 0.78
 * (B) top-3 avg similarity ≥ 0.70
 * (C) feature coverage ≥ 2 types + any content word similarity ≥ 0.60
 * 
 * Embeddings only called on speech-end (not continuously).
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { DescribeGuessTrial, FeatureType, getDescribeGuessTrials } from '@/data/describeGuessBank';
import { getSemanticSimilarity } from '@/lib/semanticSimilarity';
import { extractAnswerFromTranscript, isMostlyFiller, getContentWordCount } from '@/lib/speechNormalizer';
import { useGameSounds } from '@/hooks/useGameSounds';

export interface DescribeGuessTrialResult {
  trialId: string;
  target: string;
  transcript: string;
  meaningWin: boolean;      // App guessed correctly
  wordWin: boolean;         // User said the target word
  strategyWin: boolean;     // Used 2+ feature types
  communicationWin: boolean; // Produced meaningful speech
  featureTypesUsed: FeatureType[];
  guessConfidence: number;
  promptsShown: string[];
  timeToWordRetrievalMs: number | null;
  selfCorrected: boolean;
  reactionTimeMs: number;
  attemptNumber: number;
  difficulty: number;
}

/** Star count from wins */
export function getStarCount(result: DescribeGuessTrialResult): number {
  let stars = 0;
  if (result.meaningWin) stars++;
  if (result.wordWin) stars++;
  if (result.strategyWin) stars++;
  // Communication win is always at least a "participation" point
  if (!result.meaningWin && !result.wordWin && !result.strategyWin && result.communicationWin) {
    stars = 1;
  }
  return Math.max(stars, result.communicationWin ? 1 : 0);
}

interface GuessResult {
  guessed: boolean;
  confidence: number;
  bestWord: string | null;
  bestSimilarity: number;
  top3Avg: number;
  featureCount: number;
  rulesPassed: string[];
}

interface UseDescribeGuessGameOptions {
  trialCount?: number;
  difficulty?: number;
  onTrialComplete?: (result: DescribeGuessTrialResult) => void;
  onGameComplete?: (results: DescribeGuessTrialResult[]) => void;
}

export function useDescribeGuessGame(options: UseDescribeGuessGameOptions = {}) {
  const {
    trialCount = 8,
    difficulty = 2,
    onTrialComplete,
    onGameComplete,
  } = options;

  const { playSuccess } = useGameSounds();
  const roundStartTimeRef = useRef<number>(Date.now());
  const pendingTrialRef = useRef<DescribeGuessTrialResult | null>(null);
  const wordRetrievalTimeRef = useRef<number | null>(null);

  const initialTrials = useMemo(
    () => getDescribeGuessTrials({ difficulty, count: trialCount }),
    [difficulty, trialCount]
  );

  const [trials] = useState(initialTrials);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<DescribeGuessTrialResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [lastResult, setLastResult] = useState<DescribeGuessTrialResult | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  
  // Feature tracking (deterministic via chip taps)
  const [featureTypesUsed, setFeatureTypesUsed] = useState<Set<FeatureType>>(new Set());
  const [promptsShown, setPromptsShown] = useState<string[]>([]);

  const currentTrial = trials[currentIndex] ?? null;

  /**
   * Check if user said the target word directly (local match)
   */
  const checkWordMatch = useCallback((transcript: string, trial: DescribeGuessTrial): boolean => {
    const words = transcript.toLowerCase().split(/\s+/);
    const target = trial.target.toLowerCase();
    
    for (const word of words) {
      const clean = word.replace(/[^a-z]/g, '');
      if (clean === target || clean === target + 's' || clean + 's' === target) return true;
      // Check accepted words
      for (const accepted of trial.acceptedWords) {
        const a = accepted.toLowerCase();
        if (clean === a || clean === a + 's') return true;
      }
      // Check aliases
      for (const aliases of Object.values(trial.wordAliases)) {
        for (const alias of aliases) {
          if (clean === alias.toLowerCase()) return true;
        }
      }
    }
    return false;
  }, []);

  /**
   * Check feature keywords in transcript (supplements chip tracking)
   */
  const detectFeatureKeywords = useCallback((transcript: string, trial: DescribeGuessTrial): FeatureType[] => {
    const detected: FeatureType[] = [];
    const words = transcript.toLowerCase();
    
    for (const [featureType, keywords] of Object.entries(trial.featureKeywords)) {
      if (keywords?.some(kw => words.includes(kw.toLowerCase()))) {
        detected.push(featureType as FeatureType);
      }
    }
    return detected;
  }, []);

  /**
   * Record that user tapped a feature prompt chip
   */
  const recordFeatureChip = useCallback((featureType: FeatureType, promptText: string) => {
    setFeatureTypesUsed(prev => new Set([...prev, featureType]));
    setPromptsShown(prev => prev.includes(promptText) ? prev : [...prev, promptText]);
  }, []);

  /**
   * Evaluate whether the app should "guess" — 2-of-3 rule
   * Called on speech end (not continuously)
   */
  const evaluateGuess = useCallback(async (
    transcript: string,
    trial: DescribeGuessTrial
  ): Promise<GuessResult> => {
    const cleaned = extractAnswerFromTranscript(transcript);
    if (isMostlyFiller(cleaned) || getContentWordCount(cleaned) < 1) {
      return { guessed: false, confidence: 0, bestWord: null, bestSimilarity: 0, top3Avg: 0, featureCount: 0, rulesPassed: [] };
    }

    // Extract content words
    const contentWords = cleaned.split(/\s+/).filter(w => w.length >= 2);
    
    // Compute similarity for each content word to target
    const similarities: { word: string; sim: number }[] = [];
    for (const word of contentWords.slice(0, 6)) { // Cap at 6 to limit API calls
      const sim = await getSemanticSimilarity(word, trial.target, trial.category);
      similarities.push({ word, sim });
    }
    
    similarities.sort((a, b) => b.sim - a.sim);
    
    const bestSimilarity = similarities[0]?.sim ?? 0;
    const bestWord = similarities[0]?.word ?? null;
    const top3 = similarities.slice(0, 3);
    const top3Avg = top3.length > 0 ? top3.reduce((s, x) => s + x.sim, 0) / top3.length : 0;
    
    // Combine chip-tracked features + keyword-detected features
    const keywordFeatures = detectFeatureKeywords(transcript, trial);
    const allFeatures = new Set([...featureTypesUsed, ...keywordFeatures]);
    const featureCount = allFeatures.size;

    // 2-of-3 rule
    const rulesPassed: string[] = [];
    if (bestSimilarity >= 0.78) rulesPassed.push('A');
    if (top3Avg >= 0.70) rulesPassed.push('B');
    if (featureCount >= 2 && bestSimilarity >= 0.60) rulesPassed.push('C');

    const guessed = rulesPassed.length >= 2;
    const confidence = Math.max(bestSimilarity, top3Avg);

    return { guessed, confidence, bestWord, bestSimilarity, top3Avg, featureCount, rulesPassed };
  }, [featureTypesUsed, detectFeatureKeywords]);

  /**
   * Finalize a trial with full result
   */
  const finalizeTrial = useCallback((
    transcript: string,
    guessResult: GuessResult,
    wordWin: boolean,
    selfCorrected: boolean = false,
  ) => {
    if (!currentTrial) return;

    const keywordFeatures = detectFeatureKeywords(transcript, currentTrial);
    const allFeatures = [...new Set([...featureTypesUsed, ...keywordFeatures])];
    
    const meaningWin = guessResult.guessed;
    const strategyWin = allFeatures.length >= 2;
    const hasContent = getContentWordCount(transcript) >= 1;
    const communicationWin = hasContent; // Any meaningful speech = acknowledged

    if (meaningWin || wordWin) playSuccess();

    const result: DescribeGuessTrialResult = {
      trialId: currentTrial.id,
      target: currentTrial.target,
      transcript,
      meaningWin,
      wordWin,
      strategyWin,
      communicationWin,
      featureTypesUsed: allFeatures,
      guessConfidence: guessResult.confidence,
      promptsShown: [...promptsShown],
      timeToWordRetrievalMs: wordRetrievalTimeRef.current,
      selfCorrected,
      reactionTimeMs: Date.now() - roundStartTimeRef.current,
      attemptNumber: currentAttempt,
      difficulty: currentTrial.difficulty,
    };

    setResults(prev => [...prev, result]);
    setLastResult(result);
    pendingTrialRef.current = result;

    queueMicrotask(() => {
      const pending = pendingTrialRef.current;
      if (pending) {
        onTrialComplete?.(pending);
        pendingTrialRef.current = null;
      }
    });

    return result;
  }, [currentTrial, featureTypesUsed, promptsShown, currentAttempt, detectFeatureKeywords, playSuccess, onTrialComplete]);

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
    setFeatureTypesUsed(new Set());
    setPromptsShown([]);
    wordRetrievalTimeRef.current = null;
    roundStartTimeRef.current = Date.now();
  }, [currentIndex, trials.length, results, onGameComplete]);

  const startRound = useCallback(() => {
    roundStartTimeRef.current = Date.now();
    wordRetrievalTimeRef.current = null;
  }, []);

  const recordWordRetrieval = useCallback(() => {
    if (!wordRetrievalTimeRef.current) {
      wordRetrievalTimeRef.current = Date.now() - roundStartTimeRef.current;
    }
  }, []);

  const progress = trials.length > 0 ? (currentIndex / trials.length) * 100 : 0;
  const meaningWins = results.filter(r => r.meaningWin).length;
  const wordWins = results.filter(r => r.wordWin).length;
  const strategyWins = results.filter(r => r.strategyWin).length;

  return {
    currentTrial,
    currentIndex,
    totalTrials: trials.length,
    results,
    isComplete,
    lastResult,
    currentAttempt,
    featureTypesUsed,
    progress,
    meaningWins,
    wordWins,
    strategyWins,
    checkWordMatch,
    evaluateGuess,
    finalizeTrial,
    recordFeatureChip,
    recordWordRetrieval,
    nextTrial,
    startRound,
  };
}
