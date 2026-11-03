import {describe,expect,it} from 'vitest';
import {
  THOUGHT_ORGANIZATION_STAGES,getThoughtOrganizationStage,
  getThoughtOrganizationTrials,evaluateThoughtOrganizationResponse,
} from './thoughtOrganizationPractice';

describe('Thought Organization — eight real practice modes',()=>{
  it('does not invent a clinical level or silently fall back on invalid input',()=>{
    expect(THOUGHT_ORGANIZATION_STAGES.map(x=>x.level)).toEqual([1,2,3,4,5,6,7,8]);
    expect(new Set(THOUGHT_ORGANIZATION_STAGES.map(x=>x.mode)).size).toBe(8);
    for(const invalid of [0,-2,9,1.4,null,undefined,NaN,'3',Infinity])
      expect(getThoughtOrganizationStage(invalid)).toBeNull();
  });
  it('provides three uniquely authored and appropriate gameplay tasks per mode',()=>{
    const kinds=['choice','choice','order','choice','open','relevance','open','open'];
    for(const [i,stage] of THOUGHT_ORGANIZATION_STAGES.entries()){
      const trials=getThoughtOrganizationTrials(stage,3);
      expect(trials).toHaveLength(3);
      expect(new Set(trials.map(x=>x.id)).size).toBe(3);
      expect(trials.every(x=>x.kind===kinds[i]&&x.prompt&&x.guidance&&x.title)).toBe(true);
      if(stage.level>=7)expect(trials.every(x=>x.kind==='open')).toBe(true);
      expect(getThoughtOrganizationTrials(stage,100)).toHaveLength(3);
    }
  });
  it('evaluates actual correct and incorrect choices without using a fake metric',()=>{
    const a=getThoughtOrganizationTrials(getThoughtOrganizationStage(1)!,1)[0];
    expect(a.kind).toBe('choice');
    if(a.kind!=='choice')throw new Error('Expected choice');
    expect(evaluateThoughtOrganizationResponse(a,{choiceIndex:a.correctIndex})).toEqual({
      correct:true,practiceAccuracy:1,
    });
    expect(evaluateThoughtOrganizationResponse(a,{choiceIndex:1-a.correctIndex})).toEqual({
      correct:false,practiceAccuracy:0,
    });
  });
  it('requires exact beginning-middle-end order and scores partial ordering as partial practice',()=>{
    const a=getThoughtOrganizationTrials(getThoughtOrganizationStage(3)!,1)[0];
    if(a.kind!=='order')throw new Error('Expected order');
    expect(evaluateThoughtOrganizationResponse(a,{order:a.ordered})).toEqual({
      correct:true,practiceAccuracy:1,
    });
    expect(evaluateThoughtOrganizationResponse(a,{order:[a.ordered[1],a.ordered[0],a.ordered[2]]})).toEqual({
      correct:false,practiceAccuracy:1/3,
    });
  });
  it('does not award correct detail selection for extra or duplicate facts',()=>{
    const a=getThoughtOrganizationTrials(getThoughtOrganizationStage(6)!,1)[0];
    if(a.kind!=='relevance')throw new Error('Expected relevance');
    expect(evaluateThoughtOrganizationResponse(a,{selectedIndices:a.correctIndices})).toEqual({
      correct:true,practiceAccuracy:1,
    });
    expect(evaluateThoughtOrganizationResponse(a,{selectedIndices:[0,1]}).correct).toBe(false);
    expect(evaluateThoughtOrganizationResponse(a,{selectedIndices:[0,0]}).correct).toBe(false);
  });
  it('never auto-grades an open personal, topical or novel explanation as correct',()=>{
    for(const level of [5,7,8]){
      for(const trial of getThoughtOrganizationTrials(getThoughtOrganizationStage(level)!,3)){
        expect(evaluateThoughtOrganizationResponse(trial,{})).toEqual({
          correct:null,practiceAccuracy:null,
        });
      }
    }
  });
});
