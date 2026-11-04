/**
 * Guided Conversation Coach — early aphasia practice L1–L3.
 *
 * Deliberately separate from the large Smart Coach orchestration pipeline:
 * one functional communication turn, one speech owner, a confirmation step
 * before grading, and no adaptive popup/card that could change task level.
 * These are provisional practice tasks, NOT a clinical assessment.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { MAYA_VOICE_ID } from '@/lib/constants/voice';
import { supabase } from '@/integrations/supabase/client';
import { scoreDiscourseTurn } from '@/lib/discourseSignalScorer';
import {
  EARLY_COACH_LEVELS, buildEarlyCoachPrompt, chooseEarlyCoachScenario,
  earlyCoachTurnOnTarget, type EarlyCoachLevel, type EarlyCoachTrial,
} from '@/lib/progression/earlyConversationCoach';
import type { SupportLevel } from '@/lib/progression/clinicalProgression';

type Phase = 'start' | 'maya_speaking' | 'ready' | 'listening' |
  'review' | 'checking' | 'complete';

interface GuidedConversationCoachProps {
  userId: string;
  profileId: string;
  sessionId: string;
  level: EarlyCoachLevel;
  onClinicalTrial?: (trial: EarlyCoachTrial) => void;
  onComplete: (metrics: {
    turnsCompleted: number;
    cardsCompleted: number;
    avgLatencyMs: number;
    userAIRatio: number;
  }) => void | Promise<void>;
}

export function GuidedConversationCoach({
  userId, profileId, sessionId, level, onClinicalTrial, onComplete,
}: GuidedConversationCoachProps) {
  const spec = EARLY_COACH_LEVELS[level];
  const scenarioRef = useRef(chooseEarlyCoachScenario());
  const scenario = scenarioRef.current;
  const question = buildEarlyCoachPrompt(level, scenario);
  const [phase, setPhase] = useState<Phase>('start');
  const phaseRef = useRef<Phase>('start');
  const mountedRef = useRef(true);
  const [transcript, setTranscript] = useState('');
  const heardRef = useRef('');
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [usedHelp, setUsedHelp] = useState(false);
  const helpRef = useRef(false);
  const [practiceMessage, setPracticeMessage] = useState('');
  const recordingRef = useRef<{ audioBlob: Blob; mimeType: string } | null>(null);
  const speechStartRef = useRef<number | null>(null);
  const firstWordRef = useRef<number | null>(null);
  const submittedRef = useRef(false);

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    if (mountedRef.current) setPhase(next);
  }, []);
  const { speak, stop: stopTTS } = useTextToSpeech();
  const {
    isSupported, startListening, stopListening, resetTranscript,
    transcript: liveTranscript,
  } = useSpeechRecognition({
    enabled: true, patientMode: true, continuousListening: false,
    onResult: heard => {
      if (phaseRef.current !== 'listening') return;
      if (heard.trim() && firstWordRef.current === null) firstWordRef.current = Date.now();
      heardRef.current = heard;
      setTranscript(heard);
    },
  });
  const { startRecording, stopRecording, cancelRecording } = useAudioRecorder();

  // Interim recognition is useful when Web Speech does not deliver a final
  // callback synchronously with Stop. Patient must confirm it before scoring.
  useEffect(() => {
    if (phase !== 'listening' || !liveTranscript.trim()) return;
    if (firstWordRef.current === null) firstWordRef.current = Date.now();
    heardRef.current = liveTranscript;
    setTranscript(liveTranscript);
  }, [liveTranscript, phase]);

  const stopListeningRef = useRef(stopListening);
  const cancelRecordingRef = useRef(cancelRecording);
  const stopTTSRef = useRef(stopTTS);
  stopListeningRef.current = stopListening;
  cancelRecordingRef.current = cancelRecording;
  stopTTSRef.current = stopTTS;
  useEffect(() => () => {
    mountedRef.current = false;
    phaseRef.current = 'complete';
    stopListeningRef.current();
    cancelRecordingRef.current();
    stopTTSRef.current();
  }, []);

  const playCoachLine = useCallback(async (line: string) => {
    changePhase('maya_speaking');
    try {
      await speak(line, { voiceId: MAYA_VOICE_ID });
    } catch (error) {
      console.warn('[GuidedCoach] Maya speech unavailable; written prompt remains', error);
    } finally {
      if (mountedRef.current) changePhase('ready');
    }
  }, [speak, changePhase]);

  const startTask = useCallback(() => {
    if (phaseRef.current !== 'start') return;
    void playCoachLine(question);
  }, [playCoachLine, question]);

  const hearQuestion = useCallback(() => {
    if (phaseRef.current !== 'ready') return;
    void playCoachLine(question);
  }, [playCoachLine, question]);

  const hearClue = useCallback(async () => {
    if (level !== 3 || !['ready', 'listening'].includes(phaseRef.current)) return;
    const wasListening = phaseRef.current === 'listening';
    // Claim the interaction immediately. Done Talking cannot race a cue.
    changePhase('maya_speaking');
    if (wasListening) {
      stopListening();
      await stopRecording();
      recordingRef.current = null;
      resetTranscript();
      heardRef.current = '';
      setTranscript('');
      firstWordRef.current = null;
      speechStartRef.current = null;
    }
    helpRef.current = true;
    setUsedHelp(true);
    try {
      await speak(scenario.semanticCue, { voiceId: MAYA_VOICE_ID });
    } catch (error) {
      console.warn('[GuidedCoach] clue speech unavailable', error);
    } finally {
      if (mountedRef.current) changePhase('ready');
    }
  }, [level, scenario, changePhase, speak, stopListening, stopRecording, resetTranscript]);

  const beginListening = useCallback(async () => {
    if (phaseRef.current !== 'ready' || !isSupported) return;
    changePhase('maya_speaking'); // lock buttons until recorder is ready
    resetTranscript();
    heardRef.current = '';
    setTranscript('');
    recordingRef.current = null;
    firstWordRef.current = null;
    speechStartRef.current = Date.now();
    // Audio capture is best-effort. Transcript confirmation remains mandatory.
    try { await startRecording(); }
    catch (error) { console.warn('[GuidedCoach] optional audio capture unavailable', error); }
    if (!mountedRef.current || phaseRef.current !== 'maya_speaking') return;
    changePhase('listening');
    startListening();
  }, [isSupported, changePhase, resetTranscript, startListening, startRecording]);

  const finishListening = useCallback(async () => {
    if (phaseRef.current !== 'listening') return;
    changePhase('checking'); // synchronous guard against double Done
    stopListening();
    const captured = await stopRecording();
    recordingRef.current = captured
      ? { audioBlob: captured.audioBlob, mimeType: captured.mimeType } : null;
    if (mountedRef.current) changePhase('review');
  }, [changePhase, stopListening, stopRecording]);

  const retry = useCallback(() => {
    if (phaseRef.current !== 'review') return;
    heardRef.current = '';
    recordingRef.current = null;
    resetTranscript();
    setTranscript('');
    firstWordRef.current = null;
    speechStartRef.current = null;
    changePhase('ready');
  }, [resetTranscript, changePhase]);

  const finish = useCallback(async (didComplete: boolean) => {
    if (!mountedRef.current) return;
    setPracticeMessage(didComplete
      ? 'Thank you for practicing your message!'
      : 'Thank you for practicing. You can try again another time.');
    changePhase('complete');
    const words = heardRef.current.trim().split(/\s+/).filter(Boolean).length;
    const responseLatency = firstWordRef.current != null && speechStartRef.current != null
      ? Math.max(0, firstWordRef.current - speechStartRef.current) : 0;
    await onComplete({
      turnsCompleted: didComplete ? 1 : 0,
      cardsCompleted: didComplete ? 1 : 0,
      avgLatencyMs: didComplete ? responseLatency : 0,
      userAIRatio: 0, // Not enough verified voice duration for talk-time math.
    });
  }, [changePhase, onComplete]);

  const confirmTranscript = useCallback(async () => {
    if (phaseRef.current !== 'review' || submittedRef.current) return;
    submittedRef.current = true;
    changePhase('checking');
    const response = heardRef.current.trim();
    if (!response) {
      setPracticeMessage('I did not hear a word. Please try again.');
      submittedRef.current = false;
      changePhase('review');
      return;
    }
    const wordCount = response.split(/\s+/).filter(Boolean).length;
    const support: SupportLevel = level === 1 ? 'carrier_or_full_model'
      : level === 2 ? 'choice_based'
      : helpRef.current ? 'semantic_cue' : 'independent';
    const cueUsed = level === 1 || level === 2 || helpRef.current;
    const latency = firstWordRef.current != null && speechStartRef.current != null
      ? Math.max(0, firstWordRef.current - speechStartRef.current) : null;
    let signal: Awaited<ReturnType<typeof scoreDiscourseTurn>> | null = null;
    try {
      signal = await scoreDiscourseTurn({
        exerciseSlug: 'conversation_coach',
        promptText: question,
        taskGoal: spec.taskGoal,
        transcript: response,
        wordCount,
        latencyToFirstWordMs: latency,
        scaffoldUsed: cueUsed,
        turnNumber: 1,
      });
    } catch (error) {
      console.warn('[GuidedCoach] discourse scoring unavailable; no level credit', error);
    }

    if (!mountedRef.current) return;
    const targetMet = earlyCoachTurnOnTarget(response, signal);
    const scorable = signal?.source === 'llm';
    let audioStoragePath: string | null = null;
    // Recording is optional evidence. If it cannot be uploaded, no claim that
    // audio exists is put in the raw event.
    const recording = recordingRef.current;
    if (recording) {
      try {
        const ext = recording.mimeType.includes('mp4') ? 'mp4' : 'webm';
        const path = `${userId}/${sessionId}/guided-coach-1-${Date.now()}.${ext}`;
        const { data, error } = await supabase.storage.from('session-recordings')
          .upload(path, recording.audioBlob, { contentType: recording.mimeType, upsert: false });
        if (!error) audioStoragePath = data.path;
      } catch (error) {
        console.warn('[GuidedCoach] optional audio upload not saved', error);
      }
    }
    if (!mountedRef.current) return;
    let eventSaved = false;
    try {
      const { error } = await supabase.from('exercise_events').insert({
        session_id: sessionId,
        exercise_slug: 'conversation_coach',
        round: 1,
        score: !scorable ? null : targetMet ? 100 : 0,
        error_type: !scorable ? 'unscorable' :
          targetMet ? 'correct' : signal?.errorType ?? 'below_practice_target',
        reaction_time_ms: latency,
        inputs: {
          prompt: question, transcript: response,
          word_count: wordCount, task_goal: spec.taskGoal,
          clinical_level: level, response_mode: 'spoken',
          transcript_confirmed: true, support_used: support,
          selected_choice: selectedChoice,
          audio_storage_path: audioStoragePath,
        },
        outputs: {
          clinical_practice: {
            level, target_met: targetMet,
            scoring_valid: scorable, scorer_source: signal?.source ?? 'unavailable',
            support_used: support, on_topic_score: signal?.onTopicScore ?? null,
            target_achievement_score: signal?.targetAchievementScore ?? null,
          },
        },
        engagement_flags: {
          spoke: wordCount > 0, scorer_source: signal?.source ?? 'unavailable',
        },
      });
      eventSaved = !error;
      if (error) console.warn('[GuidedCoach] clinical turn event NOT stored', error.message);
    } catch (error) {
      console.warn('[GuidedCoach] clinical turn event NOT stored', error);
    }
    if (eventSaved && scorable) {
      onClinicalTrial?.({ correct: targetMet, support, turnNumber: 1 });
    }
    if (!mountedRef.current) return;
    setPracticeMessage(!eventSaved
      ? 'We practiced, but your results could not be saved.'
      : !scorable ? 'Thank you. We could not score that answer today.'
      : targetMet ? 'You shared your message!' : 'Thank you for trying.');
    await finish(true);
  }, [changePhase, question, spec, level, userId, sessionId, selectedChoice,
    onClinicalTrial, finish]);

  const hearRecognition = useCallback(async () => {
    if (phaseRef.current !== 'review' || !heardRef.current.trim()) return;
    changePhase('maya_speaking');
    try { await speak(`I heard: ${heardRef.current}. Is that right?`, { voiceId: MAYA_VOICE_ID }); }
    catch (error) { console.warn('[GuidedCoach] transcript playback unavailable', error); }
    finally { if (mountedRef.current) changePhase('review'); }
  }, [changePhase, speak]);

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardContent className="p-6 space-y-5 text-center">
        <div aria-label="Clinical coaching level" className="space-y-2">
          <p className="text-lg font-semibold">Clinical Level {level}: {scenario.title}</p>
          <p className="text-muted-foreground">{spec.objective}</p>
        </div>
        <div aria-live="polite" className="rounded-xl bg-muted/50 p-5 text-xl font-medium">
          {level === 1 ? scenario.modeledMessage :
            level === 2 ? scenario.choiceQuestion : scenario.openQuestion}
        </div>
        {level === 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" aria-label="Suggested spoken choices">
            {scenario.choices.map(choice => (
              <Button key={choice} size="lg"
                variant={selectedChoice === choice ? 'default' : 'outline'}
                aria-pressed={selectedChoice === choice}
                onClick={() => setSelectedChoice(choice)}
                disabled={phase === 'checking' || phase === 'complete' || phase === 'listening'}>
                {choice}
              </Button>
            ))}
            <p className="col-span-full text-sm text-muted-foreground">
              Pick one, then say it aloud. Tapping alone will not finish.
            </p>
          </div>
        )}
        {!isSupported && <p role="alert">Microphone speech recognition is unavailable in this browser. This spoken task cannot be scored.</p>}
        {phase === 'start' && <Button size="lg" className="w-full" onClick={startTask} disabled={!isSupported}>
          <Volume2 className="mr-2 w-5 h-5" /> Hear Maya
        </Button>}
        {phase === 'maya_speaking' && <p role="status">Maya is speaking…</p>}
        {phase === 'ready' && <>
          <Button size="lg" className="w-full" onClick={beginListening} disabled={!isSupported}>
            <Mic className="mr-2 w-5 h-5" /> Press to Talk
          </Button>
          <Button size="lg" variant="outline" className="w-full" onClick={hearQuestion}>
            <Volume2 className="mr-2 w-5 h-5" /> Hear Maya Again
          </Button>
          {level === 3 && <Button size="lg" variant="outline" className="w-full" onClick={() => void hearClue()}>
            <Volume2 className="mr-2 w-5 h-5" /> Hear a Clue
          </Button>}
        </>}
        {phase === 'listening' && <>
          <p role="status" className="text-sm">I’m listening. Take your time.</p>
          <Button size="lg" className="w-full" onClick={() => void finishListening()}>
            Done Talking
          </Button>
          {level === 3 && <Button size="lg" variant="outline" className="w-full" onClick={() => void hearClue()}>
            Stop and Hear a Clue
          </Button>}
        </>}
        {usedHelp && level === 3 && <p className="text-sm text-muted-foreground">Maya helped with this message.</p>}
        {phase === 'review' && <>
          <p className="text-sm font-semibold">Did I hear you right?</p>
          <div className="p-3 bg-muted/40 rounded-lg" aria-label="Recognized speech">
            {transcript.trim() || 'I did not hear your answer.'}
          </div>
          {transcript.trim() && <Button className="w-full" variant="outline" size="lg" onClick={() => void hearRecognition()}>
            <Volume2 className="w-5 h-5 mr-2" /> Hear What Maya Heard
          </Button>}
          <Button className="w-full" size="lg" onClick={() => void confirmTranscript()} disabled={!transcript.trim()}>
            Yes, That’s Right
          </Button>
          <Button className="w-full" size="lg" variant="outline" onClick={retry}>Try Again</Button>
          <Button className="w-full" variant="ghost" onClick={() => void finish(false)}>Finish Without Scoring</Button>
        </>}
        {phase === 'checking' && <p role="status">Checking your answer…</p>}
        {phase === 'complete' && <p role="status">{practiceMessage || 'Thank you for practicing!'}</p>}
      </CardContent>
    </Card>
  );
}
