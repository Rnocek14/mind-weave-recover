import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import type {FixSentenceTrialResult} from '@/hooks/useFixSentenceGame';

const mocks=vi.hoisted(()=>({
  submit:vi.fn(),commit:vi.fn(),complete:vi.fn(),navigate:vi.fn(),
  review:vi.fn(),
  next:null as null|Record<string,unknown>,
}));
vi.mock('react-router-dom',async importOriginal=>{
  const actual=await importOriginal<typeof import('react-router-dom')>();
  return {...actual,useNavigate:()=>mocks.navigate,useLocation:()=>({state:{}})};
});
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'test-caregiver'}})}));
vi.mock('@/hooks/useProfile',()=>({useProfile:()=>({activeProfile:{id:'synthetic-patient'}})}));
vi.mock('@/hooks/useStandaloneSession',()=>({useStandaloneSession:()=>({
  activeSessionId:'synthetic-session',isCreatingSession:false,
})}));
vi.mock('@/hooks/useRestoredLessonContext',()=>({useRestoredLessonContext:()=>({
  fromLesson:false,returnTo:'/lesson',sessionId:null,adaptations:null,
})}));
vi.mock('@/hooks/useSessionLifecycle',()=>({useSessionLifecycle:()=>({
  completeSession:mocks.complete,
})}));
vi.mock('@/hooks/useSessionAdaptation',()=>({useSessionAdaptation:()=>({
  difficultyTier:1,focusPhonemes:[],loading:false,
})}));
vi.mock('@/lib/adaptationTelemetry',()=>({buildAdaptationTelemetry:()=>({})}));
vi.mock('@/hooks/useExerciseMidSessionPivot',()=>({useExerciseMidSessionPivot:()=>({})}));
vi.mock('@/hooks/useValidationTrialCount',()=>({useValidationTrialCount:()=>1}));
vi.mock('@/hooks/useFixSentenceProgression',()=>({useFixSentenceProgression:()=>({
  loaded:true,startingLevel:3,state:{supportBaseline:0},
})}));
vi.mock('@/lib/progression/fixSentenceDifficultyBridge',()=>({
  resolveEffectiveFixSentenceInitialDifficulty:()=>({
    clinicalFloor:3,raised:false,softRegressionScaffold:false,
  }),
}));
vi.mock('@/hooks/useTrialSubmission',()=>({useTrialSubmission:()=>({
  submitTrial:mocks.submit,commitSession:mocks.commit,
})}));
vi.mock('@/lib/gameReviewHandoff',()=>({recordFixSentenceReviewTargets:mocks.review}));
vi.mock('@/components/FixSentenceGame',()=>({
  FixSentenceGame:({onTrialComplete}:{
    onTrialComplete:(result:FixSentenceTrialResult)=>void;
  })=><button onClick={()=>onTrialComplete(mocks.next as unknown as FixSentenceTrialResult)}>
    Record synthetic repair
  </button>,
}));

import FixSentenceExercise from './FixSentenceExercise';

const trial=(opts:Partial<FixSentenceTrialResult>={}):FixSentenceTrialResult=>({
  trialId:'fs-synthetic',sentence:'I brushed my teeth with a hammer.',
  wrongWord:'hammer',spokenWord:'toothbrush',matchedFix:'toothbrush',
  isCorrect:true,isPartialCredit:false,selfCorrected:false,
  semanticSimilarity:1,reactionTimeMs:1800,attemptNumber:1,
  difficulty:2,phonemeTargets:[],support:'open_response',
  inputMode:'browser_recognized',...opts,
});
async function submit(value:FixSentenceTrialResult){
  mocks.next=value;
  render(<FixSentenceExercise/>);
  fireEvent.click(screen.getByRole('button',{name:'Record synthetic repair'}));
  await waitFor(()=>expect(mocks.submit).toHaveBeenCalledTimes(1));
  return mocks.submit.mock.calls[0][0];
}
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.next=null;
  mocks.submit.mockResolvedValue({ok:true});
  mocks.commit.mockResolvedValue({ok:true,errors:[]});
  mocks.complete.mockResolvedValue(undefined);
});
afterEach(()=>cleanup());

describe('Fix Sentence page writes real input provenance to unified trial submission',()=>{
  it('does not turn a tapped correct answer into spoken accuracy',async()=>{
    const logged=await submit(trial({
      inputMode:'choice',support:'choice_based',
    }));
    expect(logged).toMatchObject({
      trialMode:'recognition',clinicalProgressionEligible:true,
      browserTranscript:null,validity:undefined,
      supportUsed:'choice_based',
      taskParameters:{
        input_mode:'choice',clinical_score_eligible:false,
        independent_spoken_score_eligible:false,
      },
    });
  });

  it('keeps a typed correct repair as unscored speech practice, never expressive progression',async()=>{
    const logged=await submit(trial({
      inputMode:'typed',spokenWord:'toothbrush',
    }));
    expect(logged).toMatchObject({
      trialMode:'mixed',clinicalProgressionEligible:false,
      browserTranscript:null,validity:undefined,
      taskParameters:{
        input_mode:'typed',clinical_score_eligible:false,
        independent_spoken_score_eligible:false,
      },
    });
  });

  it('recognizes spoken choice-visible repair as assisted rather than independent',async()=>{
    const logged=await submit(trial({
      inputMode:'browser_recognized',support:'highlight_plus_choice',
    }));
    expect(logged).toMatchObject({
      trialMode:'scaffolded',clinicalProgressionEligible:true,
      browserTranscript:'toothbrush',supportUsed:'highlight_plus_choice',
      validity:{validity:'valid_attempt'},
      taskParameters:{
        clinical_score_eligible:false,
        independent_spoken_score_eligible:false,
      },
    });
  });

  it('preserves valid independently spoken open repairs',async()=>{
    const logged=await submit(trial());
    expect(logged).toMatchObject({
      trialMode:'production',clinicalProgressionEligible:true,
      browserTranscript:'toothbrush',supportUsed:'open_response',
      validity:{validity:'valid_attempt'},
      taskParameters:{
        input_mode:'browser_recognized',clinical_score_eligible:true,
        independent_spoken_score_eligible:true,
      },
    });
  });

  it.each(['mixed','skipped_partial','unknown'] as const)(
    'unverified %s result abstains from both spoken and clinical scoring',async mode=>{
      const logged=await submit(trial({inputMode:mode}));
      expect(logged).toMatchObject({
        trialMode:'mixed',clinicalProgressionEligible:false,browserTranscript:null,
        taskParameters:{
          input_mode:mode,clinical_score_eligible:false,
          independent_spoken_score_eligible:false,
        },
      });
    },
  );
});
