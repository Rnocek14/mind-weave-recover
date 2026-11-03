import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import ReasoningStagePracticeExercise from './ReasoningStagePracticeExercise';

const mocks=vi.hoisted(()=>({
  user:{id:'synthetic-user'} as {id:string}|null,
  profileId:'patient-a',
  sessionId:'isolated-session-a',
  complete:vi.fn(async()=>{}),
  navigate:vi.fn(),
}));
vi.mock('react-router-dom',async imp=>{
  const actual=await imp<typeof import('react-router-dom')>();
  return {...actual,useNavigate:()=>mocks.navigate};
});
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({
  user:mocks.user,loading:false,
})}));
vi.mock('@/hooks/useProfile',()=>({useProfile:()=>({
  activeProfile:mocks.profileId?{id:mocks.profileId}:null,
  loading:false,
})}));
vi.mock('@/hooks/useStandaloneSession',()=>({useStandaloneSession:()=>({
  activeSessionId:mocks.sessionId,isCreatingSession:false,
})}));
vi.mock('@/hooks/useSessionLifecycle',()=>({useSessionLifecycle:()=>({
  completeSession:mocks.complete,
})}));
vi.mock('@/components/exercise/ExerciseLoading',()=>({
  ExerciseLoading:()=> <p role="status">Preparing practice</p>,
}));
vi.mock('@/components/ReasoningStagePracticeSession',()=>({
  ReasoningStagePracticeSession:({kind,userId,profileId,sessionId,onSaved}:{
    kind:string;userId:string;profileId:string;sessionId:string;
    onSaved:(attempts:number)=>Promise<void>;
  })=><div>
    <p>Practice route {kind} · owner {userId} · profile {profileId} · session {sessionId}</p>
    <button onClick={()=>void onSaved(4)}>Complete saved synthetic practice</button>
  </div>,
}));
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.user={id:'synthetic-user'};
  mocks.profileId='patient-a';mocks.sessionId='isolated-session-a';
});
afterEach(()=>cleanup());

describe('optional reasoning practice route ownership',()=>{
  it.each([
    ['fix-sentence','Sentence Repair','fix-sentence'],
    ['detective-mind','Detective Stories','detective-mind'],
  ] as const)('isolates %s in its own patient-owned session',async(kind,title,expectedKind)=>{
    render(<ReasoningStagePracticeExercise kind={kind}/>);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(
      'Practice route '+expectedKind+' · owner synthetic-user · profile patient-a · session isolated-session-a',
    )).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Complete saved synthetic practice'}));
    await waitFor(()=>expect(mocks.complete).toHaveBeenCalledTimes(1));
  });

  it('prevents using the previous patient session after an in-place profile switch',()=>{
    const {rerender}=render(<ReasoningStagePracticeExercise kind="fix-sentence"/>);
    expect(screen.getByText(/profile patient-a/)).toBeTruthy();
    mocks.profileId='patient-b';
    rerender(<ReasoningStagePracticeExercise kind="fix-sentence"/>);
    expect(screen.getByRole('alert').textContent).toMatch(/patient changed/i);
    expect(screen.queryByRole('button',{name:'Complete saved synthetic practice'})).toBeNull();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('will not open a practice writer with no patient',()=>{
    mocks.profileId='';
    render(<ReasoningStagePracticeExercise kind="detective-mind"/>);
    expect(screen.getByText('Select a patient to practice')).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Complete saved synthetic practice'})).toBeNull();
  });
});
