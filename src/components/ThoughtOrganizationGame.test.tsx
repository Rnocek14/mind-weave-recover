import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ThoughtOrganizationGame} from './ThoughtOrganizationGame';
import {getThoughtOrganizationStage} from '@/lib/thoughtOrganization/practiceStages';

const mocks=vi.hoisted(()=>({
  speak:vi.fn(async(_text:string)=>{}),
  stop:vi.fn(),
  micStart:vi.fn(),
  micStop:vi.fn(),
  onResult: null as null|((text:string)=>void),
}));
vi.mock('@/hooks/useTextToSpeech',()=>({
  useTextToSpeech:()=>({speak:mocks.speak,stop:mocks.stop,isSpeaking:false}),
}));
vi.mock('@/hooks/useSpeechRecognition',()=>({
  useSpeechRecognition:({onResult}:{onResult:(text:string)=>void})=>{
    mocks.onResult=onResult;
    return {
      isSupported:true,isListening:false,startListening:mocks.micStart,
      stopListening:mocks.micStop,error:null,
    };
  },
}));
beforeEach(()=>{vi.clearAllMocks();vi.useFakeTimers();mocks.onResult=null;});
afterEach(()=>{cleanup();vi.useRealTimers();});

describe('ThoughtOrganizationGame — real patient interactions, not clinical score simulations',()=>{
  it('speaks the prompt, scores an actual first-stage main-idea selection and blocks double taps',()=>{
    const trial=vi.fn(),finish=vi.fn();
    render(<ThoughtOrganizationGame stage={getThoughtOrganizationStage(1)!}
      roundCount={1} onTrialComplete={trial} onGameComplete={finish}/>);
    expect(screen.getByText(/Thought practice 1\/8/)).toBeTruthy();
    expect(mocks.speak).toHaveBeenCalledWith(expect.stringContaining('A person needs milk'));
    fireEvent.click(screen.getByRole('button',{name:/A. Planning grocery shopping/}));
    expect(trial).toHaveBeenCalledWith(expect.objectContaining({
      trialId:'main-groceries',correct:true,practiceAccuracy:1,inputMode:'choice',
      clinicalProgressionEligible:false,independentSpokenScoreEligible:false,
    }));
    expect(screen.queryByRole('button',{name:/B. Fixing a broken car/})).toBeNull();
    act(()=>vi.advanceTimersByTime(1601));
    expect(finish).toHaveBeenCalledTimes(1);
  });
  it('requires actual reordering of beginning-middle-end at Stage 3',()=>{
    const trial=vi.fn();
    render(<ThoughtOrganizationGame stage={getThoughtOrganizationStage(3)!}
      roundCount={1} onTrialComplete={trial} onGameComplete={vi.fn()}/>);
    expect(screen.getByText(/Thought practice 3\/8/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:/Move down: The visitor says goodbye/}));
    fireEvent.click(screen.getByRole('button',{name:/Move down: The visitor says goodbye/}));
    fireEvent.click(screen.getByRole('button',{name:'Check order'}));
    expect(trial).toHaveBeenCalledWith(expect.objectContaining({
      correct:true,practiceAccuracy:1,inputMode:'reordered',
    }));
  });
  it('requires selecting two real relevant facts at Stage 6 without guessing speech quality',()=>{
    const trial=vi.fn();
    render(<ThoughtOrganizationGame stage={getThoughtOrganizationStage(6)!}
      roundCount={1} onTrialComplete={trial} onGameComplete={vi.fn()}/>);
    expect(screen.getByRole('button',{name:'Check details'}).hasAttribute?.('disabled')??screen.getByRole('button',{name:'Check details'}).getAttribute('disabled')!==null).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'The concern began this week'}));
    fireEvent.click(screen.getByRole('button',{name:'A symptom changes when walking'}));
    fireEvent.click(screen.getByRole('button',{name:'Check details'}));
    expect(trial).toHaveBeenCalledWith(expect.objectContaining({
      correct:true,inputMode:'selected_details',practiceAccuracy:1,
    }));
  });
  it('records a Stage 8 typed explanation without auto-scoring conversational competence',()=>{
    const trial=vi.fn(),done=vi.fn();
    render(<ThoughtOrganizationGame stage={getThoughtOrganizationStage(8)!}
      roundCount={1} onTrialComplete={trial} onGameComplete={done}/>);
    expect(screen.getByText(/Thought practice 8\/8/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Need help? Hear a clue'}));
    fireEvent.change(screen.getByRole('textbox',{name:'Your own words'}),{
      target:{value:'The library opens later, so my friend should phone first.'},
    });
    fireEvent.click(screen.getByRole('button',{name:'Record my response'}));
    expect(trial).toHaveBeenCalledWith(expect.objectContaining({
      correct:null,practiceAccuracy:null,inputMode:'typed',supportRevealed:true,
      userResponse:'The library opens later, so my friend should phone first.',
      clinicalProgressionEligible:false,independentSpokenScoreEligible:false,
    }));
    act(()=>vi.advanceTimersByTime(1601));
    expect(done).toHaveBeenCalledTimes(1);
  });
  it('does not convert a synthetic recognizer transcript into an independent clinical score',()=>{
    const trial=vi.fn();
    render(<ThoughtOrganizationGame stage={getThoughtOrganizationStage(7)!}
      roundCount={1} onTrialComplete={trial} onGameComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Try speaking'}));
    expect(mocks.micStart).toHaveBeenCalledTimes(1);
    act(()=>mocks.onResult?.('I would rather eat at home because it is quieter'));
    fireEvent.click(screen.getByRole('button',{name:'Record my response'}));
    expect(trial).toHaveBeenCalledWith(expect.objectContaining({
      correct:null,practiceAccuracy:null,inputMode:'browser_recognized',
      independentSpokenScoreEligible:false,
    }));
  });
  it('records manually reported participation with no invented transcript and cancels on exit',()=>{
    const trial=vi.fn(),finish=vi.fn();
    const view=render(<ThoughtOrganizationGame stage={getThoughtOrganizationStage(8)!}
      roundCount={1} onTrialComplete={trial} onGameComplete={finish}/>);
    fireEvent.click(screen.getByRole('button',{name:'I tried speaking (no transcript)'}));
    expect(trial).toHaveBeenCalledWith(expect.objectContaining({
      inputMode:'self_report',userResponse:null,correct:null,
    }));
    view.unmount();
    act(()=>vi.advanceTimersByTime(1700));
    expect(finish).not.toHaveBeenCalled();
    expect(mocks.micStop).toHaveBeenCalled();
  });
});
