/**
 * Optional scripted conversation mode inside the existing owner session.
 * Never starts or ends another session: the parent route owns the lifecycle.
 * Every submitted turn must be durably acknowledged before final completion.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTrialSubmission } from '@/hooks/useTrialSubmission';
import { hasMissingClinicalRawEvidence } from '@/lib/trial/clinicalRawCompletionGate';
import { UnverifiedPracticeBanner } from '@/components/exercise/UnverifiedPracticeBanner';
import { ConversationStagePracticeGame, type ConversationPracticeResult } from './ConversationStagePracticeGame';
import {
  CONVERSATION_PRACTICE_STAGES,
  getConversationPracticeScenes, getConversationPracticeStage,
  type ConversationPracticeKind,type ConversationPracticeLevel,
} from '@/lib/conversationPractice/stages';
import type { SupportLevel } from '@/lib/progression/clinicalProgression';

interface Props {
  kind: ConversationPracticeKind;
  userId: string;
  profileId: string;
  sessionId: string;
  /** Optional patient-scoped lesson suggestion, still caregiver-adjustable. */
  initialStage?: ConversationPracticeLevel;
  onSaved: (turnCount:number)=>Promise<void>;
  onExit: ()=>void;
}
function deliveredSupport(result:ConversationPracticeResult):SupportLevel{
  if(result.providedModelText)return 'carrier_or_full_model';
  if(result.revealedHelpText)return 'semantic_cue';
  return result.responseKind==='choice'?'recognition_only':'open_response';
}

export function ConversationStagePracticeSession({
  kind,userId,profileId,sessionId,initialStage,onSaved,onExit,
}:Props){
  const [level,setLevel]=useState<ConversationPracticeLevel>(
    initialStage && getConversationPracticeStage(kind,initialStage) ? initialStage : 1,
  );
  const [started,setStarted]=useState(false);
  const [phase,setPhase]=useState<'playing'|'saving'|'saved'|'failed'>('playing');
  const pendingRef=useRef<Array<Promise<{ok:boolean}>>>([]);
  const attemptsRef=useRef(0);
  const committedRef=useRef(false);
  const mountedRef=useRef(true);
  const {submitTrial,commitSession}=useTrialSubmission({
    userId,profileId,sessionId,exerciseSlug:kind.replace(/-/g,'_'),progression:null,
  });
  const stage=getConversationPracticeStage(kind,level)!;
  const scenes=useMemo(()=>getConversationPracticeScenes(kind,level,sessionId),
    [kind,level,sessionId]);

  useEffect(()=>{
    mountedRef.current=true;
    return ()=>{mountedRef.current=false;};
  },[]);

  const handleTrial=useCallback((result:ConversationPracticeResult)=>{
    if(!mountedRef.current||committedRef.current)return;
    const index=attemptsRef.current++;
    const support=deliveredSupport(result);
    const pending=submitTrial({
      profileId,sessionId,
      gameId:kind.replace(/-/g,'_'),
      level:result.stage,
      trialIndex:index,
      stimulusId:result.trialId,
      expectedResponse:null,
      userResponse:result.userResponse,
      browserTranscript:result.inputMode==='browser_recognized'?result.userResponse:null,
      isCorrect:result.practiceMatch===true,
      accuracyScore:result.practiceMatch===null?null:result.practiceMatch?1:0,
      cueLevel:result.providedModelText?3:result.revealedHelpText?1:0,
      supportUsed:support,
      trialMode:result.responseKind==='choice'?'recognition':'mixed',
      clinicalProgressionEligible:false,
      errorType:result.inputMode==='skipped'?'skipped_scripted_practice':
        result.practiceMatch===null?'ungraded_scripted_practice':
        result.practiceMatch?'correct_practice_choice':'nonmatching_practice_choice',
      taskParameters:{
        practice_stage:result.stage,practice_turn_id:result.trialId,
        practice_scene_id:result.sceneId,practice_turn_index:result.turnIndex,
        practice_turn_skill:result.turnSkill,
        practice_response_kind:result.responseKind,
        practice_input_mode:result.inputMode,
        practice_choice_match:result.practiceMatch,
        practice_help_text:result.revealedHelpText,
        practice_model_text:result.providedModelText,
        practice_support_used:support,
        simulated_partner_script:true,
        adaptive_partner_response:false,
        practice_only:true,
        clinical_progression_eligible:false,
        clinical_score_eligible:false,
        independent_spoken_score_eligible:false,
        functional_transfer_verified:false,
        completion_source:'nonclinical_scripted_conversation',
      },
    });
    pendingRef.current.push(pending);
  },[profileId,sessionId,kind,submitTrial]);

  const finish=useCallback(async(results:ConversationPracticeResult[])=>{
    if(!mountedRef.current||committedRef.current)return;
    committedRef.current=true;
    setPhase('saving');
    const writes=pendingRef.current.splice(0);
    const outcomes=await Promise.allSettled(writes);
    if(!mountedRef.current)return;
    if(writes.length!==results.length||writes.length!==attemptsRef.current||
      outcomes.some(x=>x.status==='rejected'||x.value.ok!==true)){
      setPhase('failed');return;
    }
    try{
      const commit=await commitSession();
      if(!mountedRef.current)return;
      if(hasMissingClinicalRawEvidence(commit)){
        setPhase('failed');return;
      }
      await onSaved(results.length);
      if(mountedRef.current)setPhase('saved');
    }catch{
      if(mountedRef.current)setPhase('failed');
    }
  },[commitSession,onSaved]);

  if(phase==='failed')return <UnverifiedPracticeBanner/>;
  if(phase==='saving')return <p role="status" className="p-8 text-center text-xl">
    Saving your practice…
  </p>;
  if(phase==='saved')return <div role="status" className="space-y-4 text-center p-8">
    <h2 className="text-2xl font-bold">Practice responses saved</h2>
    <p>The scripted conversation is complete. This is not a clinical score.</p>
    <Button size="lg" className="min-h-16 w-full" onClick={onExit}>Return to Today</Button>
  </div>;

  if(!started)return <div className="max-w-xl mx-auto space-y-5 p-4">
    <h2 className="text-2xl font-bold text-center">
      {kind==='conversation-coach'?'Guided coach role-play':'Guided conversation role-play'}
    </h2>
    <p className="text-lg text-center">
      Practice two everyday conversations with Maya. She follows a script
      and does not judge what you say.
    </p>
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer min-h-12 font-semibold">
        Care partner: choose a practice stage
      </summary>
      <p className="text-sm text-muted-foreground my-3">
        These are practice formats, not saved clinical recovery levels.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CONVERSATION_PRACTICE_STAGES[kind].map(item=><Button
          key={item.level} variant={item.level===level?'default':'outline'}
          aria-pressed={item.level===level} onClick={()=>setLevel(item.level)}
          className="w-full min-h-16 h-auto p-3 text-left justify-start whitespace-normal">
          Stage {item.level}: {item.title}
        </Button>)}
      </div>
    </details>
    <p role="status" className="text-center">{stage.instruction}</p>
    <Button size="lg" className="w-full min-h-16 text-lg"
      onClick={()=>setStarted(true)}>Start practice</Button>
  </div>;
  return <ConversationStagePracticeGame key={kind+':'+level+':'+sessionId}
    stage={stage} scenes={scenes}
    onTrialComplete={handleTrial} onGameComplete={finish}/>;
}
