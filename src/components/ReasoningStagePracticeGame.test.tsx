import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {
  getReasoningPracticeScenes,getReasoningPracticeStage,orderReasoningChoices,
  type ReasoningPracticeKind,type ReasoningPracticeLevel,
} from '@/lib/reasoningPractice/stages';
import {ReasoningStagePracticeGame} from './ReasoningStagePracticeGame';

const mocks=vi.hoisted(()=>({
  speak:vi.fn(async(_text:string)=>{}),
  stop:vi.fn(),
  stopListening:vi.fn(),
  startListening:vi.fn(),
  onSpeech:null as ((text:string)=>void)|null,
}));
vi.mock('@/hooks/useTextToSpeech',()=>({useTextToSpeech:()=>({
  speak:mocks.speak,stop:mocks.stop,isSpeaking:false,error:null,
})}));
vi.mock('@/hooks/useSpeechRecognition',()=>({useSpeechRecognition:({
  onResult,
}:{onResult:(text:string)=>void})=>{
  mocks.onSpeech=onResult;
  return {
    isSupported:true,isListening:false,startListening:mocks.startListening,
    stopListening:mocks.stopListening,error:null,
  };
}}));
beforeEach(()=>vi.clearAllMocks());
afterEach(()=>cleanup());

function setup(kind:ReasoningPracticeKind,level:ReasoningPracticeLevel){
  const stages=getReasoningPracticeScenes(kind,level);
  const stage=getReasoningPracticeStage(kind,level)!;
  const onTrial=vi.fn(),onComplete=vi.fn();
  render(<ReasoningStagePracticeGame stage={stage} scenes={stages}
    onTrialComplete={onTrial} onGameComplete={onComplete}/>);
  return {tasks:stages.flatMap(x=>x.steps),onTrial,onComplete};
}

describe('actual nonclinical reasoning practice game',()=>{
  it.each(['fix-sentence','detective-mind'] as const)(
    '%s Stage 7 selects four shuffled authored answers, without scoring speech',
    kind=>{
      const {tasks,onTrial,onComplete}=setup(kind,7);
      for(let index=0;index<4;index++){
        const task=tasks[index];
        expect(task.kind).toBe('choice');
        if(task.kind!=='choice')throw Error('Expected authored choice');
        const displayed=orderReasoningChoices(task);
        const position=displayed.findIndex(x=>x.originalIndex===task.bestChoice);
        const selected=displayed[position];
        const label=String.fromCharCode(65+position)+'. '+selected.text;
        fireEvent.click(screen.getByRole('button',{name:label}));
        expect(screen.getByText('That choice fits this example.')).toBeTruthy();
        expect(mocks.speak).toHaveBeenCalledWith(expect.stringContaining(
          index===3?'Press Finish practice.':'Press Next task.',
        ));
        expect(onTrial).toHaveBeenCalledTimes(index+1);
        expect(onTrial.mock.calls[index][0]).toMatchObject({
          trialId:task.id,practiceMatch:true,selectedChoice:task.bestChoice,
          inputMode:'choice',clinicalProgressionEligible:false,
          independentSpokenScoreEligible:false,
        });
        fireEvent.click(screen.getByRole('button',{name:index===3?'Finish practice':'Next task'}));
      }
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete.mock.calls[0][0]).toHaveLength(4);
      expect(screen.getByText('All four practice attempts recorded. Saving…')).toBeTruthy();
    },
  );

  it('Fix Sentence Stage 8 supports typed, skipped, self-reported and recognized attempts without grading open repairs',()=>{
    const {tasks,onTrial,onComplete}=setup('fix-sentence',8);
    // First task: a patient requests a model before typing.
    fireEvent.click(screen.getByRole('button',{name:'Hear an example'}));
    expect(screen.getByText(/Example: Please come at two o’clock/i)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox',{name:'Your own words'}),{
      target:{value:'Come at two on Tuesday.'},
    });
    fireEvent.click(screen.getByRole('button',{name:'Record my attempt'}));
    expect(onTrial.mock.calls[0][0]).toMatchObject({
      trialId:tasks[0].id,inputMode:'typed',userResponse:'Come at two on Tuesday.',
      practiceMatch:null,modelRevealedBeforeAttempt:true,
    });
    expect(mocks.speak).toHaveBeenCalledWith(expect.stringContaining(
      'Your attempt was recorded.',
    ));
    fireEvent.click(screen.getByRole('button',{name:'Next task'}));
    // Second: skipped response retains a unique row, not a wrong clinical score.
    fireEvent.click(screen.getByRole('button',{name:'Skip this task'}));
    expect(onTrial.mock.calls[1][0]).toMatchObject({
      trialId:tasks[1].id,inputMode:'skipped',practiceMatch:null,
    });
    fireEvent.click(screen.getByRole('button',{name:'Next task'}));
    // Third: a person tried aloud without a usable transcript.
    fireEvent.click(screen.getByRole('button',{name:'I tried speaking (no transcript)'}));
    expect(onTrial.mock.calls[2][0]).toMatchObject({
      trialId:tasks[2].id,inputMode:'self_report',userResponse:null,
      practiceMatch:null,
    });
    fireEvent.click(screen.getByRole('button',{name:'Next task'}));
    // Fourth: a browser hypothesis is still ungraded, not clinical speech.
    fireEvent.click(screen.getByRole('button',{name:'Try speaking'}));
    act(()=>mocks.onSpeech?.('Please bring me the small water.'));
    fireEvent.click(screen.getByRole('button',{name:'Record my attempt'}));
    expect(onTrial.mock.calls[3][0]).toMatchObject({
      trialId:tasks[3].id,inputMode:'browser_recognized',
      userResponse:'Please bring me the small water.',practiceMatch:null,
      clinicalProgressionEligible:false,independentSpokenScoreEligible:false,
    });
    fireEvent.click(screen.getByRole('button',{name:'Finish practice'}));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].map((x:{trialId:string})=>x.trialId)).toEqual(
      tasks.map(x=>x.id),
    );
    expect(mocks.stopListening).toHaveBeenCalled();
  });

  it('does not submit the same choice twice on rapid taps',()=>{
    const {onTrial}=setup('detective-mind',1);
    const choice=screen.getByRole('button',{name:/^A\. /});
    fireEvent.click(choice);
    fireEvent.click(choice);
    expect(onTrial).toHaveBeenCalledTimes(1);
  });

  it('cleans up its microphone when unmounted',()=>{
    const {unmount}=render(<ReasoningStagePracticeGame
      stage={getReasoningPracticeStage('fix-sentence',8)!}
      scenes={getReasoningPracticeScenes('fix-sentence',8)}
      onTrialComplete={vi.fn()} onGameComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Try speaking'}));
    unmount();
    expect(mocks.stopListening).toHaveBeenCalled();
    expect(mocks.stop).toHaveBeenCalled();
  });
});
