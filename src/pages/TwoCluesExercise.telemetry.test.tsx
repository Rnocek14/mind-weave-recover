import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TwoCluesTrialResult } from '@/hooks/useTwoCluesGame';
import { getSpeechScoreExclusion } from '@/lib/clinical/gameMeasurementContracts';

const mocks=vi.hoisted(()=>({
  nextTrial:null as TwoCluesTrialResult|null,
  submitTrial:vi.fn(),commitSession:vi.fn(),
  completeSession:vi.fn(),recordPivot:vi.fn(),navigate:vi.fn(),
  acknowledgePivot:vi.fn(),
}));

vi.mock('react-router-dom',async(original)=>{
  const actual=await original<typeof import('react-router-dom')>();
  return {...actual,useNavigate:()=>mocks.navigate,
    useLocation:()=>({state:{trialLimit:1}})};
});
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'synthetic-user'}})}));
vi.mock('@/hooks/useProfile',()=>({useProfile:()=>({activeProfile:{id:'synthetic-profile'}})}));
vi.mock('@/hooks/useStandaloneSession',()=>({useStandaloneSession:()=>({
  activeSessionId:'synthetic-session',isCreatingSession:false,
})}));
vi.mock('@/hooks/useSessionLifecycle',()=>({useSessionLifecycle:()=>({
  completeSession:mocks.completeSession,
})}));
vi.mock('@/hooks/useRestoredLessonContext',()=>({useRestoredLessonContext:()=>({
  fromLesson:false,returnTo:'/today',sessionId:null,adaptations:null,
})}));
vi.mock('@/hooks/useSessionAdaptation',()=>({useSessionAdaptation:()=>({
  difficultyTier:3,recommendedCueType:'semantic',loading:false,
})}));
vi.mock('@/lib/adaptationTelemetry',()=>({buildAdaptationTelemetry:()=>({})}));
vi.mock('@/hooks/useTwoCluesProgression',async(original)=>{
  const actual=await original<typeof import('@/hooks/useTwoCluesProgression')>();
  return {...actual,useTwoCluesProgression:()=>({
    loaded:true,startingLevel:2,state:{supportBaseline:0},
  })};
});
vi.mock('@/lib/progression/twoCluesDifficultyBridge',()=>({
  resolveEffectiveTwoCluesInitialDifficulty:()=>({
    effective:3,clinicalFloor:3,softRegressionScaffold:false,
  }),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot',()=>({useExerciseMidSessionPivot:()=>({
  recordTrialResult:mocks.recordPivot,
  acknowledge:mocks.acknowledgePivot,
  shouldStepDown:false,hasPending:false,pivotReason:null,
})}));
vi.mock('@/hooks/useTrialSubmission',()=>({useTrialSubmission:()=>({
  submitTrial:mocks.submitTrial,commitSession:mocks.commitSession,
})}));
vi.mock('@/components/TwoCluesGame',()=>({
  TwoCluesGame:({onTrialComplete}:{
    onTrialComplete:(result:TwoCluesTrialResult)=>void,
  })=>(
    <button onClick={()=>{
      if(!mocks.nextTrial)throw new Error('No synthetic trial');
      onTrialComplete(mocks.nextTrial);
    }}>Submit actual Two Clues callback</button>
  ),
}));

import TwoCluesExercise from './TwoCluesExercise';

function trial(overrides:Partial<TwoCluesTrialResult>={}):TwoCluesTrialResult{
  return {
    puzzleId:'puzzle-1',clues:['white','cold'],anchors:['snow'],
    spokenWord:'snow',browserTranscript:'I think snow',
    completionReason:'answered',
    tier:'strong',score:100,reachedAnchor:true,semanticSimilarity:1,
    reactionTimeMs:2000,attemptNumber:1,cueLevelUsed:0,cueTypeUsed:'none',
    ...overrides,
  };
}

beforeEach(()=>{
  vi.clearAllMocks();mocks.nextTrial=trial();
  mocks.submitTrial.mockResolvedValue({ok:true});
  mocks.commitSession.mockResolvedValue({ok:true,errors:[]});
});
afterEach(cleanup);

describe('TwoCluesExercise raw trial source and skip handling',()=>{
  const submit=async()=>{
    render(<TwoCluesExercise/>);
    fireEvent.click(screen.getByRole('button',{name:'Submit actual Two Clues callback'}));
    await waitFor(()=>expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    return mocks.submitTrial.mock.calls[0][0];
  };

  it('passes actual recognizer transcript and individual cue/match provenance',async()=>{
    mocks.nextTrial=trial({cueLevelUsed:1,cueTypeUsed:'semantic',tier:'related',
      score:75,semanticSimilarity:0.85});
    const input=await submit();
    expect(input).toMatchObject({
      profileId:'synthetic-profile',sessionId:'synthetic-session',
      gameId:'two_clues',trialMode:'scaffolded',
      clinicalProgressionEligible:true,
      browserTranscript:'I think snow',
      taskParameters:{
        target_word:'snow',
        response_input_mode:'browser_recognized_provisional',
        cue_support_used:'semantic',
        clue_diagnosticity:null,
        app_match_similarity:0.85,
        valid_alternative_human_verified:false,
      },
    });
    expect(mocks.recordPivot).toHaveBeenCalledTimes(1);
  });

  it('records skip without assigning an aphasia error or moving clinical progression',async()=>{
    mocks.nextTrial=trial({
      spokenWord:'',browserTranscript:null,completionReason:'skipped',
      tier:'uncertain',score:0,reachedAnchor:false,semanticSimilarity:null,
    });
    const input=await submit();
    expect(input).toMatchObject({
      trialMode:'mixed',clinicalProgressionEligible:false,
      browserTranscript:null,userResponse:null,errorType:'skipped',
      taskParameters:{
        response_input_mode:'skipped',
        completion_reason:'skipped',
        speech_score_eligible:false,
        browser_recognizer_transcript_available:false,
      },
    });
    expect(mocks.recordPivot).not.toHaveBeenCalled();
    expect(getSpeechScoreExclusion(input.gameId,input.trialMode,input.taskParameters))
      .not.toBeNull();
  });

  it('abstains on a nonempty answer without original recognizer provenance',async()=>{
    mocks.nextTrial=trial({browserTranscript:null});
    const input=await submit();
    expect(input.trialMode).toBe('mixed');
    expect(input.clinicalProgressionEligible).toBe(false);
    expect(input.taskParameters.response_input_mode).toBe('unverified_response_source');
    expect(input.errorType).toBe('unverified_speech_provenance');
    expect(mocks.recordPivot).not.toHaveBeenCalled();
  });
});
