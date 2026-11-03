import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {SequenceBuilderProbe} from './SequenceBuilderProbe';

const mocks=vi.hoisted(()=>({speak:vi.fn(async(_s:string)=>{})}));
vi.mock('@/hooks/useTextToSpeech',()=>({
  useTextToSpeech:()=>({speak:mocks.speak,isLoading:false,error:null}),
}));
beforeEach(()=>{vi.clearAllMocks();vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(0.5);});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();});

describe('SequenceBuilderProbe: eight actual practice formats',()=>{
  it('requires an independently answered cause question after ordering Stage 6',()=>{
    const complete=vi.fn();
    render(<SequenceBuilderProbe totalTrials={1} practiceLevel={6} onComplete={complete}/>);
    expect(screen.getByText(/Sequence practice 6\/8/)).toBeTruthy();
    expect(screen.getAllByRole('button',{name:/^Move .* up$/})).toHaveLength(4);
    fireEvent.click(screen.getByRole('button',{name:'Check Order'}));
    expect(screen.getByRole('group',{name:'Cause and effect question'})).toBeTruthy();
    expect(complete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'So it is ready to eat'}));
    act(()=>vi.advanceTimersByTime(1201));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      correct:1,total:1,practiceStage:6,evidenceScope:'supported_sequencing_practice',
      trials:[expect.objectContaining({
        correct:true,positionAccuracy:1,causeCorrect:true,responseMode:'ordering',
      })],
    }));
  });
  it('presents two distinct alternatives in Stage 7 and records choosing an order, not rearranging',()=>{
    const complete=vi.fn();
    render(<SequenceBuilderProbe totalTrials={1} practiceLevel={7} onComplete={complete}/>);
    expect(screen.getByText(/Sequence practice 7\/8/)).toBeTruthy();
    expect(screen.queryByRole('button',{name:'Check Order'})).toBeNull();
    expect(screen.getAllByRole('button',{name:/Option [AB]/})).toHaveLength(2);
    fireEvent.click(screen.getByRole('button',{name:/Option A/}));
    fireEvent.click(screen.getByRole('button',{name:/Option B/}));
    act(()=>vi.advanceTimersByTime(1201));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      correct:1,accuracy:1,practiceStage:7,
      trials:[expect.objectContaining({responseMode:'choice',correct:true})],
    }));
  });
  it('adds optional first-step support and marks a skip as unsuccessful in novel Stage 8',()=>{
    const complete=vi.fn();
    render(<SequenceBuilderProbe totalTrials={1} practiceLevel={8} onComplete={complete}/>);
    expect(screen.getByText(/new practical sequence/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Show the first step (help)'}));
    expect(screen.getByText(/First step:/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Skip this sequence'}));
    act(()=>vi.advanceTimersByTime(1201));
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      correct:0,accuracy:0,practiceStage:8,
      trials:[expect.objectContaining({skipped:true,supportShown:true})],
    }));
  });
  it('keeps ordinary quick practice available without silently changing its stage',()=>{
    const complete=vi.fn();
    render(<SequenceBuilderProbe totalTrials={1} onComplete={complete}/>);
    expect(screen.queryByText(/Sequence practice .*\/8/)).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Check Order'}));
    act(()=>vi.advanceTimersByTime(1201));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      practiceStage:undefined,total:1,
    }));
  });
  it('does not dispatch completed results after exiting while awaiting feedback',()=>{
    const complete=vi.fn();
    const view=render(<SequenceBuilderProbe totalTrials={1} practiceLevel={7} onComplete={complete}/>);
    fireEvent.click(screen.getByRole('button',{name:/Option A/}));
    view.unmount();
    act(()=>vi.advanceTimersByTime(1300));
    expect(complete).not.toHaveBeenCalled();
  });
});
