/**
 * Scripted conversational practice: Maya's lines do not adapt to the
 * patient's speech. Open responses are attempts only, not clinical scores.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import {
  evaluateConversationPracticeTurn,
  type ConversationPracticeScene, type ConversationPracticeStage,
  type ConversationPracticeTurn,
} from '@/lib/conversationPractice/stages';

export type ConversationPracticeInputMode =
  'choice'|'typed'|'browser_recognized'|'self_report'|'skipped';

export interface ConversationPracticeResult {
  trialId:string;
  stage:number;
  sceneId:string;
  turnIndex:number;
  turnSkill:ConversationPracticeTurn['skill'];
  responseKind:ConversationPracticeTurn['kind'];
  inputMode:ConversationPracticeInputMode;
  userResponse:string|null;
  practiceMatch:boolean|null;
  revealedHelpText:string|null;
  providedModelText:string|null;
  clinicalProgressionEligible:false;
  independentSpokenScoreEligible:false;
}
interface Props {
  stage:ConversationPracticeStage;
  scenes:readonly ConversationPracticeScene[];
  onTrialComplete:(result:ConversationPracticeResult)=>void;
  onGameComplete:(results:ConversationPracticeResult[])=>void;
}

export function ConversationStagePracticeGame({
  stage,scenes,onTrialComplete,onGameComplete,
}:Props){
  const [step,setStep]=useState(0);
  const [feedback,setFeedback]=useState<ConversationPracticeResult|null>(null);
  const [results,setResults]=useState<ConversationPracticeResult[]>([]);
  const [help,setHelp]=useState(false);
  const [response,setResponse]=useState('');
  const [responseMode,setResponseMode]=useState<'typed'|'browser_recognized'>('typed');
  const [finished,setFinished]=useState(false);
  const mountedRef=useRef(true);
  const micRequestedRef=useRef(false);
  const lockedRef=useRef(false);
  const completeRef=useRef(false);
  const scene=scenes[Math.floor(step/2)];
  const turnIndex=step%2;
  const turn=scene?.turns[turnIndex];
  const {speak,stop,isSpeaking}=useTextToSpeech();
  const onSpeech=useCallback((transcript:string)=>{
    if(!mountedRef.current||!micRequestedRef.current||lockedRef.current)return;
    setResponse(transcript);setResponseMode('browser_recognized');
  },[]);
  const {isSupported,isListening,startListening,stopListening,error:micError}=
    useSpeechRecognition({onResult:onSpeech,continuousListening:false,patientMode:true});

  useEffect(()=>{
    mountedRef.current=true;
    return ()=>{
      mountedRef.current=false;
      micRequestedRef.current=false;
      stopListening();stop();
    };
    // Functions belong to the single mounted speech hook instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Maya reads fixed script text. It is never a generated evaluation.
  useEffect(()=>{
    if(!turn)return;
    const model=turn.kind==='open'&&turn.model?' First, here is a model: '+turn.model:'';
    const choices=turn.kind==='choice'
      ?' Option A. '+turn.options[0]+'. Option B. '+turn.options[1]+'.':'';
    const intro=step===0?stage.instruction+' ':'';
    void speak(intro+turn.mayaPrompt+model+choices);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[step,stage.level]);

  const play=(text:string)=>{
    micRequestedRef.current=false;
    stopListening();
    stop();
    void speak(text);
  };
  const submit=(answer:{
    inputMode:ConversationPracticeInputMode;userResponse?:string|null;choiceIndex?:number;
  })=>{
    if(!turn||!scene||lockedRef.current||completeRef.current)return;
    lockedRef.current=true;
    micRequestedRef.current=false;
    stopListening();stop();
    const verdict=answer.inputMode==='skipped'
      ?{practiceMatch:turn.kind==='choice'?false:null}
      :evaluateConversationPracticeTurn(turn,{choiceIndex:answer.choiceIndex});
    const result:ConversationPracticeResult={
      trialId:turn.id,stage:stage.level,sceneId:scene.id,turnIndex,
      turnSkill:turn.skill,responseKind:turn.kind,
      inputMode:answer.inputMode,
      userResponse:answer.userResponse??null,practiceMatch:verdict.practiceMatch,
      revealedHelpText:help?turn.clue:null,
      providedModelText:turn.kind==='open'?turn.model??null:null,
      clinicalProgressionEligible:false,independentSpokenScoreEligible:false,
    };
    setResults(old=>[...old,result]);
    setFeedback(result);
    onTrialComplete(result);
  };
  const next=()=>{
    if(!feedback||completeRef.current||!lockedRef.current)return;
    if(step+1>=scenes.length*2){
      completeRef.current=true;
      setFinished(true);
      onGameComplete(results);
      return;
    }
    micRequestedRef.current=false;
    stopListening();
    setStep(old=>old+1);
    setResponse('');setResponseMode('typed');
    setFeedback(null);setHelp(false);
    lockedRef.current=false;
  };
  const toggleMic=()=>{
    if(isListening||micRequestedRef.current){
      micRequestedRef.current=false;stopListening();return;
    }
    if(!isSupported||isSpeaking||lockedRef.current)return;
    stop();micRequestedRef.current=true;startListening();
  };

  if(!turn||!scene)return <p role="status" className="p-8 text-center">
    No scripted conversation is available for this stage.
  </p>;
  if(finished)return <p role="status" className="p-8 text-center text-xl">
    All practice turns recorded. Saving…
  </p>;
  return <div className="space-y-4 max-w-xl mx-auto p-4">
    <div className="rounded-xl bg-muted/30 p-4 space-y-2">
      <p className="text-sm text-muted-foreground">
        Practice stage {stage.level}/8 · Turn {step+1} of {scenes.length*2}
      </p>
      <h2 className="text-xl font-semibold">{stage.title}</h2>
      <p className="text-base">{stage.instruction}</p>
    </div>
    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="text-lg font-semibold">{scene.title}</h3>
      <p>{scene.situation}</p>
      <p className="text-xs text-muted-foreground">
        Maya follows a prepared role-play script. Her next message is not a judgment of your words.
      </p>
      <p className="text-xl font-medium">{turn.mayaPrompt}</p>
      {turn.kind==='open'&&turn.model&&
        <p className="rounded-lg bg-muted p-3">Model phrase: {turn.model}</p>}
      <Button size="lg" variant="outline" className="w-full min-h-14"
        disabled={!!feedback} onClick={()=>play(turn.mayaPrompt+
          (turn.kind==='open'&&turn.model?' '+turn.model:''))}>
        <Volume2 className="h-5 w-5 mr-2"/>Hear Maya again
      </Button>
    </div>
    {!feedback&&<>
      {!help?
        <Button size="lg" className="w-full min-h-14" variant="outline"
          onClick={()=>{setHelp(true);play(turn.clue);}}>Need a clue?</Button>
        :<p role="status" className="rounded-lg bg-muted p-4">{turn.clue}</p>}
      {turn.kind==='choice'&&<div className="space-y-3">
        {turn.options.map((option,index)=><Button key={option} size="lg" variant="outline"
          className="min-h-16 w-full h-auto whitespace-normal text-left justify-start p-4"
          onClick={()=>submit({inputMode:'choice',choiceIndex:index,userResponse:option})}>
          {index===0?'A. ':'B. '}{option}
        </Button>)}
      </div>}
      {turn.kind==='open'&&<div className="space-y-3">
        <p className="text-base">
          Try speaking or typing. The next scripted turn does not mean Maya
          understood or graded your response.
        </p>
        <Textarea rows={3} aria-label="Your own words"
          placeholder="Your response (optional)" className="text-base min-h-24"
          value={response} onChange={event=>{
            micRequestedRef.current=false;
            stopListening();
            setResponse(event.target.value);setResponseMode('typed');
          }}/>
        {isSupported&&<Button size="lg" variant="outline" className="w-full min-h-14"
          disabled={isSpeaking} onClick={toggleMic}>
          {isListening?<><MicOff className="w-5 h-5 mr-2"/>Stop microphone</>
            :<><Mic className="w-5 h-5 mr-2"/>Try speaking</>}
        </Button>}
        {micError&&<p role="status">Microphone unavailable. Typing is okay.</p>}
        <Button size="lg" className="w-full min-h-14" disabled={!response.trim()}
          onClick={()=>submit({inputMode:responseMode,userResponse:response.trim()})}>
          Record my response
        </Button>
        <Button size="lg" variant="outline" className="w-full min-h-14"
          onClick={()=>submit({inputMode:'self_report'})}>I tried speaking (no transcript)</Button>
      </div>}
      <Button variant="ghost" size="lg" className="w-full min-h-14"
        onClick={()=>submit({inputMode:'skipped'})}>Skip this turn</Button>
    </>}
    {feedback&&<div role="status" className="rounded-xl bg-muted p-4 space-y-3">
      <p className="text-lg font-semibold">
        {feedback.inputMode==='skipped'?'Turn skipped.'
          :feedback.practiceMatch===null?'Your attempt was recorded.'
            :feedback.practiceMatch?'That reply fits this example.'
              :'Here is another reply that fits this example.'}
      </p>
      {feedback.practiceMatch===false&&turn.kind==='choice'&&
        <p>A useful reply: {turn.options[turn.bestChoice]}</p>}
      <p className="text-sm text-muted-foreground">
        This does not measure independent conversation or clinical mastery.
      </p>
      <Button size="lg" className="w-full min-h-16 text-lg" onClick={next}>
        {step+1>=scenes.length*2?'Finish practice':'Hear the next turn'}
      </Button>
    </div>}
  </div>;
}
