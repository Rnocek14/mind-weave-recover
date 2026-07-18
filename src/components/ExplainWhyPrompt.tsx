/**
 * ExplainWhyPrompt — Generative "explain why" layer for comprehension exercises
 * 
 * After an MC answer, prompts the user to explain WHY the answer is correct.
 * Uses speech recognition to capture the explanation and scores it against key concepts.
 * Designed for stroke survivors: patient timing, scaffolded fallbacks, gentle feedback.
 * 
 * UPGRADED: Capture parity with PhotoNaming:
 * - useUtteranceLogger for persisted utterance analysis records
 * - useAudioRecorder for WAV capture/upload
 * - Discourse-focused: no pronunciation analysis
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useUtteranceLogger } from '@/hooks/useUtteranceLogger';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { scoreExplanation, ExplanationScore, ExplanationResultData } from '@/lib/explanationScorer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, MicOff, Brain, MessageCircle, SkipForward, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ExplainWhyResult {
  transcript: string;
  score: ExplanationScore;
  skipped: boolean;
  durationMs: number;
  /** Structured data for telemetry persistence */
  explanationData: ExplanationResultData;
}

interface ExplainWhyPromptProps {
  /** Was the MC answer correct? Changes prompt framing */
  wasCorrect: boolean;
  /** The correct answer text */
  correctAnswer: string;
  /** Key concepts expected in a good explanation */
  keyConcepts: string[];
  /** The explanation text to show as scaffold if needed */
  modelExplanation: string;
  /** Called when the user finishes explaining (or skips) */
  onComplete: (result: ExplainWhyResult) => void;
  /** Optional: custom prompt text */
  promptOverride?: string;
  /** Optional: clinical pipeline context */
  userId?: string;
  sessionId?: string | null;
  trialIndex?: number;
}

export function ExplainWhyPrompt({
  wasCorrect,
  correctAnswer,
  keyConcepts,
  modelExplanation,
  onComplete,
  promptOverride,
  userId,
  sessionId,
  trialIndex = 0,
}: ExplainWhyPromptProps) {
  const [stage, setStage] = useState<'prompt' | 'listening' | 'scored'>('prompt');
  const [collectedTranscript, setCollectedTranscript] = useState('');
  const [explanationScore, setExplanationScore] = useState<ExplanationScore | null>(null);
  const startTimeRef = useRef(Date.now());
  const hasProcessedRef = useRef(false);
  const latestTranscriptRef = useRef('');

  // Clinical pipeline hooks
  const {
    startAttempt,
    logFinalAnalysis,
    resetAttempt,
    currentAttemptId,
  } = useUtteranceLogger();

  const {
    startRecording,
    stopRecording,
    uploadRecording,
  } = useAudioRecorder();

  const promptText = promptOverride 
    ?? (wasCorrect 
      ? "Why is that the right answer? Explain in your own words."
      : `Why do you think "${correctAnswer}" is correct? Try to explain.`);

  const handleSpeechResult = useCallback((transcript: string) => {
    if (hasProcessedRef.current || !transcript.trim()) return;
    setCollectedTranscript(transcript);
    latestTranscriptRef.current = transcript;
  }, []);

  const { isListening, transcript: liveTranscript, startListening, stopListening, isSupported } = useSpeechRecognition({
    onResult: handleSpeechResult,
    patientMode: true,
    continuousListening: true,
  });

  useEffect(() => {
    if (liveTranscript) {
      latestTranscriptRef.current = liveTranscript;
    }
  }, [liveTranscript]);

  // Auto-submit after 3s silence once user has spoken 2+ words
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (stage !== 'listening') return;
    const transcript = collectedTranscript || latestTranscriptRef.current || '';
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (wordCount >= 2) {
      silenceTimerRef.current = setTimeout(() => {
        if (!hasProcessedRef.current) handleDoneSpeaking();
      }, 3000);
    }
    return () => { if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); };
  }, [stage, collectedTranscript, liveTranscript]);

  // Start recording
  const handleStartSpeaking = useCallback(() => {
    startTimeRef.current = Date.now();
    setStage('listening');
    
    // Start clinical pipeline
    if (userId) {
      startAttempt({
        sessionId: sessionId || 'standalone',
        userId,
        exerciseSlug: 'explain-why',
        trialIndex,
        attemptNumber: 1,
        targetWord: correctAnswer.slice(0, 50),
        category: 'discourse',
      });
    }
    
    startRecording();
    startListening();
  }, [startListening, startRecording, startAttempt, userId, sessionId, trialIndex, correctAnswer]);

  // Stop and score
  const handleDoneSpeaking = useCallback(() => {
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;
    
    stopListening();
    
    // Stop recording
    stopRecording().then(async (recordingResult) => {
      const transcriptToScore = collectedTranscript || latestTranscriptRef.current || '';
      const score = scoreExplanation(transcriptToScore, keyConcepts, correctAnswer);
      const durationMs = Date.now() - startTimeRef.current;
      
      // Upload audio for clinical persistence
      let audioStoragePath: string | null = null;
      if (recordingResult?.audioBlob && userId && sessionId) {
        audioStoragePath = await uploadRecording(
          recordingResult.audioBlob,
          userId,
          sessionId,
          trialIndex,
          recordingResult.mimeType
        );
      }
      
      // Log utterance
      if (currentAttemptId) {
        await logFinalAnalysis({
          transcript: transcriptToScore || undefined,
          transcriptSource: 'browser',
          evaluationModel: 'flow',
          isCorrect: null,
          didSpeak: transcriptToScore.trim().length > 0,
          utteranceComplete: transcriptToScore.trim().length > 0,
          recordingDurationMs: durationMs,
          audioStoragePath: audioStoragePath || undefined,
          coherenceScore: score.onTopicScore,
          fluencyAvailable: false,
          fluencyUnavailableReason: 'discourse_task',
        });
        resetAttempt();
      }
      
      setCollectedTranscript(transcriptToScore);
      setExplanationScore(score);
      setStage('scored');
    });
  }, [stopListening, stopRecording, collectedTranscript, keyConcepts, correctAnswer, uploadRecording, userId, sessionId, trialIndex, currentAttemptId, logFinalAnalysis, resetAttempt]);

  // Skip explanation
  const handleSkip = useCallback(async () => {
    stopListening();
    await stopRecording();
    
    // Log skip
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
    
    const durationMs = Date.now() - startTimeRef.current;
    const skipScore: ExplanationScore = {
      score: 0,
      conceptsFound: 0,
      conceptsTotal: keyConcepts.length,
      matchedConcepts: [],
      level: 'no-response',
      feedback: '',
      onTopicScore: 0,
      coverageRatio: 0,
    };
    onComplete({
      transcript: '',
      score: skipScore,
      skipped: true,
      durationMs,
      explanationData: {
        transcript: '',
        level: 'no-response',
        score: 0,
        conceptsFound: 0,
        conceptsTotal: keyConcepts.length,
        matchedConcepts: [],
        onTopicScore: 0,
        coverageRatio: 0,
        durationMs,
        skipped: true,
      },
    });
  }, [stopListening, stopRecording, onComplete, keyConcepts.length, currentAttemptId, logFinalAnalysis, resetAttempt]);

  // Continue after seeing score
  const handleContinue = useCallback(() => {
    if (!explanationScore) return;
    const durationMs = Date.now() - startTimeRef.current;
    onComplete({
      transcript: collectedTranscript,
      score: explanationScore,
      skipped: false,
      durationMs,
      explanationData: {
        transcript: collectedTranscript,
        level: explanationScore.level,
        score: explanationScore.score,
        conceptsFound: explanationScore.conceptsFound,
        conceptsTotal: explanationScore.conceptsTotal,
        matchedConcepts: explanationScore.matchedConcepts,
        onTopicScore: explanationScore.onTopicScore,
        coverageRatio: explanationScore.coverageRatio,
        durationMs,
        skipped: false,
      },
    });
  }, [explanationScore, collectedTranscript, onComplete]);

  // Auto-timeout
  useEffect(() => {
    if (stage !== 'listening') return;
    const timeout = setTimeout(() => {
      if (!hasProcessedRef.current && !collectedTranscript && !latestTranscriptRef.current) {
        handleDoneSpeaking();
      }
    }, 30000);
    return () => clearTimeout(timeout);
  }, [stage, collectedTranscript, handleDoneSpeaking]);

  const levelColors: Record<string, string> = {
    'excellent': 'border-green-500 bg-green-50 dark:bg-green-950/20',
    'good': 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
    'partial': 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
    'off-topic': 'border-orange-500 bg-orange-50 dark:bg-orange-950/20',
    'no-response': 'border-muted bg-muted/20',
  };

  const levelEmoji: Record<string, string> = {
    'excellent': '🧠',
    'good': '👍',
    'partial': '💡',
    'off-topic': '🔄',
    'no-response': '⏭️',
  };

  return (
    <div className="space-y-3">
      {stage === 'prompt' && (
        <Card className="border-2 border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Think Deeper</span>
            </div>
            <p className="text-base leading-relaxed">{promptText}</p>
            
            <div className="flex gap-2">
              {isSupported ? (
                <Button onClick={handleStartSpeaking} className="flex-1" size="lg">
                  <Mic className="h-4 w-4 mr-2" />
                  Tap to explain
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground italic">
                  Speech not supported in this browser. 
                  <Button variant="ghost" size="sm" onClick={handleSkip} className="ml-2">
                    Skip <SkipForward className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
              {/* Labeled escape — an icon-only skip is invisible to users who
                  scan for words, and the primary action here is voice-first. */}
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
                Skip
                <SkipForward className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stage === 'listening' && (
        <Card className="border-2 border-primary/50">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Mic className="h-5 w-5 text-primary" />
                {isListening && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                  </span>
                )}
              </div>
              <span className="font-semibold text-sm">
                {isListening ? 'Listening...' : 'Starting...'}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">Auto-submits when you pause</span>
            </div>
            
            {(liveTranscript || collectedTranscript) && (
              <div className="bg-muted/50 rounded-lg p-3 min-h-[3rem]">
                <p className="text-sm text-foreground italic">
                  "{collectedTranscript || liveTranscript}"
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleDoneSpeaking} className="flex-1" variant="secondary">
                <MicOff className="h-4 w-4 mr-2" />
                I'm done
              </Button>
              {/* Labeled escape — an icon-only skip is invisible to users who
                  scan for words, and the primary action here is voice-first. */}
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
                Skip
                <SkipForward className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {stage === 'scored' && explanationScore && (
        <Card className={cn("border-2", levelColors[explanationScore.level])}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{levelEmoji[explanationScore.level]}</span>
              <span className="font-semibold text-sm">{explanationScore.feedback}</span>
              {explanationScore.score > 0 && (
                <span className="ml-auto text-xs font-medium text-muted-foreground">
                  +{explanationScore.score} bonus
                </span>
              )}
            </div>

            {collectedTranscript && (
              <div className="bg-muted/30 rounded-lg p-2">
                <p className="text-xs text-muted-foreground mb-1">You said:</p>
                <p className="text-sm italic">"{collectedTranscript}"</p>
              </div>
            )}

            {(explanationScore.level === 'partial' || 
              explanationScore.level === 'off-topic' || 
              explanationScore.level === 'no-response') && (
              <div className="bg-primary/5 rounded-lg p-2 border border-primary/20">
                <div className="flex items-center gap-1 mb-1">
                  <MessageCircle className="h-3 w-3 text-primary" />
                  <p className="text-xs font-medium text-primary">Key idea:</p>
                </div>
                <p className="text-sm">{modelExplanation}</p>
              </div>
            )}

            <Button onClick={handleContinue} className="w-full" size="lg">
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
