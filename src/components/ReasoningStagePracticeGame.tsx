/**
 * Accessible, optional eight-stage reasoning rehearsal.
 * Not a replacement for either game's clinical scorer. Choice matching is
 * against a known authored option only; open repair/inference is ungraded.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import {
  evaluateReasoningChoice,orderReasoningChoices,
  type ReasoningPracticeScene,
  type ReasoningPracticeStage,
  type ReasoningPracticeSkill,
} from '@/lib/reasoningPractice/stages';

export type ReasoningResponseMode = 'choice' | 'typed' | 'browser_recognized' | 'self_report' | 'skipped';
export interface ReasoningPracticeResult {
  trialId: string;
  stage: number;
  sceneId: string;
  sceneTitle: string;
  stepIndex: number;
  skill: ReasoningPracticeSkill;
  responseKind: 'choice' | 'open';
  inputMode: ReasoningResponseMode;
  userResponse: string | null;
  selectedChoice: number | null;
  practiceMatch: boolean | null;
  clueRevealed: boolean;
  modelRevealedBeforeAttempt: boolean;
  /** Never interpreted as a patient recovery or speech-accuracy score. */
  clinicalProgressionEligible: false;
  independentSpokenScoreEligible: false;
}
interface Props {
  stage: ReasoningPracticeStage;
  scenes: readonly ReasoningPracticeScene[];
  onTrialComplete: (result: ReasoningPracticeResult) => void;
  onGameComplete: (results: ReasoningPracticeResult[]) => void;
}
export function ReasoningStagePracticeGame({stage,scenes,onTrialComplete,onGameComplete}:Props){
  const [stepIndex,setStepIndex]=useState(0);
  const [response,setResponse]=useState('');
  const [responseMode,setResponseMode]=useState<'typed'|'browser_recognized'>('typed');
  const [clueRevealed,setClueRevealed]=useState(false);
  const [modelRevealed,setModelRevealed]=useState(false);
  const [feedback,setFeedback]=useState<ReasoningPracticeResult|null>(null);
  const [finished,setFinished]=useState(false);
  const lockedRef=useRef(false);
  const completedRef=useRef(false);
  const mountedRef=useRef(true);
  const micRequestedRef=useRef(false);
  const resultsRef=useRef<ReasoningPracticeResult[]>([]);
  const scene=scenes[Math.floor(stepIndex/2)];
  const turnIndex=stepIndex%2;
  const task=scene?.steps[turnIndex];
  const displayChoices=task?.kind==='choice'?orderReasoningChoices(task):[];
  const totalSteps=scenes.length*2;
  const {speak,stop,isSpeaking}=useTextToSpeech();
  const onSpeech=useCallback((text:string)=>{
    if(!mountedRef.current||!micRequestedRef.current||lockedRef.current)return;
    setResponse(text);setResponseMode('browser_recognized');
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
    // These callbacks belong to this mounted recognition/voice instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // The patient can hear the situation and question without reading them.
  useEffect(()=>{
    if(!task||!scene)return;
    const sceneIntro=turnIndex===0?scene.title+'. '+scene.context+' ':'';
    void speak((stepIndex===0?stage.instruction+' ':'')+sceneIntro+task.question+
      (task.kind==='choice'
        ?' '+displayChoices.map((choice,i)=>'Option '+String.fromCharCode(65+i)+': '+choice.text).join('. '):''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[stepIndex,stage.level]);

  const play=(text:string)=>{
    micRequestedRef.current=false;stopListening();stop();
    void speak(text);
  };
  const submit=(answer:{
    inputMode:ReasoningResponseMode;
    userResponse?:string|null;
    selectedChoice?:number|null;
  })=>{
    if(!scene||!task||lockedRef.current||completedRef.current)return;
    lockedRef.current=true;
    micRequestedRef.current=false;stopListening();stop();
    const choiceIndex=answer.selectedChoice??null;
    const practiceMatch=answer.inputMode==='skipped'
      ?null:evaluateReasoningChoice(task,choiceIndex);
    const result:ReasoningPracticeResult={
      trialId:task.id,stage:stage.level,sceneId:scene.id,
      sceneTitle:scene.title,stepIndex,skill:task.skill,
      responseKind:task.kind,inputMode:answer.inputMode,
      userResponse:answer.userResponse??null,
      selectedChoice:choiceIndex,
      practiceMatch,clueRevealed,modelRevealedBeforeAttempt:modelRevealed,
      clinicalProgressionEligible:false,independentSpokenScoreEligible:false,
    };
    resultsRef.current.push(result);
    setFeedback(result);
    onTrialComplete(result);
  };
  const advance=()=>{
    if(!feedback||!lockedRef.current||completedRef.current)return;
    micRequestedRef.current=false;stopListening();stop();
    if(stepIndex+1>=totalSteps){
      completedRef.current=true;
      setFinished(true);
      onGameComplete([...resultsRef.current]);
      return;
    }
    setStepIndex(value=>value+1);
    setResponse('');setResponseMode('typed');
    setClueRevealed(false);setModelRevealed(false);
    setFeedback(null);
    lockedRef.current=false;
  };
  const toggleMic=()=>{
    if(isListening||micRequestedRef.current){
      micRequestedRef.current=false;stopListening();return;
    }
    if(!isSupported||isSpeaking||lockedRef.current)return;
    stop();micRequestedRef.current=true;
    startListening();
  };

  if(!scene||!task||totalSteps!==4)return <p role="alert" className="p-6 text-xl">
    These practice items are unavailable. Please return to Today.
  </p>;
  if(finished)return <p role="status" className="p-8 text-center text-xl">
    All four practice attempts recorded. Saving…
  </p>;

  return <div className="mx-auto max-w-xl space-y-4 p-4">
    <div className="rounded-xl bg-muted/40 p-4">
      <p className="text-sm text-muted-foreground">Practice stage {stage.level}/8 · Task {stepIndex+1} of {totalSteps}</p>
      <h2 className="text-xl font-semibold">{stage.title}</h2>
      <p className="mt-2">{stage.instruction}</p>
    </div>
    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="text-lg font-semibold">{scene.title}</h3>
      <p className="text-lg">{scene.context}</p>
      <p className="text-xl font-medium">{task.question}</p>
      <Button size="lg" variant="outline" className="min-h-14 w-full"
        disabled={!!feedback} onClick={()=>play(scene.context+' '+task.question+
          (task.kind==='choice'
            ?' '+displayChoices.map((choice,i)=>'Option '+String.fromCharCode(65+i)+': '+choice.text).join('. ')
            :''))}>
        <Volume2 className="mr-2 h-5 w-5"/>Hear again
      </Button>
    </div>
    {!feedback&&<>
      {!clueRevealed?
        <Button size="lg" variant="outline" className="min-h-14 w-full"
          onClick={()=>{setClueRevealed(true);play(task.clue);}}>Need a clue?</Button>:
        <p role="status" className="rounded-lg bg-muted p-4 text-lg">Clue: {task.clue}</p>}
      {task.kind==='choice'?<div className="space-y-3">
        {displayChoices.map((choice,i)=><Button
          key={task.id+':'+i} size="lg" variant="outline"
          className="min-h-16 h-auto w-full whitespace-normal p-4 text-left justify-start text-lg"
          onClick={()=>submit({inputMode:'choice',selectedChoice:choice.originalIndex,userResponse:choice.text})}>
          {String.fromCharCode(65+i)}. {choice.text}
        </Button>)}
      </div>:<div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Try saying or typing a clearer message. This task is not automatically graded.
        </p>
        {modelRevealed&&<p role="status" className="rounded-lg bg-muted p-4 text-lg">
          Example: {task.modelExample}
        </p>}
        {!modelRevealed&&<Button size="lg" variant="outline" className="min-h-14 w-full"
          onClick={()=>{setModelRevealed(true);play(task.modelExample);}}>
          Hear an example
        </Button>}
        <Textarea rows={3} aria-label="Your own words"
          className="min-h-24 text-lg" placeholder="Your own words (optional)"
          value={response} onChange={event=>{
            micRequestedRef.current=false;stopListening();
            setResponse(event.target.value);setResponseMode('typed');
          }}/>
        {isSupported&&<Button size="lg" variant="outline" className="min-h-14 w-full"
          disabled={isSpeaking} onClick={toggleMic}>
          {isListening?<><MicOff className="mr-2 h-5 w-5"/>Stop microphone</>:
            <><Mic className="mr-2 h-5 w-5"/>Try speaking</>}
        </Button>}
        {micError&&<p role="status">Microphone unavailable. Typing is okay.</p>}
        <Button size="lg" className="min-h-16 w-full" disabled={!response.trim()}
          onClick={()=>submit({inputMode:responseMode,userResponse:response.trim()})}>
          Record my attempt
        </Button>
        <Button size="lg" className="min-h-14 w-full" variant="outline"
          onClick={()=>submit({inputMode:'self_report'})}>
          I tried speaking (no transcript)
        </Button>
      </div>}
      <Button variant="ghost" size="lg" className="min-h-14 w-full"
        onClick={()=>submit({inputMode:'skipped'})}>
        Skip this task
      </Button>
    </>}
    {feedback&&<div role="status" className="rounded-xl bg-muted p-4 space-y-3">
      <p className="text-lg font-semibold">
        {feedback.inputMode==='skipped'?'Task skipped.'
          :feedback.practiceMatch===null?'Your practice attempt was recorded.'
            :feedback.practiceMatch?'That choice fits this example.'
              :'Here is the example answer.'}
      </p>
      <p className="text-lg">{task.explanation}</p>
      {task.kind==='choice'&&
        <p className="text-base">Example choice: {task.options[task.bestChoice]}</p>}
      {task.kind==='open'&&<p className="text-base">Example response: {task.modelExample}</p>}
      <p className="text-sm text-muted-foreground">
        This is rehearsal only, not an independent speech or clinical recovery score.
      </p>
      <Button size="lg" className="min-h-16 w-full text-lg" onClick={advance}>
        {stepIndex+1>=totalSteps?'Finish practice':'Next task'}
      </Button>
    </div>}
  </div>;
}
