/**
 * The optional Minimal Pairs spoken repetition is a separate observation from
 * the auditory-discrimination answer. Never turn an unavailable Azure result
 * into a zero or use it for the discrimination score / progression.
 *
 * MediaRecorder (not browser speech-to-text) captures the real utterance.
 * The shared Azure pronunciation hook supplies provider-derived measurements.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { usePronunciationAnalysis } from '@/hooks/usePronunciationAnalysis';
import { voiceController } from '@/lib/voiceController';
import type { EchoStatus } from '@/lib/minimalPairs/echoState';

export interface MinimalPairsEchoAnalysis {
  transcript: string;
  accuracyScore: number;
  pronunciationScore: number;
  pronRequestId: string;
}

const RECORD_WINDOW_MS = 7000;
const ANALYSIS_TIMEOUT_MS = 8000;

export function useMinimalPairsEcho(trialIndex: number) {
  const { startRecording, stopRecording, cancelRecording, isSupported } = useAudioRecorder();
  const { analyzePronunciation } = usePronunciationAnalysis();
  const [status, setStatus] = useState<EchoStatus>('idle');
  const [analysis, setAnalysis] = useState<MinimalPairsEchoAnalysis | null>(null);
  const phaseRef = useRef<EchoStatus>('idle');
  const generationRef = useRef(0);
  const targetRef = useRef('');
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRecordTimer = useCallback(() => {
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }, []);

  const finish = useCallback(async () => {
    if (phaseRef.current !== 'listening') return; // single stop and assessment
    const generation = generationRef.current;
    clearRecordTimer();
    phaseRef.current = 'analyzing';
    setStatus('analyzing');

    try {
      const recording = await stopRecording();
      if (generation !== generationRef.current) return;
      if (!recording || recording.audioBlob.size === 0) {
        phaseRef.current = 'analysis-unavailable';
        setStatus('analysis-unavailable');
        return;
      }

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let result: Awaited<ReturnType<typeof analyzePronunciation>> | null;
      try {
        result = await Promise.race([
          analyzePronunciation(recording.audioBlob, targetRef.current),
          new Promise<null>(resolve => {
            timeoutId = setTimeout(() => resolve(null), ANALYSIS_TIMEOUT_MS);
          }),
        ]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
      if (generation !== generationRef.current) return;
      if (!result || !result.ok) {
        phaseRef.current = 'analysis-unavailable';
        setStatus('analysis-unavailable');
        return;
      }
      setAnalysis({
        transcript: result.data.transcript,
        accuracyScore: result.data.accuracyScore,
        pronunciationScore: result.data.pronunciationScore,
        pronRequestId: result.pronRequestId,
      });
      phaseRef.current = 'heard';
      setStatus('heard');
    } catch (error) {
      if (generation !== generationRef.current) return;
      console.warn('[MinimalPairs] spoken repetition analysis unavailable', error);
      phaseRef.current = 'analysis-unavailable';
      setStatus('analysis-unavailable');
    }
  }, [stopRecording, analyzePronunciation, clearRecordTimer]);

  const start = useCallback(async (targetWord: string) => {
    if (phaseRef.current !== 'idle') return;
    const generation = ++generationRef.current;
    targetRef.current = targetWord;
    setAnalysis(null);
    phaseRef.current = 'arming';
    setStatus('arming');

    try {
      const safe = await voiceController.awaitMicSafe(5000);
      if (generation !== generationRef.current) return;
      if (!safe || voiceController.isSessionPaused) {
        phaseRef.current = 'unavailable';
        setStatus('unavailable');
        return;
      }
      const started = await startRecording();
      if (generation !== generationRef.current) {
        if (started) cancelRecording();
        return;
      }
      if (!started) {
        phaseRef.current = 'unavailable';
        setStatus('unavailable');
        return;
      }
      // MediaRecorder has actually started: only now may the UI say Listening.
      phaseRef.current = 'listening';
      setStatus('listening');
      recordTimerRef.current = setTimeout(() => { void finish(); }, RECORD_WINDOW_MS);
    } catch (error) {
      if (generation !== generationRef.current) return;
      console.warn('[MinimalPairs] echo microphone unavailable', error);
      cancelRecording();
      phaseRef.current = 'unavailable';
      setStatus('unavailable');
    }
  }, [startRecording, cancelRecording, finish]);

  const skip = useCallback(() => {
    if (phaseRef.current === 'heard' || phaseRef.current === 'skipped') return;
    ++generationRef.current; // stale mic startup / provider response cannot overwrite skip
    clearRecordTimer();
    cancelRecording();
    setAnalysis(null);
    phaseRef.current = 'skipped';
    setStatus('skipped');
  }, [clearRecordTimer, cancelRecording]);

  const reset = useCallback(() => {
    ++generationRef.current;
    clearRecordTimer();
    cancelRecording();
    targetRef.current = '';
    setAnalysis(null);
    phaseRef.current = 'idle';
    setStatus('idle');
  }, [clearRecordTimer, cancelRecording]);

  useEffect(() => { reset(); }, [trialIndex, reset]);
  useEffect(() => () => {
    ++generationRef.current;
    clearRecordTimer();
    cancelRecording();
  }, [clearRecordTimer, cancelRecording]);
  useEffect(() => voiceController.subscribeSessionPaused(paused => {
    if (paused && ['arming', 'listening', 'analyzing'].includes(phaseRef.current)) skip();
  }), [skip]);

  return { status, analysis, start, finish, skip, isSupported };
}
