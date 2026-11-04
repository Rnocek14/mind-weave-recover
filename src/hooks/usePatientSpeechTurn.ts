/**
 * Turn-taking for open-ended aphasia exercises.
 *
 * This manages ONLY capture completion, never correctness, clinical progress,
 * or speech recognition. The patient can finish manually at any point.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createPatientPauseHistory,
  getPatientTurnSilenceMs,
  isExplicitlyUnfinishedSpeech,
  observePatientSpeech,
  resetPatientPauseHistory,
  type PatientSpeechTask,
} from '@/lib/speech/patientTurnTaking';

interface UsePatientSpeechTurnOptions {
  task: PatientSpeechTask;
  transcript: string;
  enabled: boolean;
  onSpeechEnd: (transcript: string) => void;
}

export function usePatientSpeechTurn({
  task,
  transcript,
  enabled,
  onSpeechEnd,
}: UsePatientSpeechTurnOptions) {
  const [waitingForCompletion, setWaitingForCompletion] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef(createPatientPauseHistory());
  const latestTextRef = useRef('');
  const lastScheduledTextRef = useRef('');
  const hasSubmittedRef = useRef(false);
  const onSpeechEndRef = useRef(onSpeechEnd);
  const enabledRef = useRef(enabled);
  onSpeechEndRef.current = onSpeechEnd;
  enabledRef.current = enabled;

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const finishNow = useCallback(() => {
    cancelTimer();
    if (hasSubmittedRef.current) return;
    const answer = latestTextRef.current.trim();
    if (!answer) return;
    hasSubmittedRef.current = true;
    setWaitingForCompletion(false);
    onSpeechEndRef.current(answer);
  }, [cancelTimer]);

  const resetTurn = useCallback(() => {
    cancelTimer();
    hasSubmittedRef.current = false;
    latestTextRef.current = '';
    lastScheduledTextRef.current = '';
    historyRef.current = resetPatientPauseHistory(historyRef.current);
    setWaitingForCompletion(false);
  }, [cancelTimer]);

  useEffect(() => {
    const text = transcript.trim();
    if (!enabled || !text || hasSubmittedRef.current) {
      cancelTimer();
      return;
    }

    if (text !== latestTextRef.current) {
      historyRef.current = observePatientSpeech(historyRef.current, text, Date.now());
      latestTextRef.current = text;
      setWaitingForCompletion(false);
    }

    // Never keep the timer from a previous hypothesis or disabled state.
    if (text !== lastScheduledTextRef.current || timerRef.current === null) {
      cancelTimer();
      lastScheduledTextRef.current = text;
      const delay = getPatientTurnSilenceMs(task, text, historyRef.current.pausesMs);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!enabledRef.current || hasSubmittedRef.current ||
            latestTextRef.current !== text) return;

        // A transcript ending in "because", "and", "um", etc. is strong
        // evidence of an interrupted thought. Keep listening, show Done,
        // and do NOT make an incomplete answer into a clinical "failure".
        if (isExplicitlyUnfinishedSpeech(text)) {
          setWaitingForCompletion(true);
          return;
        }
        finishNow();
      }, delay);
    }
  }, [task, transcript, enabled, cancelTimer, finishNow]);

  useEffect(() => () => cancelTimer(), [cancelTimer]);

  return { finishNow, resetTurn, cancelTimer, waitingForCompletion };
}
