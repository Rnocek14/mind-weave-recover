import {describe,expect,it} from 'vitest';
import {
  REASONING_PRACTICE_STAGES,getReasoningPracticeScenes,getReasoningPracticeStage,
  evaluateReasoningChoice,orderReasoningChoices,
  type ReasoningPracticeKind,
} from './stages';

const kinds:ReasoningPracticeKind[]=['fix-sentence','detective-mind'];

describe('authored nonclinical sentence repair and detective practice stages',()=>{
  it.each(kinds)('%s has eight playable, distinct stages, two scenes per stage and 32 real tasks',kind=>{
    const stages=REASONING_PRACTICE_STAGES[kind];
    expect(stages.map(stage=>stage.level)).toEqual([1,2,3,4,5,6,7,8]);
    expect(new Set(stages.map(stage=>stage.title)).size).toBe(8);
    const sceneIds=new Set<string>(),stepIds=new Set<string>();
    let shifted=0,recognitionItems=0;
    for(const stage of stages){
      expect(stage.practiceOnly).toBe(true);
      expect(stage.goal.length).toBeGreaterThan(15);
      expect(getReasoningPracticeStage(kind,stage.level)).toEqual(stage);
      const scenes=getReasoningPracticeScenes(kind,stage.level);
      expect(scenes).toHaveLength(2);
      for(const scene of scenes){
        expect(sceneIds.has(scene.id),scene.id).toBe(false);
        sceneIds.add(scene.id);
        expect(scene.context.trim().length).toBeGreaterThan(15);
        expect(scene.steps).toHaveLength(2);
        for(const task of scene.steps){
          expect(stepIds.has(task.id),task.id).toBe(false);
          stepIds.add(task.id);
          expect(task.question.trim().length).toBeGreaterThan(15);
          expect(task.clue.trim().length).toBeGreaterThan(12);
          expect(task.explanation.trim().length).toBeGreaterThan(12);
          if(task.kind==='choice'){
            recognitionItems++;
            expect(task.options.length).toBeGreaterThanOrEqual(2);
            expect(task.options.length).toBeLessThanOrEqual(4);
            expect(new Set(task.options).size).toBe(task.options.length);
            expect(Number.isInteger(task.bestChoice)).toBe(true);
            expect(task.bestChoice).toBeGreaterThanOrEqual(0);
            expect(task.bestChoice).toBeLessThan(task.options.length);
            const displayed=orderReasoningChoices(task);
            expect(orderReasoningChoices(task)).toEqual(displayed);
            expect(displayed.map(x=>x.originalIndex).sort()).toEqual(
              task.options.map((_,i)=>i),
            );
            const correct=displayed.find(x=>x.originalIndex===task.bestChoice)!;
            expect(correct.text).toBe(task.options[task.bestChoice]);
            expect(evaluateReasoningChoice(task,correct.originalIndex)).toBe(true);
            for(const wrong of displayed.filter(x=>x.originalIndex!==task.bestChoice)){
              expect(evaluateReasoningChoice(task,wrong.originalIndex)).toBe(false);
            }
            if(displayed[0].originalIndex!==task.bestChoice)shifted++;
          }else{
            expect(task.modelExample.trim().length).toBeGreaterThan(20);
            expect(evaluateReasoningChoice(task,0)).toBeNull();
          }
        }
      }
    }
    expect(sceneIds.size).toBe(16);
    expect(stepIds.size).toBe(32);
    expect(recognitionItems).toBeGreaterThan(15);
    expect(shifted).toBeGreaterThan(3);
    for(const invalid of [0,-1,9,1.2,NaN]){
      expect(getReasoningPracticeStage(kind,invalid)).toBeNull();
    }
  });

  it('Fix Sentence upper stages are distinct tasks: two errors, morphology, embedded clauses and open repairs',()=>{
    const tasks=(level:5|6|7|8)=>getReasoningPracticeScenes('fix-sentence',level)
      .flatMap(scene=>scene.steps);
    expect(tasks(5).every(x=>x.skill==='two_error_repair')).toBe(true);
    expect(tasks(6).every(x=>x.skill==='morphology')).toBe(true);
    expect(tasks(7).every(x=>x.skill==='embedded_clause')).toBe(true);
    expect(tasks(8).every(x=>x.skill==='open_repair'&&x.kind==='open')).toBe(true);
  });

  it('Detective Mind upper stages require hypothesis comparison and novel, ungraded alternatives',()=>{
    const seven=getReasoningPracticeScenes('detective-mind',7).flatMap(scene=>scene.steps);
    const eight=getReasoningPracticeScenes('detective-mind',8).flatMap(scene=>scene.steps);
    expect(seven.every(x=>x.skill==='alternative_hypothesis'&&x.kind==='choice')).toBe(true);
    expect(eight.every(x=>x.skill==='novel_abstract_reasoning')).toBe(true);
    expect(eight.filter(x=>x.kind==='open')).toHaveLength(2);
    expect(eight.filter(x=>x.kind==='choice')).toHaveLength(2);
  });

  it('does not convert a skip, invalid index or open text into a correct scored choice',()=>{
    const choice=getReasoningPracticeScenes('detective-mind',1)[0].steps[0];
    expect(evaluateReasoningChoice(choice,null)).toBeNull();
    expect(evaluateReasoningChoice(choice,-1)).toBeNull();
    expect(evaluateReasoningChoice(choice,1.4)).toBeNull();
    expect(evaluateReasoningChoice(choice,999)).toBeNull();
    const open=getReasoningPracticeScenes('fix-sentence',8)[0].steps[0];
    expect(evaluateReasoningChoice(open,0)).toBeNull();
  });
});
