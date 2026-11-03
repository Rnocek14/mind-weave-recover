/**
 * Word Finding and Sentence Game: independently routed, practice-only modes.
 * A care partner may choose a task format; this never touches persisted
 * clinical_progression_state or the patient's clinical mastery levels.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { useRestoredLessonContext } from '@/hooks/useRestoredLessonContext';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import { hasMissingClinicalRawEvidence } from '@/lib/trial/clinicalRawCompletionGate';
import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import { UnverifiedPracticeBanner } from '@/components/exercise/UnverifiedPracticeBanner';
import { FunctionalPracticeGame, type FunctionalPracticeResult } from '@/components/FunctionalPracticeGame';
import {
  FUNCTIONAL_PRACTICE_STAGES,
  getFunctionalPracticeStage,
  type FunctionalPracticeKind, type FunctionalPracticeLevel,
} from '@/lib/practice/functionalStageContent';
import type { SupportLevel } from '@/lib/progression/clinicalProgression';

interface Props { kind: FunctionalPracticeKind }

const LABELS: Record<FunctionalPracticeKind, string> = {
  'word-finding': 'Word Finding',
  'sentence-game': 'Sentence Game',
};

function supportFor(result: FunctionalPracticeResult): SupportLevel {
  if (result.baselineSupport === 'full_model') return 'carrier_or_full_model';
  if (result.baselineSupport === 'phonemic_cue') return 'phonemic_cue';
  if (result.supportRevealed || result.baselineSupport === 'semantic_cue') return 'semantic_cue';
  return result.taskKind === 'open' ? 'open_response' : 'recognition_only';
}

export default function FunctionalPracticeExercise({ kind }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProfile } = useProfile();
  const slug = kind.replace(/-/g, '_');
  const restored = useRestoredLessonContext(slug);
  const { activeSessionId, isCreatingSession } = useStandaloneSession(
    user?.id, restored.sessionId, slug,
  );
  const scope = JSON.stringify([kind, user?.id ?? null, activeProfile?.id ?? null, activeSessionId ?? null]);
  const [selected, setSelected] = useState<{
    scope: string; level: FunctionalPracticeLevel;
  } | null>(null);
  const level = selected?.scope === scope ? selected.level : 1;
  const stage = getFunctionalPracticeStage(kind, level)!;
  const [startedScope, setStartedScope] = useState<string | null>(null);
  const [finishState, setFinishState] = useState<{
    scope: string; phase: 'saving' | 'saved' | 'failed';
  } | null>(null);
  const started = restored.fromLesson || startedScope === scope;
  const phase = finishState?.scope === scope ? finishState.phase : null;
  const scopeRef = useRef(scope);
  const pendingRef = useRef<Array<Promise<{ok: boolean}>>>([]);
  const completedRef = useRef(false);
  const dispatchedRef = useRef(false);
  const attemptsRef = useRef(0);
  const objectiveCorrectRef = useRef(0);
  const beganRef = useRef(Date.now());

  useEffect(() => {
    scopeRef.current = scope;
    pendingRef.current = [];
    completedRef.current = false;
    dispatchedRef.current = false;
    attemptsRef.current = 0;
    objectiveCorrectRef.current = 0;
    beganRef.current = Date.now();
  }, [scope]);

  const stats = useCallback(() => ({
    score: objectiveCorrectRef.current,
    totalTrials: attemptsRef.current,
    startTime: beganRef.current,
  }), []);
  const { completeSession } = useSessionLifecycle({
    sessionId: activeSessionId,
    userId: user?.id,
    profileId: activeProfile?.id,
    exerciseSlug: slug,
    getSessionStats: stats,
  });
  const { submitTrial, commitSession } = useTrialSubmission({
    userId: user?.id,
    profileId: activeProfile?.id,
    sessionId: activeSessionId,
    exerciseSlug: slug,
    progression: null,
  });

  const record = useCallback((attempt: FunctionalPracticeResult) => {
    if (!user?.id || !activeProfile?.id || !activeSessionId || scopeRef.current !== scope) return;
    attemptsRef.current += 1;
    if (attempt.correct === true) objectiveCorrectRef.current += 1;
    const pending = submitTrial({
      profileId: activeProfile.id,
      sessionId: activeSessionId,
      gameId: slug,
      level: attempt.stage,
      stimulusId: attempt.trialId,
      expectedResponse: null,
      userResponse: attempt.userResponse,
      browserTranscript: attempt.inputMode === 'browser_recognized'
        ? attempt.userResponse : null,
      isCorrect: attempt.correct === true,
      accuracyScore: attempt.practiceAccuracy,
      cueLevel: attempt.supportRevealed ? 1 : 0,
      supportUsed: supportFor(attempt),
      trialMode: attempt.taskKind === 'open' ? 'mixed' : 'recognition',
      clinicalProgressionEligible: false,
      errorType: attempt.inputMode === 'skipped' ? 'skipped_practice'
        : attempt.correct === null ? 'ungraded_open_practice'
        : attempt.correct === false ? 'practice_mismatch' : undefined,
      taskParameters: {
        practice_stage: attempt.stage,
        practice_task_kind: attempt.taskKind,
        practice_input_mode: attempt.inputMode,
        practice_answer_correct: attempt.correct,
        practice_accuracy: attempt.practiceAccuracy,
        practice_support_revealed: attempt.supportRevealed,
        practice_baseline_support: attempt.baselineSupport,
        clinical_progression_eligible: false,
        clinical_score_eligible: false,
        independent_spoken_score_eligible: false,
        completion_source: 'nonclinical_functional_language_practice',
      },
    });
    pendingRef.current.push(pending);
  }, [user?.id, activeProfile?.id, activeSessionId, submitTrial, slug, scope]);

  const finish = useCallback(async (results: FunctionalPracticeResult[]) => {
    if (completedRef.current || scopeRef.current !== scope) return;
    completedRef.current = true;
    setFinishState({ scope, phase: 'saving' });
    const pending = pendingRef.current.splice(0);
    const outcomes = await Promise.allSettled(pending);
    if (scopeRef.current !== scope) return;
    if (pending.length !== results.length || pending.length !== attemptsRef.current
      || outcomes.some(outcome => outcome.status === 'rejected' || outcome.value.ok !== true)) {
      setFinishState({ scope, phase: 'failed' });
      return;
    }
    try {
      const commit = await commitSession();
      if (scopeRef.current !== scope) return;
      if (hasMissingClinicalRawEvidence(commit)) {
        setFinishState({ scope, phase: 'failed' }); return;
      }
      await completeSession();
      if (scopeRef.current !== scope) return;
      setFinishState({ scope, phase: 'saved' });
      if (restored.fromLesson && !dispatchedRef.current) {
        dispatchedRef.current = true;
        window.dispatchEvent(new CustomEvent('exercise-complete', {
          detail: {
            exerciseSlug: kind,
            results: { trials: results.length, practiceOnly: true },
          },
        }));
        navigate(restored.returnTo, { state: { resuming: true }, replace: true });
      }
    } catch {
      if (scopeRef.current === scope) setFinishState({ scope, phase: 'failed' });
    }
  }, [scope, commitSession, completeSession, restored.fromLesson, restored.returnTo, kind, navigate]);

  const start = () => {
    if (!user?.id || !activeProfile?.id || !activeSessionId) return;
    pendingRef.current = [];
    completedRef.current = false;
    dispatchedRef.current = false;
    attemptsRef.current = 0;
    objectiveCorrectRef.current = 0;
    beganRef.current = Date.now();
    setFinishState(null);
    setStartedScope(scope);
  };
  if (!user?.id || !activeProfile?.id) return <div
    className="min-h-dvh flex justify-center items-center p-6 text-center text-lg">
    Choose a patient profile or ask a care partner for help.
  </div>;
  if (isCreatingSession || !activeSessionId) return <ExerciseLoading/>;
  if (phase === 'failed') return <UnverifiedPracticeBanner/>;

  return <div className="min-h-dvh bg-background">
    <header className="sticky top-0 z-40 bg-background border-b">
      <div className="mx-auto max-w-xl h-16 flex items-center justify-between px-4">
        <Button variant="ghost" className="min-h-12"
          onClick={() => navigate(restored.fromLesson ? restored.returnTo : '/today')}>
          <ArrowLeft className="w-4 h-4 mr-2"/> Back
        </Button>
        <h1 className="font-semibold text-lg">{LABELS[kind]}</h1>
        <span className="w-12"/>
      </div>
    </header>
    <main className="mx-auto max-w-xl p-4">
      {phase === 'saving' && <p role="status" className="p-8 text-xl text-center">
        Saving your practice…
      </p>}
      {phase === 'saved' && <div role="status" className="p-8 space-y-4 text-center">
        <h2 className="text-2xl font-bold">Practice saved</h2>
        <p>You practiced everyday communication.</p>
        <p className="text-base">
          Spoken and typed attempts were logged as practice, not clinical accuracy.
        </p>
        <Button className="w-full min-h-14" onClick={() => navigate('/today')}>
          Return to Today
        </Button>
      </div>}
      {!phase && !started && <div className="space-y-4">
        <h2 className="text-2xl font-bold text-center">{LABELS[kind]}</h2>
        <p className="text-center text-lg">
          Listen, choose or share your words. Take your time. Help is available.
        </p>
        <details className="rounded-xl border p-4">
          <summary className="min-h-12 cursor-pointer font-semibold">
            Care partner: choose a practice stage
          </summary>
          <p className="text-sm text-muted-foreground py-3">
            These are practice formats, not saved clinical recovery levels.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FUNCTIONAL_PRACTICE_STAGES[kind].map(option =>
              <Button key={option.level} className="min-h-16 h-auto w-full text-left justify-start whitespace-normal p-3"
                variant={option.level === level ? 'default' : 'outline'}
                aria-pressed={option.level === level}
                onClick={() => setSelected({ scope, level: option.level })}>
                Stage {option.level}: {option.title}
              </Button>)}
          </div>
        </details>
        <p role="status" className="text-center">{stage.instruction}</p>
        <Button size="lg" className="min-h-16 w-full text-lg" onClick={start}>
          Start practice
        </Button>
      </div>}
      {!phase && started && <FunctionalPracticeGame
        key={scope + ':' + level}
        kind={kind} stage={stage} onTrialComplete={record} onGameComplete={finish}/>}
    </main>
  </div>;
}
