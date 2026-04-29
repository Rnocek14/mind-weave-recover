/**
 * Describe & Guess Game Hook
 * 
 * State machine for the circumlocution training exercise.
 * Implements the 2-of-3 guess rule and deterministic feature tracking
 * via prompt chips instead of NLP classification.
 * 
 * Guess triggers (any 2 of 3):
 * (A) whole-description similarity ≥ 0.72 (embeddings compare full phrase to target)
 * (B) best key-phrase similarity ≥ 0.65 (2-3 word chunks compared to target)
 * (C) feature coverage ≥ 2 types (from chips or keyword detection)
 * 
 * KEY CHANGE: Previously compared individual words to target, which fails for 
 * circumlocution (e.g., "you put them on your feet to walk" → each word alone
 * has low similarity to "shoe"). Now compares the WHOLE description and 
 * meaningful 2-3 word phrases to the target — which is how circumlocution 
 * actually works.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { DescribeGuessTrial, FeatureType, getDescribeGuessTrials } from '@/data/describeGuessBank';
import { matchAnswer } from '@/lib/answerMatcher';
import { extractCandidatePhrases, getSemanticAnalysisText } from '@/lib/describeGuessAnalysis';
import { getSemanticSimilarity } from '@/lib/semanticSimilarity';
import { extractAnswerFromTranscript, getContentWordCount } from '@/lib/speechNormalizer';
import { validateSpokenResponse } from '@/lib/evaluation/responseValidation';
import { trackValidation, logValidationDetail } from '@/lib/evaluation/validationTelemetry';
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

  // CRITICAL: difficulty is intentionally NOT a dep below — mid-session
  // changes must NOT reset score/progress. Use setActiveDifficulty().
  const initialTrials = useMemo(
    () => getDescribeGuessTrials({ difficulty, count: trialCount }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trialCount]
  );

  const [trials, setTrials] = useState(initialTrials);
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
   * 
   * NEW STRATEGY (whole-description approach):
   * Instead of comparing individual words to target, we compare:
   * 1. The WHOLE description as a phrase → target (captures circumlocution context)
   * 2. Key 2-3 word phrases → target (captures "sit on", "four legs", etc.)
   * 3. Feature coverage from chips + keyword detection
   * 
   * This is vastly better for circumlocution because "you put them on before walking"
   * as a whole phrase has HIGH similarity to "shoe", while individual words like 
   * "walking" or "put" alone have LOW similarity.
   */
  const evaluateGuess = useCallback(async (
    transcript: string,
    trial: DescribeGuessTrial
  ): Promise<GuessResult> => {
    // Universal validation pipeline — rejects empty, filler, instruction echo
    const validation = validateSpokenResponse({
      transcript,
      expectedMode: 'description',
    });

    trackValidation('describe_guess', validation);
    logValidationDetail('describe_guess', transcript, validation);

    if (!validation.valid) {
      console.log('[DescribeGuess] Pre-scoring rejection:', validation.rejectionReason);
      return { guessed: false, confidence: 0, bestWord: null, bestSimilarity: 0, top3Avg: 0, featureCount: 0, rulesPassed: [] };
    }

    const analysisText = getSemanticAnalysisText(transcript);

    const directMatch = matchAnswer(transcript, trial.target, trial.acceptedWords, trial.category);
    if (directMatch.isMatch && directMatch.countsAsCorrect) {
      return {
        guessed: true,
        confidence: Math.max(0.8, directMatch.confidence),
        bestWord: directMatch.inferredWord || trial.target,
        bestSimilarity: Math.max(0.8, directMatch.confidence),
        top3Avg: Math.max(0.8, directMatch.confidence),
        featureCount: new Set([...featureTypesUsed, ...detectFeatureKeywords(transcript, trial)]).size,
        rulesPassed: ['DIRECT'],
      };
    }

    // Strategy 1: Compare the WHOLE description to the target
    // This is the key insight — circumlocution works at sentence level
    const candidatePhrases = extractCandidatePhrases(analysisText, 5);
    const [wholeDescSimilarity, phraseSimilarities] = await Promise.all([
      getSemanticSimilarity(analysisText, trial.target, trial.category),
      Promise.all(
        candidatePhrases.map(async (phrase) => {
          const sim = await getSemanticSimilarity(phrase, trial.target, trial.category);
          return { word: phrase, sim };
        })
      )
    ]);

    phraseSimilarities.sort((a, b) => b.sim - a.sim);
    const bestPhraseSim = phraseSimilarities[0]?.sim ?? 0;
    const bestPhrase = phraseSimilarities[0]?.word ?? null;

    // Use the best of whole-description or best-phrase
    const bestSimilarity = Math.max(wholeDescSimilarity, bestPhraseSim);
    const bestWord = wholeDescSimilarity >= bestPhraseSim ? analysisText : bestPhrase;
    
    // Combine chip-tracked features + keyword-detected features
    const keywordFeatures = detectFeatureKeywords(transcript, trial);
    const allFeatures = new Set([...featureTypesUsed, ...keywordFeatures]);
    const featureCount = allFeatures.size;

    // 2-of-3 rule (tuned for whole-description approach)
    const rulesPassed: string[] = [];
    
    // Rule A: Whole description captures meaning well
    if (wholeDescSimilarity >= 0.68) rulesPassed.push('A');
    
    // Rule B: A key phrase is strongly related
    if (bestPhraseSim >= 0.62) rulesPassed.push('B');
    
    // Rule C: Used 2+ feature types AND some semantic relevance
    if (featureCount >= 2 && bestSimilarity >= 0.5) rulesPassed.push('C');

    // Rule D: Strong whole-description alone can carry the guess even without chips
    if (wholeDescSimilarity >= 0.8) rulesPassed.push('D');

    const guessed = rulesPassed.includes('D') || rulesPassed.length >= 2;
    const confidence = bestSimilarity;

    // Top-3 average for telemetry
    const top3Avg = phraseSimilarities.length > 0
      ? phraseSimilarities.slice(0, 3).reduce((s, x) => s + x.sim, 0) / Math.min(3, phraseSimilarities.length)
      : wholeDescSimilarity;

    console.log('[DescribeGuess] Evaluation:', {
      target: trial.target,
        transcript: analysisText,
      wholeDescSimilarity: wholeDescSimilarity.toFixed(3),
      bestPhraseSim: bestPhraseSim.toFixed(3),
      bestPhrase,
        candidatePhrases,
      featureCount,
      rulesPassed,
      guessed,
    });

    return { guessed, confidence, bestWord, bestSimilarity, top3Avg, featureCount, rulesPassed };
  }, [featureTypesUsed, detectFeatureKeywords]);

  /**
   * Finalize a trial with full result
   */
  const finalizeTrial = useCallback((
    transcript: string,
    guessResult: GuessResult,
    rawWordWin: boolean,
    selfCorrected: boolean = false,
  ) => {
    if (!currentTrial) return;

    const keywordFeatures = detectFeatureKeywords(transcript, currentTrial);
    const allFeatures = [...new Set([...featureTypesUsed, ...keywordFeatures])];
    
    const meaningWin = guessResult.guessed;
    const strategyWin = allFeatures.length >= 2;
    const hasContent = getContentWordCount(transcript) >= 1;
    const communicationWin = hasContent; // Any meaningful speech = acknowledged

    // Only award wordWin if the patient produced meaningful descriptive content
    // before/alongside saying the target word. This prevents "blurting" the answer
    // without circumlocution from earning the Word Retrieval star.
    // Criteria: used at least 1 feature type OR said 3+ content words (beyond the target itself)
    const targetWordCount = currentTrial.target.split(/\s+/).length;
    const contentWordsExcludingTarget = getContentWordCount(transcript) - targetWordCount;
    const producedDescription = allFeatures.length >= 1 || contentWordsExcludingTarget >= 3;
    const wordWin = rawWordWin && producedDescription;

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
      // Use functional update to get latest results (avoids stale closure)
      setResults(prev => {
        onGameComplete?.(prev);
        return prev;
      });
      return;
    }
    setCurrentIndex(nextIdx);
    setLastResult(null);
    setCurrentAttempt(1);
    setFeatureTypesUsed(new Set());
    setPromptsShown([]);
    wordRetrievalTimeRef.current = null;
    roundStartTimeRef.current = Date.now();
  }, [currentIndex, trials.length, onGameComplete]);

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
