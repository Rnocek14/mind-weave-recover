import {describe,expect,it} from 'vitest';
import {
 DIRECTION_LABELS,DIRECTION_PRACTICE_STAGES,
 getDirectionPracticeStage,buildDirectionPracticeTrials,getDirectionBoardLabels,
} from './followDirectionsPractice';

describe('Follow Directions: eight real supported practice formats',()=>{
  it('separates all 8 modes rather than relabeling identical trials',()=>{
    expect(DIRECTION_PRACTICE_STAGES.map(x=>x.level)).toEqual([1,2,3,4,5,6,7,8]);
    expect(new Set(DIRECTION_PRACTICE_STAGES.map(x=>x.mode)).size).toBe(8);
    expect(DIRECTION_PRACTICE_STAGES.map(x=>x.stepCount)).toEqual([1,1,2,2,3,3,3,4]);
    for(const invalid of [null,undefined,0,9,-2,1.2,'4',NaN,Infinity]) {
      expect(getDirectionPracticeStage(invalid)).toBeNull();
    }
  });
  it('preserves every required tap exactly once in each playable board',()=>{
    for(const stage of DIRECTION_PRACTICE_STAGES){
      const trials=buildDirectionPracticeTrials(stage,5);
      expect(trials).toHaveLength(5);
      expect(new Set(trials.map(x=>x.text)).size).toBe(5);
      for(const trial of trials){
        expect(trial.steps).toHaveLength(stage.stepCount);
        const steps=trial.steps.map(x=>x.targetLabel);
        expect(new Set(steps).size).toBe(steps.length);
        expect(steps.every(x=>DIRECTION_LABELS.includes(x))).toBe(true);
        const board=getDirectionBoardLabels(stage,trial);
        expect(board).toHaveLength(stage.boardSize);
        expect(new Set(board).size).toBe(board.length);
        expect(steps.every(x=>board.includes(x))).toBe(true);
        expect(trial.text).toContain(steps[0]);
      }
    }
  });
  it('actually encodes temporal and negative instructions in the given correct order',()=>{
    const temporal=buildDirectionPracticeTrials(getDirectionPracticeStage(6)!,1)[0];
    expect(temporal.text).toContain('Before touching the '+temporal.steps[2].targetLabel);
    expect(temporal.text).toContain('Finish with the '+temporal.steps[2].targetLabel);
    const negative=buildDirectionPracticeTrials(getDirectionPracticeStage(7)!,1)[0];
    expect(negative.text).toContain('Do not touch the ');
    const ignored=negative.text.split('Do not touch the ')[1].split('.')[0];
    expect(negative.steps.map(x=>x.targetLabel)).not.toContain(ignored);
    expect(buildDirectionPracticeTrials(getDirectionPracticeStage(8)!,1)[0].steps).toHaveLength(4);
  });
  it('does not silently manufacture trials on empty or invalid requests',()=>{
    expect(buildDirectionPracticeTrials(getDirectionPracticeStage(8)!,0)).toEqual([]);
    expect(buildDirectionPracticeTrials(getDirectionPracticeStage(8)!,NaN)).toEqual([]);
    expect(buildDirectionPracticeTrials(getDirectionPracticeStage(8)!,10)).toHaveLength(8);
  });
});
