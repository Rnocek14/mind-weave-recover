import {describe,expect,it} from 'vitest';
import {SEQUENCE_PRACTICE_STAGES,getSequencePracticeStage,buildSequencePracticeTrials,
  buildSequenceAlternatives,scoreSequenceOrder} from './sequenceBuilderPractice';

describe('Sequence Builder: real eight-stage nonclinical practice',()=>{
  it('has distinct formats without silent invalid-level fallback',()=>{
    expect(SEQUENCE_PRACTICE_STAGES.map(x=>x.level)).toEqual([1,2,3,4,5,6,7,8]);
    expect(new Set(SEQUENCE_PRACTICE_STAGES.map(x=>x.mode)).size).toBe(8);
    expect(SEQUENCE_PRACTICE_STAGES.map(x=>x.itemCount)).toEqual([2,2,3,3,4,4,4,4]);
    for(const value of [null,undefined,0,9,2.2,'4',NaN,Infinity,-2])
      expect(getSequencePracticeStage(value)).toBeNull();
  });
  it('selects real, distinct and in-order practice tasks for every stage',()=>{
    for(const stage of SEQUENCE_PRACTICE_STAGES){
      const trials=buildSequencePracticeTrials(stage,3);
      expect(trials).toHaveLength(3);
      expect(new Set(trials.map(x=>x.id)).size).toBe(3);
      for(const trial of trials){
        expect(trial.items).toHaveLength(stage.itemCount);
        expect(new Set(trial.items.map(x=>x.id)).size).toBe(stage.itemCount);
        expect(trial.title).toBeTruthy();
        if(stage.mode==='cause_and_order'){
          expect(trial.causeQuestion?.prompt).toBeTruthy();
          expect(trial.causeQuestion?.choices).toHaveLength(2);
        } else expect(trial.causeQuestion).toBeUndefined();
        const correct=scoreSequenceOrder(trial.items,trial.items);
        expect(correct).toEqual({correct:true,positionAccuracy:1});
      }
    }
  });
  it('keeps Stage 8 entirely novel and avoids copying its tasks into earlier stages',()=>{
    const old=new Set(SEQUENCE_PRACTICE_STAGES.filter(x=>x.pool==='familiar')
      .flatMap(s=>buildSequencePracticeTrials(s,99).map(t=>t.title)));
    const novel=buildSequencePracticeTrials(getSequencePracticeStage(8)!,99);
    expect(novel.length).toBeGreaterThanOrEqual(4);
    expect(novel.every(t=>!old.has(t.title))).toBe(true);
    expect(buildSequencePracticeTrials(getSequencePracticeStage(8)!,NaN)).toEqual([]);
  });
  it('creates two plausible L7 response options with one real correct order',()=>{
    for(const [i,trial] of buildSequencePracticeTrials(getSequencePracticeStage(7)!,4).entries()){
      const {options,correctIndex}=buildSequenceAlternatives(trial,i);
      expect(correctIndex).toBe(i%2);
      expect(options.map(o=>scoreSequenceOrder(o,trial.items).correct)).toEqual(
        i%2===0?[true,false]:[false,true]);
      expect(options[1-correctIndex].map(x=>x.id).sort()).toEqual(trial.items.map(x=>x.id).sort());
    }
  });
  it('refuses incomplete or duplicated ordering as exact success',()=>{
    const trial=buildSequencePracticeTrials(getSequencePracticeStage(5)!,1)[0];
    const missing=trial.items.slice(0,3);
    expect(scoreSequenceOrder(missing,trial.items)).toEqual({correct:false,positionAccuracy:0});
    const swapped=trial.items.map(x=>({...x}));
    [swapped[0],swapped[1]]=[swapped[1],swapped[0]];
    expect(scoreSequenceOrder(swapped,trial.items)).toEqual({correct:false,positionAccuracy:0.5});
  });
});
