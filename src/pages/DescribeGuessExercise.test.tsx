import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DescribeGuessTrialResult } from '@/hooks/useDescribeGuessGame';

const mocks = vi.hoisted(() => ({
  nextTrial: null as DescribeGuessTrialResult | null,
  submitTrial: vi.fn(),
  commitSession: vi.fn(),
  completeSession: vi.fn(),
  recordPivot: vi.fn(),
  acknowledgePivot: vi.fn(),
  navigate: vi.fn(),
  stage: null as { level: 1 | 2 | 3; itemTier: 1 | 2; initialVisiblePrompts: 0 | 3; label: string } | null,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mocks.navigate,
    useLocation: () => ({ key:'synthetic', state:{ trialLimit:1 } }) };
});
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'synthetic-user' } }),
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ activeProfile: { id: 'synthetic-profile' } }),
}));
vi.mock('@/hooks/useDescribeGuessTrainingStage', () => ({
  useDescribeGuessTrainingStage: () => ({
    loaded: true, loadUnavailable: false, persistedLevel: mocks.stage?.level ?? 1,
    stage: mocks.stage,
  }),
}));
vi.mock('@/hooks/useStandaloneSession', () => ({
  useStandaloneSession: () => ({ activeSessionId: 'synthetic-session', isCreatingSession: false }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({ completeSession: mocks.completeSession }),
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({ difficultyTier: 4, loading: false }),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({
  buildAdaptationTelemetry: () => ({}),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot', () => ({
  useExerciseMidSessionPivot: () => ({
    recordTrialResult: mocks.recordPivot,
    acknowledge: mocks.acknowledgePivot,
    shouldStepDown: false,
    hasPending: false,
    pivotReason: null,
  }),
}));
vi.mock('@/hooks/useTrialSubmission', () => ({
  useTrialSubmission: () => ({
    submitTrial: mocks.submitTrial,
    commitSession: mocks.commitSession,
  }),
}));
vi.mock('@/components/DescribeGuessGame', () => ({
  DescribeGuessGame: ({onTrialComplete, onGameComplete, trainingStage}: {
    onTrialComplete:(value: DescribeGuessTrialResult)=>void,
    onGameComplete:(values:DescribeGuessTrialResult[])=>void,
    trainingStage?: { level: number } | null,
  }) => (<>
    <p>Chosen training stage: {trainingStage?.level ?? 'none'}</p>
    <button onClick={() => {
      if (!mocks.nextTrial) throw new Error('Missing synthetic describe trial');
      onTrialComplete(mocks.nextTrial);
      onGameComplete([mocks.nextTrial]);
    }}>Finish synthetic description</button>
  </>),
}));

import DescribeGuessExercise from './DescribeGuessExercise';

const trial = (o: Partial<DescribeGuessTrialResult> = {}): DescribeGuessTrialResult => ({
  trialId:'synthetic-1', target:'cup',
  transcript:'you use it to drink tea',
  inputMode:'spoken',
  browserTranscript:'you use it to drink tea',
  meaningWin:true,wordWin:false,strategyWin:true,communicationWin:true,
  featureTypesUsed:['function'],guessConfidence:0.75,
  promptsShown:[],timeToWordRetrievalMs:null,selfCorrected:false,
  reactionTimeMs:2000,attemptNumber:1,difficulty:4,
  ...o,
});

describe('DescribeGuessExercise scoring/provenance reader', () => {
  it('passes the selected patient practice stage into the real page rendering path', () => {
    mocks.stage = { level: 2, itemTier: 1, initialVisiblePrompts: 0, label: 'Short descriptions with less help' };
    render(<DescribeGuessExercise />);
    expect(screen.getByText('Chosen training stage: 2')).toBeTruthy();
  });

  it('prevents always-visible strategy labels from inflating independent speech accuracy', async () => {
    mocks.stage = { level: 1, itemTier: 1, initialVisiblePrompts: 3, label: 'Full feature support' };
    complete();
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      trialMode: 'scaffolded',
      clinicalProgressionEligible: false,
      cueLevel: 0, // no chip tapped, but visible strategy labels were offered
      supportUsed: 'semantic_cue',
      taskParameters: expect.objectContaining({
        stage_strategy_labels_available: 5,
        independent_spoken_score_eligible: false,
        clinical_stage_promotion_eligible: false,
        supported_spoken_practice: true,
      }),
    }));
  });

  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    mocks.stage = null;
    mocks.nextTrial=trial();
    mocks.submitTrial.mockResolvedValue({ok:true});
    mocks.commitSession.mockResolvedValue({ok:true,errors:[]});
  });
  afterEach(() => cleanup());

  const complete = () => {
    render(<DescribeGuessExercise />);
    fireEvent.click(screen.getByRole('button',{name:'Finish synthetic description'}));
  };

  it('retains independent spoken descriptions as production evidence', async () => {
    complete();
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      userResponse:'you use it to drink tea',
      browserTranscript:'you use it to drink tea',
      clinicalProgressionEligible:true,trialMode:'production',cueLevel:0,
      supportUsed:'independent',
      taskParameters:expect.objectContaining({
        input_mode:'spoken',independent_spoken_score_eligible:true,
        describing_training_stage:null, describing_target_tier:null,
        clinical_stage_promotion_eligible:false,
      }),
    }));
    expect(mocks.recordPivot).toHaveBeenCalledWith(expect.objectContaining({wasCorrect:true}));
  });

  it('records successful typed answers as practice without browser speech or speech pivot', async () => {
    mocks.nextTrial=trial({inputMode:'typed',browserTranscript:null});
    complete();
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      isCorrect:true,trialMode:'mixed',clinicalProgressionEligible:false,
      userResponse:'you use it to drink tea',browserTranscript:null,
      taskParameters:expect.objectContaining({
        input_mode:'typed',independent_spoken_score_eligible:false,
      }),
    }));
    expect(mocks.recordPivot).not.toHaveBeenCalled();
  });

  it('records two help-chip prompts as semantic support, not phonemic cues', async () => {
    mocks.nextTrial=trial({promptsShown:['What do you use it for?','Where do you see it?']});
    complete();
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      trialMode:'scaffolded',clinicalProgressionEligible:false,
      cueLevel:2,supportUsed:'semantic_cue',
      taskParameters:expect.objectContaining({
        prompts_shown_count:2,independent_spoken_score_eligible:false,
        supported_spoken_practice:true,
      }),
    }));
  });

  it('never fabricates a browser transcript when a spoken-tagged result lacks ASR evidence', async () => {
    mocks.nextTrial = trial({ inputMode: 'spoken', browserTranscript: null });
    complete();
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      browserTranscript: null,
      trialMode: 'mixed',
      clinicalProgressionEligible: false,
      errorType: 'unverified_speech_provenance',
      taskParameters: expect.objectContaining({
        input_mode: 'spoken',
        provenance_issue: 'missing_browser_transcript',
        independent_spoken_score_eligible: false,
      }),
    }));
    expect(mocks.recordPivot).not.toHaveBeenCalled();
  });

  it('excludes missing source/invalid communication from independence measures and pivot', async () => {
    mocks.nextTrial=trial({inputMode:'unknown',communicationWin:false,transcript:''});
    complete();
    await waitFor(() => expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      trialMode:'mixed',clinicalProgressionEligible:false,browserTranscript:null,
      errorType:'unscorable_response',
    }));
    expect(mocks.recordPivot).not.toHaveBeenCalled();
  });
});
