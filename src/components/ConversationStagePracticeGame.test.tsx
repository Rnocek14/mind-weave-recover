import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {useState} from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {ConversationStagePracticeGame} from './ConversationStagePracticeGame';
import {
  getConversationPracticeScenes,getConversationPracticeStage,
  type ConversationPracticeKind,
} from '@/lib/conversationPractice/stages';

const mocks=vi.hoisted(()=>({
  speak:vi.fn(async(_text:string)=>{}),stop:vi.fn(),
  startMic:vi.fn(),stopMic:vi.fn(),
  onResult:null as null|((text:string)=>void),
}));
vi.mock('@/hooks/useTextToSpeech',()=>({
  useTextToSpeech:()=>({
    speak:mocks.speak,stop:mocks.stop,isSpeaking:false,
  }),
}));
vi.mock('@/hooks/useSpeechRecognition',()=>({
  useSpeechRecognition:({onResult}:{onResult:(text:string)=>void})=>{
    const [isListening,setListening]=useState(false);
    mocks.onResult=onResult;
    return {
      isSupported:true,isListening,error:null,
      startListening:()=>{mocks.startMic();setListening(true);},
      stopListening:()=>{mocks.stopMic();setListening(false);},
    };
  },
}));
beforeEach(()=>{vi.clearAllMocks();mocks.onResult=null;});
afterEach(()=>cleanup());
const mount=(kind:ConversationPracticeKind,level:1|4|8)=>{
  const onTrial=vi.fn(),onComplete=vi.fn();
  const stage=getConversationPracticeStage(kind,level)!;
  const scenes=getConversationPracticeScenes(kind,level);
  const view=render(<ConversationStagePracticeGame
    stage={stage} scenes={scenes}
    onTrialComplete={onTrial} onGameComplete={onComplete}/>);
  return {view,onTrial,onComplete,scenes};
};

describe('ConversationStagePracticeGame production interactions',()=>{
  it('plays and records four linked beginner turns, no duplication or clinical scoring',()=>{
    const {onTrial,onComplete}=mount('conversation-partner',1);
    const choices=[
      'A. I am doing okay, thanks.',
      'A. Yes, please come in.',
      'A. Good to see you too.',
      'A. Yes, thank you.',
    ];
    for(let i=0;i<choices.length;i++){
      fireEvent.click(screen.getByRole('button',{name:choices[i]}));
      expect(onTrial).toHaveBeenCalledTimes(i+1);
      expect(mocks.speak).toHaveBeenCalledWith(
        expect.stringContaining('That reply fits this example.'),
      );
      expect(onTrial).toHaveBeenLastCalledWith(expect.objectContaining({
        stage:1,responseKind:'choice',practiceMatch:true,
        inputMode:'choice',clinicalProgressionEligible:false,
        independentSpokenScoreEligible:false,
      }));
      // Response cannot be submitted again while feedback is visible.
      expect(screen.queryByRole('button',{name:choices[i]})).toBeNull();
      fireEvent.click(screen.getByRole('button',{
        name:i===3?'Finish practice':'Hear the next turn',
      }));
    }
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toHaveLength(4);
    expect(new Set(onComplete.mock.calls[0][0].map((r:{trialId:string})=>r.trialId)).size).toBe(4);
  });

  it('Stage 1 Coach reads the full modeled phrase; logs modeled support not independent speech',()=>{
    const {onTrial}=mount('conversation-coach',1);
    expect(mocks.speak).toHaveBeenCalledWith(expect.stringContaining('May I have some water, please?'));
    expect(screen.getByText(/Model phrase: May I have some water, please/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'I tried speaking (no transcript)'}));
    expect(onTrial).toHaveBeenCalledWith(expect.objectContaining({
      providedModelText:'May I have some water, please?',inputMode:'self_report',
      userResponse:null,practiceMatch:null,independentSpokenScoreEligible:false,
    }));
  });

  it('does not pretend the scripted next turn interpreted open speech',()=>{
    const {onTrial}=mount('conversation-partner',4);
    fireEvent.change(screen.getByRole('textbox',{name:'Your own words'}),{
      target:{value:'I like watching birds with my sister.'},
    });
    fireEvent.click(screen.getByRole('button',{name:'Record my response'}));
    expect(onTrial).toHaveBeenCalledWith(expect.objectContaining({
      practiceMatch:null,inputMode:'typed',clinicalProgressionEligible:false,
    }));
    fireEvent.click(screen.getByRole('button',{name:'Hear the next turn'}));
    expect(screen.getByText('Tell me a little more about that activity.')).toBeTruthy();
    expect(screen.getByText(/Her next message is not a judgment/)).toBeTruthy();
  });

  it('keeps a typed patient correction when a delayed recognizer result arrives',()=>{
    const {onTrial}=mount('conversation-coach',8);
    fireEvent.click(screen.getByRole('button',{name:'Try speaking'}));
    expect(mocks.startMic).toHaveBeenCalledTimes(1);
    act(()=>mocks.onResult?.('incorrect live hypothesis'));
    fireEvent.change(screen.getByRole('textbox',{name:'Your own words'}),{
      target:{value:'Could we change the visit to Thursday?'},
    });
    act(()=>mocks.onResult?.('late overwritten text'));
    fireEvent.click(screen.getByRole('button',{name:'Record my response'}));
    expect(onTrial).toHaveBeenCalledWith(expect.objectContaining({
      inputMode:'typed',userResponse:'Could we change the visit to Thursday?',
      practiceMatch:null,providedModelText:null,
    }));
  });

  it('records browser recognition as unverified participation without marking response correct',()=>{
    const {onTrial}=mount('conversation-partner',8);
    fireEvent.click(screen.getByRole('button',{name:'Try speaking'}));
    act(()=>mocks.onResult?.('Can we meet another day?'));
    fireEvent.click(screen.getByRole('button',{name:'Record my response'}));
    expect(onTrial).toHaveBeenCalledWith(expect.objectContaining({
      inputMode:'browser_recognized',userResponse:'Can we meet another day?',
      practiceMatch:null,clinicalProgressionEligible:false,
      independentSpokenScoreEligible:false,
    }));
  });

  it('records explicit clue and skip without manufactured spoken data',()=>{
    const {onTrial}=mount('conversation-coach',8);
    fireEvent.click(screen.getByRole('button',{name:'Need a clue?'}));
    expect(mocks.speak).toHaveBeenCalledWith(
      'Explain the conflict and request an option.',
    );
    fireEvent.click(screen.getByRole('button',{name:'Skip this turn'}));
    expect(onTrial).toHaveBeenCalledTimes(1);
    expect(mocks.speak).toHaveBeenCalledWith(expect.stringContaining('Turn skipped.'));
    expect(onTrial).toHaveBeenCalledWith(expect.objectContaining({
      inputMode:'skipped',userResponse:null,practiceMatch:null,
      revealedHelpText:'Explain the conflict and request an option.',
    }));
  });

  it('releases TTS/microphone on exit and ignores stale transcripts',()=>{
    const {view,onTrial}=mount('conversation-partner',8);
    act(()=>mocks.onResult?.('not listening'));
    expect(screen.getByRole('button',{name:'Record my response'}).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Try speaking'}));
    fireEvent.click(screen.getByRole('button',{name:'Stop microphone'}));
    act(()=>mocks.onResult?.('result after stop'));
    expect(screen.getByRole('button',{name:'Record my response'}).hasAttribute('disabled')).toBe(true);
    view.unmount();
    act(()=>mocks.onResult?.('result after exit'));
    expect(mocks.stopMic).toHaveBeenCalled();
    expect(mocks.stop).toHaveBeenCalled();
    expect(onTrial).not.toHaveBeenCalled();
  });
});
