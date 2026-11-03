/**
 * Adult functional-language practice player.
 *
 * Every stage changes the task format/content. Objective choice/ordering
 * feedback is practice-only; open speech is an observed attempt, never an
 * algorithmic judgment of language competence or functional transfer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Mic, MicOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import {
  evaluateFunctionalPracticeTrial, getFunctionalPracticeTrials,
  type FunctionalPracticeKind, type FunctionalPracticeStage,
  type FunctionalPracticeTrial,
} from '@/lib/practice/functionalStageContent';

export type FunctionalPracticeInputMode =
  'choice' | 'reordered' | 'typed' | 'browser_recognized' | 'self_report' | 'skipped';

export interface FunctionalPracticeResult {
  trialId: string;
  stage: number;
  taskKind: FunctionalPracticeTrial['kind'];
  inputMode: FunctionalPracticeInputMode;
  userResponse: string | null;
  correct: boolean | null;
  practiceAccuracy: number | null;
  supportRevealed: boolean;
  /** Literal spoken and visible support provided, when requested. */
  supportText: string | null;
  baselineSupport: FunctionalPracticeStage['support'];
  clinicalProgressionEligible: false;
  independentSpokenScoreEligible: false;
}

interface Props {
  kind: FunctionalPracticeKind;
  stage: FunctionalPracticeStage;
  sessionSeed?: string;
  roundCount?: number;
  onTrialComplete: (result: FunctionalPracticeResult) => void;
  onGameComplete: (results: FunctionalPracticeResult[]) => void;
}

export function FunctionalPracticeGame({
  kind, stage, sessionSeed, roundCount = 3, onTrialComplete, onGameComplete,
}: Props) {
  const trials = useMemo(
    () => getFunctionalPracticeTrials(kind, stage.level, roundCount, sessionSeed),
    [kind, stage.level, roundCount, sessionSeed],
  );
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<FunctionalPracticeResult[]>([]);
  const [feedback, setFeedback] = useState<FunctionalPracticeResult | null>(null);
  const [help, setHelp] = useState(false);
  const [order, setOrder] = useState<string[]>(() => {
    const task = trials[0];
    return task?.kind === 'order' ? [task.ordered[2], task.ordered[0], task.ordered[1]] : [];
  });
  const [response, setResponse] = useState('');
  const [responseMode, setResponseMode] = useState<'typed' | 'browser_recognized'>('typed');
  const [finished, setFinished] = useState(false);
  const mountedRef = useRef(true);
  const lockedRef = useRef(false);
  const doneRef = useRef(false);
  const micRequestedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = trials[index];

  const handleSpeech = useCallback((text: string) => {
    if (!mountedRef.current || lockedRef.current || !micRequestedRef.current) return;
    setResponse(text);
    setResponseMode('browser_recognized');
  }, []);
  const {
    isSupported, isListening, startListening, stopListening, error: micError,
  } = useSpeechRecognition({ onResult: handleSpeech, continuousListening: true });
  const { speak, stop, isSpeaking } = useTextToSpeech();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      micRequestedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      stopListening();
      stop();
    };
    // Stop/recognizer references are owned by the mounted hook instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!current) return;
    const options = current.kind === 'choice'
      ? 'Option A. ' + current.options[0] + '. Option B. ' + current.options[1] + '.'
      : current.kind === 'order' ? current.ordered.join('. ') : '';
    void speak(stage.instruction + ' ' + current.prompt + ' ' + options);
    // Speaking happens on each new trial, never while listening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, stage.level, index]);

  const submit = (answer: {
    inputMode: FunctionalPracticeInputMode;
    userResponse?: string | null;
    choiceIndex?: number;
    order?: readonly string[];
  }) => {
    if (!current || lockedRef.current || doneRef.current) return;
    lockedRef.current = true;
    micRequestedRef.current = false;
    stopListening();
    stop();

    const verdict = answer.inputMode === 'skipped'
      ? { correct: current.kind === 'open' ? null : false,
          practiceAccuracy: current.kind === 'open' ? null : 0 }
      : evaluateFunctionalPracticeTrial(current, answer);
    const result: FunctionalPracticeResult = {
      trialId: current.id, stage: stage.level, taskKind: current.kind,
      inputMode: answer.inputMode, userResponse: answer.userResponse ?? null,
      correct: verdict.correct, practiceAccuracy: verdict.practiceAccuracy,
      supportRevealed: help, supportText: help ? current.clue : null,
      baselineSupport: stage.support,
      clinicalProgressionEligible: false, independentSpokenScoreEligible: false,
    };
    const updated = [...results, result];
    setResults(updated);
    setFeedback(result);
    onTrialComplete(result);
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current || doneRef.current) return;
      if (index + 1 >= trials.length) {
        doneRef.current = true;
        setFinished(true);
        onGameComplete(updated);
        return;
      }
      const next = trials[index + 1];
      setOrder(next.kind === 'order'
        ? [next.ordered[2], next.ordered[0], next.ordered[1]] : []);
      setResponse('');
      setResponseMode('typed');
      setHelp(false);
      setFeedback(null);
      lockedRef.current = false;
      setIndex(index + 1);
    }, 1600);
  };

  const playSupport = (text: string) => {
    // Never let Maya's model/clue be captured as the patient's next answer.
    micRequestedRef.current = false;
    stopListening();
    void speak(text);
  };
  const submitResponse = () => {
    const trimmed = response.trim();
    if (!trimmed) return;
    submit({ inputMode: responseMode, userResponse: trimmed });
  };
  const toggleMic = () => {
    if (isListening || micRequestedRef.current) {
      micRequestedRef.current = false;
      stopListening();
      return;
    }
    if (!isSupported || isSpeaking || feedback) return;
    stop();
    micRequestedRef.current = true;
    startListening();
  };
  if (!current) return <p role="status" className="p-6 text-center">
    No practice items available for this stage.
  </p>;
  if (finished) return <p role="status" className="p-6 text-center text-xl">
    Practice attempts recorded. Saving results…
  </p>;

  return <div className="max-w-xl mx-auto space-y-4 p-4">
    <div className="space-y-2 rounded-xl bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">
        Practice stage {stage.level}/8 — question {index + 1} of {trials.length}
      </p>
      <h2 className="text-xl font-semibold">{stage.title}</h2>
      <p className="text-base">{stage.instruction}</p>
    </div>
    <div className="space-y-3 rounded-xl border p-4">
      <h3 className="text-lg font-semibold">{current.title}</h3>
      <p className="text-xl">{current.prompt}</p>
      <Button variant="outline" className="w-full min-h-14" size="lg"
        disabled={!!feedback} onClick={() => playSupport(current.prompt)}>
        <Volume2 className="mr-2 h-5 w-5"/> Hear the question again
      </Button>
    </div>
    {!feedback && <>
      {!help ? <Button variant="outline" size="lg" className="w-full min-h-14"
        onClick={() => { setHelp(true); playSupport(current.clue); }}>
        Need a clue?
      </Button> : <p role="status" className="rounded-lg bg-muted p-4">{current.clue}</p>}
      {current.kind === 'choice' && <div className="space-y-3">
        {current.options.map((option, idx) =>
          <Button key={idx} size="lg" variant="outline" className="min-h-16 w-full h-auto whitespace-normal p-4 text-left justify-start"
            onClick={() => submit({ inputMode: 'choice', choiceIndex: idx })}>
            {idx === 0 ? 'A.' : 'B.'} {option}
          </Button>)}
      </div>}
      {current.kind === 'order' && <div className="space-y-3">
        <p className="text-base">Move the words into the right order.</p>
        {order.map((word, i) => <div key={word} className="flex items-center gap-2 rounded-xl border p-3">
          <span className="w-6">{i + 1}.</span>
          <span className="flex-1 text-lg">{word}</span>
          <Button size="icon" variant="outline" className="w-12 h-12"
            aria-label={'Move up: ' + word} disabled={i === 0}
            onClick={() => setOrder(old => {
              const next = [...old]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next;
            })}><ArrowUp className="w-5 h-5"/></Button>
          <Button size="icon" variant="outline" className="w-12 h-12"
            aria-label={'Move down: ' + word} disabled={i === order.length - 1}
            onClick={() => setOrder(old => {
              const next = [...old]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; return next;
            })}><ArrowDown className="w-5 h-5"/></Button>
        </div>)}
        <Button size="lg" className="w-full min-h-14"
          onClick={() => submit({ inputMode: 'reordered', order })}>Check sentence</Button>
      </div>}
      {current.kind === 'open' && <div className="space-y-3">
        <p className="text-base">
          Try speaking or typing. A care partner can help; there is no automatic right/wrong score.
        </p>
        {current.prompts.map((prompt, i) =>
          <p key={i} className="rounded-lg bg-muted/30 p-3">{i + 1}. {prompt}</p>)}
        <Textarea aria-label="Your own words" placeholder="Your message (optional)"
          rows={3} className="text-base min-h-24" value={response}
          onChange={event => {
            // A patient choosing typing owns this answer. Stop the browser
            // recognizer before a late hypothesis can overwrite the draft.
            micRequestedRef.current = false;
            stopListening();
            setResponse(event.target.value);
            setResponseMode('typed');
          }}/>
        {isSupported && <Button variant="outline" size="lg" className="w-full min-h-14"
          disabled={isSpeaking} onClick={toggleMic}>
          {isListening ? <><MicOff className="mr-2 w-5 h-5"/> Stop microphone</>
            : <><Mic className="mr-2 w-5 h-5"/> Try speaking</>}
        </Button>}
        {micError && <p role="status">Microphone unavailable. You can type or report trying.</p>}
        <Button size="lg" className="w-full min-h-14" disabled={!response.trim()}
          onClick={submitResponse}>Record my response</Button>
        <Button variant="outline" size="lg" className="w-full min-h-14"
          onClick={() => submit({ inputMode: 'self_report' })}>
          I tried speaking (no transcript)
        </Button>
      </div>}
      <Button variant="ghost" size="lg" className="w-full min-h-14"
        onClick={() => submit({ inputMode: 'skipped' })}>Skip this question</Button>
    </>}
    {feedback && <div role="status" className="rounded-xl bg-muted p-4 space-y-2 text-center">
      <p className="text-lg font-semibold">
        {feedback.inputMode === 'skipped' ? 'Question skipped.'
          : feedback.correct === null ? 'Your practice attempt was recorded.'
            : feedback.correct ? 'That matches.' : 'Here is a useful answer.'}
      </p>
      {feedback.correct === false && current.kind === 'choice' &&
        <p>{current.options[current.correctIndex]}</p>}
      {feedback.correct === false && current.kind === 'order' &&
        <p>{current.ordered.join(' ')}</p>}
      <p className="text-sm text-muted-foreground">
        These are practice observations, not clinical language-recovery scores.
      </p>
    </div>}
  </div>;
}
