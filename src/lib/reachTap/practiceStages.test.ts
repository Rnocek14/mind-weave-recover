import {describe,expect,it} from 'vitest';
import {REACH_PRACTICE_STAGES,LEFT_HUNT_PRACTICE_STAGES,getReachPracticeStage,placeStagedReachTarget} from './practiceStages';

describe('Reach and Left Hunt: distinct eight-stage motor practice',()=>{
  it('has eight unique task mechanics for each mode with no clinical progression side effects',()=>{
    for(const [variant,stages] of [['standard',REACH_PRACTICE_STAGES],['left-side-hunt',LEFT_HUNT_PRACTICE_STAGES]] as const){
      expect(stages.map(s=>s.level)).toEqual([1,2,3,4,5,6,7,8]);
      expect(new Set(stages.map(s=>[s.sizePx,s.layout,s.distractors,s.visualGuide].join('/'))).size).toBe(8);
      expect(stages.every(s=>s.prompt.length>15)).toBe(true);
      expect(getReachPracticeStage(variant,8)?.level).toBe(8);
    }
    for(const invalid of [-1,0,9,100,2.1,'3',null,NaN]){
      expect(getReachPracticeStage('standard',invalid)).toBeNull();
    }
  });
  it('keeps targets tappable and within even very small device bounds',()=>{
    for(const width of [160,320,400]){
      for(const variant of ['standard','left-side-hunt'] as const){
        for(let level=1;level<=8;level++){
          const stage=getReachPracticeStage(variant,level)!;
          for(let trial=1;trial<=8;trial++){
            const size=Math.min(stage.sizePx,width-24,220);
            const p=placeStagedReachTarget({x:40,y:70,size,side:'left'},width,244,stage,trial);
            expect(p.x).toBeGreaterThanOrEqual(12);
            expect(p.y).toBeGreaterThanOrEqual(12);
            expect(p.x+p.size).toBeLessThanOrEqual(width-12);
            expect(p.y+p.size).toBeLessThanOrEqual(244-12);
          }
        }
      }
    }
  });
  it('truly alternates target regions in Stage 5 and quadrant positions in Stage 6',()=>{
    const base={x:30,y:30,size:60,side:'left' as const};
    const a=placeStagedReachTarget(base,420,300,getReachPracticeStage('standard',5)!,1);
    const b=placeStagedReachTarget(base,420,300,getReachPracticeStage('standard',5)!,2);
    expect(a.x).toBeLessThan(b.x);
    const xs=[1,2,3,4].map(n=>placeStagedReachTarget(base,420,300,getReachPracticeStage('standard',6)!,n));
    expect(new Set(xs.map(x=>x.x+':'+x.y)).size).toBe(4);
  });
});
