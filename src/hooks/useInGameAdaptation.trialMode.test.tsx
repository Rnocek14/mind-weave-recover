import {act,cleanup,renderHook} from '@testing-library/react';
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
  logged:vi.fn(),event:vi.fn(),
}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'synthetic-user'}})}));
vi.mock('@/hooks/useProfile',()=>({useProfile:()=>({activeProfile:{id:'synthetic-profile'}})}));
vi.mock('@/hooks/useAdaptationTrialLogger',()=>({
  useAdaptationTrialLogger:()=>({
    logTrial:mocks.logged,flush:vi.fn(async()=>{}),
  }),
}));
vi.mock('@/hooks/useAdaptationEventLogger',()=>({
  useAdaptationEventLogger:()=>({logDifficultyChange:mocks.event}),
}));
import {useInGameAdaptation} from './useInGameAdaptation';

beforeEach(()=>vi.clearAllMocks());
afterEach(()=>cleanup());
describe('real in-game adaptive logger per-attempt mode contract',()=>{
  it('preserves the existing game default for unspecified spoken responses',()=>{
    const {result}=renderHook(()=>useInGameAdaptation({
      exerciseSlug:'fix_sentence',sessionId:'synthetic-session',
      bounds:{floor:1,ceiling:8,suggestedStart:2},
      initialDifficulty:2,windowSize:5,autoLog:true,
      defaultTrialMode:'production',
      enableDifficultyAutoStepDown:false,enableDifficultyToasts:false,
    }));
    act(()=>result.current.recordTrial({
      correct:true,reactionTimeMs:1700,
    }));
    expect(mocks.logged).toHaveBeenCalledWith(expect.objectContaining({
      correct:true,trialMode:'production',
    }));
  });

  it('logs a tapped repair as recognition and assisted speech as scaffolded without changing the game default',()=>{
    const {result}=renderHook(()=>useInGameAdaptation({
      exerciseSlug:'fix_sentence',sessionId:'synthetic-session',
      bounds:{floor:1,ceiling:8,suggestedStart:2},
      initialDifficulty:2,windowSize:5,autoLog:true,
      defaultTrialMode:'production',
      enableDifficultyAutoStepDown:false,enableDifficultyToasts:false,
    }));
    act(()=>{
      result.current.recordTrial({correct:true,reactionTimeMs:1100,trialMode:'recognition'});
      result.current.recordTrial({correct:true,reactionTimeMs:1400,trialMode:'scaffolded'});
      result.current.recordTrial({correct:false,reactionTimeMs:1700,trialMode:'mixed'});
    });
    expect(mocks.logged.mock.calls.map(([value])=>value.trialMode)).toEqual([
      'recognition','scaffolded','mixed',
    ]);
    expect(mocks.logged).toHaveBeenCalledTimes(3);
  });
});
