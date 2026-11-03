import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {ReasoningPracticeResult} from './ReasoningStagePracticeGame';
import type {ReasoningPracticeScene,ReasoningPracticeKind} from '@/lib/reasoningPractice/stages';

const mocks=vi.hoisted(()=>({submit:vi.fn(),commit:vi.fn()}));
vi.mock('@/hooks/useTrialSubmission',()=>({useTrialSubmission:()=>({
  submitTrial:mocks.submit,commitSession:mocks.commit,
})}));
vi.mock('@/components/exercise/UnverifiedPracticeBanner',()=>({
  UnverifiedPracticeBanner:()=> <div role="alert">Results not saved</div>,
}));
vi.mock('./ReasoningStagePracticeGame',()=>({
  ReasoningStagePracticeGame:({stage,scenes,onTrialComplete,onGameComplete}:{
    stage:{level:number};
    scenes:readonly ReasoningPracticeScene[];
    onTrialComplete:(result:ReasoningPracticeResult)=>void;
    onGameComplete:(results:ReasoningPracticeResult[])=>void;
  })=><div>
    <span>Stage {stage.level} is playing</span>
    <button onClick={()=>{
      const results:ReasoningPracticeResult[]=scenes.flatMap(scene=>
        scene.steps.map((task,stepIndex)=>({
          trialId:task.id,stage:stage.level,sceneId:scene.id,
          sceneTitle:scene.title,stepIndex,skill:task.skill,
          responseKind:task.kind,
          inputMode:task.kind==='choice'?'choice' as const:'typed' as const,
          userResponse:task.kind==='choice'?task.options[task.bestChoice]:
            'Please make the message clear.',
          selectedChoice:task.kind==='choice'?task.bestChoice:null,
          practiceMatch:task.kind==='choice'?true:null,
          clueRevealed:false,modelRevealedBeforeAttempt:false,
          clinicalProgressionEligible:false,
          independentSpokenScoreEligible:false,
        })),
      );
      results.forEach(onTrialComplete);
      onGameComplete(results);
    }}>Finish four synthetic practice tasks</button>
  </div>,
}));

import {ReasoningStagePracticeSession} from './ReasoningStagePracticeSession';

const defaultProps={
  kind:'fix-sentence' as ReasoningPracticeKind,
  userId:'synthetic-user-a',profileId:'synthetic-profile-a',
  sessionId:'synthetic-session-a',
};
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.submit.mockResolvedValue({ok:true});
  mocks.commit.mockResolvedValue({ok:true,errors:[]});
});
afterEach(()=>cleanup());

async function finish(kind:ReasoningPracticeKind,stage:number=8,onSaved=vi.fn().mockResolvedValue(undefined)){
  render(<ReasoningStagePracticeSession {...defaultProps}
    kind={kind} onSaved={onSaved} onExit={vi.fn()}/>);
  if(stage!==1){
    fireEvent.click(screen.getByText('Care partner: choose a practice stage'));
    fireEvent.click(screen.getByRole('button',{name:new RegExp('Stage '+stage+':')}));
  }
  fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
  fireEvent.click(screen.getByRole('button',{name:'Finish four synthetic practice tasks'}));
  await waitFor(()=>expect(mocks.submit).toHaveBeenCalledTimes(4));
  return onSaved;
}

describe('practice-only, patient-owned reasoning session writes',()=>{
  it.each(['fix-sentence','detective-mind'] as const)(
    '%s has 8 visible stage choices and records all four attempts with no clinical promotion',
    async kind=>{
      const onSaved=vi.fn().mockResolvedValue(undefined);
      render(<ReasoningStagePracticeSession {...defaultProps}
        kind={kind} onSaved={onSaved} onExit={vi.fn()}/>);
      fireEvent.click(screen.getByText('Care partner: choose a practice stage'));
      expect(screen.getAllByRole('button',{name:/Stage [1-8]:/})).toHaveLength(8);
      fireEvent.click(screen.getByRole('button',{name:/Stage 8:/}));
      fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
      expect(screen.getByText('Stage 8 is playing')).toBeTruthy();
      fireEvent.click(screen.getByRole('button',{name:'Finish four synthetic practice tasks'}));
      await waitFor(()=>expect(mocks.submit).toHaveBeenCalledTimes(4));
      const submitted=mocks.submit.mock.calls.map(([item])=>item);
      expect(submitted.map(x=>x.trialIndex)).toEqual([0,1,2,3]);
      expect(new Set(submitted.map(x=>x.stimulusId)).size).toBe(4);
      for(const input of submitted){
        expect(input.gameId).toBe(kind.replace(/-/g,'_'));
        expect(input.profileId).toBe('synthetic-profile-a');
        expect(input.sessionId).toBe('synthetic-session-a');
        expect(input.level).toBe(8);
        expect(input.expectedResponse).toBeNull();
        expect(input.clinicalProgressionEligible).toBe(false);
        expect(input.taskParameters).toMatchObject({
          reasoning_practice:true,practice_only:true,reasoning_practice_stage:8,
          clinical_progression_eligible:false,clinical_score_eligible:false,
          independent_spoken_score_eligible:false,functional_transfer_verified:false,
        });
        expect(input.trialMode).toBe(input.taskParameters.reasoning_response_kind==='choice'
          ?'recognition':'mixed');
        if(input.taskParameters.reasoning_response_kind==='open'){
          expect(input.accuracyScore).toBeNull();
          expect(input.isCorrect).toBe(false);
        }
      }
      await waitFor(()=>expect(onSaved).toHaveBeenCalledTimes(1));
      expect(onSaved).toHaveBeenCalledWith(4);
      expect(mocks.commit).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Practice attempts saved')).toBeTruthy();
    },
  );

  it('a correct Stage 1 recognition choice never becomes independent spoken evidence',async()=>{
    const onSaved=await finish('detective-mind',1);
    const first=mocks.submit.mock.calls[0][0];
    expect(first).toMatchObject({
      trialMode:'recognition',isCorrect:true,accuracyScore:1,
      clinicalProgressionEligible:false,browserTranscript:null,
      taskParameters:{
        reasoning_practice_stage:1,reasoning_input_mode:'choice',
        clinical_score_eligible:false,independent_spoken_score_eligible:false,
      },
    });
    await waitFor(()=>expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('will not complete when any raw attempt fails',async()=>{
    mocks.submit.mockResolvedValueOnce({ok:true})
      .mockResolvedValueOnce({ok:false}).mockResolvedValue({ok:true});
    const onSaved=await finish('fix-sentence');
    await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('Results not saved')).toBeTruthy();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('waits for every attempted response to persist before marking the session complete',async()=>{
    let resolve!:(answer:{ok:boolean})=>void;
    mocks.submit.mockResolvedValueOnce({ok:true}).mockResolvedValueOnce({ok:true})
      .mockResolvedValueOnce({ok:true})
      .mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
    const onSaved=await finish('detective-mind');
    expect(screen.getByText('Saving your practice…')).toBeTruthy();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    resolve({ok:true});
    await waitFor(()=>expect(mocks.commit).toHaveBeenCalledTimes(1));
    await waitFor(()=>expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('refuses to declare saved practice when the unified commit fails',async()=>{
    mocks.commit.mockResolvedValueOnce({
      ok:false,errors:['raw clinical event writes failed: 1'],
    });
    const onSaved=await finish('fix-sentence');
    await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('stops using the previous patient session when the owner changes',()=>{
    const onSaved=vi.fn().mockResolvedValue(undefined);
    const {rerender}=render(<ReasoningStagePracticeSession {...defaultProps}
      onSaved={onSaved} onExit={vi.fn()}/>);
    rerender(<ReasoningStagePracticeSession {...defaultProps}
      profileId="different-patient" onSaved={onSaved} onExit={vi.fn()}/>);
    expect(screen.getByRole('alert').textContent).toMatch(/patient profile changed/i);
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
