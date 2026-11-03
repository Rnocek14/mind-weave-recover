/**
 * Thought Organization: standalone adult practice player.
 *
 * The eight stages change WHAT the patient practices, not a level badge.
 * Open-ended language is logged as an attempt, never automatically scored as
 * coherent or independently conversational, even with a browser transcript.
 */
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {useSpeechRecognition} from '@/hooks/useSpeechRecognition';
import {useTextToSpeech} from '@/hooks/useTextToSpeech';
import {
  evaluateThoughtOrganizationResponse,getThoughtOrganizationTrials,
  type ThoughtOrganizationStage,type ThoughtOrganizationTrial,
} from '@/lib/thoughtOrganization/practiceStages';
import {ArrowDown,ArrowUp,Volume2,Mic,MicOff} from 'lucide-react';

export type ThoughtOrganizationInputMode=
  'choice'|'reordered'|'selected_details'|'typed'|
  'browser_recognized'|'self_report'|'skipped';
export interface ThoughtOrganizationRoundResult{
  trialId:string;
  stage:number;
  taskKind:ThoughtOrganizationTrial['kind'];
  inputMode:ThoughtOrganizationInputMode;
  userResponse:string|null;
  correct:boolean|null;
  practiceAccuracy:number|null;
  supportRevealed:boolean;
  /** False for ALL stages, including perfect choices. */
  clinicalProgressionEligible:false;
  independentSpokenScoreEligible:false;
}
interface Props {
  stage:ThoughtOrganizationStage;
  roundCount?:number;
  onTrialComplete:(result:ThoughtOrganizationRoundResult)=>void;
  onGameComplete:(results:ThoughtOrganizationRoundResult[])=>void;
}
export function ThoughtOrganizationGame({
  stage,roundCount=3,onTrialComplete,onGameComplete,
}:Props){
  const trials=useMemo(()=>getThoughtOrganizationTrials(stage,roundCount),[stage.level,roundCount]);
  const [index,setIndex]=useState(0);
  const [results,setResults]=useState<ThoughtOrganizationRoundResult[]>([]);
  const [help,setHelp]=useState(false);
  const [feedback,setFeedback]=useState<ThoughtOrganizationRoundResult|null>(null);
  const [finished,setFinished]=useState(false);
  const [order,setOrder]=useState<string[]>(()=>{
    const task=trials[0];
    return task?.kind==='order'
      ? [task.ordered[2],task.ordered[0],task.ordered[1]]:[];
  });
  const [selectedDetails,setSelectedDetails]=useState<number[]>([]);
  const [response,setResponse]=useState('');
  const [responseMode,setResponseMode]=useState<'typed'|'browser_recognized'>('typed');
  const lockedRef=useRef(false);
  const finishedRef=useRef(false);
  const mountedRef=useRef(true);
  const feedbackTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);

  const onRecognized=useCallback((text:string)=>{
    if(!mountedRef.current || lockedRef.current)return;
    setResponse(text);
    setResponseMode('browser_recognized');
  },[]);
  const {isSupported,isListening,startListening,stopListening,error:micError}=
    useSpeechRecognition({onResult:onRecognized,continuousListening:true});
  const {speak,stop,isSpeaking}=useTextToSpeech();
  const current=trials[index];

  useEffect(()=>{
    mountedRef.current=true;
    return ()=>{
      mountedRef.current=false;
      if(feedbackTimerRef.current)clearTimeout(feedbackTimerRef.current);
      stopListening();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{
    if(!current)return;
    const speech=stage.instruction+' '+current.prompt+' '+(
      current.kind==='choice'
        ? 'Option A. '+current.options[0]+'. Option B. '+current.options[1]+'.'
        : current.kind==='relevance'
          ? current.options.map((t,i)=>'Option '+String.fromCharCode(65+i)+'. '+t+'.').join(' ')
          : current.kind==='order'
            ? current.ordered.map(t=>t+'.').join(' ')
            : '');
    void speak(speech);
    // New question is spoken automatically; a replay button remains visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[index,stage.level]);

  const resetRound=(next:number)=>{
    const trial=trials[next];
    setHelp(false);
    setFeedback(null);
    setResponse('');
    setResponseMode('typed');
    setSelectedDetails([]);
    setOrder(trial?.kind==='order'
      ?[trial.ordered[2],trial.ordered[0],trial.ordered[1]]:[]);
    lockedRef.current=false;
    setIndex(next);
  };

  const submit=(answer:{
    inputMode:ThoughtOrganizationInputMode;
    userResponse?:string|null;
    choiceIndex?:number;order?:readonly string[];selectedIndices?:readonly number[];
  })=>{
    if(!current||lockedRef.current||finishedRef.current)return;
    lockedRef.current=true;
    stopListening();
    stop();
    const verdict=answer.inputMode==='skipped'
      ?{correct:current.kind==='open'?null:false,practiceAccuracy:current.kind==='open'?null:0}
      :evaluateThoughtOrganizationResponse(current,answer);
    const result:ThoughtOrganizationRoundResult={
      trialId:current.id,stage:stage.level,taskKind:current.kind,
      inputMode:answer.inputMode,userResponse:answer.userResponse??null,
      correct:verdict.correct,practiceAccuracy:verdict.practiceAccuracy,
      supportRevealed:help,clinicalProgressionEligible:false,
      independentSpokenScoreEligible:false,
    };
    const nextResults=[...results,result];
    setFeedback(result);
    setResults(nextResults);
    onTrialComplete(result);
    feedbackTimerRef.current=setTimeout(()=>{
      if(!mountedRef.current)return;
      if(index+1>=trials.length){
        if(finishedRef.current)return;
        finishedRef.current=true;
        setFinished(true);
        onGameComplete(nextResults);
      }else resetRound(index+1);
    },1600);
  };
  const answerChoice=(i:number)=>submit({choiceIndex:i,inputMode:'choice'});
  const answerOrder=()=>submit({order,inputMode:'reordered'});
  const answerDetails=()=>submit({selectedIndices:selectedDetails,inputMode:'selected_details'});
  const answerOpen=()=>{
    const trimmed=response.trim();
    if(!trimmed)return;
    submit({inputMode:responseMode==='browser_recognized'
      ?'browser_recognized':'typed',userResponse:trimmed});
  };
  const readAgain=()=> {
    if(!current)return;
    void speak(current.prompt);
  };
  const toggleListening=()=>{
    if(isListening){stopListening();return;}
    if(!isSupported)return;
    stop();
    startListening();
  };

  if(!current)return <p role="status" className="p-6 text-center">
    No thought-organization practice is available.
  </p>;
  if(finished)return <div className="text-center space-y-3 p-6" role="status">
    <h2 className="text-2xl font-bold">Practice complete</h2>
    <p>You've tried {results.length} everyday thinking activities.</p>
    <p className="text-sm text-muted-foreground">
      Open speaking tasks are practice attempts, not automatic clinical scores.
    </p>
  </div>;

  return <div className="mx-auto max-w-xl space-y-4 p-4">
    <div className="rounded-xl bg-muted/30 p-4 space-y-2">
      <p className="text-sm text-muted-foreground">
        Thought practice {stage.level}/8 — {index+1} of {trials.length}
      </p>
      <h2 className="font-semibold text-lg">{stage.title}</h2>
      <p className="text-sm">{stage.instruction}</p>
    </div>
    <div className="rounded-xl border p-4 space-y-3">
      <h3 className="font-semibold text-xl">{current.title}</h3>
      <p className="text-lg">{current.prompt}</p>
      <Button variant="outline" size="lg" className="min-h-12 w-full"
        onClick={readAgain} disabled={!!feedback}>
        <Volume2 className="w-4 h-4 mr-2"/> Hear this again
      </Button>
    </div>
    {!feedback&&<>
      {!help && <Button variant="outline" size="lg" className="w-full min-h-14"
        onClick={()=>{setHelp(true);void speak(current.guidance);}}>
        Need help? Hear a clue
      </Button>}
      {help&&<div role="status" className="rounded-lg bg-muted p-3 text-base">
        {current.guidance}
      </div>}
      {current.kind==='choice'&&<div className="space-y-3">
        {current.options.map((option,i)=>(
          <Button key={i} variant="outline" size="lg"
            className="w-full min-h-16 h-auto whitespace-normal text-left p-4"
            onClick={()=>answerChoice(i)}>
            {String.fromCharCode(65+i)}. {option}
          </Button>
        ))}
      </div>}
      {current.kind==='order'&&<div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Move the ideas into beginning, middle and ending order.
        </p>
        {order.map((sentence,i)=>(
          <div key={sentence} className="flex items-center gap-2 rounded-lg border p-3">
            <span className="font-medium w-6">{i+1}.</span>
            <span className="flex-1">{sentence}</span>
            <div className="flex gap-1">
              <Button aria-label={'Move up: '+sentence} variant="outline" size="icon"
                className="h-11 w-11" disabled={i===0} onClick={()=>{
                  const next=[...order];[next[i],next[i-1]]=[next[i-1],next[i]];setOrder(next);
                }}><ArrowUp className="w-5 h-5"/></Button>
              <Button aria-label={'Move down: '+sentence} variant="outline" size="icon"
                className="h-11 w-11" disabled={i===order.length-1} onClick={()=>{
                  const next=[...order];[next[i],next[i+1]]=[next[i+1],next[i]];setOrder(next);
                }}><ArrowDown className="w-5 h-5"/></Button>
            </div>
          </div>
        ))}
        <Button size="lg" className="w-full min-h-14" onClick={answerOrder}>
          Check order
        </Button>
      </div>}
      {current.kind==='relevance'&&<div className="space-y-3">
        <p className="font-medium">Choose the two important details.</p>
        {current.options.map((option,i)=>(
          <Button key={i} size="lg" variant={selectedDetails.includes(i)?'default':'outline'}
            aria-pressed={selectedDetails.includes(i)}
            className="w-full min-h-14 h-auto whitespace-normal text-left p-3"
            onClick={()=>setSelectedDetails(prev=>
              prev.includes(i)?prev.filter(v=>v!==i):[...prev,i]
            )}>
            {option}
          </Button>
        ))}
        <Button size="lg" className="w-full min-h-14"
          disabled={selectedDetails.length!==2} onClick={answerDetails}>
          Check details
        </Button>
      </div>}
      {current.kind==='open'&&<div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Try speaking or typing. A care partner can help. There is no automatic right/wrong score.
        </p>
        {current.prompts.map((prompt,i)=>(
          <p key={i} className="rounded-lg bg-muted/30 p-3">{i+1}. {prompt}</p>
        ))}
        <Textarea rows={3} value={response} placeholder="Your thoughts (optional)"
          aria-label="Your own words" className="text-base min-h-24"
          onChange={e=>{setResponse(e.target.value);setResponseMode('typed');}}/>
        {isSupported&&<Button size="lg" variant="outline"
          className="w-full min-h-14" onClick={toggleListening}
          disabled={isSpeaking}>
          {isListening?<><MicOff className="w-4 h-4 mr-2"/>Stop microphone</>
            :<><Mic className="w-4 h-4 mr-2"/>Try speaking</>}
        </Button>}
        {micError&&<p className="text-sm text-muted-foreground">
          Microphone unavailable. Typing or care-partner confirmation is okay.
        </p>}
        <Button size="lg" className="w-full min-h-14"
          disabled={!response.trim()} onClick={answerOpen}>Record my response</Button>
        <Button variant="outline" size="lg" className="w-full min-h-14"
          onClick={()=>submit({inputMode:'self_report'})}>
          I tried speaking (no transcript)
        </Button>
      </div>}
      <Button variant="ghost" size="lg" className="w-full min-h-12"
        onClick={()=>submit({inputMode:'skipped'})}>
        Skip this question
      </Button>
    </>}
    {feedback&&<div role="status" className="rounded-lg bg-muted p-4 text-center space-y-2">
      <p className="font-semibold text-lg">
        {feedback.inputMode==='skipped'?'Question skipped.'
          :feedback.correct===null?'Your practice attempt was recorded.'
          :feedback.correct?'That works!':'Another answer may work better.'}
      </p>
      {feedback.correct===false&&current.kind==='choice'&&
        <p>The answer for this practice was: {current.options[current.correctIndex]}</p>}
      {feedback.correct===false&&current.kind==='order'&&
        <p>One useful order: {current.ordered.join(', then ')}.</p>}
      {feedback.correct===false&&current.kind==='relevance'&&
        <p>Important details: {current.correctIndices.map(i=>current.options[i]).join('; ')}.</p>}
      <p className="text-xs text-muted-foreground">
        Practice observations, not validated clinical mastery.
      </p>
    </div>}
  </div>;
}
