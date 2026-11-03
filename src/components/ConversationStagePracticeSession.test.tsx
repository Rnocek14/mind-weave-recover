import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {ConversationPracticeResult} from './ConversationStagePracticeGame';
import type {ConversationPracticeScene} from '@/lib/conversationPractice/stages';

const mocks=vi.hoisted(()=>({
  submit:vi.fn(),commit:vi.fn(),
}));
vi.mock('@/hooks/useTrialSubmission',()=>({
  useTrialSubmission:()=>({
    submitTrial:mocks.submit,commitSession:mocks.commit,
  }),
}));
vi.mock('@/components/exercise/UnverifiedPracticeBanner',()=>({
  UnverifiedPracticeBanner:()=> <div role="alert">Results not saved</div>,
}));
vi.mock('./ConversationStagePracticeGame',()=>({
  ConversationStagePracticeGame:({stage,scenes,onTrialComplete,onGameComplete}:{
    stage:{level:number};
    scenes:ConversationPracticeScene[];
    onTrialComplete:(r:ConversationPracticeResult)=>void;
    onGameComplete:(r:ConversationPracticeResult[])=>void;
  })=><div>
    <span>Stage {stage.level} is playing</span>
    <button onClick={()=>{
      const results:ConversationPracticeResult[]=scenes.flatMap(scene=>
        scene.turns.map((turn,turnIndex)=>({
          trialId:turn.id,stage:stage.level,sceneId:scene.id,turnIndex,
          turnSkill:turn.skill,responseKind:turn.kind,
          inputMode:turn.kind==='choice'?'choice':'typed',
          userResponse:turn.kind==='choice'?turn.options[turn.bestChoice]:
            'Could we discuss this another way?',
          practiceMatch:turn.kind==='choice'?true:null,
          revealedHelpText:null,
          providedModelText:turn.kind==='open'?turn.model??null:null,
          clinicalProgressionEligible:false,
          independentSpokenScoreEligible:false,
        })),
      );
      results.forEach(onTrialComplete);
      onGameComplete(results);
    }}>Complete four simulated turns</button>
  </div>,
}));
import {ConversationStagePracticeSession} from './ConversationStagePracticeSession';

const defaultProps={
  kind:'conversation-partner' as const,
  userId:'synthetic-user-a',
  profileId:'synthetic-profile-a',
  sessionId:'synthetic-session-a',
};
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.submit.mockResolvedValue({ok:true});
  mocks.commit.mockResolvedValue({ok:true,errors:[],masteryFlushed:true});
});
afterEach(()=>cleanup());

describe('scripted conversation persistence and scope contract',()=>{
  it.each(['conversation-partner','conversation-coach'] as const)(
    '%s offers 8 practice stages and saves all four actual stage attempts before completion',
    async kind=>{
      const onSaved=vi.fn().mockResolvedValue(undefined);
      render(<ConversationStagePracticeSession {...defaultProps} kind={kind}
        onSaved={onSaved} onExit={vi.fn()}/>);
      fireEvent.click(screen.getByText('Care partner: choose a practice stage'));
      expect(screen.getAllByRole('button',{name:/Stage [1-8]:/})).toHaveLength(8);
      fireEvent.click(screen.getByRole('button',{name:/Stage 8:/}));
      fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
      expect(screen.getByText('Stage 8 is playing')).toBeTruthy();
      fireEvent.click(screen.getByRole('button',{name:'Complete four simulated turns'}));
      await waitFor(()=>expect(mocks.submit).toHaveBeenCalledTimes(4));
      const submitted=mocks.submit.mock.calls.map(call=>call[0]);
      expect(submitted.map(x=>x.trialIndex)).toEqual([0,1,2,3]);
      expect(new Set(submitted.map(x=>x.stimulusId)).size).toBe(4);
      expect(submitted.every(x=>x.clinicalProgressionEligible===false)).toBe(true);
      expect(submitted.every(x=>x.trialMode==='mixed')).toBe(true);
      expect(submitted.every(x=>x.accuracyScore===null)).toBe(true);
      expect(submitted.every(x=>x.taskParameters.clinical_score_eligible===false)).toBe(true);
      expect(submitted.every(x=>x.taskParameters.adaptive_partner_response===false)).toBe(true);
      expect(submitted.every(x=>x.taskParameters.independent_spoken_score_eligible===false)).toBe(true);
      expect(submitted.every(x=>x.browserTranscript===null)).toBe(true);
      await waitFor(()=>expect(onSaved).toHaveBeenCalledTimes(1));
      expect(onSaved).toHaveBeenCalledWith(4);
      expect(mocks.commit).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Practice responses saved')).toBeTruthy();
    },
  );

  it('retains explicit full modeling and recognition provenance rather than independent speech',async()=>{
    const onSaved=vi.fn().mockResolvedValue(undefined);
    render(<ConversationStagePracticeSession {...defaultProps} kind="conversation-coach"
      onSaved={onSaved} onExit={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
    fireEvent.click(screen.getByRole('button',{name:'Complete four simulated turns'}));
    await waitFor(()=>expect(mocks.submit).toHaveBeenCalledTimes(4));
    const first=mocks.submit.mock.calls[0][0];
    expect(first).toEqual(expect.objectContaining({
      gameId:'conversation_coach',supportUsed:'carrier_or_full_model',
      cueLevel:3,clinicalProgressionEligible:false,
      taskParameters:expect.objectContaining({
        practice_model_text:'May I have some water, please?',
        simulated_partner_script:true,functional_transfer_verified:false,
      }),
    }));
    await waitFor(()=>expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('fails closed if any of four raw writes returns a failed acknowledgment',async()=>{
    mocks.submit.mockResolvedValueOnce({ok:true})
      .mockResolvedValueOnce({ok:false}).mockResolvedValue({ok:true});
    const onSaved=vi.fn().mockResolvedValue(undefined);
    render(<ConversationStagePracticeSession {...defaultProps}
      onSaved={onSaved} onExit={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
    fireEvent.click(screen.getByRole('button',{name:'Complete four simulated turns'}));
    await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText('Results not saved')).toBeTruthy();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('waits for every pending raw write before acknowledging completion',async()=>{
    let resolve!:(value:{ok:boolean})=>void;
    mocks.submit.mockResolvedValueOnce({ok:true})
      .mockResolvedValueOnce({ok:true})
      .mockResolvedValueOnce({ok:true})
      .mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
    const onSaved=vi.fn().mockResolvedValue(undefined);
    render(<ConversationStagePracticeSession {...defaultProps}
      onSaved={onSaved} onExit={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
    fireEvent.click(screen.getByRole('button',{name:'Complete four simulated turns'}));
    expect(screen.getByText('Saving your practice…')).toBeTruthy();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    resolve({ok:true});
    await waitFor(()=>expect(mocks.commit).toHaveBeenCalledTimes(1));
    await waitFor(()=>expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved).toHaveBeenCalledWith(4);
  });

  it('blocks a completed lesson if unified commit reports missing raw evidence',async()=>{
    mocks.commit.mockResolvedValueOnce({
      ok:false,errors:['raw clinical event writes failed: 1'],masteryFlushed:false,
    });
    const onSaved=vi.fn().mockResolvedValue(undefined);
    render(<ConversationStagePracticeSession {...defaultProps}
      onSaved={onSaved} onExit={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
    fireEvent.click(screen.getByRole('button',{name:'Complete four simulated turns'}));
    await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
    expect(onSaved).not.toHaveBeenCalled();
  });
});
