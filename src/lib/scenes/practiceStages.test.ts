import { describe,expect,it } from 'vitest';
import { FUNCTIONAL_SCENES } from '@/data/functionalSceneBank';
import { SCENE_PRACTICE_STAGES,getScenePracticeStage,getScenePracticeGoal,commandMeetsScenePracticeGoal } from './practiceStages';

describe('Functional Command Scenes — eight meaningful action practices',()=>{
  it('has distinct runtime mechanics and safe invalid-level behavior',()=>{
    expect(SCENE_PRACTICE_STAGES.map(s=>s.level)).toEqual([1,2,3,4,5,6,7,8]);
    expect(new Set(SCENE_PRACTICE_STAGES.map(s=>s.mode)).size).toBe(8);
    expect(SCENE_PRACTICE_STAGES.slice(5).every(s=>s.requiredSteps>=1)).toBe(true);
    for(const invalid of [null,0,9,-3,1.3,'8',NaN])expect(getScenePracticeStage(invalid)).toBeNull();
  });
  it('every goal refers to an existing playable authored scene command',()=>{
    for(const scene of FUNCTIONAL_SCENES){
      for(const stage of SCENE_PRACTICE_STAGES){
        for(let step=0;step<stage.requiredSteps;step++){
          const goal=getScenePracticeGoal(scene,stage,step);
          expect(goal.prompt).toBeTruthy();
          expect(scene.commands.some(c=>c.word===goal.command)).toBe(true);
        }
      }
    }
  });
  it('separates complete object-action commands and alternate forms from word echo',()=>{
    const scene=FUNCTIONAL_SCENES.find(s=>s.id==='lamp')!;
    const object=getScenePracticeGoal(scene,getScenePracticeStage(5)!);
    expect(commandMeetsScenePracticeGoal('brighter','brighter','canonical',object,'lamp')).toBe(false);
    expect(commandMeetsScenePracticeGoal('lamp brighter','brighter','canonical',object,'lamp')).toBe(true);
    const alternative=getScenePracticeGoal(scene,getScenePracticeStage(7)!);
    expect(commandMeetsScenePracticeGoal('brighter','brighter','canonical',alternative,'lamp')).toBe(false);
    expect(commandMeetsScenePracticeGoal('lighter','brighter','alias',alternative,'lamp')).toBe(true);
  });
  it('repair mode changes the required target within the same real scene',()=>{
    const scene=FUNCTIONAL_SCENES.find(s=>s.id==='car')!;
    const stage=getScenePracticeStage(6)!;
    expect(getScenePracticeGoal(scene,stage,0).command).toBe('go');
    expect(getScenePracticeGoal(scene,stage,1).command).toBe('stop');
  });
});
