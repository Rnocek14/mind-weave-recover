/**
 * Detective Mind Game Component — v2
 * 
 * Redesigned: no reading gate, purpose framing, fixed hint targeting,
 * model explanation shown, adaptive explain-why, question-type summary.
 * 
 * Full Coaching mode: Maya auto-reads story + question, spoken stall cues.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useDetectiveMindGame, DetectiveTrialResult, DetectiveRank } from '@/hooks/useDetectiveMindGame';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Search, CheckCircle, XCircle, Lightbulb, Star, Shield, MessageCircle, Volume2, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExplainWhyPrompt, ExplainWhyResult } from '@/components/ExplainWhyPrompt';
import { deriveKeyConcepts } from '@/lib/explanationScorer';
import { QuestionType, mapEngineLevelToDetectiveTier } from '@/data/detectiveMindCases';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useInGameAdaptation } from '@/hooks/useInGameAdaptation';
import { useEngagementMonitor } from '@/hooks/useEngagementMonitor';
import { narrateAdaptation, classifyReason } from '@/lib/adaptationNarrator';
import { AdaptationBadge, useAdaptationShift } from '@/components/AdaptationBadge';
import { AdaptationNarrationCard } from '@/components/AdaptationNarrationCard';
import { LevelBadge } from '@/components/exercise/LevelBadge';
import { isAudioUnlocked } from '@/lib/audioUnlock';

interface DetectiveMindGameProps {
  onTrialComplete: (result: DetectiveTrialResult) => void;
  onGameComplete: (results: DetectiveTrialResult[]) => void;
  roundCount?: number;
  difficultyLevel?: number;
  recommendedCueType?: 'semantic' | 'phonemic' | 'full_word' | 'none';
  sessionId?: string | null;
}

/** Map adaptive level (1-10) → content tier (1-3) — Phase 1.5: single source of truth */
const levelToTierLocal = mapEngineLevelToDetectiveTier;

const RANK_ICONS: Record<DetectiveRank, React.ReactNode> = {
  'Rookie': <Search className="h-5 w-5" />,
  'Junior Detective': <Search className="h-5 w-5" />,
  'Investigator': <Shield className="h-5 w-5" />,
  'Senior Detective': <Star className="h-5 w-5" />,
  'Chief Detective': <Star className="h-5 w-5 text-yellow-500" />,
};

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  literal: 'Finding Facts',
  inference: 'Reading Between Lines',
  cause_effect: 'Cause & Effect',
  prediction: 'Predicting Outcomes',
  figurative: 'Figurative Language',
};

type Phase = 'answering' | 'feedback' | 'explaining';

export function DetectiveMindGame({ 
  onTrialComplete, 
  onGameComplete, 
  roundCount = 10,
  difficultyLevel = 1,
  recommendedCueType,
  sessionId = null,
}: DetectiveMindGameProps) {
  const {
    currentCase,
    currentIndex,
    totalCases,
    isComplete,
    results,
    totalPoints,
    rank,
    activeTier,
    setActiveTier,
    submitAnswer,
    nextCase,
  } = useDetectiveMindGame(roundCount, difficultyLevel);

  // Visible adaptation badge controller
  const { direction: shiftDirection, reason: shiftReason, signal: signalShift } = useAdaptationShift();

  // Engagement monitor — feeds the cue-dependency safety gate.
  const engagement = useEngagementMonitor(sessionId);

  // In-game adaptation engine: drives content-tier swaps based on rolling success window
  const adaptation = useInGameAdaptation({
    exerciseSlug: 'detective-mind',
    sessionId,
    initialDifficulty: difficultyLevel,
    bounds: { floor: 1, ceiling: 10, suggestedStart: difficultyLevel },
    enableDifficultyToasts: false, // we render AdaptationBadge instead
    enableAutoHints: true,
    // Hint usage = direct cue dependency signal for this comprehension task.
    getCueDependencyScore: () => engagement.getState().signals.cueDependency,
    onEscalationBlocked: ({ reason, cueDependencyScore, trialsAtLevel }) => {
      console.info('[DetectiveMind] escalation blocked', {
        reason, cueDependencyScore, trialsAtLevel,
      });
    },
    onDifficultyChange: (newLevel, reason, dir) => {
      const newTier = levelToTierLocal(newLevel);
      if (newTier !== activeTier) {
        setActiveTier(newTier);
      }
      const narration = narrateAdaptation({
        direction: dir,
        reasonKind: classifyReason(reason),
      });
      signalShift(dir, narration || reason);
    },
  });

  const [phase, setPhase] = useState<Phase>('answering');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<DetectiveTrialResult | null>(null);
  const [usedHint, setUsedHint] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [reasoningPoints, setReasoningPoints] = useState(0);
  const [explainSkipCount, setExplainSkipCount] = useState(0);
  const [hasAutoRead, setHasAutoRead] = useState(false);
  const [autoReadDone, setAutoReadDone] = useState(false);
  const [voiceMissMsg, setVoiceMissMsg] = useState<string | null>(null);
  const caseLoadTimeRef = useRef(Date.now());
  const firstInteractionRef = useRef<number | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Voice guidance for Full Coaching mode
  const vg = useVoiceGuidance('detective-mind');

  // Direct TTS so Detective Mind reads story+question in EVERY coaching mode
  // (the previous vg-only path required Full Coaching, which is why users
  // reported the case being silent in Guided mode).
  const { speak: speakDirect, stop: stopDirect, isSpeaking: isDirectSpeaking } = useTextToSpeech();
  const ttsSeqRef = useRef(0);

  const speakBlocking = useCallback(async (text: string) => {
    const seq = ++ttsSeqRef.current;
    try { await speakDirect(text); } catch {}
    return seq === ttsSeqRef.current;
  }, [speakDirect]);

  // ---------------------------------------------------------------------------
  // Shuffle answer options per case so the correct answer isn't always "B".
  // The case bank is heavily B-biased (17/19 cases) — without shuffling, users
  // pattern-match on position instead of comprehension.
  //
  // We compute a stable display order keyed on the case id so the same case
  // shuffles the same way within a single render lifecycle, and produce a map
  // from displayed index → original (data-model) index.
  // ---------------------------------------------------------------------------
  const { displayedOptions, displayedCorrectIndex, displayToOriginal } = useMemo(() => {
    if (!currentCase) {
      return {
        displayedOptions: [] as string[],
        displayedCorrectIndex: 0,
        displayToOriginal: [] as number[],
      };
    }
    // Deterministic shuffle from the case id so re-renders are stable.
    const order = currentCase.options.map((_, i) => i);
    let seed = 0;
    for (const ch of currentCase.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    for (let i = order.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const j = seed % (i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    return {
      displayedOptions: order.map((origIdx) => currentCase.options[origIdx]),
      displayedCorrectIndex: order.indexOf(currentCase.correctIndex),
      displayToOriginal: order,
    };
  }, [currentCase]);

  // Reset state when case changes — keyed on case.id (not just index) so
  // re-shuffles or hot-swaps still trigger a clean reset.
  useEffect(() => {
    if (!currentCase) return;
    // CRITICAL: kill any in-flight Maya speech from the PREVIOUS case before
    // the auto-read effect spins up the new one. Bumping ttsSeqRef invalidates
    // any pending awaits so stale story audio cannot land on the new case.
    vg.interrupt?.();
    try { stopDirect(); } catch {}
    ttsSeqRef.current++;

    setPhase('answering');
    setSelectedOption(null);
    setLastResult(null);
    setUsedHint(false);
    setShowHint(false);
    setHasAutoRead(false);
    setAutoReadDone(false);
    setVoiceMissMsg(null);
    caseLoadTimeRef.current = Date.now();
    firstInteractionRef.current = null;
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
  }, [currentCase?.id, vg, stopDirect]);

  // Auto-read instructions (first case) → story → question + options on case
  // load — runs in EVERY mode. Keyed on case.id so re-shuffles also re-read.
  useEffect(() => {
    if (!currentCase || hasAutoRead) return;
    setHasAutoRead(true);
    const localSeq = ++ttsSeqRef.current;

    const doAutoRead = async () => {
      // If audio context isn't unlocked yet (no prior gesture this session),
      // poll briefly so the very first read isn't silently dropped.
      if (!isAudioUnlocked()) {
        for (let i = 0; i < 20 && !isAudioUnlocked(); i++) {
          await new Promise(r => setTimeout(r, 150));
          if (localSeq !== ttsSeqRef.current) return;
        }
      }

      // Instructions on first case
      if (currentIndex === 0) {
        await speakDirect("Read the story, then say or tap A, B, C, or D for the best answer.");
        if (localSeq !== ttsSeqRef.current) return;
        await new Promise(r => setTimeout(r, 400));
        if (localSeq !== ttsSeqRef.current) return;
      }
      // Read story
      const storyText = currentCase.story.join(' ');
      try { await speakDirect(storyText); } catch {}
      if (localSeq !== ttsSeqRef.current) return;
      await new Promise(r => setTimeout(r, 600));
      if (localSeq !== ttsSeqRef.current) return;
      // Read question + each option so users can answer by voice
      const optionsSpoken = currentCase.options
        .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`)
        .join('. ');
      try { await speakDirect(`${currentCase.question}. Your options are: ${optionsSpoken}.`); } catch {}
      if (localSeq !== ttsSeqRef.current) return;
      setAutoReadDone(true);
    };

    doAutoRead();
  }, [currentCase, currentIndex, hasAutoRead, speakDirect]);

  // Full Coaching: spoken stall cue after ~8s of no interaction
  // Only starts AFTER auto-read finishes to avoid interrupting story reading
  useEffect(() => {
    if (phase !== 'answering' || !vg.isVoiceLed) return;
    // If voice-led and auto-read hasn't finished yet, don't start stall timer
    if (vg.shouldAutoReadContent && !autoReadDone) return;
    stallTimerRef.current = setTimeout(() => {
      if (selectedOption === null && !firstInteractionRef.current) {
        vg.speakReminder();
      }
    }, 8000);
    return () => { if (stallTimerRef.current) clearTimeout(stallTimerRef.current); };
  }, [phase, vg.isVoiceLed, currentIndex, autoReadDone, vg.shouldAutoReadContent]);

  // Check completion (fire once)
  const completedRef = useRef(false);
  useEffect(() => {
    if (isComplete && results.length > 0 && !completedRef.current) {
      completedRef.current = true;
      onGameComplete(results);
    }
  }, [isComplete, results, onGameComplete]);

  const handleSelectOption = useCallback((displayedIndex: number) => {
    if (phase !== 'answering' || selectedOption !== null) return;

    // Interrupt Maya if she's still speaking
    vg.interrupt();

    // Track first interaction time if not set
    if (!firstInteractionRef.current) {
      firstInteractionRef.current = Date.now();
    }

    // Translate the position the user tapped (display order) into the
    // original index the data model expects.
    const originalIndex = displayToOriginal[displayedIndex] ?? displayedIndex;

    setSelectedOption(displayedIndex);
    const reactionTimeMs = Date.now() - caseLoadTimeRef.current;
    const result = submitAnswer(originalIndex, reactionTimeMs, usedHint);

    if (result) {
      setLastResult(result);
      setPhase('feedback');
      adaptation.recordTrial({
        correct: result.correct,
        reactionTimeMs,
        cueWasShown: usedHint,
      });
      // cueLevel: hints in DetectiveMind are binary → 0 or 1
      engagement.recordTrial({
        correct: result.correct,
        reactionTimeMs,
        cueLevel: usedHint ? 1 : 0,
        timeout: false,
        timestamp: Date.now(),
      });
    }
  }, [phase, selectedOption, usedHint, submitAnswer, vg, adaptation, engagement, displayToOriginal]);

  // ─── Voice answer support ────────────────────────────────────────────────
  // Listen after Maya finishes reading; map spoken letter / ordinal /
  // option keyword to the displayed option index.
  const selectFromTranscript = useCallback((raw: string): number | null => {
    const t = raw.toLowerCase().trim();
    if (!t) return null;
    // Letter match: "a", "b.", "letter c", "answer d"
    const letterMatch = t.match(/\b(?:answer\s+|letter\s+|option\s+)?([a-d])\b/);
    if (letterMatch) {
      const idx = letterMatch[1].charCodeAt(0) - 'a'.charCodeAt(0);
      if (idx >= 0 && idx < displayedOptions.length) return idx;
    }
    // Ordinal
    const ords: Record<string, number> = { first: 0, second: 1, third: 2, fourth: 3, one: 0, two: 1, three: 2, four: 3 };
    for (const [k, v] of Object.entries(ords)) {
      if (new RegExp(`\\b${k}\\b`).test(t) && v < displayedOptions.length) return v;
    }
    // Substring match against option text (longest unique wins)
    let best = -1; let bestLen = 0;
    displayedOptions.forEach((opt, i) => {
      const lower = opt.toLowerCase();
      // require at least 3 char overlap of significant word
      const words = lower.split(/\W+/).filter(w => w.length >= 4);
      for (const w of words) {
        if (t.includes(w) && w.length > bestLen) { best = i; bestLen = w.length; }
      }
    });
    return best >= 0 ? best : null;
  }, [displayedOptions]);

  const handleSpeechAnswer = useCallback((text: string) => {
    if (phase !== 'answering' || selectedOption !== null) return;
    const idx = selectFromTranscript(text);
    if (idx != null) handleSelectOption(idx);
  }, [phase, selectedOption, selectFromTranscript, handleSelectOption]);

  const {
    isListening: voiceListening,
    startListening: startVoice,
    stopListening: stopVoice,
    isSupported: voiceSupported,
  } = useSpeechRecognition({
    onResult: handleSpeechAnswer,
    patientMode: true,
    continuousListening: true,
  });

  // Auto-start mic after Maya finishes reading the question/options.
  useEffect(() => {
    if (!autoReadDone || phase !== 'answering' || selectedOption !== null) return;
    if (!voiceSupported) return;
    if (isDirectSpeaking) return;
    const t = setTimeout(() => {
      try { startVoice(); } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [autoReadDone, phase, selectedOption, voiceSupported, isDirectSpeaking, startVoice]);

  // Stop listening once selection committed or case changes.
  useEffect(() => {
    if (selectedOption !== null || phase !== 'answering') {
      try { stopVoice(); } catch {}
    }
  }, [selectedOption, phase, stopVoice]);

  const handleHint = useCallback(() => {
    // Track first interaction
    if (!firstInteractionRef.current) {
      firstInteractionRef.current = Date.now();
    }
    setUsedHint(true);
    setShowHint(true);
  }, []);

  // Transition from feedback → explaining or skip to next
  const handleProceedToExplain = useCallback(() => {
    setPhase('explaining');
  }, []);

  const handleSkipExplain = useCallback(() => {
    setExplainSkipCount(prev => prev + 1);
    if (lastResult) {
      onTrialComplete(lastResult);
    }
    nextCase();
  }, [nextCase, lastResult, onTrialComplete]);

  // Auto-advance from feedback → next case to keep session rhythm.
  // Correct: 3.5s (most users want to move on). Incorrect: 6s (read the "why").
  // Tapping "Next Case" or "Explain why" before timer fires cancels it.
  useEffect(() => {
    if (phase !== 'feedback' || !lastResult) return;
    const delay = lastResult.correct ? 3500 : 6000;
    const t = setTimeout(() => { handleSkipExplain(); }, delay);
    return () => clearTimeout(t);
  }, [phase, lastResult, handleSkipExplain]);

  // Handle explanation completion
  const handleExplainComplete = useCallback((explainResult: ExplainWhyResult) => {
    if (explainResult.skipped) {
      setExplainSkipCount(prev => prev + 1);
    } else if (!explainResult.skipped) {
      setReasoningPoints(prev => prev + explainResult.score.score);
    }
    if (lastResult) {
      onTrialComplete({
        ...lastResult,
        points: lastResult.points + explainResult.score.score,
        explanation: explainResult.explanationData,
      });
    }
    nextCase();
  }, [nextCase, lastResult, onTrialComplete]);

  // Explain-why visibility: progressively lighter, never fully gone
  const explainPromptLevel = useMemo(() => {
    if (explainSkipCount < 3) return 'full';      // "Explain why (bonus points)" button
    if (explainSkipCount < 6) return 'collapsed';  // Small text link
    return 'minimal';                               // Tiny optional link
  }, [explainSkipCount]);

  if (!currentCase || isComplete) {
    return <DetectiveSummary results={results} totalPoints={totalPoints} rank={rank} reasoningPoints={reasoningPoints} />;
  }

  const progressPercent = (currentIndex / totalCases) * 100;
  const isFirstCase = currentIndex === 0;

  return (
    <div className="max-w-lg mx-auto space-y-2 sm:space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between text-sm gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {RANK_ICONS[rank]}
          <span className="font-medium">{rank}</span>
          <span className="text-xs text-muted-foreground">· Rank</span>
        </div>
        <div className="flex items-center gap-2">
          <LevelBadge descriptor={adaptation.levelDescriptor} compact />
        </div>
        <div className="text-muted-foreground text-xs sm:text-sm">
          Case {currentIndex + 1} of {totalCases}
        </div>
        <div className="flex items-center gap-1">
          <Star className="h-4 w-4 text-yellow-500" />
          <span className="font-medium">{totalPoints}</span>
          {reasoningPoints > 0 && (
            <span className="text-xs text-muted-foreground ml-1">+🧠{reasoningPoints}</span>
          )}
        </div>
      </div>

      <Progress value={progressPercent} className="h-1.5" />

      {/* Visible adaptation cue + narration */}
      {shiftDirection && (
        <div className="space-y-2">
          <div className="flex justify-center">
            <AdaptationBadge direction={shiftDirection} reason={shiftReason} />
          </div>
          <AdaptationNarrationCard direction={shiftDirection} message={shiftReason} />
        </div>
      )}

      {/* Purpose banner — first case only */}
      {isFirstCase && phase === 'answering' && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-3 text-sm text-center">
          <span className="font-medium">🕵️ Read the story, find the clues, answer the question.</span>
          <p className="text-muted-foreground text-xs mt-1">
            This builds the same skills you use following conversations and reading.
          </p>
        </div>
      )}

      {/* Case title */}
      <div className="flex items-center gap-2 py-1">
        <Search className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">📂 {currentCase.title}</h2>
        <span className="ml-auto text-xs text-muted-foreground capitalize">
          {QUESTION_TYPE_LABELS[currentCase.questionType]}
        </span>
      </div>

      {/* Story card — always visible */}
      <Card className="border-2 border-border/50">
        <CardContent className="pt-6 space-y-3">
          {currentCase.story.map((sentence, i) => (
            <p key={i} className={cn(
              "text-base leading-relaxed",
              showHint && i === currentCase.hintSentenceIndex && "bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded font-medium"
            )}>
              {sentence}
            </p>
          ))}
        </CardContent>
      </Card>

      {/* Phase: Answering — question + options shown immediately with story */}
      {phase === 'answering' && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">{currentCase.question}</h3>
          
          <div className="space-y-2">
            {displayedOptions.map((option, i) => (
              <Button
                key={`${currentCase.id}-${i}`}
                variant="outline"
                className="w-full text-left justify-start h-auto py-3 px-4 whitespace-normal"
                onClick={() => handleSelectOption(i)}
              >
                <span className="mr-3 font-bold text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
                {option}
              </Button>
            ))}
          </div>

          {!usedHint && (
            <Button variant="ghost" size="sm" onClick={handleHint} className="w-full text-muted-foreground">
              <Lightbulb className="h-4 w-4 mr-2" />
              {recommendedCueType === 'semantic' 
                ? 'Highlight key evidence (−5 bonus points)'
                : 'Show a hint (−5 bonus points)'}
            </Button>
          )}
          {!usedHint && recommendedCueType === 'full_word' && (
            <p className="text-xs text-muted-foreground text-center italic">
              💡 Using the hint can help — no pressure!
            </p>
          )}

          {/* Replay buttons — always visible, work in every coaching mode */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 min-w-[120px]"
              onClick={() => {
                if (!currentCase) return;
                vg.interrupt();
                stopDirect();
                ttsSeqRef.current++;
                speakDirect(currentCase.story.join(' '));
              }}
            >
              <Volume2 className="h-4 w-4 mr-1" />
              Repeat story
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 min-w-[120px]"
              onClick={() => {
                if (!currentCase) return;
                vg.interrupt();
                stopDirect();
                ttsSeqRef.current++;
                const optionsSpoken = currentCase.options
                  .map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`)
                  .join('. ');
                speakDirect(`${currentCase.question}. ${optionsSpoken}.`);
              }}
            >
              <Volume2 className="h-4 w-4 mr-1" />
              Repeat question
            </Button>
            {voiceSupported && (
              <Button
                variant={voiceListening ? 'default' : 'outline'}
                size="sm"
                className="flex-1 min-w-[120px]"
                onClick={() => {
                  if (voiceListening) { stopVoice(); }
                  else { stopDirect(); ttsSeqRef.current++; startVoice(); }
                }}
              >
                {voiceListening ? <MicOff className="h-4 w-4 mr-1" /> : <Mic className="h-4 w-4 mr-1" />}
                {voiceListening ? 'Listening… say A, B, C, or D' : 'Answer by voice'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Phase: Feedback — shows result + model explanation */}
      {phase === 'feedback' && lastResult && (
        <div className="space-y-3">
          <Card className={cn(
            "border-2",
            lastResult.correct 
              ? "border-green-500 bg-green-50 dark:bg-green-950/20" 
              : "border-red-500 bg-red-50 dark:bg-red-950/20"
          )}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2">
                {lastResult.correct 
                  ? <CheckCircle className="h-5 w-5 text-green-600" />
                  : <XCircle className="h-5 w-5 text-red-600" />
                }
                <span className="font-bold">
                  {lastResult.correct ? '🎯 Case Solved!' : '❌ Not quite...'}
                </span>
                {lastResult.correct && (
                  <span className="ml-auto text-sm text-green-700 dark:text-green-400 font-medium">
                    +{lastResult.points} pts
                  </span>
                )}
              </div>
              {!lastResult.correct && (
                <p className="text-sm">
                  <span className="font-medium">Correct answer:</span>{' '}
                  {currentCase.options[currentCase.correctIndex]}
                </p>
              )}
              {/* Model explanation — always shown */}
              <div className="border-t pt-2 mt-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Why:</span>{' '}
                  {currentCase.explanation}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Explain-why: adaptive, progressively lighter */}
          <div className="flex gap-2">
            {explainPromptLevel === 'full' && (
              <>
                <Button onClick={handleProceedToExplain} className="flex-1" size="lg">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Explain why (bonus points)
                </Button>
                <Button onClick={handleSkipExplain} variant="outline" size="lg">
                  Next →
                </Button>
              </>
            )}
            {explainPromptLevel === 'collapsed' && (
              <div className="w-full space-y-2">
                <Button onClick={handleSkipExplain} className="w-full" size="lg">
                  Next Case →
                </Button>
                <button
                  onClick={handleProceedToExplain}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Want to explain your thinking? (bonus points)
                </button>
              </div>
            )}
            {explainPromptLevel === 'minimal' && (
              <div className="w-full space-y-2">
                <Button onClick={handleSkipExplain} className="w-full" size="lg">
                  Next Case →
                </Button>
                <button
                  onClick={handleProceedToExplain}
                  className="w-full text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors py-0.5"
                >
                  Explain reasoning
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Phase: Explaining */}
      {phase === 'explaining' && currentCase && (
        <ExplainWhyPrompt
          wasCorrect={lastResult?.correct ?? false}
          correctAnswer={currentCase.options[currentCase.correctIndex]}
          keyConcepts={deriveKeyConcepts(currentCase.explanation, undefined, undefined, currentCase.options[currentCase.correctIndex])}
          modelExplanation={currentCase.explanation}
          onComplete={handleExplainComplete}
          promptOverride={
            lastResult?.correct 
              ? "What clues in the story told you that? Explain your reasoning."
              : `Why is "${currentCase.options[currentCase.correctIndex]}" the right answer? What clues support it?`
          }
        />
      )}
    </div>
  );
}

/** Summary screen with question-type breakdown and Maya reflection */
function DetectiveSummary({ 
  results, totalPoints, rank, reasoningPoints 
}: { 
  results: DetectiveTrialResult[]; 
  totalPoints: number; 
  rank: DetectiveRank; 
  reasoningPoints: number;
}) {
  const correctCount = results.filter(r => r.correct).length;
  const accuracy = results.length > 0 ? correctCount / results.length : 0;

  // Group by question type
  const typeBreakdown = useMemo(() => {
    const map = new Map<QuestionType, { correct: number; total: number }>();
    for (const r of results) {
      const qt = r.questionType as QuestionType;
      const entry = map.get(qt) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (r.correct) entry.correct += 1;
      map.set(qt, entry);
    }
    return Array.from(map.entries()).map(([type, stats]) => ({
      type,
      label: QUESTION_TYPE_LABELS[type],
      ...stats,
    }));
  }, [results]);

  // Find weakest type for next-step suggestion
  const weakestType = useMemo(() => {
    let worst: { type: QuestionType; label: string; acc: number } | null = null;
    for (const t of typeBreakdown) {
      const acc = t.total > 0 ? t.correct / t.total : 1;
      if (!worst || acc < worst.acc) {
        worst = { type: t.type, label: t.label, acc };
      }
    }
    return worst;
  }, [typeBreakdown]);

  // Maya reflection
  const mayaReflection = useMemo(() => {
    if (accuracy >= 0.8) return "Strong detective work! You're picking up on clues quickly.";
    if (accuracy >= 0.5) return "Good effort — you're building solid comprehension skills.";
    return "These are tricky cases. Each one helps you practice finding important details.";
  }, [accuracy]);

  const realLifeLine = "Understanding clues in stories uses the same skills as following conversations and reading the news.";

  return (
    <div className="max-w-lg mx-auto space-y-6 text-center">
      <div className="text-6xl">🕵️</div>
      <h2 className="text-2xl font-bold">Investigation Complete!</h2>
      <div className="flex items-center justify-center gap-2 text-lg">
        {RANK_ICONS[rank]}
        <span className="font-semibold">{rank}</span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{correctCount}/{results.length}</div>
            <div className="text-xs text-muted-foreground">Cases Solved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{totalPoints}</div>
            <div className="text-xs text-muted-foreground">Points</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-2xl font-bold">{Math.round(accuracy * 100)}%</div>
            <div className="text-xs text-muted-foreground">Accuracy</div>
          </CardContent>
        </Card>
      </div>

      {/* Question-type breakdown */}
      {typeBreakdown.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <h3 className="text-sm font-semibold text-left">Skill Breakdown</h3>
            {typeBreakdown.map(t => {
              const acc = t.total > 0 ? t.correct / t.total : 0;
              const icon = acc >= 0.75 ? '✅' : acc >= 0.5 ? '⚠️' : '○';
              return (
                <div key={t.type} className="flex items-center justify-between text-sm">
                  <span>{t.label}</span>
                  <span className="font-medium">
                    {icon} {t.correct}/{t.total}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Next-step suggestion */}
      {weakestType && weakestType.acc < 0.75 && (
        <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm text-left">
          <span className="font-medium">💡 Next time:</span>{' '}
          <span className="text-muted-foreground">
            {weakestType.type === 'inference' && "Look for hidden clues — what characters feel or do can tell you more than what's said directly."}
            {weakestType.type === 'prediction' && "Think about what comes next — the clues in the story hint at what will happen."}
            {weakestType.type === 'cause_effect' && "Ask yourself: what caused this to happen? Look for the chain of events."}
            {weakestType.type === 'figurative' && "Some phrases don't mean exactly what they say — think about the everyday meaning."}
            {weakestType.type === 'literal' && "Focus on the specific details mentioned in the story."}
          </span>
        </div>
      )}

      {/* Maya reflection */}
      <div className="bg-primary/5 border border-primary/10 rounded-lg px-4 py-3 text-sm space-y-1">
        <p className="font-medium">{mayaReflection}</p>
        <p className="text-muted-foreground text-xs">{realLifeLine}</p>
      </div>

      {reasoningPoints > 0 && (
        <div className="text-sm text-muted-foreground">
          🧠 Reasoning score: {reasoningPoints} pts
        </div>
      )}
    </div>
  );
}
