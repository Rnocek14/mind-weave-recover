import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {ThoughtOrganizationRoundResult} from '@/components/ThoughtOrganizationGame';

const mocks=vi.hoisted(()=>({
  navigate:vi.fn(),submit:vi.fn(),commit:vi.fn(),completeSession:vi.fn(),
  profileId:'synthetic-patient-a',
}));
vi.mock('react-router-dom',async importOriginal=>{
  const actual=await importOriginal<typeof import('react-router-dom')>();
  return {...actual,useNavigate:()=>mocks.navigate};
});
vi.mock('@/hooks/useAuth',()=>({
  useAuth:()=>({user:{id:'synthetic-caregiver'}}),
}));
vi.mock('@/hooks/useProfile',()=>({
  useProfile:()=>({activeProfile:{id:mocks.profileId}}),
}));
vi.mock('@/hooks/useStandaloneSession',()=>({
  useStandaloneSession:()=>({activeSessionId:'synthetic-session',isCreatingSession:false}),
}));
vi.mock('@/hooks/useRestoredLessonContext',()=>({
  useRestoredLessonContext:()=>({fromLesson:false,sessionId:null,returnTo:'/lesson'}),
}));
vi.mock('@/hooks/useSessionLifecycle',()=>({
  useSessionLifecycle:()=>({completeSession:mocks.completeSession}),
}));
vi.mock('@/hooks/useTrialSubmission',()=>({
  useTrialSubmission:()=>({submitTrial:mocks.submit,commitSession:mocks.commit}),
}));
const fake:ThoughtOrganizationRoundResult={
  trialId:'main-groceries',stage:1,taskKind:'choice',inputMode:'choice',
  userResponse:null,correct:true,practiceAccuracy:1,
  supportRevealed:false,clinicalProgressionEligible:false,
  independentSpokenScoreEligible:false,
};
vi.mock('@/components/ThoughtOrganizationGame',()=>({
  ThoughtOrganizationGame:({stage,onTrialComplete,onGameComplete}:{
    stage:{level:number};
    onTrialComplete:(r:ThoughtOrganizationRoundResult)=>void;
    onGameComplete:(r:ThoughtOrganizationRoundResult[])=>void;
  })=><div>
    <span>Active synthetic stage: {stage.level}</span>
    <button onClick={()=>{
      const event={...fake,stage:stage.level};
      onTrialComplete(event);onGameComplete([event]);
    }}>Complete one practice round</button>
  </div>,
}));

import ThoughtOrganizationExercise from './ThoughtOrganizationExercise';

beforeEach(()=>{
  vi.clearAllMocks();mocks.profileId='synthetic-patient-a';
  mocks.submit.mockResolvedValue({ok:true});
  mocks.commit.mockResolvedValue({ok:true,errors:[],masteryFlushed:true});
  mocks.completeSession.mockResolvedValue(undefined);
});
afterEach(()=>cleanup());

function start(){
  render(<ThoughtOrganizationExercise/>);
  fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
}
describe('ThoughtOrganizationExercise: patient scope and real save boundary',()=>{
  it('shows eight real care-partner stages and defaults to beginner practice',()=>{
    render(<ThoughtOrganizationExercise/>);
    fireEvent.click(screen.getByText('Care partner: choose a practice stage'));
    expect(screen.getAllByRole('button',{name:/Stage [1-8]:/})).toHaveLength(8);
    fireEvent.click(screen.getByRole('button',{name:/Stage 8: Explain a new practical situation/}));
    fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
    expect(screen.getByText('Active synthetic stage: 8')).toBeTruthy();
  });
  it('marks even correct objective selections as nonclinical recognition only',async()=>{
    start();
    fireEvent.click(screen.getByRole('button',{name:'Complete one practice round'}));
    await waitFor(()=>expect(mocks.submit).toHaveBeenCalledTimes(1));
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({
      gameId:'thought_organization',trialMode:'recognition',
      clinicalProgressionEligible:false,supportUsed:'recognition_only',
      taskParameters:expect.objectContaining({
        practice_stage:1,practice_task_kind:'choice',
        practice_answer_correct:true,clinical_score_eligible:false,
        independent_spoken_score_eligible:false,
      }),
    }));
    await waitFor(()=>expect(screen.getByText('Practice saved')).toBeTruthy());
    expect(mocks.completeSession).toHaveBeenCalledTimes(1);
  });
  it('never celebrates or completes a session if the raw trial write fails',async()=>{
    mocks.submit.mockResolvedValue({ok:false});
    start();
    fireEvent.click(screen.getByRole('button',{name:'Complete one practice round'}));
    await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.completeSession).not.toHaveBeenCalled();
    expect(screen.queryByText('Practice saved')).toBeNull();
  });
  it('waits for pending raw writes before committing the session',async()=>{
    let complete!: (x:{ok:boolean})=>void;
    mocks.submit.mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
    start();
    fireEvent.click(screen.getByRole('button',{name:'Complete one practice round'}));
    expect(screen.getByText('Saving your practice…')).toBeTruthy();
    expect(mocks.commit).not.toHaveBeenCalled();
    complete({ok:true});
    await waitFor(()=>expect(mocks.commit).toHaveBeenCalledTimes(1));
    await waitFor(()=>expect(screen.getByText('Practice saved')).toBeTruthy());
  });
  it('does not reuse a former patient stage when switching profiles',()=>{
    const view=render(<ThoughtOrganizationExercise/>);
    fireEvent.click(screen.getByText('Care partner: choose a practice stage'));
    fireEvent.click(screen.getByRole('button',{name:/Stage 8: Explain a new practical situation/}));
    fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
    expect(screen.getByText('Active synthetic stage: 8')).toBeTruthy();
    mocks.profileId='synthetic-patient-b';
    view.rerender(<ThoughtOrganizationExercise/>);
    expect(screen.getByRole('button',{name:'Start practice'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
    expect(screen.getByText('Active synthetic stage: 1')).toBeTruthy();
  });
});
