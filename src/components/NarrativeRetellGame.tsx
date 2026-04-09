/**
 * Narrative Retell Game Component — v2
 * 
 * Shows full story upfront → user retells via speech → structured feedback.
 * 
 * v2 changes:
 * - All story cards visible at once (no scene gating)
 * - Purpose banner for entry clarity
 * - Stall support prompts during retell
 * - Structured beginning/middle/end feedback with next-step hint
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNarrativeRetellGame, NarrativeTrialResult, SectionStatus } from '@/hooks/useNarrativeRetellGame';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useVoiceGuidance } from '@/hooks/useVoiceGuidance';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Mic, MicOff, BookOpen, ChevronRight, SkipForward, Keyboard, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

interface NarrativeRetellGameProps {
  userId?: string;
  sessionId?: string | null;
  onTrialComplete: (result: NarrativeTrialResult) => void;
  onGameComplete: (results: NarrativeTrialResult[]) => void;
  roundCount?: number;
  tier?: number;
  /** Profile-recommended cue type — adapts retelling scaffolding */
  recommendedCueType?: 'semantic' | 'phonemic' | 'full_word' | 'none';
}

type Phase = 'reading' | 'retelling' | 'scored';

const STALL_PROMPTS = [
  "Take your time. Start with what happened first.",
  "Who was in the story?",
  "What happened next?",
  "How did the story end?",
];

function SectionStatusIcon({ status }: { status: SectionStatus }) {
  if (status === 'covered') return <span>✅</span>;
  if (status === 'partial') return <span>⚠️</span>;
  return <span className="text-muted-foreground">○</span>;
}

function SectionStatusLabel({ status }: { status: SectionStatus }) {
  if (status === 'covered') return <span className="text-green-700 dark:text-green-400">Covered</span>;
  if (status === 'partial') return <span className="text-amber-600 dark:text-amber-400">Partial</span>;
  return <span className="text-muted-foreground">Missed</span>;
}

/** Generate Maya's structured reflection based on retell result */
function buildMayaReflection(result: NarrativeTrialResult): string {
  const { structureBreakdown: sb, eventCoverage } = result;
  const coveredParts: string[] = [];
  const weakParts: string[] = [];
  for (const section of ['beginning', 'middle', 'end'] as const) {
    if (sb[section].status === 'covered') coveredParts.push(section);
    else weakParts.push(section);
  }

  if (eventCoverage >= 0.6 && weakParts.length === 0) {
    return 'You told the full story clearly, including the key events.';
  }
  if (coveredParts.length > 0 && weakParts.length > 0) {
    return `You got the ${coveredParts.join(' and ')} clearly. The ${weakParts[0]} was harder — that's what we'll focus on next.`;
  }
  if (eventCoverage >= 0.3) {
    return 'You started the story well. Next time, try adding what happened after.';
  }
  return "That's okay. Let's try starting with just the beginning next time.";
}

const REAL_LIFE_CONNECTIONS = [
  "This is the same skill you use when telling someone what happened during your day.",
  "This helps when you're explaining something to someone — step by step.",
  "Retelling stories strengthens the same skills you use in everyday conversations.",
];

export function NarrativeRetellGame({
  userId,
  sessionId,
  onTrialComplete,
  onGameComplete,
  roundCount = 3,
  tier = 1,
  recommendedCueType,
}: NarrativeRetellGameProps) {
  const { currentStory, currentIndex, totalStories, isComplete, results, submitRetell, nextStory } =
    useNarrativeRetellGame(roundCount, tier);

  const [phase, setPhase] = useState<Phase>('reading');
  const [lastResult, setLastResult] = useState<NarrativeTrialResult | null>(null);
  const [collectedTranscript, setCollectedTranscript] = useState('');
  const [useTyping, setUseTyping] = useState(() => sessionStorage.getItem('preferTypingInput') === 'true');
  const [typedText, setTypedText] = useState('');
  const [stallPromptIndex, setStallPromptIndex] = useState(-1);
  const realLifeLineRef = useRef(REAL_LIFE_CONNECTIONS[Math.floor(Math.random() * REAL_LIFE_CONNECTIONS.length)]);
  const startTimeRef = useRef(Date.now());
  const latestTranscriptRef = useRef('');
  const hasProcessedRef = useRef(false);
  const stallTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retellStartRef = useRef(Date.now());

  // Clinical pipeline hooks
  const { startAttempt, logFinalAnalysis, resetAttempt, currentAttemptId } = useUtteranceLogger();
  const { startRecording, stopRecording, uploadRecording } = useAudioRecorder();
  const { speak: speakTTS, isSpeaking: isTTSSpeaking, stop: stopTTS } = useTextToSpeech();

  // Voice guidance for Full Coaching mode
  const vg = useVoiceGuidance('narrative-retell');

  // Stop TTS on unmount or when leaving reading phase
  useEffect(() => {
    return () => { stopTTS(); vg.interrupt(); };
  }, [stopTTS, vg]);

  // Full Coaching: auto-read story when entering reading phase
  const hasAutoReadRef = useRef(false);
  useEffect(() => {
    if (phase !== 'reading' || !currentStory || !vg.shouldAutoReadContent || hasAutoReadRef.current) return;
    hasAutoReadRef.current = true;

    const doAutoRead = async () => {
      // First story gets the exercise intro
      if (currentIndex === 0) {
        await vg.speakIntro();
        await new Promise(r => setTimeout(r, 800));
      }
      // Read the full story
      const fullText = currentStory.scenes.map(s => s.text).join(' ');
      await vg.autoReadText(fullText);
    };
    doAutoRead();
  }, [phase, currentStory, currentIndex, vg]);

  const handleListenToStory = useCallback(() => {
    if (!currentStory) return;
    const fullText = currentStory.scenes.map(s => s.text).join(' ');
    speakTTS(fullText);
  }, [currentStory, speakTTS]);

  // Reset on story change
  useEffect(() => {
    setPhase('reading');
    setLastResult(null);
    setCollectedTranscript('');
    setStallPromptIndex(-1);
    hasProcessedRef.current = false;
    latestTranscriptRef.current = '';
    hasAutoReadRef.current = false;
  }, [currentIndex]);

  const completedRef = useRef(false);
  useEffect(() => {
    if (isComplete && results.length > 0 && !completedRef.current) {
      completedRef.current = true;
      onGameComplete(results);
    }
  }, [isComplete, results, onGameComplete]);

  const handleSpeechResult = useCallback((transcript: string) => {
    if (hasProcessedRef.current || !transcript.trim()) return;
    setCollectedTranscript(transcript);
    latestTranscriptRef.current = transcript;
  }, []);

  const { isListening, fullTranscript, startListening, stopListening, isSupported } =
    useSpeechRecognition({ onResult: handleSpeechResult, patientMode: true, continuousListening: true, discourseMode: true });

  useEffect(() => {
    if (fullTranscript) latestTranscriptRef.current = fullTranscript;
  }, [fullTranscript]);

  // Auto-submit after 3s silence once user has spoken 2+ words
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (phase !== 'retelling') return;
    const transcript = collectedTranscript || latestTranscriptRef.current || '';
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (wordCount >= 2) {
      silenceTimerRef.current = setTimeout(() => {
        if (!hasProcessedRef.current) handleDoneRetelling();
      }, 3000);
    }
    return () => { if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); };
  }, [phase, collectedTranscript, fullTranscript]);

  // Stall support: show progressive prompts if user hasn't spoken much
  // In Full Coaching mode, speak the prompts aloud
  const lastSpokenStallRef = useRef(-1);
  useEffect(() => {
    if (phase !== 'retelling') return;
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);

    const checkStall = () => {
      const transcript = collectedTranscript || latestTranscriptRef.current || '';
      const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
      const elapsed = Date.now() - retellStartRef.current;

      if (wordCount < 2) {
        let newIndex = stallPromptIndex;
        if (elapsed > 20000 && stallPromptIndex < 3) newIndex = 3;
        else if (elapsed > 15000 && stallPromptIndex < 2) newIndex = 2;
        else if (elapsed > 10000 && stallPromptIndex < 1) newIndex = 1;
        else if (elapsed > 6000 && stallPromptIndex < 0) newIndex = 0;
        
        if (newIndex > stallPromptIndex) {
          setStallPromptIndex(newIndex);
          // Speak the stall prompt in Full Coaching mode
          if (vg.isVoiceLed && newIndex > lastSpokenStallRef.current) {
            lastSpokenStallRef.current = newIndex;
            vg.speakIfVoiceLed(STALL_PROMPTS[newIndex]);
          }
        }
      }
    };

    stallTimerRef.current = setTimeout(checkStall, 3000);
    const interval = setInterval(checkStall, 3000);
    return () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      clearInterval(interval);
    };
  }, [phase, collectedTranscript, stallPromptIndex, vg]);

  const handleStartRetelling = useCallback(() => {
    stopTTS(); // Stop Maya reading if still playing
    vg.interrupt(); // Stop any Full Coaching speech
    setPhase('retelling');
    startTimeRef.current = Date.now();
    retellStartRef.current = Date.now();
    setTypedText('');
    setStallPromptIndex(-1);
    lastSpokenStallRef.current = -1;

    // Full Coaching: speak the retell prompt
    if (vg.isVoiceLed) {
      // Slight delay so mic doesn't pick up Maya
      setTimeout(() => vg.speakTask(), 300);
    }

    if (currentStory && userId) {
      startAttempt({
        sessionId: sessionId || 'standalone',
        userId,
        exerciseSlug: 'narrative_retell',
        trialIndex: currentIndex,
        attemptNumber: 1,
        targetWord: currentStory.title,
        category: 'discourse',
      });
    }

    if (!useTyping) {
      startRecording();
      startListening();
    }
  }, [startListening, startRecording, startAttempt, currentStory, currentIndex, userId, sessionId, useTyping, stopTTS]);

  const handleDoneRetelling = useCallback(async () => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    stopListening();

    const recordingResult = useTyping ? null : await stopRecording();

    setTimeout(async () => {
      const transcript = useTyping ? typedText : (collectedTranscript || latestTranscriptRef.current || '');
      const durationMs = Date.now() - startTimeRef.current;
      const result = submitRetell(transcript, durationMs);

      let audioStoragePath: string | null = null;
      if (recordingResult?.audioBlob && userId && sessionId) {
        audioStoragePath = await uploadRecording(
          recordingResult.audioBlob, userId, sessionId, currentIndex, recordingResult.mimeType
        );
      }

      if (currentAttemptId) {
        await logFinalAnalysis({
          transcript: transcript || undefined,
          transcriptSource: 'browser',
          evaluationModel: 'flow',
          isCorrect: null,
          didSpeak: transcript.trim().length > 0,
          utteranceComplete: transcript.trim().length > 0,
          recordingDurationMs: durationMs,
          audioStoragePath: audioStoragePath || undefined,
          fluencyAvailable: false,
          fluencyUnavailableReason: 'discourse_task',
        });
        resetAttempt();
      }

      if (result) {
        setLastResult(result);
        setPhase('scored');
        onTrialComplete(result);
      }
    }, 150);
  }, [stopListening, stopRecording, collectedTranscript, submitRetell, onTrialComplete, uploadRecording, userId, sessionId, currentIndex, currentAttemptId, logFinalAnalysis, resetAttempt, useTyping, typedText]);

  const handleSkip = useCallback(async () => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    stopListening();
    await stopRecording();

    const durationMs = Date.now() - startTimeRef.current;
    const result = submitRetell('', durationMs);

    if (currentAttemptId) {
      await logFinalAnalysis({
        transcript: '',
        transcriptSource: 'browser',
        evaluationModel: 'flow',
        isCorrect: null,
        didSpeak: false,
        fluencyAvailable: false,
        fluencyUnavailableReason: 'no_recording',
      });
      resetAttempt();
    }

    if (result) {
      setLastResult(result);
      setPhase('scored');
      onTrialComplete(result);
    }
  }, [stopListening, stopRecording, submitRetell, onTrialComplete, currentAttemptId, logFinalAnalysis, resetAttempt]);

  const handleContinue = useCallback(() => {
    nextStory();
  }, [nextStory]);

  // Game complete screen
  if (!currentStory || isComplete) {
    const avgCoverage = results.length > 0
      ? results.reduce((sum, r) => sum + r.eventCoverage, 0) / results.length
      : 0;
    const bestSection = results.length > 0 ? (() => {
      const sectionHits = { beginning: 0, middle: 0, end: 0 };
      for (const r of results) {
        for (const s of ['beginning', 'middle', 'end'] as const) {
          if (r.structureBreakdown[s].status === 'covered') sectionHits[s]++;
        }
      }
      if (sectionHits.beginning >= sectionHits.middle && sectionHits.beginning >= sectionHits.end) return 'beginnings';
      if (sectionHits.end >= sectionHits.middle) return 'endings';
      return 'middle details';
    })() : null;

    return (
      <div className="max-w-lg mx-auto space-y-6 text-center">
        <div className="text-6xl">📖</div>
        <h2 className="text-2xl font-bold">Stories Complete!</h2>

        {/* Maya session reflection */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-left space-y-1.5">
          <p className="text-sm text-foreground">
            {avgCoverage >= 0.6
              ? `You did well remembering key events across all stories${bestSection ? `, especially ${bestSection}` : ''}.`
              : avgCoverage >= 0.3
              ? `You're building your retelling skills. ${bestSection ? `Your ${bestSection} were strongest.` : ''}`
              : "Keep practicing — retelling gets easier with each session."}
          </p>
          <p className="text-xs text-muted-foreground italic">{realLifeLineRef.current}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{results.length}</div>
              <div className="text-xs text-muted-foreground">Stories Retold</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{Math.round(avgCoverage * 100)}%</div>
              <div className="text-xs text-muted-foreground">Avg Coverage</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-2 sm:space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="font-medium">Narrative Retell</span>
        </div>
        <div className="text-muted-foreground">
          Story {currentIndex + 1} of {totalStories}
        </div>
      </div>

      <Progress value={((currentIndex) / totalStories) * 100} className="h-2" />

      <h2 className="text-lg font-bold flex items-center gap-2">
        📂 {currentStory.title}
      </h2>

      {/* ─── Reading phase: all cards visible at once ─── */}
      {phase === 'reading' && (
        <div className="space-y-3">
          {/* Purpose banner with optional prior-round context */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-center">
            <p className="text-base font-medium text-foreground">
              {currentIndex === 0
                ? "📖 Let's work on telling a short story clearly. This helps with real conversations."
                : results.length > 0 && results[results.length - 1].eventCoverage >= 0.6
                ? "📖 You did well last time. Let's try another story."
                : results.length > 0 && results[results.length - 1].structureBreakdown.middle.status !== 'covered'
                ? "📖 Let's work on including the middle details this time."
                : "📖 Read the next story and tell it back in your own words."}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Read the story below. When you're ready, tell it back in your own words.</p>
          </div>

          {/* All scene cards visible */}
          {currentStory.scenes.map((scene, i) => (
            <Card key={i} className="border border-border/50">
              <CardContent className="pt-4 flex items-start gap-3">
                <span className="text-2xl">{scene.emoji}</span>
                <p className="text-base leading-relaxed">{scene.text}</p>
              </CardContent>
            </Card>
          ))}

          {/* Adaptive scaffolding */}
          {recommendedCueType === 'semantic' && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
              <span className="font-medium">💡 Hint: </span>
              Think about: <em>who</em> was in the story, <em>where</em> it happened, and <em>what</em> went wrong.
            </div>
          )}
          {recommendedCueType === 'phonemic' && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
              <span className="font-medium">💡 Start with: </span>
              "{currentStory.scenes[0].text.split(' ').slice(0, 3).join(' ')}..."
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button onClick={handleStartRetelling} className="flex-1" size="lg" disabled={isTTSSpeaking}>
                {useTyping ? <Keyboard className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                Start retelling
              </Button>
              <Button variant="outline" size="lg" onClick={isTTSSpeaking ? stopTTS : handleListenToStory}>
                <Volume2 className="h-4 w-4 mr-1" />
                {isTTSSpeaking ? 'Stop' : 'Listen'}
              </Button>
            </div>
            {isSupported && (
              <button
                onClick={() => { const next = !useTyping; setUseTyping(next); sessionStorage.setItem('preferTypingInput', String(next)); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mx-auto"
              >
                {useTyping ? <Mic className="w-3 h-3" /> : <Keyboard className="w-3 h-3" />}
                {useTyping ? 'Switch to speech' : 'Switch to typing'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Retelling phase with stall support ─── */}
      {phase === 'retelling' && (
        <Card className="border-2 border-primary/50">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                {useTyping ? <Keyboard className="h-5 w-5 text-primary" /> : <Mic className="h-5 w-5 text-primary" />}
                {!useTyping && isListening && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                  </span>
                )}
              </div>
              <span className="font-semibold text-sm">
                Tell the story in your own words...
              </span>
              {!useTyping && (
                <span className="text-xs text-muted-foreground ml-auto">Auto-submits when you pause</span>
              )}
            </div>

            {/* Helper text */}
            <p className="text-xs text-muted-foreground">You can start with what happened first.</p>

            {/* Typing mode */}
            {useTyping && (
              <Textarea
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder="Type what happened in the story..."
                className="min-h-[100px] text-base"
                autoFocus
              />
            )}

            {/* Speech mode transcript */}
            {!useTyping && (fullTranscript || collectedTranscript) && (
              <div className="bg-muted/50 rounded-lg p-3 min-h-[3rem] max-h-[8rem] overflow-y-auto">
                <p className="text-sm text-foreground italic">
                  "{collectedTranscript || fullTranscript}"
                </p>
              </div>
            )}

            {/* Stall support prompts */}
            {stallPromptIndex >= 0 && (
              <div className="bg-accent/30 border border-accent/50 rounded-lg px-3 py-2 text-sm text-foreground animate-in fade-in duration-500">
                💬 {STALL_PROMPTS[stallPromptIndex]}
              </div>
            )}

            {/* Replay buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (!currentStory) return;
                  vg.interrupt();
                  const fullText = currentStory.scenes.map(s => s.text).join(' ');
                  vg.isVoiceLed ? vg.autoReadText(fullText) : speakTTS(fullText);
                }}
              >
                <Volume2 className="h-4 w-4 mr-1" />
                Read story again
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  vg.interrupt();
                  vg.speakTask();
                }}
              >
                <Volume2 className="h-4 w-4 mr-1" />
                Repeat instructions
              </Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDoneRetelling} className="flex-1" variant="secondary" disabled={useTyping && !typedText.trim()}>
                {useTyping ? '✓' : <MicOff className="h-4 w-4 mr-2" />} I'm done
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Scored phase: structured feedback ─── */}
      {phase === 'scored' && lastResult && (
        <div className="space-y-3">
          <Card className={cn("border-2",
            lastResult.eventCoverage >= 0.6 ? "border-green-500 bg-green-50 dark:bg-green-950/20" :
            lastResult.eventCoverage >= 0.3 ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20" :
            "border-orange-500 bg-orange-50 dark:bg-orange-950/20"
          )}>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {lastResult.eventCoverage >= 0.6 ? '🧠' : lastResult.eventCoverage >= 0.3 ? '👍' : '💡'}
                </span>
                <span className="font-bold text-sm">Your retell</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {lastResult.eventsFound}/{lastResult.eventsTotal} key events
                </span>
               </div>

              {/* Maya reflection */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2 space-y-1">
                <p className="text-sm text-foreground">{buildMayaReflection(lastResult)}</p>
                <p className="text-xs text-muted-foreground italic">{realLifeLineRef.current}</p>
              </div>

              {/* Story structure breakdown */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Story structure:</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['beginning', 'middle', 'end'] as const).map(section => {
                    const data = lastResult.structureBreakdown[section];
                    return (
                      <div key={section} className={cn(
                        "rounded-lg p-2 text-center border",
                        data.status === 'covered' ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" :
                        data.status === 'partial' ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800" :
                        "bg-muted/30 border-border"
                      )}>
                        <SectionStatusIcon status={data.status} />
                        <p className="text-xs font-medium capitalize mt-1">{section}</p>
                        <p className="text-[10px] text-muted-foreground">{data.hit}/{data.total} details</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* What you included */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">What you included:</p>
                {lastResult.allKeyEvents.map((event, i) => {
                  const matched = lastResult.matchedEvents.some(
                    m => m.toLowerCase() === event.toLowerCase()
                  );
                  return (
                    <div key={i} className={cn(
                      "flex items-center gap-2 text-sm rounded-md px-2 py-1",
                      matched ? "bg-green-100 dark:bg-green-950/30 text-green-800 dark:text-green-300" : "bg-muted/40 text-muted-foreground"
                    )}>
                      <span>{matched ? '✅' : '○'}</span>
                      <span className={cn(!matched && "opacity-70")}>{event}</span>
                    </div>
                  );
                })}
              </div>

              {/* Next step hint */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                <p className="text-xs font-medium text-primary mb-0.5">💡 Next step</p>
                <p className="text-sm text-foreground">{lastResult.nextStepHint}</p>
              </div>

              {lastResult.transcript && (
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground mb-1">You said:</p>
                  <p className="text-sm italic">"{lastResult.transcript}"</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleContinue} className="w-full" size="lg">
            {currentIndex + 1 < totalStories ? 'Next Story' : 'Finish'} <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
