/**
 * Sentence Construction v2
 * 
 * Grammar and syntax exercise with:
 * - Purpose framing + Maya integration
 * - Speech-first with tile fallback (preserved)
 * - Grammar-aware feedback explaining WHY the correct structure works
 * - Structured summary with grammar-type breakdown
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CardContent } from "@/components/ui/card";
import type { ExerciseConfig } from '@/lib/clinicalProfileMapper';
import type { DifficultyBounds } from '@/lib/difficultyBounds';
import {
  CheckCircle2,
  XCircle,
  Volume2,
  RotateCcw,
  ArrowRight,
  Trash2,
  Lightbulb,
  Mic,
  MicOff,
  Keyboard
} from "lucide-react";
import { useSentenceGame } from "@/hooks/useSentenceGame";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useMayaExerciseFrame } from "@/hooks/useMayaExerciseFrame";
import { useVoiceGuidance } from "@/hooks/useVoiceGuidance";
import { useInGameAdaptation } from "@/hooks/useInGameAdaptation";
import { LevelBadge } from "@/components/exercise/LevelBadge";
import { ExercisePurposeBanner } from "@/components/ExercisePurposeBanner";
import { StructuredFeedbackSummary } from "@/components/StructuredFeedbackSummary";
import { cn } from "@/lib/utils";
import { useKidsMode } from "@/contexts/KidsModeContext";
import { getKidsPraise, getKidsGrammarLabel } from "@/data/kidsContent";
import { KidsCelebration } from "@/components/KidsCelebration";
import { KidsStarMeter } from "@/components/KidsStarMeter";

interface SentenceConstructionGameProps {
  config: ExerciseConfig;
  bounds: DifficultyBounds;
  difficultyLevel: number;
  focusPhonemes?: string[];
  adaptations?: ExerciseAdaptation | null;
  sessionId?: string | null;
  onTrialComplete?: (data: {
    correct: boolean;
    reactionTime: number;
    errorType: string | null;
    grammarFocus: string;
    trialSource: 'graded_sentence_bank' | 'standard_sentence_bank';
    /** True if patient played the model audio (hint) on this trial. */
    hintUsed: boolean;
    /** Engine difficulty (1–10) at the moment the trial fired. */
    difficulty: number;
  }) => void;
  onGameComplete?: (finalScore: number, totalTrials: number) => void;
}

interface ExerciseAdaptation {
  exerciseId: string;
  adaptations: {
    useAudioCues?: boolean;
    eliminateText?: boolean;
    simplifiedUI?: boolean;
    extendedTimeouts?: boolean;
    largeTargets?: boolean;
    highContrast?: boolean;
  };
  reason: string;
}

// Grammar focus display labels and explanations
const GRAMMAR_LABELS: Record<string, { label: string; explanation: string }> = {
  'SVO': { label: 'Word Order', explanation: 'Subject → Verb → Object is the basic sentence pattern' },
  'articles': { label: 'Articles', explanation: 'Words like "the," "a," and "an" help specify nouns' },
  'past_tense': { label: 'Past Tense', explanation: 'Past tense verbs describe what already happened' },
  'present_tense': { label: 'Present Tense', explanation: 'Present tense describes what is happening now' },
  'future_tense': { label: 'Future Tense', explanation: 'Future tense describes what will happen' },
  'pronouns': { label: 'Pronouns', explanation: 'Words like "he," "she," "they" replace names' },
  'prepositions': { label: 'Prepositions', explanation: 'Words like "on," "in," "under" show location or direction' },
  'conjunctions': { label: 'Joining Words', explanation: 'Words like "and," "but," "because" connect ideas' },
  'adjectives': { label: 'Describing Words', explanation: 'Adjectives describe nouns — what something looks like, how it feels' },
  'adverbs': { label: 'Adverbs', explanation: 'Words that describe how, when, or where something happens' },
  'questions': { label: 'Questions', explanation: 'Questions rearrange word order to ask for information' },
  'negation': { label: 'Negation', explanation: '"Not," "don\'t," "won\'t" — making sentences negative' },
  'passive_voice': { label: 'Passive Voice', explanation: 'The object comes first: "The ball was kicked by the boy"' },
  'relative_clauses': { label: 'Relative Clauses', explanation: 'Extra detail added with "who," "which," "that"' },
  'compound': { label: 'Compound Sentences', explanation: 'Two ideas joined together in one sentence' },
  'complex': { label: 'Complex Sentences', explanation: 'Main idea + supporting detail' },
};

function getGrammarLabel(focus: string): string {
  return GRAMMAR_LABELS[focus]?.label || focus.replace(/_/g, ' ');
}

function getGrammarExplanation(focus: string): string {
  return GRAMMAR_LABELS[focus]?.explanation || '';
}

// Track grammar performance across trials
interface GrammarStats {
  focus: string;
  correct: number;
  incorrect: number;
}

export const SentenceConstructionGame = ({
  config,
  bounds,
  difficultyLevel,
  focusPhonemes = [],
  adaptations,
  sessionId,
  onTrialComplete,
  onGameComplete
}: SentenceConstructionGameProps) => {
  const {
    currentTrial,
    trials,
    currentAnswer,
    score,
    completed,
    showFeedback,
    feedbackCorrect,
    getCurrentTrial,
    selectWord,
    removeLastWord,
    clearAnswer,
    submitAnswer,
    nextTrial,
    setActiveDifficulty,
    getWeakestGrammarArea,
    getAnswerAsWords
  } = useSentenceGame(10, difficultyLevel, focusPhonemes);

  // In-Game Adaptation: drives mid-session level shifts based on performance.
  // Publishes the canonical 1–10 game_level to the adaptive level registry,
  // and triggers content repooling when the level changes.
  const setActiveDifficultyRef = useRef<((lvl: number) => void) | null>(null);
  const prevLevelLogRef = useRef<number>(difficultyLevel);
  useEffect(() => {
    setActiveDifficultyRef.current = setActiveDifficulty;
  }, [setActiveDifficulty]);

  const {
    currentDifficulty,
    levelDescriptor: scLevelDescriptor,
    recordTrial: recordAdaptiveTrial,
  } = useInGameAdaptation({
    exerciseSlug: 'sentence_construction',
    sessionId: sessionId || null,
    initialDifficulty: difficultyLevel,
    bounds,
    windowSize: 5,
    targetSuccessRate: 0.75,
    enableDifficultyAutoStepDown: true,
    enableDifficultyToasts: false,
    enableAutoHints: false,
    // Wave 2: page owns the unified trial writer via useTrialSubmission and
    // tags every trial with trialMode='production'. Disabling the auto-logger
    // here prevents untagged duplicate rows from polluting mastery routing.
    autoLog: false,
    onDifficultyChange: (newLvl, reason) => {
      setActiveDifficultyRef.current?.(newLvl);
      if (import.meta.env.DEV) {
        console.log(`[SentenceConstruction] L${prevLevelLogRef.current} → L${newLvl}, reason: ${reason}`);
        prevLevelLogRef.current = newLvl;
      }
    },
  });

  const { speak, stop, isSpeaking, isLoading } = useTextToSpeech();
  const { buildReflection } = useMayaExerciseFrame({ exerciseSlug: 'sentence-construction' });
  const vg = useVoiceGuidance('sentence-construction');

  // Speak intro on first mount in Full Coaching mode
  const hasSpokenSCIntroRef = useRef(false);
  useEffect(() => {
    if (!hasSpokenSCIntroRef.current && vg.shouldAutoSpeak) {
      hasSpokenSCIntroRef.current = true;
      vg.speakIntro();
    }
  }, [vg.shouldAutoSpeak]);

  // Stall timer for voice reminder
  const stallTimerSCRef = useRef<NodeJS.Timeout | null>(null);

  const [trialStartTime, setTrialStartTime] = useState<number>(Date.now());
  const [hintUsed, setHintUsed] = useState(false);
  const { kidsMode } = useKidsMode();
  // Kids default to tactile word tiles — voice-first assumes a mic-permission
  // flow and reading of status text that young kids can't navigate alone.
  const [showTiles, setShowTiles] = useState(kidsMode);
  // Pick praise once per trial so it doesn't reroll on re-renders.
  const kidsPraise = useMemo(() => getKidsPraise(), [currentTrial]);
  const [spokenSentence, setSpokenSentence] = useState<string | null>(null);
  const hasProcessedSpeechRef = useRef(false);
  /** Guards against double-write of trial events (e.g. user taps Submit while
   *  the speech-recognition auto-submit is also firing). Reset per trial. */
  const trialCompletedRef = useRef(false);
  const [showPurpose, setShowPurpose] = useState(true);
  const [grammarStats, setGrammarStats] = useState<GrammarStats[]>([]);

  const trial = getCurrentTrial();

  // === Speech Recognition ===
  const handleSpeechResult = useCallback((transcript: string) => {
    if (hasProcessedSpeechRef.current) return;
    setSpokenSentence(transcript);
  }, []);

  const {
    isListening,
    startListening,
    stopListening,
    isSupported: speechSupported,
  } = useSpeechRecognition({
    onResult: handleSpeechResult,
    patientMode: true,
    continuousListening: true,
    discourseMode: true,
    autoStart: false,
  });

  useEffect(() => {
    setTrialStartTime(Date.now());
    setHintUsed(false);
    setSpokenSentence(null);
    hasProcessedSpeechRef.current = false;
    trialCompletedRef.current = false;
    stop();
    if (trial?.modelAudio && !completed) {
      const timer = setTimeout(() => { speak(trial.modelAudio!); }, 300);
      
      // Stall timer
      if (stallTimerSCRef.current) clearTimeout(stallTimerSCRef.current);
      stallTimerSCRef.current = setTimeout(() => {
        if (!completed && !showFeedback) {
          vg.speakReminder();
        }
      }, 12000);
      
      return () => { 
        clearTimeout(timer); 
        if (stallTimerSCRef.current) clearTimeout(stallTimerSCRef.current);
      };
    }
  }, [currentTrial, completed]);

  useEffect(() => {
    if (!isSpeaking && !isLoading && trial && !completed && !showFeedback && speechSupported && !showTiles) {
      const timer = setTimeout(() => {
        if (!hasProcessedSpeechRef.current) startListening();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isSpeaking, isLoading, trial, completed, showFeedback, speechSupported, showTiles, startListening]);

  useEffect(() => {
    if (completed && onGameComplete) {
      onGameComplete(score, trials.length);
    }
  }, [completed]);

  const recordGrammarResult = useCallback((focus: string, correct: boolean) => {
    setGrammarStats(prev => {
      const existing = prev.find(s => s.focus === focus);
      if (existing) {
        return prev.map(s => s.focus === focus
          ? { ...s, correct: s.correct + (correct ? 1 : 0), incorrect: s.incorrect + (correct ? 0 : 1) }
          : s
        );
      }
      return [...prev, { focus, correct: correct ? 1 : 0, incorrect: correct ? 0 : 1 }];
    });
  }, []);

  const submitSpokenSentence = useCallback(() => {
    if (!trial || !spokenSentence || hasProcessedSpeechRef.current) return;
    hasProcessedSpeechRef.current = true;
    stopListening();

    const spokenWords = spokenSentence.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const usedIndices = new Set<number>();
    const mappedIndices: number[] = [];

    for (const spoken of spokenWords) {
      let bestIdx = -1;
      for (let i = 0; i < trial.options.length; i++) {
        if (usedIndices.has(i)) continue;
        if (trial.options[i].toLowerCase() === spoken) { bestIdx = i; break; }
      }
      if (bestIdx >= 0) { mappedIndices.push(bestIdx); usedIndices.add(bestIdx); }
    }

    if (mappedIndices.length > 0) {
      clearAnswer();
      mappedIndices.forEach(idx => selectWord(idx));
    }

    setTimeout(() => {
      const result = submitAnswer();
      if (!result) return;
      const reactionTime = Date.now() - trialStartTime;
      if (trial?.modelAudio) speak(trial.modelAudio);
      recordGrammarResult(result.trial.grammarFocus, result.correct);
      setShowPurpose(false);
      // Feed the adaptive engine — drives mid-session level shifts + telemetry.
      recordAdaptiveTrial({ correct: result.correct, reactionTimeMs: reactionTime });
      if (onTrialComplete && !trialCompletedRef.current) {
        trialCompletedRef.current = true;
        onTrialComplete({
          correct: result.correct,
          reactionTime,
          errorType: result.errorAnalysis.errorType,
          grammarFocus: result.trial.grammarFocus,
          trialSource: result.trial.id.startsWith('graded-') ? 'graded_sentence_bank' : 'standard_sentence_bank',
          hintUsed,
          difficulty: currentDifficulty,
        });
      }
    }, 300);
  }, [trial, spokenSentence, stopListening, clearAnswer, selectWord, submitAnswer, trialStartTime, onTrialComplete, speak, recordGrammarResult, recordAdaptiveTrial]);

  useEffect(() => {
    if (spokenSentence && !isListening && !hasProcessedSpeechRef.current) {
      const timer = setTimeout(() => submitSpokenSentence(), 600);
      return () => clearTimeout(timer);
    }
  }, [spokenSentence, isListening, submitSpokenSentence]);

  const handleHint = () => {
    setHintUsed(true);
    if (trial?.modelAudio) speak(trial.modelAudio);
  };

  const handlePlayAudio = () => {
    if (trial?.modelAudio) speak(trial.modelAudio);
  };

  const handleSubmit = () => {
    const result = submitAnswer();
    if (!result) return;
    const reactionTime = Date.now() - trialStartTime;
    if (trial?.modelAudio) speak(trial.modelAudio);
    recordGrammarResult(result.trial.grammarFocus, result.correct);
    setShowPurpose(false);
    // Feed the adaptive engine — drives mid-session level shifts + telemetry.
    recordAdaptiveTrial({ correct: result.correct, reactionTimeMs: reactionTime });
    if (onTrialComplete && !trialCompletedRef.current) {
      trialCompletedRef.current = true;
      onTrialComplete({
        correct: result.correct,
        reactionTime,
        errorType: result.errorAnalysis.errorType,
        grammarFocus: result.trial.grammarFocus,
        trialSource: result.trial.id.startsWith('graded-') ? 'graded_sentence_bank' : 'standard_sentence_bank',
        hintUsed,
        difficulty: currentDifficulty,
      });
    }
  };

  const handleNext = () => {
    setShowTiles(false);
    nextTrial(difficultyLevel);
  };

  const getAvailableWords = (): Array<{ word: string; index: number }> => {
    if (!trial) return [];
    return trial.options
      .map((word, index) => ({ word, index }))
      .filter(item => !currentAnswer.includes(item.index));
  };

  const answerWords = getAnswerAsWords();

  if (!trial) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground">Loading...</p>
      </Card>
    );
  }

  // ── Summary screen ──
  if (completed) {
    const accuracy = trials.length > 0 ? score / trials.length : 0;
    const weakestArea = getWeakestGrammarArea();
    const maya = buildReflection(accuracy);

    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // Grammar breakdown analysis
    const strongAreas = grammarStats.filter(s => s.correct > 0 && s.incorrect === 0);
    const weakAreas = grammarStats.filter(s => s.incorrect > s.correct);
    const mixedAreas = grammarStats.filter(s => s.correct > 0 && s.incorrect > 0 && s.correct >= s.incorrect);

    if (strongAreas.length > 0) {
      strengths.push(`Strong with: ${strongAreas.map(s => getGrammarLabel(s.focus)).join(', ')}`);
    }
    if (accuracy >= 0.7) {
      strengths.push(`${Math.round(accuracy * 100)}% accuracy — consistent sentence building`);
    }
    if (mixedAreas.length > 0) {
      strengths.push(`Improving: ${mixedAreas.map(s => getGrammarLabel(s.focus)).join(', ')}`);
    }

    if (weakAreas.length > 0) {
      weaknesses.push(`Needs practice: ${weakAreas.map(s => getGrammarLabel(s.focus)).join(', ')}`);
      const weakExplanations = weakAreas
        .map(s => getGrammarExplanation(s.focus))
        .filter(Boolean)
        .slice(0, 1);
      if (weakExplanations.length > 0) {
        weaknesses.push(`Tip: ${weakExplanations[0]}`);
      }
    }

    if (strengths.length === 0) strengths.push(`Completed ${trials.length} sentences — building consistency`);

    return (
      <div className="space-y-4 max-w-lg mx-auto">
        <div className="text-center space-y-2">
          <div className="text-4xl">📝</div>
          <h2 className="text-xl font-bold">Session Complete</h2>
          <p className="text-2xl font-bold text-primary">{score} / {trials.length}</p>
        </div>

        {/* Grammar breakdown */}
        {grammarStats.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <h3 className="text-sm font-medium mb-2">Grammar Breakdown</h3>
              <div className="space-y-1.5">
                {grammarStats.map(({ focus, correct, incorrect }) => {
                  const total = correct + incorrect;
                  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                  return (
                    <div key={focus} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 text-foreground/80">{getGrammarLabel(focus)}</span>
                      <div className="w-20">
                        <Progress value={pct} className="h-2" />
                      </div>
                      <span className="text-xs text-muted-foreground w-14 text-right">
                        {correct}/{total}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <StructuredFeedbackSummary
          strengths={strengths}
          weaknesses={weaknesses}
          nextStep={maya.nextStep}
          mayaReflection={maya.reflection}
          realLifeLine={maya.realLifeLine}
        />

        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => window.history.back()} className="min-h-[48px]">
            Back
          </Button>
          <Button onClick={() => nextTrial(difficultyLevel)} className="min-h-[48px]">
            Continue
          </Button>
        </div>
      </div>
    );
  }

  const progress = ((currentTrial + 1) / trials.length) * 100;
  const canSubmit = currentAnswer.length > 0;

  return (
    <div className="space-y-2 sm:space-y-3 max-w-lg mx-auto">
      {/* Purpose banner — first trial only */}
      {showPurpose && currentTrial === 0 && (
        <ExercisePurposeBanner exerciseSlug="sentence-construction" />
      )}

      {/* Compact progress */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs sm:text-sm">
          <span className="text-muted-foreground">
            {currentTrial + 1} of {trials.length}
          </span>
          <div className="flex items-center gap-2">
            <LevelBadge descriptor={scLevelDescriptor} compact />
            <span className="font-medium">{score} correct</span>
          </div>
        </div>
        <Progress value={progress} className="h-1.5" />
        {kidsMode && <KidsStarMeter earned={score} total={trials.length} />}
      </div>

      {/* Task info + audio */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">
          {kidsMode ? getKidsGrammarLabel(trial.grammarFocus) : getGrammarLabel(trial.grammarFocus)}
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={showFeedback ? handlePlayAudio : handleHint}
          disabled={isLoading}
          className="gap-1.5 min-h-[40px]"
        >
          <Volume2 className="w-4 h-4" />
          {showFeedback ? "Hear it" : (hintUsed ? "Hear Again" : "Hear Sentence")}
        </Button>
      </div>

      {/* Main Task Card */}
      <Card className="p-3 sm:p-4">
        <div className="space-y-3">
          {/* Speech mode (default) */}
          {!showTiles && !showFeedback && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5 p-2.5 bg-muted/50 rounded-lg">
                {trial.options.map((word, idx) => (
                  <Badge key={idx} variant="outline" className="text-sm px-2.5 py-1">
                    {word}
                  </Badge>
                ))}
              </div>

              <div className="flex flex-col items-center gap-3 py-4">
                <button
                  onClick={() => {
                    if (isListening) {
                      stopListening();
                    } else {
                      hasProcessedSpeechRef.current = false;
                      setSpokenSentence(null);
                      startListening();
                    }
                  }}
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center transition-all",
                    isListening
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 animate-pulse"
                      : "bg-muted hover:bg-primary/10 text-muted-foreground"
                  )}
                >
                  {isListening ? <Mic className="w-8 h-8" /> : <MicOff className="w-8 h-8" />}
                </button>
                <p className="text-sm text-muted-foreground text-center">
                  {isListening
                    ? (spokenSentence ? `"${spokenSentence}"` : 'Say the correct sentence...')
                    : 'Tap to speak'}
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => { stopListening(); setShowTiles(true); }}
              >
                <Keyboard className="w-3 h-3 mr-1" /> Switch to word tiles
              </Button>
            </div>
          )}

          {/* Tile mode (fallback) */}
          {showTiles && !showFeedback && (
            <>
              <div className="flex flex-wrap gap-1.5 min-h-[44px] p-2.5 bg-muted border-2 border-dashed border-primary rounded-lg">
                {answerWords.length === 0 ? (
                  <span className="text-muted-foreground text-sm">Tap words to build sentence</span>
                ) : (
                  answerWords.map((word, idx) => (
                    <Badge key={idx} variant="secondary" className="text-sm px-2.5 py-1">
                      {word}
                    </Badge>
                  ))
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {getAvailableWords().map((item) => (
                  <Button
                    key={item.index}
                    variant="outline"
                    onClick={() => selectWord(item.index)}
                    disabled={showFeedback}
                    className="text-base min-h-[48px] px-4"
                  >
                    {item.word}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={removeLastWord} disabled={currentAnswer.length === 0} className="min-h-[44px]">
                  <RotateCcw className="w-4 h-4 mr-1" /> Undo
                </Button>
                <Button variant="outline" size="sm" onClick={clearAnswer} disabled={currentAnswer.length === 0} className="min-h-[44px]">
                  <Trash2 className="w-4 h-4 mr-1" /> Clear
                </Button>
                <Button className="ml-auto min-h-[48px]" onClick={handleSubmit} disabled={!canSubmit}>
                  Submit
                </Button>
              </div>

              <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setShowTiles(false)}>
                <Mic className="w-3 h-3 mr-1" /> Switch to voice
              </Button>
            </>
          )}

          {/* Feedback — now with grammar explanation */}
          {showFeedback && (
            <>
              <div className="flex flex-wrap gap-1.5 min-h-[44px] p-2.5 bg-muted border-2 border-dashed border-border rounded-lg">
                {answerWords.map((word, idx) => (
                  <Badge key={idx} variant="secondary" className="text-sm px-2.5 py-1">
                    {word}
                  </Badge>
                ))}
              </div>

              <div className={cn(
                "relative p-3 rounded-lg border animate-in fade-in slide-in-from-bottom-2 space-y-2",
                feedbackCorrect
                  ? "bg-primary/5 border-primary/20"
                  : "bg-destructive/5 border-destructive/20"
              )}>
                {kidsMode && feedbackCorrect && (
                  <KidsCelebration burstKey={currentTrial} />
                )}
                <div className="flex items-start gap-2">
                  {feedbackCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-sm">
                      {feedbackCorrect
                        ? (kidsMode ? kidsPraise : "Correct sentence!")
                        : (kidsMode ? "Almost! Try it like this:" : "Not quite right")}
                    </p>
                    {!feedbackCorrect && (
                      <p className="text-sm">
                        Correct: <span className="font-medium">{trial.targetSentence}</span>
                      </p>
                    )}
                    {/* Grammar explanation */}
                    {getGrammarExplanation(trial.grammarFocus) && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-1">
                        <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>
                          <strong>{getGrammarLabel(trial.grammarFocus)}:</strong>{' '}
                          {getGrammarExplanation(trial.grammarFocus)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button className="min-h-[48px]" onClick={handleNext}>
                  Next <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};
