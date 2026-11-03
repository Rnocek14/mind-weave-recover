import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {FollowDirectionsProbe} from './FollowDirectionsProbe';
import {buildDirectionPracticeTrials,getDirectionPracticeStage} from '@/lib/coach/followDirectionsPractice';

const mocks=vi.hoisted(()=>({speak:vi.fn(async(_text:string)=>{})}));
vi.mock('@/hooks/useTextToSpeech',()=>({
  useTextToSpeech:()=>({speak:mocks.speak,isLoading:false,error:null}),
}));
beforeEach(()=>{vi.clearAllMocks();vi.useFakeTimers();});
afterEach(()=>{cleanup();vi.useRealTimers();});

describe('FollowDirectionsProbe: actual patient-visible eight-stage practice',()=>{
  it('shows a guided target and preserves supported, not independent, results at Stage 1',()=>{
    const complete=vi.fn();
    const correct=buildDirectionPracticeTrials(getDirectionPracticeStage(1)!,1)[0].steps[0].targetLabel;
    render(<FollowDirectionsProbe totalTrials={1} practiceLevel={1} onComplete={complete}/>);
    expect(screen.getByText(/Directions practice 1\/8/)).toBeTruthy();
    expect(screen.getAllByRole('button',{name:/^Touch /})).toHaveLength(2);
    expect(screen.getByRole('button',{name:'Touch '+correct}).getAttribute('data-guided')).toBe('true');
    fireEvent.click(screen.getByRole('button',{name:'Touch '+correct}));
    act(()=>vi.advanceTimersByTime(801));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      correct:1,total:1,practiceStage:1,evidenceScope:'supported_auditory_practice',
      trials:[expect.objectContaining({correct:true,practiceStage:1,supportShown:true,skipped:false})],
    }));
  });
  it('keeps auditory Stage 4 text hidden until a patient requests written help, but provides replay',()=>{
    const complete=vi.fn(),first=vi.fn();
    const trial=buildDirectionPracticeTrials(getDirectionPracticeStage(4)!,1)[0];
    render(<FollowDirectionsProbe totalTrials={1} practiceLevel={4} onFirstAction={first} onComplete={complete}/>);
    expect(screen.getByText(/Listen to the direction/)).toBeTruthy();
    expect(screen.queryByText(trial.text)).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Hear the direction again'}));
    expect(mocks.speak).toHaveBeenCalledWith(trial.text);
    fireEvent.click(screen.getByRole('button',{name:'Show written direction (help)'}));
    expect(screen.getByText(trial.text)).toBeTruthy();
    for(const item of trial.steps){
      fireEvent.click(screen.getByRole('button',{name:'Touch '+item.targetLabel}));
    }
    act(()=>vi.advanceTimersByTime(801));
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      correct:1,total:1,practiceStage:4,
      trials:[expect.objectContaining({supportShown:true,replayCount:1,correct:true,skipped:false})],
    }));
    expect(first).toHaveBeenCalled();
  });
  it('reports a skipped novel four-step round as unsuccessful without awarding an accuracy point',()=>{
    const complete=vi.fn();
    render(<FollowDirectionsProbe totalTrials={1} practiceLevel={8} onComplete={complete}/>);
    expect(screen.getByText(/Directions practice 8\/8/)).toBeTruthy();
    expect(screen.getAllByRole('button',{name:/^Touch /})).toHaveLength(6);
    fireEvent.click(screen.getByRole('button',{name:'Skip this direction'}));
    act(()=>vi.advanceTimersByTime(801));
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      correct:0,total:1,accuracy:0,
      trials:[expect.objectContaining({skipped:true,correct:false,practiceStage:8})],
    }));
  });
  it('cancels pending callbacks when a patient exits during feedback',()=>{
    const complete=vi.fn();
    const first=buildDirectionPracticeTrials(getDirectionPracticeStage(1)!,1)[0].steps[0].targetLabel;
    const view=render(<FollowDirectionsProbe totalTrials={1} practiceLevel={1} onComplete={complete}/>);
    fireEvent.click(screen.getByRole('button',{name:'Touch '+first}));
    view.unmount();
    act(()=>vi.advanceTimersByTime(900));
    expect(complete).not.toHaveBeenCalled();
  });
});
