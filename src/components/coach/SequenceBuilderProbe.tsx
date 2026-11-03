/**
 * Sequence Builder (coach modal): ordinary legacy ordering, plus eight
 * caregiver-selectable actual practice formats. A tapped ordering (or a
 * supported causal question) is NOT a clinical narrative mastery measure.
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ArrowUp, ArrowDown, Check, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import {
  buildSequencePracticeTrials,buildSequenceAlternatives,scoreSequenceOrder,
  getSequencePracticeStage,type SequencePracticeLevel,
  type SequenceItem,type SequencePracticeTrial,
} from '@/lib/coach/sequenceBuilderPractice';

interface SequenceTrial {
  title:string;
  items:SequenceItem[];
}
const TRIALS: SequenceTrial[]=[
  {title:'Making breakfast',items:[
    {id:'a',text:'Get eggs from the fridge'},
    {id:'b',text:'Crack eggs into a pan'},
    {id:'c',text:'Cook until done'},
    {id:'d',text:'Put eggs on a plate'},
  ]},
  {title:'Going to the store',items:[
    {id:'a',text:'Make a shopping list'},
    {id:'b',text:'Drive to the store'},
    {id:'c',text:'Pick items from the shelves'},
    {id:'d',text:'Pay at the register'},
  ]},
  {title:'Getting ready for bed',items:[
    {id:'a',text:'Brush your teeth'},
    {id:'b',text:'Put on pajamas'},
    {id:'c',text:'Get into bed'},
    {id:'d',text:'Turn off the light'},
  ]},
  {title:'Planting a flower',items:[
    {id:'a',text:'Dig a hole in the soil'},
    {id:'b',text:'Put the seed in the hole'},
    {id:'c',text:'Cover with soil'},
    {id:'d',text:'Water the plant'},
  ]},
  {title:'Sending a letter',items:[
    {id:'a',text:'Write the letter'},
    {id:'b',text:'Put it in an envelope'},
    {id:'c',text:'Write the address'},
    {id:'d',text:'Take it to the mailbox'},
  ]},
];
interface SequenceResult {
  title:string;
  correct:boolean;
  positionAccuracy:number;
  practiceStage?:number;
  supportShown?:boolean;
  responseMode?:'ordering'|'choice';
  causeCorrect?:boolean|null;
  skipped?:boolean;
}
interface SequenceBuilderProbeProps {
  totalTrials?:number;
  practiceLevel?:SequencePracticeLevel|null;
  onFirstAction?:()=>void;
  onComplete:(results:{
    correct:number;
    total:number;
    accuracy:number;
    avgPositionAccuracy:number;
    practiceStage?:number;
    evidenceScope?:'supported_sequencing_practice';
    trials:SequenceResult[];
  })=>void;
}

export function SequenceBuilderProbe({
  totalTrials=3,practiceLevel=null,onFirstAction,onComplete,
}:SequenceBuilderProbeProps){
  const stage=getSequencePracticeStage(practiceLevel);
  const selectedTrials=useMemo(():SequenceTrial[]=>{
    if(stage)return buildSequencePracticeTrials(stage,totalTrials);
    const shuffled=[...TRIALS].sort(()=>Math.random()-0.5);
    return shuffled.slice(0,Math.min(totalTrials,TRIALS.length));
  },[stage?.level,totalTrials]);
  const [currentIndex,setCurrentIndex]=useState(0);
  const [results,setResults]=useState<SequenceResult[]>([]);
  const [completed,setCompleted]=useState(false);
  const [userOrder,setUserOrder]=useState<SequenceItem[]>(()=>
    [...(selectedTrials[0]?.items??[])].sort(()=>Math.random()-0.5));
  const [feedback,setFeedback]=useState<'correct'|'incorrect'|null>(null);
  const [helpShown,setHelpShown]=useState(false);
  const [causePending,setCausePending]=useState<{correct:boolean;positionAccuracy:number}|null>(null);
  const finalizedRef=useRef(false);
  const completeRef=useRef(false);
  const timerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const {speak}=useTextToSpeech();
  useEffect(()=>()=>{
    if(timerRef.current)clearTimeout(timerRef.current);
  },[]);

  const trial=selectedTrials[currentIndex];
  const orderOptions=useMemo(()=>{
    if(stage?.mode!=='choose_between_orders'||!trial)return null;
    return buildSequenceAlternatives(trial,currentIndex);
  },[stage?.mode,trial,currentIndex]);

  const moveItem=(fromIndex:number,direction:'up'|'down')=>{
    if(feedback||causePending||finalizedRef.current||completed)return;
    const toIndex=direction==='up'?fromIndex-1:fromIndex+1;
    if(toIndex<0||toIndex>=userOrder.length)return;
    onFirstAction?.();
    setUserOrder(previous=>{
      const next=[...previous];
      [next[fromIndex],next[toIndex]]=[next[toIndex],next[fromIndex]];
      return next;
    });
  };

  const finalize=(data:{
    correct:boolean;positionAccuracy:number;
    responseMode:'ordering'|'choice';causeCorrect?:boolean|null;skipped?:boolean;
  })=>{
    if(finalizedRef.current||completed||!trial)return;
    finalizedRef.current=true; // Blocks rapid double-submit and duplicate callbacks.
    onFirstAction?.();
    setCausePending(null);
    setFeedback(data.correct?'correct':'incorrect');
    const all:SequenceResult[]=[...results,{
      title:trial.title,correct:data.correct,positionAccuracy:data.positionAccuracy,
      practiceStage:stage?.level,
      supportShown:!!stage && (stage.firstStepHint||helpShown),
      responseMode:data.responseMode,
      causeCorrect:data.causeCorrect,
      skipped:data.skipped??false,
    }];
    setResults(all);
    timerRef.current=setTimeout(()=>{
      setFeedback(null);
      if(currentIndex+1>=selectedTrials.length){
        if(completeRef.current)return;
        completeRef.current=true;
        setCompleted(true);
        const correct=all.filter(x=>x.correct).length;
        const avgPositionAccuracy=all.reduce((sum,x)=>sum+x.positionAccuracy,0)/all.length;
        onComplete({
          correct,total:all.length,accuracy:correct/all.length,
          avgPositionAccuracy,practiceStage:stage?.level,
          evidenceScope:stage?'supported_sequencing_practice':undefined,
          trials:all,
        });
      }else{
        setCurrentIndex(x=>x+1);
        setUserOrder([...selectedTrials[currentIndex+1].items].sort(()=>Math.random()-0.5));
        setHelpShown(false);
        setCausePending(null);
        finalizedRef.current=false;
      }
    },1200);
  };

  const submitOrder=()=>{
    if(finalizedRef.current||causePending||feedback||!trial)return;
    const result=scoreSequenceOrder(userOrder,trial.items);
    if(stage?.mode==='cause_and_order'){
      onFirstAction?.();
      // The causal question is separate from sequence ordering and must
      // be answered or skipped; a good order alone cannot finish the stage.
      setCausePending(result);
      return;
    }
    finalize({...result,responseMode:'ordering'});
  };

  const answerCause=(answer:0|1|null)=>{
    if(!causePending||!trial)return;
    const question=(trial as SequencePracticeTrial).causeQuestion;
    if(!question)return;
    const correct=answer===question.correctIndex;
    finalize({
      correct:causePending.correct&&correct,
      positionAccuracy:causePending.positionAccuracy,
      responseMode:'ordering',
      causeCorrect:answer===null?null:correct,
      skipped:answer===null,
    });
  };

  if(completed){
    const correct=results.filter(x=>x.correct).length;
    return <div className="flex flex-col items-center gap-4 p-6">
      <ThumbsUp className="w-10 h-10 text-primary"/>
      <p className="text-lg font-medium">{correct}/{results.length} completed</p>
      <p className="text-sm text-muted-foreground">
        Practice completed. Supported attempts are not clinical recovery measurements.
      </p>
    </div>;
  }
  if(!trial)return <p className="p-6 text-center" role="status">
    No sequence available. Ask a care partner to restart.
  </p>;

  const revealFirst=stage?.firstStepHint||helpShown;
  const first=trial.items[0]?.text;
  const canInteract=!feedback&&!causePending;
  return <div className="flex flex-col gap-4 p-4">
    {stage&&<div className="rounded-lg bg-muted/30 p-3 space-y-1 text-center" role="status">
      <p className="font-semibold">Sequence practice {stage.level}/8 — {stage.label}</p>
      <p className="text-sm">{stage.instruction}</p>
      <p className="text-xs text-muted-foreground">
        Practice only, not clinical narrative or sequencing mastery.
      </p>
    </div>}
    <p className="text-xs text-muted-foreground text-center">
      {currentIndex+1} / {selectedTrials.length}
    </p>
    <div className="text-center space-y-1">
      <p className="text-sm text-muted-foreground">
        {stage?.mode==='choose_between_orders'?'Which order makes sense?':'Put these steps in the right order:'}
      </p>
      <p className="font-medium">{trial.title}</p>
      {revealFirst&&<p className="rounded-lg bg-primary/10 p-2 text-sm">
        First step: {first}
      </p>}
    </div>
    {stage&&!revealFirst&&stage.mode!=='choose_between_orders'&&
      <Button size="lg" variant="outline" className="min-h-12 w-full"
        onClick={()=>{setHelpShown(true);onFirstAction?.();}}>
        Show the first step (help)
      </Button>
    }
    {causePending&&(
      <div className="space-y-3 rounded-xl border p-4" role="group" aria-label="Cause and effect question">
        <p className="text-base font-semibold">
          {(trial as SequencePracticeTrial).causeQuestion?.prompt}
        </p>
        {(trial as SequencePracticeTrial).causeQuestion?.choices.map((choice,index)=>(
          <Button key={index} className="w-full min-h-14 whitespace-normal h-auto p-3"
            variant="outline" onClick={()=>answerCause(index as 0|1)}>
            {choice}
          </Button>
        ))}
        <Button className="w-full min-h-12" variant="ghost" onClick={()=>answerCause(null)}>
          Skip this question
        </Button>
      </div>
    )}
    {!causePending&&stage?.mode==='choose_between_orders'&&orderOptions&&
      <div className="space-y-3">
        {orderOptions.options.map((option,i)=>(
          <Button key={i} variant="outline" disabled={!canInteract}
            className="w-full whitespace-normal h-auto min-h-14 p-4 text-left flex flex-col items-start gap-2"
            onClick={()=>finalize({
              ...scoreSequenceOrder(option,trial.items),responseMode:'choice',
            })}>
            <strong>Option {i===0?'A':'B'}</strong>
            {option.map((item,idx)=>(
              <span className="block text-sm" key={idx}>{idx+1}. {item.text}</span>
            ))}
          </Button>
        ))}
      </div>
    }
    {!causePending&&stage?.mode!=='choose_between_orders'&&
      <div className="flex flex-col gap-2">
        {userOrder.map((item,i)=>(
          <div key={item.id} className={cn(
            'flex items-center gap-2 p-3 rounded-lg border transition-colors',
            feedback==='correct'?'border-primary bg-primary/10':
            feedback==='incorrect'?'border-destructive bg-destructive/10':
            revealFirst&&i===0&&item.id===trial.items[0].id
              ?'border-primary bg-primary/5':'border-border bg-card'
          )}>
            <span className="text-xs font-mono text-muted-foreground w-5">{i+1}.</span>
            <span className="flex-1 text-sm">{item.text}</span>
            {stage&&<Button variant="ghost" size="icon" disabled={!canInteract}
              aria-label={\`Hear step: \${item.text}\`}
              onClick={()=>{setHelpShown(true);onFirstAction?.();void speak(item.text);}}>
              <Volume2 className="w-4 h-4"/>
            </Button>}
            {canInteract&&<div className="flex flex-col gap-0.5">
              <Button variant="ghost" size="icon" aria-label={\`Move \${item.text} up\`}
                className="h-10 w-10" disabled={i===0}
                onClick={()=>moveItem(i,'up')}>
                <ArrowUp className="w-5 h-5"/>
              </Button>
              <Button variant="ghost" size="icon" aria-label={\`Move \${item.text} down\`}
                className="h-10 w-10" disabled={i===userOrder.length-1}
                onClick={()=>moveItem(i,'down')}>
                <ArrowDown className="w-5 h-5"/>
              </Button>
            </div>}
          </div>
        ))}
      </div>
    }
    {feedback&&<div role="status" className="rounded-lg bg-muted p-3 text-center">
      <p className="font-semibold">{feedback==='correct'
        ?'You completed the practice task.':'Good effort. The order was:'}</p>
      {feedback==='incorrect'&&<p className="text-sm mt-1">
        {trial.items.map(item=>item.text).join(' → ')}
      </p>}
    </div>}
    {canInteract&&stage?.mode!=='choose_between_orders'&&
      <Button size="lg" className="w-full min-h-14" onClick={submitOrder}>
        <Check className="w-4 h-4 mr-2"/> Check Order
      </Button>}
    {canInteract&&stage&&
      <Button size="lg" variant="ghost" className="w-full min-h-12"
        onClick={()=>finalize({
          correct:false,positionAccuracy:0,
          responseMode:stage.mode==='choose_between_orders'?'choice':'ordering',
          skipped:true,
        })}>Skip this sequence</Button>}
  </div>;
}
