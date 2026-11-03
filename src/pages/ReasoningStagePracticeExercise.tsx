/**
 * Optional, standalone nonclinical mode for an existing game.
 * The original Fix Sentence / Detective Mind routes and clinical engines are
 * untouched; this page owns one session with practice-only raw events.
 */
import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useStandaloneSession } from '@/hooks/useStandaloneSession';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { ExerciseLoading } from '@/components/exercise/ExerciseLoading';
import { ReasoningStagePracticeSession } from '@/components/ReasoningStagePracticeSession';
import {reasoningPracticeEventSlug,type ReasoningPracticeKind} from '@/lib/reasoningPractice/stages';

export default function ReasoningStagePracticeExercise({
  kind,
}: {kind: ReasoningPracticeKind}){
  const navigate=useNavigate();
  const {user,loading:authLoading}=useAuth();
  const {activeProfile,loading:profileLoading}=useProfile();
  const exerciseSlug=reasoningPracticeEventSlug(kind);
  const {activeSessionId,isCreatingSession}=useStandaloneSession(
    user?.id,null,exerciseSlug,
  );
  const startRef=useRef(Date.now());
  const attemptsRef=useRef(0);
  const scope=JSON.stringify([kind,user?.id??null,activeProfile?.id??null]);
  // Stop and require a fresh route if the underlying patient changes during
  // a session. useStandaloneSession may still hold the old session ID.
  const originalScopeRef=useRef<string|null>(null);
  if(user?.id&&activeProfile?.id&&!originalScopeRef.current){
    originalScopeRef.current=scope;
  }
  const ownerChanged=originalScopeRef.current!==null&&originalScopeRef.current!==scope;

  const getSessionStats=useCallback(()=>({
    score:0, // an ungraded practice dose is not a clinical accuracy score
    totalTrials:attemptsRef.current,startTime:startRef.current,
  }),[]);
  const {completeSession}=useSessionLifecycle({
    sessionId:activeSessionId,userId:user?.id,profileId:activeProfile?.id,
    exerciseSlug,getSessionStats,
  });
  const onSaved=useCallback(async(attempts:number)=>{
    if(ownerChanged)throw new Error('Patient scope changed');
    attemptsRef.current=attempts;
    await completeSession();
  },[completeSession,ownerChanged]);

  if(authLoading||profileLoading||isCreatingSession)return <ExerciseLoading/>;
  if(ownerChanged)return <div role="alert" className="mx-auto max-w-lg space-y-4 p-6">
    <h2 className="text-xl font-bold">Patient changed</h2>
    <p>Return to Today and start a new practice for this patient.</p>
    <Button className="min-h-14 w-full" onClick={()=>navigate('/today')}>Return to Today</Button>
  </div>;
  if(!user||!activeProfile?.id)return <div className="mx-auto max-w-lg space-y-4 p-6">
    <h2 className="text-xl font-bold">Select a patient to practice</h2>
    <p>We need the right patient profile before saving attempts.</p>
    <Button className="min-h-14 w-full" onClick={()=>navigate('/today')}>Return to Today</Button>
  </div>;
  if(!activeSessionId)return <ExerciseLoading/>;

  return <div className="min-h-dvh bg-background">
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-xl flex h-14 items-center justify-between px-4">
        <Button size="sm" variant="ghost" onClick={()=>navigate('/today')}>
          <ArrowLeft className="mr-2 h-4 w-4"/>Back
        </Button>
        <h1 className="text-lg font-semibold">
          {kind==='fix-sentence'?'Sentence Repair':'Detective Stories'}
        </h1>
        <span className="text-xs text-muted-foreground">Practice</span>
      </div>
    </header>
    <main>
      <ReasoningStagePracticeSession
        key={scope+':'+activeSessionId}
        kind={kind} userId={user.id} profileId={activeProfile.id}
        sessionId={activeSessionId} onSaved={onSaved}
        onExit={()=>navigate('/today')}/>
    </main>
  </div>;
}
