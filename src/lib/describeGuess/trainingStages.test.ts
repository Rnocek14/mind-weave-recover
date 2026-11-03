import { describe, expect, it } from 'vitest';
import { DESCRIBE_GUESS_BANK } from '@/data/describeGuessBank';
import {
  getDescribeGuessTrainingStage, getDescribeGuessStageTrials,
  getDescribeGuessStagePrompt, assessDescribeGuessPracticeGoal,
  DESCRIBE_NEW_LISTENER_IDS, getDescribeGuessVisibleFeatureTypes,
} from '@/lib/describeGuess/trainingStages';

describe('Describe & Guess: eight actual nonclinical training formats', () => {
  it('changes target tier, support and practice goal across all eight stages', () => {
    const modes = ([1,2,3,4,5,6,7,8] as const).map(level => getDescribeGuessTrainingStage(level)!);
    expect(modes.map(m => m.itemTier)).toEqual([1,1,2,2,3,3,3,3]);
    expect(modes.map(m => m.initialVisiblePrompts)).toEqual([3,0,0,0,0,0,0,0]);
    expect(modes.map(m => m.hideAutomaticPrompts ?? false)).toEqual([
      false,false,false,false,false,true,true,true,
    ]);
    expect(new Set(modes.map(m => m.mode)).size).toBe(8);
    expect(new Set(modes.map(m => m.instruction)).size).toBe(8);
    expect(modes[7].situational).toBe(true);
  });

  it('actually fades and restores exact relevant feature prompts by stage',()=>{
    const f=(level:number,shown=0,revealed=false)=>
      getDescribeGuessVisibleFeatureTypes(getDescribeGuessTrainingStage(level),shown,revealed);
    expect(f(1,3)).toEqual(['function','location','appearance','material','category']);
    expect(f(2)).toEqual(['function','location']);
    expect(f(3,1)).toEqual(['function','location','appearance']);
    expect(f(4)).toEqual(['function','location']);
    expect(f(5)).toEqual(['appearance','material']);
    for(const level of [6,7,8]) {
      expect(f(level,3)).toEqual([]); // cooldown never leaks an unrequested cue
      expect(f(level,3,true)).toEqual([
        'function','location','appearance','material','category',
      ]);
    }
  });

  it('does not fabricate an invalid level or silently clamp it to Stage 1', () => {
    for (const n of [-1,0,9,2.5,NaN,Infinity,null,undefined]) {
      expect(getDescribeGuessTrainingStage(n)).toBeNull();
    }
  });

  it.each([1,2,3,4,5,6,7,8] as const)(
    'delivers playable, strict photographed targets at practice stage %i', level => {
      const stage = getDescribeGuessTrainingStage(level)!;
      const chosen = getDescribeGuessStageTrials(stage,6);
      expect(chosen).toHaveLength(6);
      expect(new Set(chosen.map(x => x.target)).size).toBe(6);
      expect(chosen.every(x => x.difficulty === stage.itemTier)).toBe(true);
    },
  );

  it('never pads an upper-stage pool with lower-tier items, even if asked for too many', () => {
    const stages=[getDescribeGuessTrainingStage(3)!,getDescribeGuessTrainingStage(8)!];
    for(const stage of stages) {
      const chosen=getDescribeGuessStageTrials(stage,100);
      expect(chosen.length).toBeGreaterThan(0);
      expect(chosen.length).toBeLessThan(100);
      expect(chosen.every(x=>x.difficulty===stage.itemTier)).toBe(true);
    }
  });

  it('reserves authored new-listener situations for the right actual photos', () => {
    const stage=getDescribeGuessTrainingStage(8)!;
    const trials=getDescribeGuessStageTrials(stage,20);
    expect(trials.length).toBeGreaterThanOrEqual(6);
    expect(trials.every(t=>DESCRIBE_NEW_LISTENER_IDS.includes(t.id))).toBe(true);
    for(const trial of trials){
      const prompt=getDescribeGuessStagePrompt(stage,trial);
      expect(prompt).toBeTruthy();
      expect(prompt).not.toBe(stage.instruction);
      expect(prompt.toLowerCase()).not.toContain(' '+trial.target.toLowerCase()+' ');
    }
  });

  it('observes actual feature types, but does not call a name-only response successful circumlocution', () => {
    const lamp=DESCRIBE_GUESS_BANK.find(t=>t.id==='dg_lamp')!;
    const stage4=getDescribeGuessTrainingStage(4)!;
    expect(assessDescribeGuessPracticeGoal({
      stage:stage4,trial:lamp,response:'I use it to read beside the desk',
    })).toMatchObject({
      goalObserved:true,missingFeatures:[],targetNamed:false,
    });
    expect(assessDescribeGuessPracticeGoal({
      stage:stage4,trial:lamp,response:'desk',
    })).toMatchObject({goalObserved:false,missingFeatures:['function']});
    const pillow=DESCRIBE_GUESS_BANK.find(t=>t.id==='dg_pillow')!;
    const stage7=getDescribeGuessTrainingStage(7)!;
    const meaningful='You rest with this on your bed. It is bedding';
    expect(assessDescribeGuessPracticeGoal({
      stage:stage7,trial:pillow,response:meaningful,
    })).toMatchObject({goalObserved:true,targetNamed:false});
    expect(assessDescribeGuessPracticeGoal({
      stage:stage7,trial:pillow,response:meaningful+' pillow',
    })).toMatchObject({goalObserved:false,targetNamed:true});
  });

  it('does not mistake response aliases inside unrelated longer words for naming',()=>{
    const trial=DESCRIBE_GUESS_BANK.find(t=>t.id==='dg_lamp')!;
    const verdict=assessDescribeGuessPracticeGoal({
      stage:getDescribeGuessTrainingStage(7)!,trial,
      response:'The lampoon was about reading at the desk',
    });
    expect(verdict.targetNamed).toBe(false);
  });
});
