import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
  profileId:'synthetic-profile-a' as string|null,
  navigate:vi.fn(),completeSession:vi.fn(),
  routeState:{} as Record<string,unknown>,
}));
vi.mock('react-router-dom',async(imp)=>{
  const real=await imp<typeof import('react-router-dom')>();
  return {...real,useNavigate:()=>mocks.navigate,useLocation:()=>({state:mocks.routeState})};
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
  ConversationStagePracticeSession:({kind,profileId,sessionId,initialStage,onSaved}:{
    kind:string;profileId:string;sessionId:string;initialStage?:number;
    onSaved:(count:number)=>Promise<void>;
  })=><div>
    <p>Structured {kind} for {profileId} in {sessionId}</p>
    {initialStage != null && <p>Recommended Stage {initialStage}</p>}
    <button onClick={()=>void onSaved(4)}>Complete scripted coach practice</button>
  </div>,
}));

import ConversationCoachExercise from './ConversationCoachExercise';
import { makeLessonConversationNavigation, selectLessonConversationBridge } from '@/lib/conversationPractice/lessonHandoff';

beforeEach(()=>{
  vi.clearAllMocks();
  mocks.profileId='synthetic-profile-a';
  mocks.routeState={};
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
    expect(screen.queryByRole('button',{name:'Practice Again'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Return to Today'}));
    expect(mocks.navigate).toHaveBeenCalledWith('/today');
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
  it('offers Phrase Practice follow-up without silently starting AI or changing scripted scores',()=>{
    const bridge=selectLessonConversationBridge(['phrase_practice']);
    if(!bridge)throw new Error('Expected authored Phrase Practice follow-up');
    mocks.routeState={lessonConversation:makeLessonConversationNavigation(bridge,'synthetic-profile-a')};
    render(<ConversationCoachExercise/>);
    expect(screen.getByRole('button',{name:'Start Practice'})).toBeTruthy();
    expect(screen.getByRole('button',{name:'Practice this skill with Maya'})).toBeTruthy();
    expect(screen.queryByText(/Structured conversation-coach/)).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Practice this skill with Maya'}));
    expect(screen.getByText('Recommended Stage 3')).toBeTruthy();
    expect(screen.getByText('Structured conversation-coach for synthetic-profile-a in session-synthetic-profile-a')).toBeTruthy();
    expect(mocks.completeSession).not.toHaveBeenCalled();
  });

  it('refuses a different patient\'s lesson recommendation and ends old handoff on patient switch',()=>{
    const bridge=selectLessonConversationBridge(['photo_naming']);
    if(!bridge)throw new Error('Expected authored naming follow-up');
    mocks.routeState={lessonConversation:makeLessonConversationNavigation(bridge,'synthetic-profile-a')};
    const view=render(<ConversationCoachExercise/>);
    fireEvent.click(screen.getByRole('button',{name:'Practice this skill with Maya'}));
    expect(screen.getByText('Recommended Stage 5')).toBeTruthy();

    mocks.profileId='synthetic-profile-b';
    view.rerender(<ConversationCoachExercise/>);
    expect(screen.queryByText('Recommended Stage 5')).toBeNull();
    expect(screen.getByRole('button',{name:'Guided coach role-play (8 practice stages)'})).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Practice this skill with Maya'})).toBeNull();
    expect(mocks.completeSession).not.toHaveBeenCalled();
  });

});
