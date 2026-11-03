/**
 * Isolated practice-mode writer for two existing games. The parent page owns
 * the session; this component cannot change clinical progression or mastery.
 * Raw writes are acknowledged before completion or navigation.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import { UnverifiedPracticeBanner } from '@/components/exercise/UnverifiedPracticeBanner';
import { ReasoningStagePracticeGame, type ReasoningPracticeResult } from './ReasoningStagePracticeGame';
import {
  REASONING_PRACTICE_STAGES,getReasoningPracticeScenes,getReasoningPracticeStage,
  reasoningPracticeEventSlug,
  type ReasoningPracticeKind,type ReasoningPracticeLevel,
} from '@/lib/reasoningPractice/stages';
import type { SupportLevel } from '@/lib/progression/clinicalProgression';

interface Props {
  kind:ReasoningPracticeKind;
  userId:string;
  profileId:string;
  sessionId:string;
  onSaved:(attempts:number)=>Promise<void>;
  onExit:()=>void;
}
function supportUsed(result:ReasoningPracticeResult):SupportLevel{
  if(result.modelRevealedBeforeAttempt)return 'carrier_or_full_model';
  if(result.clueRevealed)return 'semantic_cue';
  return result.responseKind==='choice'?'recognition_only':'open_response';
}

export function ReasoningStagePracticeSession({
  kind,userId,profileId,sessionId,onSaved,onExit,
}:Props){
  const [level,setLevel]=useState<ReasoningPracticeLevel>(1);
  const [started,setStarted]=useState(false);
  const [phase,setPhase]=useState<'playing'|'saving'|'saved'|'failed'>('playing');
  const pendingRef=useRef<Array<Promise<{ok:boolean}>>>([]);
  const attemptsRef=useRef(0);
  const completedRef=useRef(false);
  const scope=JSON.stringify([kind,userId,profileId,sessionId]);
  const ownerRef=useRef(scope);
  const ownerChanged=ownerRef.current!==scope;
  const {submitTrial,commitSession}=useTrialSubmission({
    userId,profileId,sessionId,
    exerciseSlug:reasoningPracticeEventSlug(kind),progression:null,
  });
  const stage=getReasoningPracticeStage(kind,level)!;
  const scenes=useMemo(()=>getReasoningPracticeScenes(kind,level),
    [kind,level]);

  const record=useCallback((result:ReasoningPracticeResult)=>{
    if(completedRef.current||ownerRef.current!==scope)return;
    const trialIndex=attemptsRef.current++;
    // In all modes the authored example is a PRACTICE observation. Its
    // correctness is never treated as speech recognition or recovery.
    const promised=submitTrial({
      profileId,sessionId,gameId:reasoningPracticeEventSlug(kind),
      trialIndex,level:result.stage,stimulusId:result.trialId,
      expectedResponse:null,
      userResponse:result.userResponse,
      browserTranscript:result.inputMode==='browser_recognized'?result.userResponse:null,
      isCorrect:result.practiceMatch===true,
      accuracyScore:result.practiceMatch===null?null:result.practiceMatch?1:0,
      cueLevel:result.modelRevealedBeforeAttempt?3:result.clueRevealed?1:0,
      supportUsed:supportUsed(result),
      trialMode:result.responseKind==='choice'?'recognition':'mixed',
      clinicalProgressionEligible:false,
      errorType:result.inputMode==='skipped'?'skipped_practice':
        result.practiceMatch===null?'ungraded_reasoning_practice':
          result.practiceMatch?'correct_practice_choice':'nonmatching_practice_choice',
      taskParameters:{
        reasoning_practice:true,practice_only:true,
        reasoning_source_game:kind.replace(/-/g,'_'),
        reasoning_practice_stage:result.stage,
        reasoning_scene_id:result.sceneId,reasoning_scene_title:result.sceneTitle,
        reasoning_step_index:result.stepIndex,reasoning_step_id:result.trialId,
        reasoning_target_skill:result.skill,
        reasoning_input_mode:result.inputMode,
        reasoning_response_kind:result.responseKind,
        reasoning_selected_choice:result.selectedChoice,
        reasoning_choice_match:result.practiceMatch,
        reasoning_clue_revealed:result.clueRevealed,
        reasoning_model_revealed:result.modelRevealedBeforeAttempt,
        clinical_progression_eligible:false,
        clinical_score_eligible:false,
        independent_spoken_score_eligible:false,
        functional_transfer_verified:false,
        completion_source:'nonclinical_reasoning_rehearsal',
      },
    });
    pendingRef.current.push(promised);
  },[kind,profileId,sessionId,scope,submitTrial]);

  const finish=useCallback(async(results:ReasoningPracticeResult[])=>{
    if(completedRef.current||ownerRef.current!==scope)return;
    completedRef.current=true;
    setPhase('saving');
    const writes=pendingRef.current.splice(0);
    const outcomes=await Promise.allSettled(writes);
    if(ownerRef.current!==scope)return;
    if(writes.length!==results.length||writes.length!==4||
      writes.length!==attemptsRef.current||
      outcomes.some(x=>x.status==='rejected'||x.value.ok!==true)){
      setPhase('failed');return;
    }
    try{
      const commit=await commitSession();
      if(ownerRef.current!==scope)return;
      // A writer failure, not merely successful UI feedback, controls
      // whether this activity may be reported as completed.
      if(!commit.ok){setPhase('failed');return;}
      await onSaved(results.length);
      if(ownerRef.current===scope)setPhase('saved');
    }catch{
      if(ownerRef.current===scope)setPhase('failed');
    }
  },[commitSession,onSaved,scope]);

  if(ownerChanged)return <p role="alert" className="p-6 text-xl">
    The patient profile changed. Return to Today before starting again.
  </p>;
  if(phase==='failed')return <UnverifiedPracticeBanner/>;
  if(phase==='saving')return <p role="status" className="p-8 text-center text-xl">
    Saving your practice…
  </p>;
  if(phase==='saved')return <div role="status" className="mx-auto max-w-xl space-y-4 p-6 text-center">
    <h2 className="text-2xl font-bold">Practice attempts saved</h2>
    <p>Four practice attempts were recorded. This is not a clinical recovery score.</p>
    <Button size="lg" className="min-h-16 w-full" onClick={onExit}>Return to Today</Button>
  </div>;

  if(!started)return <div className="mx-auto max-w-xl space-y-5 p-4">
    <h2 className="text-2xl font-bold text-center">
      {kind==='fix-sentence'?'Sentence Repair Practice':'Detective Story Practice'}
    </h2>
    <p className="text-lg text-center">
      Practice with four short activities. Maya can read them aloud.
      Correct choices are practice only, not medical scores.
    </p>
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer min-h-12 font-semibold">
        Care partner: choose a practice stage
      </summary>
      <p className="my-3 text-sm text-muted-foreground">
        These stages are for rehearsal, not saved clinical levels.
        They do not change the game’s clinical progression.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {REASONING_PRACTICE_STAGES[kind].map(item=><Button
          key={item.level} variant={item.level===level?'default':'outline'}
          aria-pressed={item.level===level} onClick={()=>setLevel(item.level)}
          className="min-h-16 h-auto w-full justify-start whitespace-normal p-3 text-left">
          Stage {item.level}: {item.title}
        </Button>)}
      </div>
    </details>
    <p role="status" className="text-center text-lg">
      Stage {level}: {stage.instruction}
    </p>
    <Button size="lg" className="min-h-16 w-full text-lg"
      onClick={()=>setStarted(true)}>Start practice</Button>
    <Button size="lg" variant="ghost" className="min-h-14 w-full"
      onClick={onExit}>Return to Today</Button>
  </div>;

  return <ReasoningStagePracticeGame key={scope+':'+level}
    stage={stage} scenes={scenes}
    onTrialComplete={record} onGameComplete={finish}/>;
}
