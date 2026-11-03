import {describe,expect,it} from 'vitest';
import {normalizeFollowDirectionsResult,normalizeSequenceBuilderResult} from './normalizedExerciseResult';

describe('Coach practice normalizers preserve meaning and cue provenance',()=>{
  it('does not describe helped directions as independent clinical comprehension',()=>{
    const result=normalizeFollowDirectionsResult({
      correct:1,total:2,practiceStage:4,avgLatencyMs:15000,
      trials:[
        {correct:true,supportShown:true,replayCount:2},
        {correct:false,supportShown:false,replayCount:0},
      ],
    });
    expect(result.completed).toBe(true);
    expect(result.score).toBe(0.5);
    expect(result.cueLevelUsed).toBe(1);
    expect(result.summary).toContain('Not an independent clinical comprehension score');
    expect(result.raw).toMatchObject({practiceStage:4});
  });
  it('distinguishes unsupported from supported sequencing practice without inflating accuracy',()=>{
    const r=normalizeSequenceBuilderResult({
      correct:1,total:2,practiceStage:6,avgPositionAccuracy:0.75,
      trials:[
        {correct:false,positionAccuracy:1,causeCorrect:false,supportShown:false},
        {correct:true,positionAccuracy:0.5,causeCorrect:true,supportShown:true},
      ],
    });
    expect(r.score).toBe(0.5);
    expect(r.accuracy).toBe(0.75);
    expect(r.cueLevelUsed).toBe(1);
    expect(r.summary).toContain('not a clinical mastery score');
  });
  it('preserves existing quick-probe normalizer meaning when stages are not selected',()=>{
    const directions=normalizeFollowDirectionsResult({correct:2,total:3,maxComplexity:2});
    const sequences=normalizeSequenceBuilderResult({correct:1,total:3,avgPositionAccuracy:0.5});
    expect(directions.summary).toContain('Followed 2 of 3 directions');
    expect(sequences.summary).toContain('Sequenced 1 of 3 stories');
    expect(directions.cueLevelUsed).toBeUndefined();
    expect(sequences.cueLevelUsed).toBeUndefined();
  });
});
