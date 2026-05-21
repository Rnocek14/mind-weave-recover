/**
 * Meaning Match Game Component (v2)
 * 
 * Read a sentence → pick the correct meaning → optionally explain WHY.
 * Redesigned: no reading gate, adaptive explain-why, model explanation shown,
 * structured feedback, Maya integration.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useMeaningMatchGame, MeaningMatchTrialResult } from '@/hooks/useMeaningMatchGame';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Lightbulb, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExplainWhyPrompt, ExplainWhyResult } from '@/components/ExplainWhyPrompt';
import { deriveKeyConcepts } from '@/lib/explanationScorer';
import { ExercisePurposeBanner } from '@/components/ExercisePurposeBanner';
import { StructuredFeedbackSummary } from '@/components/StructuredFeedbackSummary';
import { useMayaExerciseFrame } from '@/hooks/useMayaExerciseFrame';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { narrateAdaptation, classifyReason } from '@/lib/adaptationNarrator';
import { getCapabilityDifficultyBounds } from '@/lib/difficultyBounds';
import { AdaptationBadge, useAdaptationShift } from '@/components/AdaptationBadge';
import { LevelBadge } from '@/components/exercise/LevelBadge';
import { levelToTier } from '@/data/meaningMatchItems';

interface MeaningMatchGameProps {
  onTrialComplete: (result: MeaningMatchTrialResult) => void;
  onGameComplete: (results: MeaningMatchTrialResult[]) => void;
  roundCount?: number;
  difficultyLevel?: number;
  recommendedCueType?: 'semantic' | 'phonemic' | 'full_word' | 'none';
  /**
   * Active session id — forwarded to useInGameAdaptation so the auto-wired
   * adaptation_trial_logs logger can persist per-trial telemetry. Without
   * this, the in-game adaptation controller still runs but its rows are
   * dropped at the persistence layer (autoLog no-ops on null sessionId).
   */
  sessionId?: string | null;
}

type Phase = 'answering' | 'feedback' | 'explaining';

/** Highlight keywords in a sentence */
function highlightSentence(sentence: string, keywords?: string[]): React.ReactNode {
  if (!keywords || keywords.length === 0) return sentence;
  
  const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = sentence.split(regex);
  
  return parts.map((part, i) => {
    const isKeyword = keywords.some(k => k.toLowerCase() === part.toLowerCase());
    if (isKeyword) {
      return (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800/50 px-0.5 rounded font-medium">
          {part}
        </mark>
      );
    }
    return part;
  });
}

export function MeaningMatchGame({
  onTrialComplete,
  onGameComplete,
  roundCount = 10,
  difficultyLevel = 1,
  recommendedCueType,
  sessionId = null,
}: MeaningMatchGameProps) {

  const {
    currentItem,
    currentIndex,
    totalItems,
    isComplete,
    results,
    totalPoints,
    submitAnswer,
    nextItem,
    activeTier,
    setActiveTier,
  } = useMeaningMatchGame(roundCount, difficultyLevel);

  // ============ Adaptive Difficulty Layer ============
  // Real-time tier shifts based on rolling success rate
  const bounds = useMemo(() => getCapabilityDifficultyBounds('meaning-match', null), []);
  const { direction: shiftDirection, reason: shiftReason, signal: signalShift } = useAdaptationShift();

  // Phase 2: engagement monitor — hint usage flows in as cueLevel.
  const engagement = useEngagementMonitor(null);

  const adaptation = useInGameAdaptation({
    exerciseSlug: 'meaning-match',
    sessionId,

    initialDifficulty: difficultyLevel,
    bounds,
    enableDifficultyToasts: false, // We use the inline badge instead
    getCueDependencyScore: () => engagement.getState().signals.cueDependency,
    onEscalationBlocked: ({ reason, cueDependencyScore, trialsAtLevel }) => {
      console.debug('[meaning-match] escalation blocked', { reason, cueDependencyScore, trialsAtLevel });
    },
    onDifficultyChange: (newLevel, reason, dir) => {
      const newTier = levelToTier(newLevel);
      if (newTier !== activeTier) {
        setActiveTier(newTier);
      }
      const narration = narrateAdaptation({ direction: dir, reasonKind: classifyReason(reason) });
      signalShift(dir, narration || reason);
    },
  });

  const [phase, setPhase] = useState<Phase>('answering');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<MeaningMatchTrialResult | null>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [reasoningPoints, setReasoningPoints] = useState(0);
  const [explainSkipCount, setExplainSkipCount] = useState(0);
  const trialStartRef = useRef(Date.now());
  const caseLoadTimeRef = useRef(Date.now());
  const firstInteractionRef = useRef(false);

  const { buildReflection } = useMayaExerciseFrame({ exerciseSlug: 'meaning-match' });
  const vg = useVoiceGuidance('meaning-match');

  // Speak intro on first mount in Full Coaching mode
  const hasSpokenIntroRef = React.useRef(false);
  React.useEffect(() => {
    if (!hasSpokenIntroRef.current && vg.shouldAutoSpeak) {
      hasSpokenIntroRef.current = true;
      vg.speakIntro();
    }
  }, [vg.shouldAutoSpeak]);

  // Stall timer for voice reminder
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state when item changes
  useEffect(() => {
    setPhase('answering');
    setSelectedOption(null);
    setLastResult(null);
    setUsedHint(false);
    setShowHint(false);
    firstInteractionRef.current = false;
    caseLoadTimeRef.current = Date.now();
    trialStartRef.current = Date.now();
    
    // Auto-read the sentence in Full Coaching mode
    if (vg.shouldAutoSpeak && currentItem) {
      vg.autoReadText(currentItem.sentence);
    }

    // Start stall timer
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(() => {
      if (selectedOption === null && !firstInteractionRef.current) {
        vg.speakReminder();
      }
    }, 10000);

    return () => { if (stallTimerRef.current) clearTimeout(stallTimerRef.current); };
  }, [currentIndex]);

  // Fire completion once
  const completedRef = useRef(false);
  useEffect(() => {
    if (isComplete && results.length > 0 && !completedRef.current) {
      completedRef.current = true;
      onGameComplete(results);
    }
  }, [isComplete, results, onGameComplete]);

  const handleSelectOption = useCallback((index: number) => {
    if (phase !== 'answering' || selectedOption !== null) return;

    if (!firstInteractionRef.current) {
      firstInteractionRef.current = true;
      trialStartRef.current = Date.now();
    }

    setSelectedOption(index);
    const reactionTimeMs = Date.now() - trialStartRef.current;
    const result = submitAnswer(index, reactionTimeMs, usedHint);

    if (result) {
      setLastResult(result);
      setPhase('feedback');
      // Feed the unified adaptive controller — drives mid-game tier shifts
      adaptation.recordTrial({
        correct: result.correct,
        reactionTimeMs,
      });
      // Phase 2: cueLevel = 1 if first-letter hint was used, else 0.
      engagement.recordTrial({
        correct: result.correct,
        reactionTimeMs,
        timeout: false,
        cueLevel: usedHint ? 1 : 0,
        timestamp: Date.now(),
      });
    }
  }, [phase, selectedOption, usedHint, submitAnswer, adaptation]);

  const handleHint = useCallback(() => {
    if (!firstInteractionRef.current) {
      firstInteractionRef.current = true;
      trialStartRef.current = Date.now();
    }
    setUsedHint(true);
    setShowHint(true);
  }, []);

  // Proceed to explain or skip
  const handleProceedToExplain = useCallback(() => {
    setPhase('explaining');
  }, []);

  const handleSkipExplain = useCallback(() => {
    setExplainSkipCount(prev => prev + 1);
    if (lastResult) {
      onTrialComplete(lastResult);
    }
    nextItem();
  }, [nextItem, lastResult, onTrialComplete]);

  const handleExplainComplete = useCallback((explainResult: ExplainWhyResult) => {
    if (!explainResult.skipped) {
      setReasoningPoints(prev => prev + explainResult.score.score);
    } else {
      setExplainSkipCount(prev => prev + 1);
    }
    if (lastResult) {
      onTrialComplete({
        ...lastResult,
        points: lastResult.points + explainResult.score.score,
        explanation: explainResult.explanationData,
      });
    }
    nextItem();
  }, [nextItem, lastResult, onTrialComplete]);

  // Build summary data
  const summaryData = useMemo(() => {
    if (!isComplete || results.length === 0) return null;

    const correctCount = results.filter(r => r.correct).length;
    const accuracy = correctCount / results.length;
    const literalResults = results.filter(r => r.type === 'literal');
    const figurativeResults = results.filter(r => r.type === 'figurative');
    const literalCorrect = literalResults.filter(r => r.correct).length;
    const figurativeCorrect = figurativeResults.filter(r => r.correct).length;

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (literalResults.length > 0 && literalCorrect / literalResults.length >= 0.7) {
      strengths.push(`Strong literal comprehension (${literalCorrect}/${literalResults.length})`);
    }
    if (figurativeResults.length > 0 && figurativeCorrect / figurativeResults.length >= 0.7) {
      strengths.push(`Good figurative understanding (${figurativeCorrect}/${figurativeResults.length})`);
    }
    if (accuracy >= 0.8) {
      strengths.push('Consistently accurate across the exercise');
    }
    const noHintTrials = results.filter(r => !r.usedHint && r.correct).length;
    if (noHintTrials >= results.length * 0.5) {
      strengths.push('Strong independent performance without hints');
    }

    if (literalResults.length > 0 && literalCorrect / literalResults.length < 0.5) {
      weaknesses.push(`Literal meanings need more practice (${literalCorrect}/${literalResults.length})`);
    }
    if (figurativeResults.length > 0 && figurativeCorrect / figurativeResults.length < 0.5) {
      weaknesses.push(`Figurative meanings were challenging (${figurativeCorrect}/${figurativeResults.length})`);
    }
    if (results.filter(r => r.usedHint).length > results.length * 0.5) {
      weaknesses.push('Relied on hints frequently — try without next time');
    }

    if (strengths.length === 0) {
      strengths.push('You completed the full exercise — persistence matters');
    }

    const maya = buildReflection(accuracy);

    return {
      correctCount,
      accuracy,
      literalResults,
      figurativeResults,
      literalCorrect,
      figurativeCorrect,
      strengths,
      weaknesses,
      maya,
    };
  }, [isComplete, results, buildReflection]);

  // Summary screen
  if (!currentItem || isComplete) {
    if (!summaryData) return null;

    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Exercise Complete</h2>
          <p className="text-muted-foreground">
            {summaryData.correctCount}/{results.length} correct • {Math.round(summaryData.accuracy * 100)}% accuracy
          </p>
        </div>

        {/* Type breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-lg font-bold">
                {summaryData.literalCorrect}/{summaryData.literalResults.length}
              </div>
              <div className="text-xs text-muted-foreground">Literal</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-lg font-bold">
                {summaryData.figurativeCorrect}/{summaryData.figurativeResults.length}
              </div>
              <div className="text-xs text-muted-foreground">Figurative</div>
            </CardContent>
          </Card>
        </div>

        {reasoningPoints > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            🧠 Reasoning bonus: {reasoningPoints} pts
          </p>
        )}

        <StructuredFeedbackSummary
          strengths={summaryData.strengths}
          weaknesses={summaryData.weaknesses}
          nextStep={summaryData.maya.nextStep}
          mayaReflection={summaryData.maya.reflection}
          realLifeLine={summaryData.maya.realLifeLine}
        />
      </div>
    );
  }

  const progressPercent = (currentIndex / totalItems) * 100;

  // Determine explain-why presentation level based on skip count
  const explainLevel: 'full' | 'compact' | 'minimal' = 
    explainSkipCount < 3 ? 'full' : explainSkipCount < 6 ? 'compact' : 'minimal';

  return (
    <div className="max-w-lg mx-auto w-full my-auto space-y-2 sm:space-y-4">
      {/* Purpose banner on first trial only */}
      {currentIndex === 0 && (
        <ExercisePurposeBanner exerciseSlug="meaning-match" />
      )}

      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-muted-foreground">
          {currentIndex + 1} of {totalItems}
        </span>
        <div className="flex items-center gap-2">
          <LevelBadge descriptor={adaptation.levelDescriptor} compact />
          <AdaptationBadge direction={shiftDirection} reason={shiftReason} />
          <span className="text-sm text-muted-foreground">{totalPoints} pts</span>
        </div>
      </div>

      <Progress value={progressPercent} className="h-1.5" />

      {/* Sentence card — always visible, no gate */}
      <Card className="border-2 border-border/50">
        <CardContent className="pt-6">
          <p className="text-lg leading-relaxed">
            {showHint
              ? highlightSentence(currentItem.sentence, currentItem.keywords)
              : currentItem.sentence}
          </p>
          {currentItem.type === 'figurative' && (
            <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
              Figurative
            </span>
          )}
        </CardContent>
      </Card>

      {/* Answering phase — shown immediately, no reading gate */}
      {phase === 'answering' && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Pick the best meaning:</h3>

          <div className="space-y-2">
            {currentItem.options.map((option, i) => (
              <Button
                key={i}
                variant="outline"
                className="w-full text-left justify-start h-auto py-3 px-4 whitespace-normal"
                onClick={() => handleSelectOption(i)}
              >
                <span className="mr-3 font-bold text-muted-foreground">
                  {String.fromCharCode(65 + i)}.
                </span>
                {option}
              </Button>
            ))}
          </div>

          {!usedHint && (
            <Button variant="ghost" size="sm" onClick={handleHint} className="w-full text-muted-foreground">
              <Lightbulb className="h-4 w-4 mr-2" />
              {recommendedCueType === 'phonemic' 
                ? 'Show first letter hint (−5 bonus points)'
                : 'Highlight keywords (−5 bonus points)'}
            </Button>
          )}
          {!usedHint && recommendedCueType === 'full_word' && (
            <p className="text-xs text-muted-foreground text-center italic">
              💡 Try the hint if you need help — it's okay to use support.
            </p>
          )}
        </div>
      )}

      {/* Feedback phase — shows explanation + adaptive explain-why */}
      {phase === 'feedback' && lastResult && (
        <div className="space-y-3">
          <Card className={cn(
            "border-2",
            lastResult.correct
              ? "border-primary/50 bg-primary/5"
              : "border-destructive/50 bg-destructive/5"
          )}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2">
                {lastResult.correct
                  ? <CheckCircle className="h-5 w-5 text-primary" />
                  : <XCircle className="h-5 w-5 text-destructive" />}
                <span className="font-bold">
                  {lastResult.correct ? 'Correct' : 'Not quite'}
                </span>
                {lastResult.correct && (
                  <span className="ml-auto text-sm text-primary font-medium">
                    +{lastResult.points} pts
                  </span>
                )}
              </div>
              {!lastResult.correct && (
                <p className="text-sm">
                  <span className="font-medium">Answer:</span>{' '}
                  {currentItem.options[currentItem.correctIndex]}
                </p>
              )}
              {/* Model explanation — always shown */}
              <div className="flex items-start gap-2 pt-1 border-t border-border/30 mt-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">{currentItem.explanation}</p>
              </div>
            </CardContent>
          </Card>

          {/* Adaptive explain-why + Next */}
          <div className="flex gap-2">
            <Button onClick={handleSkipExplain} variant="outline" className="flex-1" size="lg">
              Next →
            </Button>
            {explainLevel === 'full' && (
              <Button onClick={handleProceedToExplain} variant="default" className="flex-1" size="lg">
                Explain why (bonus)
              </Button>
            )}
            {explainLevel === 'compact' && (
              <Button onClick={handleProceedToExplain} variant="ghost" size="sm" className="text-xs self-center">
                Explain why
              </Button>
            )}
            {explainLevel === 'minimal' && (
              <button
                onClick={handleProceedToExplain}
                className="text-xs text-muted-foreground underline self-center"
              >
                explain
              </button>
            )}
          </div>
        </div>
      )}

      {/* Explaining phase */}
      {phase === 'explaining' && currentItem && (
        <ExplainWhyPrompt
          wasCorrect={lastResult?.correct ?? false}
          correctAnswer={currentItem.options[currentItem.correctIndex]}
          keyConcepts={deriveKeyConcepts(currentItem.explanation, currentItem.keywords, undefined, currentItem.options[currentItem.correctIndex])}
          modelExplanation={currentItem.explanation}
          onComplete={handleExplainComplete}
        />
      )}
    </div>
  );
}
