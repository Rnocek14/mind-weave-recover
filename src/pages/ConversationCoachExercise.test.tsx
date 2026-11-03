import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
  profileId:'synthetic-profile-a' as string|null,
  navigate:vi.fn(),completeSession:vi.fn(),
}));
vi.mock('react-router-dom',async(imp)=>{
  const real=await imp<typeof import('react-router-dom')>();
  return {...real,useNavigate:()=>mocks.navigate,useLocation:()=>({state:{}})};
});
vi.mock('@/hooks/useAuth',()=>({
  useAuth:()=>({user:{id:'synthetic-user'},loading:false}),
}));
vi.mock('@/hooks/useProfile',()=>({
  useProfile:()=>({activeProfile:mocks.profileId?{id:mocks.profileId}:null}),
}));
vi.mock('@/hooks/useStandaloneSession',()=>({
  useStandaloneSession:()=>({
    activeSessionId:mocks.profileId?'session-'+mocks.profileId:null,
    isCreatingSession:false,
  }),
}));
vi.mock('@/hooks/useSessionLifecycle',()=>({
  useSessionLifecycle:()=>({completeSession:mocks.completeSession}),
}));
vi.mock('@/hooks/useRestoredLessonContext',()=>({
  useRestoredLessonContext:()=>({
    fromLesson:false,returnTo:'/today',sessionId:null,adaptations:null,
  }),
}));
vi.mock('@/hooks/useSessionAdaptation',()=>({
  useSessionAdaptation:()=>({}),
}));
vi.mock('@/lib/adaptationTelemetry',()=>({
  buildAdaptationTelemetry:()=>({}),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot',()=>({
  useExerciseMidSessionPivot:()=>({}),
}));
vi.mock('@/components/ConversationCoachGame',()=>({
  ConversationCoachGame:({profileId,onComplete}:{
    profileId:string;
    onComplete:(metrics:{
      turnsCompleted:number;cardsCompleted:number;
      avgLatencyMs:number;userAIRatio:number;
    })=>void;
  })=><div>
    <p>Live Coach for {profileId}</p>
    <button onClick={()=>onComplete({
      turnsCompleted:3,cardsCompleted:1,avgLatencyMs:900,userAIRatio:55,
    })}>Complete live conversation</button>
  </div>,
}));
vi.mock('@/components/ConversationStagePracticeSession',()=>({
  ConversationStagePracticeSession:({kind,profileId,sessionId,onSaved}:{
    kind:string;profileId:string;sessionId:string;
    onSaved:(count:number)=>Promise<void>;
  })=><div>
    <p>Structured {kind} for {profileId} in {sessionId}</p>
    <button onClick={()=>void onSaved(4)}>Complete scripted coach practice</button>
  </div>,
}));

import ConversationCoachExercise from './ConversationCoachExercise';

beforeEach(()=>{
  vi.clearAllMocks();
  mocks.profileId='synthetic-profile-a';
  mocks.completeSession.mockResolvedValue(undefined);
});
afterEach(()=>cleanup());

describe('Conversation Coach optional structured practice',()=>{
  it('does not allow sessionless practice',()=>{
    mocks.profileId=null;
    render(<ConversationCoachExercise/>);
    expect((screen.getByRole('button',{name:'Start Practice'}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button',{name:'Guided coach role-play (8 practice stages)'}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('preserves live AI coach route and actually displays its post-game summary',async()=>{
    render(<ConversationCoachExercise/>);
    fireEvent.click(screen.getByRole('button',{name:'Start Practice'}));
    expect(screen.getByText('Live Coach for synthetic-profile-a')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Complete live conversation'}));
    await waitFor(()=>expect(screen.getByText('Session Complete')).toBeTruthy());
    expect(screen.getByText('Great Practice!')).toBeTruthy();
    expect(mocks.completeSession).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button',{name:'Practice Again'}));
    expect(screen.getByRole('button',{name:'Start Practice'})).toBeTruthy();
  });

  it('offers eight-stage roleplay as an explicit alternative to the live AI coach',async()=>{
    render(<ConversationCoachExercise/>);
    fireEvent.click(screen.getByRole('button',{name:'Guided coach role-play (8 practice stages)'}));
    expect(screen.getByText('Structured conversation-coach for synthetic-profile-a in session-synthetic-profile-a')).toBeTruthy();
    expect(screen.queryByText('Live Coach for synthetic-profile-a')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Complete scripted coach practice'}));
    await waitFor(()=>expect(mocks.completeSession).toHaveBeenCalledTimes(1));
  });

  it('does not reopen an old patient role-play after changing profiles',()=>{
    const view=render(<ConversationCoachExercise/>);
    fireEvent.click(screen.getByRole('button',{name:'Guided coach role-play (8 practice stages)'}));
    expect(screen.getByText('Structured conversation-coach for synthetic-profile-a in session-synthetic-profile-a')).toBeTruthy();
    mocks.profileId='synthetic-profile-b';
    view.rerender(<ConversationCoachExercise/>);
    expect(screen.queryByText('Structured conversation-coach for synthetic-profile-a in session-synthetic-profile-a')).toBeNull();
    expect(screen.getByRole('button',{name:'Start Practice'})).toBeTruthy();
  });
});
