/**
 * Patient-owned Thought Organization practice route.
 * No saved clinical level is read/promoted: eight caregiver-selectable,
 * nonclinical activities with individually attributed results.
 */
import {useCallback,useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Button} from '@/components/ui/button';
import {ArrowLeft} from 'lucide-react';
import {useAuth} from '@/hooks/useAuth';
import {useProfile} from '@/hooks/useProfile';
import {useStandaloneSession} from '@/hooks/useStandaloneSession';
import {useSessionLifecycle} from '@/hooks/useSessionLifecycle';
import {useRestoredLessonContext} from '@/hooks/useRestoredLessonContext';
import {useTrialSubmission} from '@/hooks/useTrialSubmission';
import {hasMissingClinicalRawEvidence} from '@/lib/trial/clinicalRawCompletionGate';
import {UnverifiedPracticeBanner} from '@/components/exercise/UnverifiedPracticeBanner';
import {ExerciseLoading} from '@/components/exercise/ExerciseLoading';
import {ThoughtOrganizationGame,type ThoughtOrganizationRoundResult} from '@/components/ThoughtOrganizationGame';
import {
  THOUGHT_ORGANIZATION_STAGES,getThoughtOrganizationStage,
  type ThoughtOrganizationLevel,
} from '@/lib/thoughtOrganization/practiceStages';

const SLUG='thought_organization';

export default function ThoughtOrganizationExercise(){
  const navigate=useNavigate();
  const {user}=useAuth();
  const {activeProfile}=useProfile();
  const restored=useRestoredLessonContext(SLUG);
  const {activeSessionId,isCreatingSession}=useStandaloneSession(
    user?.id,restored.sessionId,SLUG,
  );
  const scope=JSON.stringify([user?.id??null,activeProfile?.id??null,activeSessionId??null]);
  const [stageChoice,setStageChoice]=useState<{
    scope:string;level:ThoughtOrganizationLevel;
  }|null>(null);
  const level=stageChoice?.scope===scope?stageChoice.level:1;
  const stage=getThoughtOrganizationStage(level)!;
  const [startedScope,setStartedScope]=useState<string|null>(null);
  const [finishState,setFinishState]=useState<{
    scope:string;phase:'saving'|'saved'|'failed';
  }|null>(null);
  const started=restored.fromLesson||startedScope===scope;
  const phase=finishState?.scope===scope?finishState.phase:null;
  const pendingRef=useRef<Array<Promise<{ok:boolean}>>>([]);
  const completedRef=useRef(false);
  const deliveredRef=useRef(false);
  const scopeRef=useRef(scope);
  const attemptsRef=useRef(0);
  const objectiveCorrectRef=useRef(0);
  const beganRef=useRef(Date.now());

  useEffect(()=>{
    scopeRef.current=scope;
    pendingRef.current=[];
    completedRef.current=false;
    deliveredRef.current=false;
    attemptsRef.current=0;
    objectiveCorrectRef.current=0;
    beganRef.current=Date.now();
  },[scope]);

  const stats=useCallback(()=>({
    score:objectiveCorrectRef.current,
    totalTrials:attemptsRef.current,
    startTime:beganRef.current,
  }),[]);
  const {completeSession}=useSessionLifecycle({
    sessionId:activeSessionId,userId:user?.id,profileId:activeProfile?.id,
    exerciseSlug:SLUG,getSessionStats:stats,
  });
  const {submitTrial,commitSession}=useTrialSubmission({
    userId:user?.id,profileId:activeProfile?.id,
    sessionId:activeSessionId,exerciseSlug:SLUG,progression:null,
  });

  const handleTrial=useCallback((attempt:ThoughtOrganizationRoundResult)=>{
    if(!user?.id||!activeProfile?.id||!activeSessionId||scopeRef.current!==scope)return;
    attemptsRef.current++;
    if(attempt.correct===true)objectiveCorrectRef.current++;
    const pending=submitTrial({
      profileId:activeProfile.id,sessionId:activeSessionId,
      gameId:SLUG,level:attempt.stage,stimulusId:attempt.trialId,
      expectedResponse:null,userResponse:attempt.userResponse,
      browserTranscript:attempt.inputMode==='browser_recognized'
        ?attempt.userResponse:null,
      isCorrect:attempt.correct===true,
      accuracyScore:attempt.practiceAccuracy,
      cueLevel:attempt.supportRevealed?1:0,
      supportUsed:attempt.supportRevealed?'semantic_cue':'recognition_only',
      trialMode:attempt.taskKind==='open'?'mixed':'recognition',
      clinicalProgressionEligible:false,
      errorType:attempt.inputMode==='skipped'?'skipped_practice':
        attempt.correct===null?'ungraded_open_practice':
        attempt.correct===false?'practice_mismatch':undefined,
      taskParameters:{
        practice_stage:attempt.stage,
        practice_task_kind:attempt.taskKind,
        practice_input_mode:attempt.inputMode,
        practice_answer_correct:attempt.correct,
        practice_accuracy:attempt.practiceAccuracy,
        practice_support_revealed:attempt.supportRevealed,
        clinical_progression_eligible:false,
        independent_spoken_score_eligible:false,
        clinical_score_eligible:false,
        completion_source:'nonclinical_thought_organization',
      },
    });
    pendingRef.current.push(pending);
  },[user?.id,activeProfile?.id,activeSessionId,submitTrial,scope]);

  const handleComplete=useCallback(async (results:ThoughtOrganizationRoundResult[])=>{
    if(completedRef.current||scopeRef.current!==scope)return;
    completedRef.current=true;
    setFinishState({scope,phase:'saving'});
    // Never celebrate a fake success or move an aphasic patient forward if
    // the raw attempts were not all durably submitted.
    const writes=pendingRef.current.splice(0);
    const outcomes=await Promise.allSettled(writes);
    if(scopeRef.current!==scope)return;
    if(writes.length!==results.length||writes.length!==attemptsRef.current||
      outcomes.some(o=>o.status==='rejected'||o.value.ok!==true)){
      setFinishState({scope,phase:'failed'});return;
    }
    try {
      const commit=await commitSession();
      if(scopeRef.current!==scope)return;
      if(hasMissingClinicalRawEvidence(commit)){
        setFinishState({scope,phase:'failed'});return;
      }
      await completeSession();
      if(scopeRef.current!==scope)return;
      setFinishState({scope,phase:'saved'});
      if(restored.fromLesson&&!deliveredRef.current){
        deliveredRef.current=true;
        window.dispatchEvent(new CustomEvent('exercise-complete',{
          detail:{exerciseSlug:'thought-organization',
            results:{trials:results.length,practiceOnly:true}},
        }));
        navigate(restored.returnTo,{state:{resuming:true},replace:true});
      }
    }catch{
      if(scopeRef.current===scope)setFinishState({scope,phase:'failed'});
    }
  },[scope,commitSession,completeSession,restored.fromLesson,restored.returnTo,navigate]);

  const choose=(next:ThoughtOrganizationLevel)=>{
    setStageChoice({scope,level:next});
  };
  const start=()=>{
    if(!user?.id||!activeProfile?.id||!activeSessionId)return;
    pendingRef.current=[];
    attemptsRef.current=0;
    objectiveCorrectRef.current=0;
    completedRef.current=false;
    deliveredRef.current=false;
    beganRef.current=Date.now();
    setFinishState(null);
    setStartedScope(scope);
  };

  if(!user?.id||!activeProfile?.id){
    return <div className="min-h-dvh flex items-center justify-center p-6 text-center">
      <p className="text-lg">Choose a patient profile or ask a care partner to help.</p>
    </div>;
  }
  if(isCreatingSession||!activeSessionId)return <ExerciseLoading/>;
  if(phase==='failed')return <UnverifiedPracticeBanner/>;

  return <div className="min-h-dvh bg-background">
    <header className="sticky top-0 z-40 bg-background border-b">
      <div className="mx-auto max-w-xl h-14 px-4 flex items-center justify-between">
        <Button variant="ghost" onClick={()=>navigate(restored.fromLesson?restored.returnTo:'/today')}>
          <ArrowLeft className="w-4 h-4 mr-2"/>Back
        </Button>
        <h1 className="text-base font-semibold">Organize Your Thoughts</h1>
        <span className="w-12"/>
      </div>
    </header>
    <main className="mx-auto max-w-xl p-4">
      {phase==='saving'&&<p role="status" className="text-center text-xl p-8">
        Saving your practice…
      </p>}
      {phase==='saved'&&<div role="status" className="space-y-4 text-center p-8">
        <h2 className="text-2xl font-bold">Practice saved</h2>
        <p>You practiced organizing everyday ideas.</p>
        <p className="text-sm text-muted-foreground">
          Open responses were recorded as practice attempts, not clinical scores.
        </p>
        <Button className="w-full min-h-14" onClick={()=>navigate('/today')}>
          Return to Today
        </Button>
      </div>}
      {!phase&&!started&&<div className="space-y-4">
        <h2 className="text-2xl font-bold text-center">Organize everyday ideas</h2>
        <p className="text-base text-center">
          Listen, choose, or share your thoughts. You can ask for help.
        </p>
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer min-h-10 font-semibold">
            Care partner: choose a practice stage
          </summary>
          <p className="text-sm text-muted-foreground py-2">
            These change the practice task, not a saved clinical recovery level.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {THOUGHT_ORGANIZATION_STAGES.map(mode=><Button
              key={mode.level} variant={level===mode.level?'default':'outline'}
              aria-pressed={level===mode.level} onClick={()=>choose(mode.level)}
              className="w-full min-h-14 h-auto whitespace-normal text-left justify-start p-3">
              Stage {mode.level}: {mode.title}
            </Button>)}
          </div>
        </details>
        <p role="status" className="text-center">{stage.instruction}</p>
        <Button size="lg" className="w-full min-h-16 text-lg" onClick={start}>
          Start practice
        </Button>
      </div>}
      {!phase&&started&&<ThoughtOrganizationGame key={scope+':'+stage.level}
        stage={stage} onTrialComplete={handleTrial}
        onGameComplete={handleComplete}/>}
    </main>
  </div>;
}
