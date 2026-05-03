/**
 * Semantic Feature Analysis v2 — Flagship Clinical Module
 * 
 * True SFA therapy loop:
 * 1. Present target → identify features by category
 * 2. Hide target → attempt retrieval using features as support
 * 3. Structured feedback on both features and retrieval
 * 4. Summary with feature-type breakdown + Maya reflection
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSemanticFeatureGame } from '@/hooks/useSemanticFeatureGame';
import { useExerciseDifficulty } from '@/hooks/useExerciseDifficulty';
import { useExerciseTelemetry } from '@/hooks/useExerciseTelemetry';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { narrateAdaptation, classifyReason } from '@/lib/adaptationNarrator';
import { AdaptationBadge, useAdaptationShift } from '@/components/AdaptationBadge';
import { LevelBadge } from '@/components/exercise/LevelBadge';
import { AdaptationNarrationCard } from '@/components/AdaptationNarrationCard';
import { useMayaExerciseFrame } from '@/hooks/useMayaExerciseFrame';
import { ExercisePurposeBanner } from '@/components/ExercisePurposeBanner';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { StructuredFeedbackSummary } from '@/components/StructuredFeedbackSummary';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Check, X, Eye, HelpCircle, ChevronRight } from 'lucide-react';
import { useGameSounds } from '@/hooks/useGameSounds';
import { PHOTO_BANK } from '@/data/photoBank';
import { SEMANTIC_TRIALS } from '@/data/semanticFeatureBank';
import { cn } from '@/lib/utils';
import { shuffleArray } from '@/lib/shuffle';

import type { ExerciseConfig } from '@/lib/clinicalProfileMapper';
import type { DifficultyBounds } from '@/lib/difficultyBounds';
import type { ExerciseAdaptation } from '@/lib/exerciseGating';
import type { SemanticFeatureTrial, SemanticFeature, FeatureCategory } from '@/data/semanticFeatureBank';

type TrialPhase = 'features' | 'retrieval' | 'feedback';

interface TrialResult {
  featuresCorrect: number;
  featuresMissed: number;
  featuresIncorrect: number;
  retrievalCorrect: boolean;
  featureBreakdown: Record<FeatureCategory, { hit: number; miss: number }>;
}

interface SemanticFeatureGameProps {
  totalTrials?: number;
  config: ExerciseConfig;
  bounds: DifficultyBounds;
  adaptations?: ExerciseAdaptation | null;
  customTrials?: SemanticFeatureTrial[];
  onTrialComplete?: (data: any) => void;
  onGameComplete?: (finalScore: number, totalTrials: number) => void;
  onDifficultyChange?: (newLevel: number) => void;
  userId?: string;
  sessionId?: string;
}

// Feature category labels for guided prompts
const CATEGORY_PROMPTS: Record<FeatureCategory, { label: string; icon: string; question: string }> = {
  categorical: { label: 'Category', icon: '🏷️', question: 'What group does it belong to?' },
  functional: { label: 'Use', icon: '🔧', question: 'What do you do with it?' },
  associative: { label: 'Location & Material', icon: '📍', question: 'Where is it found or what is it made of?' },
  perceptual: { label: 'Appearance', icon: '👁️', question: 'What does it look like?' },
  abstract: { label: 'Properties', icon: '💡', question: 'What else describes it?' },
};

function getRetrievalChoices(trial: SemanticFeatureTrial): string[] {
  const sameLevel = SEMANTIC_TRIALS.filter(
    t => t.word !== trial.word && Math.abs(t.difficulty - trial.difficulty) <= 1
  );
  const distractors = shuffleArray(sameLevel).slice(0, 3).map(t => t.word);
  // Ensure we have 3 distractors
  while (distractors.length < 3) {
    const fallback = shuffleArray(SEMANTIC_TRIALS.filter(t => t.word !== trial.word && !distractors.includes(t.word)));
    if (fallback.length > 0) distractors.push(fallback[0].word);
    else break;
  }
  return shuffleArray([trial.word, ...distractors]);
}

function groupFeaturesByCategory(features: SemanticFeature[]): Map<FeatureCategory, SemanticFeature[]> {
  const map = new Map<FeatureCategory, SemanticFeature[]>();
  for (const f of features) {
    if (!map.has(f.category)) map.set(f.category, []);
    map.get(f.category)!.push(f);
  }
  return map;
}

function analyzeTrialResult(
  selectedFeatures: Set<string>,
  options: SemanticFeature[],
  trial: SemanticFeatureTrial,
  retrievalCorrect: boolean
): TrialResult {
  const correctSet = new Set(trial.correctFeatures.map(f => f.text));
  const selectedArray = options.filter(f => selectedFeatures.has(f.text));
  const correctHits = selectedArray.filter(f => correctSet.has(f.text));
  const missed = trial.correctFeatures.filter(f => !selectedFeatures.has(f.text));
  const incorrect = selectedArray.filter(f => !correctSet.has(f.text));

  // Breakdown by category
  const breakdown: Record<FeatureCategory, { hit: number; miss: number }> = {
    perceptual: { hit: 0, miss: 0 },
    functional: { hit: 0, miss: 0 },
    categorical: { hit: 0, miss: 0 },
    associative: { hit: 0, miss: 0 },
    abstract: { hit: 0, miss: 0 },
  };
  for (const f of correctHits) breakdown[f.category].hit++;
  for (const f of missed) breakdown[f.category].miss++;

  return {
    featuresCorrect: correctHits.length,
    featuresMissed: missed.length,
    featuresIncorrect: incorrect.length,
    retrievalCorrect,
    featureBreakdown: breakdown,
  };
}

export const SemanticFeatureGame = ({
  totalTrials = 10,
  config,
  bounds,
  adaptations,
  customTrials,
  onTrialComplete,
  onGameComplete,
  onDifficultyChange,
  userId,
  sessionId,
}: SemanticFeatureGameProps) => {
  const { saveLevel } = useExerciseDifficulty(userId, undefined, 'semantic-features');
  const { startTrial, logTrial, calculateReactionTime } = useExerciseTelemetry(sessionId || null, 'semantic-features');
  const { playSuccess, playError, playLevelUp } = useGameSounds();
  const { buildReflection } = useMayaExerciseFrame({ exerciseSlug: 'semantic-features' });
  const vg = useVoiceGuidance('semantic-feature-analysis');

  // Speak intro on first mount in Full Coaching mode
  const hasSpokenSFAIntroRef = useRef(false);
  useEffect(() => {
    if (!hasSpokenSFAIntroRef.current && vg.shouldAutoSpeak) {
      hasSpokenSFAIntroRef.current = true;
      vg.speakIntro();
    }
  }, [vg.shouldAutoSpeak]);

  const game = useSemanticFeatureGame(totalTrials, config.startDifficulty || 1, customTrials);

  // Visible adaptation cue + narration
  const { direction: shiftDirection, reason: shiftReason, signal: signalShift } = useAdaptationShift();

  // Engagement monitor — feeds the cue-dependency safety gate.
  const engagement = useEngagementMonitor(sessionId ?? null);

  const adaptation = useInGameAdaptation({
    exerciseSlug: 'semantic-features',
    sessionId: sessionId ?? null,
    initialDifficulty: config.startDifficulty || 1,
    bounds,
    enableDifficultyToasts: false,
    enableAutoHints: false,
    // SFA cue dependency = how reliant the user is on the visible feature
    // options (the scaffolding) to retrieve the target word.
    getCueDependencyScore: () => engagement.getState().signals.cueDependency,
    onEscalationBlocked: ({ reason, cueDependencyScore, trialsAtLevel }) => {
      console.info('[SemanticFeature] escalation blocked', {
        reason,
        cueDependencyScore,
        trialsAtLevel,
      });
    },
    onDifficultyChange: (newLevel, reason, dir) => {
      saveLevel(newLevel);
      playLevelUp();
      // Swap upcoming trials to new tier WITHOUT resetting score/progress
      game.setActiveDifficulty(newLevel);
      onDifficultyChange?.(newLevel);
      const narration = narrateAdaptation({
        direction: dir,
        reasonKind: classifyReason(reason),
      });
      signalShift(dir, narration || reason);
    },
  });
  const currentDifficulty = adaptation.currentDifficulty;

  // Trial-level state
  const [phase, setPhase] = useState<TrialPhase>('features');
  const [retrievalChoices, setRetrievalChoices] = useState<string[]>([]);
  const [retrievalAnswer, setRetrievalAnswer] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<TrialResult | null>(null);
  const [trialResults, setTrialResults] = useState<TrialResult[]>([]);
  const [showPurpose, setShowPurpose] = useState(true);

  // Stall timer for voice reminder
  const stallTimerSFARef = useRef<NodeJS.Timeout | null>(null);

  // Reset phase when trial changes
  useEffect(() => {
    if (!game.completed && !game.showFeedback) {
      setPhase('features');
      setRetrievalAnswer(null);
      setCurrentResult(null);
      startTrial();
      
      // Stall timer
      if (stallTimerSFARef.current) clearTimeout(stallTimerSFARef.current);
      stallTimerSFARef.current = setTimeout(() => {
        if (!game.completed && !game.showFeedback) {
          vg.speakReminder();
        }
      }, 12000);
    }
    return () => { if (stallTimerSFARef.current) clearTimeout(stallTimerSFARef.current); };
  }, [game.currentTrial, game.completed]);

  // Generate retrieval choices when entering retrieval phase
  const trial = game.getCurrentTrial();

  const handleSubmitFeatures = useCallback(() => {
    if (game.selectedFeatures.size === 0) return;

    // Move to retrieval phase
    if (trial) {
      setRetrievalChoices(getRetrievalChoices(trial));
    }
    setPhase('retrieval');
    // Hide purpose after first trial
    setShowPurpose(false);
  }, [game.selectedFeatures.size, trial]);

  const handleRetrievalAnswer = useCallback((word: string) => {
    if (!trial || retrievalAnswer) return;
    setRetrievalAnswer(word);

    const isRetrievalCorrect = word.toLowerCase() === trial.word.toLowerCase();

    // Now submit the feature answer too
    const featureResult = game.submitAnswer();
    const reactionTime = calculateReactionTime();

    const result = analyzeTrialResult(
      game.selectedFeatures,
      game.currentOptions,
      trial,
      isRetrievalCorrect
    );
    setCurrentResult(result);
    setTrialResults(prev => [...prev, result]);

    // Overall success = features mostly right + retrieval correct
    const overallCorrect = featureResult.correct && isRetrievalCorrect;

    // ── cueLevel reflects scaffolding actually used ─────────────────────
    // SFA features ARE the cue scaffolding. Level the user's reliance:
    //   0 = retrieved with no/very few features selected (independent)
    //   1 = retrieved with some features selected (light cue use)
    //   2 = retrieved with most features selected (heavy cue use)
    const totalFeatures = trial.correctFeatures.length || 1;
    const usedRatio = result.featuresCorrect / totalFeatures;
    const sfaCueLevel = usedRatio >= 0.7 ? 2 : usedRatio >= 0.3 ? 1 : 0;

    // Feed adaptive engine (rolling window + safety gate)
    adaptation.recordTrial({
      correct: overallCorrect,
      reactionTimeMs: reactionTime,
      cueWasShown: sfaCueLevel > 0,
    });

    // Feed engagement monitor (cue dependency + fatigue + frustration)
    engagement.recordTrial({
      correct: overallCorrect,
      reactionTimeMs: reactionTime,
      cueLevel: sfaCueLevel,
      timeout: false,
      timestamp: Date.now(),
    });

    if (overallCorrect) playSuccess();
    else if (isRetrievalCorrect) playSuccess(); // partial success
    else playError();

    logTrial({
      correct: overallCorrect,
      reactionTimeMs: reactionTime,
      cueLevel: sfaCueLevel,
      errorType: overallCorrect ? null : 'semantic_error',
      taskParameters: {
        difficulty: currentDifficulty,
        word: trial.word,
        features_correct: result.featuresCorrect,
        features_missed: result.featuresMissed,
        features_incorrect: result.featuresIncorrect,
        retrieval_correct: isRetrievalCorrect,
        feature_breakdown: result.featureBreakdown,
      },
      adaptationsActive: adaptations ? {
        extended_time: adaptations.adaptations.extendedTimeouts || false,
        audio_cues: adaptations.adaptations.useAudioCues || false,
        high_contrast: adaptations.adaptations.highContrast || false,
        larger_targets: adaptations.adaptations.largeTargets || false,
      } : undefined,
    });

    onTrialComplete?.({
      correct: overallCorrect,
      reactionTime,
      cueLevel: sfaCueLevel,
      featureBreakdown: result.featureBreakdown,
      retrievalCorrect: isRetrievalCorrect,
    });

    setPhase('feedback');
  }, [trial, retrievalAnswer, game, calculateReactionTime, currentDifficulty, adaptations, adaptation, engagement, logTrial, onTrialComplete, playSuccess, playError]);

  const handleNext = useCallback(() => {
    // useInGameAdaptation has already applied any difficulty change via
    // onDifficultyChange (which calls game.setActiveDifficulty). Just advance.
    game.nextTrial(adaptation.currentDifficulty);
  }, [game, adaptation.currentDifficulty]);

  // Completion
  useEffect(() => {
    if (game.completed && onGameComplete) {
      onGameComplete(game.score, totalTrials);
    }
  }, [game.completed, game.score, totalTrials, onGameComplete]);

  if (!trial) return null;

  const photo = PHOTO_BANK.find(p => p.category === trial.imageCategory);
  const photoPath = photo ? photo.imageUrl : null;

  // ── Summary screen ──
  if (game.completed) {
    const totalFeatureHits = trialResults.reduce((s, r) => s + r.featuresCorrect, 0);
    const totalFeatureMisses = trialResults.reduce((s, r) => s + r.featuresMissed, 0);
    const totalRetrievals = trialResults.filter(r => r.retrievalCorrect).length;
    const accuracy = trialResults.length > 0 ? totalRetrievals / trialResults.length : 0;
    const maya = buildReflection(accuracy);

    // Aggregate feature breakdown
    const aggBreakdown: Record<string, { hit: number; miss: number }> = {};
    for (const r of trialResults) {
      for (const [cat, { hit, miss }] of Object.entries(r.featureBreakdown)) {
        if (!aggBreakdown[cat]) aggBreakdown[cat] = { hit: 0, miss: 0 };
        aggBreakdown[cat].hit += hit;
        aggBreakdown[cat].miss += miss;
      }
    }

    // Build strengths/weaknesses from breakdown
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (totalRetrievals >= trialResults.length * 0.7) {
      strengths.push(`Named ${totalRetrievals} of ${trialResults.length} items correctly`);
    } else {
      weaknesses.push(`Named ${totalRetrievals} of ${trialResults.length} items — retrieval needs practice`);
    }

    for (const [cat, { hit, miss }] of Object.entries(aggBreakdown)) {
      const total = hit + miss;
      if (total === 0) continue;
      const prompt = CATEGORY_PROMPTS[cat as FeatureCategory];
      if (hit >= total * 0.7) {
        strengths.push(`Strong at identifying ${prompt?.label.toLowerCase() || cat} features`);
      } else if (miss > hit) {
        weaknesses.push(`${prompt?.label || cat} features were often missed`);
      }
    }

    if (strengths.length === 0) strengths.push('Completed all trials — consistency builds skill');

    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="text-center space-y-2">
          <div className="text-4xl">🧠</div>
          <h2 className="text-xl font-bold">Session Complete</h2>
          <div className="flex justify-center gap-4 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{totalRetrievals}/{trialResults.length}</div>
              <div className="text-muted-foreground">Words retrieved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{totalFeatureHits}</div>
              <div className="text-muted-foreground">Features identified</div>
            </div>
          </div>
        </div>

        {/* Feature type breakdown */}
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-medium mb-2">Feature Breakdown</h3>
            <div className="space-y-1.5">
              {Object.entries(aggBreakdown)
                .filter(([, { hit, miss }]) => hit + miss > 0)
                .map(([cat, { hit, miss }]) => {
                  const prompt = CATEGORY_PROMPTS[cat as FeatureCategory];
                  const total = hit + miss;
                  const pct = total > 0 ? Math.round((hit / total) * 100) : 0;
                  return (
                    <div key={cat} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-center">{prompt?.icon}</span>
                      <span className="flex-1 text-foreground/80">{prompt?.label}</span>
                      <div className="w-24">
                        <Progress value={pct} className="h-2" />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        <StructuredFeedbackSummary
          strengths={strengths}
          weaknesses={weaknesses}
          nextStep={maya.nextStep}
          mayaReflection={maya.reflection}
          realLifeLine={maya.realLifeLine}
        />

        <Button
          size="lg"
          className="w-full min-h-[48px]"
          onClick={() => window.dispatchEvent(new CustomEvent('exercise-complete'))}
        >
          Continue
        </Button>
      </div>
    );
  }

  // ── Active trial ──
  const groupedOptions = groupFeaturesByCategory(game.currentOptions);
  const correctSet = new Set(trial.correctFeatures.map(f => f.text));

  return (
    <div className="space-y-3 max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex justify-between items-center text-xs">
        <span className="text-muted-foreground">{game.currentTrial + 1} of {totalTrials}</span>
        <div className="flex gap-2 items-center">
          <Badge variant="outline" className="text-xs">Lv {currentDifficulty}</Badge>
          <span className="font-medium text-foreground/80">{game.score} correct</span>
        </div>
      </div>
      <Progress value={game.progress} className="h-1.5" />

      {/* Visible adaptation cue + narration */}
      {shiftDirection && (
        <div className="space-y-2">
          <div className="flex justify-center">
            <AdaptationBadge direction={shiftDirection} reason={shiftReason} />
          </div>
          <AdaptationNarrationCard direction={shiftDirection} message={shiftReason} />
        </div>
      )}

      {/* Purpose banner — first trial only */}
      {showPurpose && game.currentTrial === 0 && (
        <ExercisePurposeBanner exerciseSlug="semantic-features" />
      )}

      {/* ── PHASE: FEATURES ── */}
      {phase === 'features' && (
        <>
          {/* Target */}
          <div className="flex flex-col items-center gap-2 py-2">
            {photoPath && (
              <img src={photoPath} alt={trial.word} className="w-28 h-28 sm:w-36 sm:h-36 object-cover rounded-lg shadow-md" />
            )}
            <div className="text-3xl font-bold text-primary">{trial.word}</div>
            <p className="text-sm text-muted-foreground text-center">
              Select the features that describe this word
            </p>
          </div>

          {/* Features organized by category */}
          <div className="space-y-3">
            {Array.from(groupedOptions.entries()).map(([category, features]) => {
              const prompt = CATEGORY_PROMPTS[category];
              return (
                <div key={category}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-sm">{prompt.icon}</span>
                    <span className="text-xs font-medium text-muted-foreground">{prompt.question}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {features.map(feature => {
                      const isSelected = game.isFeatureSelected(feature.text);
                      return (
                        <button
                          key={feature.text}
                          onClick={() => game.toggleFeature(feature.text)}
                          className={cn(
                            "px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium min-h-[44px]",
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50 hover:bg-accent'
                          )}
                        >
                          {feature.text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            onClick={handleSubmitFeatures}
            disabled={game.selectedFeatures.size === 0}
            size="lg"
            className="w-full min-h-[48px]"
          >
            I've selected the features <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </>
      )}

      {/* ── PHASE: RETRIEVAL ── */}
      {phase === 'retrieval' && (
        <>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-4 text-center space-y-2">
              <Eye className="h-6 w-6 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">What is this item?</h3>
              <p className="text-sm text-muted-foreground">
                Use the features you identified to find the word
              </p>
              {/* Show selected features as support cues */}
              <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                {game.currentOptions
                  .filter(f => game.isFeatureSelected(f.text))
                  .map(f => (
                    <Badge key={f.text} variant="secondary" className="text-xs">
                      {f.text}
                    </Badge>
                  ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            {retrievalChoices.map(word => (
              <Button
                key={word}
                variant="outline"
                className="min-h-[56px] text-lg font-semibold"
                onClick={() => handleRetrievalAnswer(word)}
                disabled={!!retrievalAnswer}
              >
                {word}
              </Button>
            ))}
          </div>
        </>
      )}

      {/* ── PHASE: FEEDBACK ── */}
      {phase === 'feedback' && currentResult && (
        <>
          {/* Retrieval result */}
          <div className={cn(
            "p-4 rounded-lg text-center space-y-1",
            currentResult.retrievalCorrect
              ? 'bg-primary/5 border border-primary/20'
              : 'bg-destructive/5 border border-destructive/20'
          )}>
            <div className="flex items-center justify-center gap-2">
              {currentResult.retrievalCorrect ? (
                <Check className="h-5 w-5 text-primary" />
              ) : (
                <X className="h-5 w-5 text-destructive" />
              )}
              <span className="font-semibold text-lg">
                {currentResult.retrievalCorrect ? trial.word : `The word was: ${trial.word}`}
              </span>
            </div>
            {currentResult.retrievalCorrect ? (
              <p className="text-sm text-muted-foreground">
                You retrieved the word using its features
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                The features can help you remember next time
              </p>
            )}
          </div>

          {/* Feature accuracy */}
          <div className="text-sm space-y-1 px-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5" />
              Features: {currentResult.featuresCorrect} correct, {currentResult.featuresMissed} missed
              {currentResult.featuresIncorrect > 0 && `, ${currentResult.featuresIncorrect} incorrect`}
            </div>
          </div>

          {/* Show correct features with check/x */}
          <div className="grid grid-cols-2 gap-1.5">
            {game.currentOptions.map(feature => {
              const isSelected = game.isFeatureSelected(feature.text);
              const isCorrect = correctSet.has(feature.text);
              let style = 'border-border opacity-40';
              if (isCorrect && isSelected) style = 'border-primary bg-primary/10 text-primary';
              else if (isCorrect && !isSelected) style = 'border-primary/30 bg-primary/5 text-primary/60';
              else if (!isCorrect && isSelected) style = 'border-destructive bg-destructive/5 text-destructive';

              return (
                <div
                  key={feature.text}
                  className={cn("px-3 py-2 rounded-lg border text-sm flex items-center justify-between", style)}
                >
                  <span>{feature.text}</span>
                  {isCorrect && isSelected && <Check className="h-3.5 w-3.5" />}
                  {isCorrect && !isSelected && <Check className="h-3.5 w-3.5 opacity-50" />}
                  {!isCorrect && isSelected && <X className="h-3.5 w-3.5" />}
                </div>
              );
            })}
          </div>

          <Button onClick={handleNext} size="lg" className="w-full min-h-[48px]">
            Next
          </Button>
        </>
      )}
    </div>
  );
};
