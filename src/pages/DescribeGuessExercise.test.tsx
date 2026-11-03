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
  stage: null as { level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    itemTier: 1 | 2 | 3; initialVisiblePrompts: 0 | 3; label: string;
    instruction?: string; hideAutomaticPrompts?: boolean;
    requiredFeatures?: string[];
  } | null,
  profileId: 'synthetic-profile',
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
  useProfile: () => ({ activeProfile: { id: mocks.profileId } }),
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
    fireEvent.click(screen.getByRole('button',{name:'Start describing'}));
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
    mocks.profileId = 'synthetic-profile';
    mocks.nextTrial=trial();
    mocks.submitTrial.mockResolvedValue({ok:true});
    mocks.commitSession.mockResolvedValue({ok:true,errors:[]});
  });
  afterEach(() => cleanup());

  const complete = () => {
    render(<DescribeGuessExercise />);
    fireEvent.click(screen.getByRole('button',{name:'Start describing'}));
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

  it('offers all eight stage choices before Start and keeps advanced attempts out of independent speech metrics', async () => {
    mocks.stage = { level:3, itemTier:2, initialVisiblePrompts:0, label:'Prior stage' };
    mocks.nextTrial = trial({
      practiceStage:8,practiceGoalObserved:true,practiceMissingFeatures:[],
      practiceTargetNamed:false,practiceHelpRevealed:false,
    });
    render(<DescribeGuessExercise />);
    fireEvent.click(screen.getByText('Care partner: choose a describing practice stage'));
    expect(screen.getAllByRole('button',{name:/Stage [1-8]:/})).toHaveLength(8);
    fireEvent.click(screen.getByRole('button',{name:/Stage 8: Help a new listener/i}));
    fireEvent.click(screen.getByRole('button',{name:'Start describing'}));
    expect(screen.getByText('Chosen training stage: 8')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Finish synthetic description'}));
    await waitFor(()=>expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      clinicalProgressionEligible:false,trialMode:'mixed',supportUsed:'independent',
      taskParameters:expect.objectContaining({
        describing_training_stage:8,describing_target_tier:3,
        stage_strategy_labels_available:0,stage_goal_observed:true,
        stage_help_revealed:false,stage_goal_scope:'nonclinical_practice_only',
        independent_spoken_score_eligible:false,
      }),
    }));
    expect(mocks.recordPivot).not.toHaveBeenCalled();
  });

  it('records a revealed Stage 8 cue as practice support, never clinical advancement', async () => {
    mocks.stage = {level:8,itemTier:3,initialVisiblePrompts:0,label:'New listener',
      hideAutomaticPrompts:true,requiredFeatures:['function','appearance','category']};
    mocks.nextTrial = trial({practiceStage:8,practiceHelpRevealed:true});
    complete();
    await waitFor(()=>expect(mocks.submitTrial).toHaveBeenCalledTimes(1));
    expect(mocks.submitTrial).toHaveBeenCalledWith(expect.objectContaining({
      trialMode:'scaffolded',supportUsed:'semantic_cue',clinicalProgressionEligible:false,
      taskParameters:expect.objectContaining({
        stage_help_revealed:true,independent_spoken_score_eligible:false,
        supported_spoken_practice:true,
      }),
    }));
  });

  it('requires successful raw event writes before committing or celebrating practice', async () => {
    mocks.submitTrial.mockResolvedValue({ok:false});
    complete();
    await waitFor(()=>expect(screen.getByRole('alert')).toBeTruthy());
    expect(mocks.commitSession).not.toHaveBeenCalled();
    expect(mocks.completeSession).not.toHaveBeenCalled();
    expect(screen.queryByText('Exercise Complete!')).toBeNull();
  });

  it('waits for the actual raw event promise instead of racing completion', async () => {
    let finishWrite!: (result:{ok:boolean})=>void;
    mocks.submitTrial.mockImplementation(()=>new Promise(resolve=>{finishWrite=resolve;}));
    complete();
    expect(mocks.commitSession).not.toHaveBeenCalled();
    finishWrite({ok:true});
    await waitFor(()=>expect(mocks.commitSession).toHaveBeenCalledTimes(1));
    await waitFor(()=>expect(screen.getByText('Exercise Complete!')).toBeTruthy());
  });

  it('never reuses one patient session\u0027s selected practice stage for another profile', () => {
    const view=render(<DescribeGuessExercise />);
    fireEvent.click(screen.getByText('Care partner: choose a describing practice stage'));
    fireEvent.click(screen.getByRole('button',{name:/Stage 7: Explain without naming/i}));
    fireEvent.click(screen.getByRole('button',{name:'Start describing'}));
    expect(screen.getByText('Chosen training stage: 7')).toBeTruthy();
    mocks.profileId = 'another-synthetic-patient';
    view.rerender(<DescribeGuessExercise />);
    expect(screen.getByRole('button',{name:'Start describing'})).toBeTruthy();
    expect(screen.queryByText('Chosen training stage: 7')).toBeNull();
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
