import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FunctionalPracticeResult } from '@/components/FunctionalPracticeGame';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(), submit: vi.fn(), commit: vi.fn(), completeSession: vi.fn(),
  profileId: 'patient-synthetic-a',
}));
vi.mock('react-router-dom', async importOriginal => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mocks.navigate };
});
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'caregiver-synthetic' } }),
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ activeProfile: { id: mocks.profileId } }),
}));
vi.mock('@/hooks/useStandaloneSession', () => ({
  useStandaloneSession: () => ({
    activeSessionId: 'session-synthetic', isCreatingSession: false,
  }),
}));
vi.mock('@/hooks/useRestoredLessonContext', () => ({
  useRestoredLessonContext: () => ({
    fromLesson: false, sessionId: null, returnTo: '/lesson',
  }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({ completeSession: mocks.completeSession }),
}));
vi.mock('@/hooks/useTrialSubmission', () => ({
  useTrialSubmission: () => ({ submitTrial: mocks.submit, commitSession: mocks.commit }),
}));

const objectiveResult: FunctionalPracticeResult = {
  trialId: 'wf-model-cup', stage: 1, taskKind: 'choice', inputMode: 'choice',
  userResponse: null, correct: true, practiceAccuracy: 1, supportRevealed: false,
  baselineSupport: 'full_model', clinicalProgressionEligible: false,
  independentSpokenScoreEligible: false,
};
vi.mock('@/components/FunctionalPracticeGame', () => ({
  FunctionalPracticeGame: ({
    kind, stage, onTrialComplete, onGameComplete,
  }: {
    kind: string;
    stage: { level: number; support: FunctionalPracticeResult['baselineSupport'] };
    onTrialComplete: (r: FunctionalPracticeResult) => void;
    onGameComplete: (r: FunctionalPracticeResult[]) => void;
  }) => <div>
    <span>Active synthetic {kind} stage: {stage.level}</span>
    <button onClick={() => {
      const trial = { ...objectiveResult, stage: stage.level,
        baselineSupport: stage.support };
      onTrialComplete(trial);
      onGameComplete([trial]);
    }}>Complete one practice round</button>
    <button onClick={() => {
      const attempt: FunctionalPracticeResult = {
        ...objectiveResult, stage: stage.level, taskKind: 'open',
        baselineSupport: stage.support, inputMode: 'typed',
        userResponse: 'I need to change my appointment', correct: null,
        practiceAccuracy: null,
      };
      onTrialComplete(attempt);
      onGameComplete([attempt]);
    }}>Complete typed practice round</button>
  </div>,
}));
import FunctionalPracticeExercise from './FunctionalPracticeExercise';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profileId = 'patient-synthetic-a';
  mocks.submit.mockResolvedValue({ ok: true });
  mocks.commit.mockResolvedValue({ ok: true, errors: [], masteryFlushed: true });
  mocks.completeSession.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

function start(kind: 'word-finding' | 'sentence-game' = 'word-finding') {
  render(<FunctionalPracticeExercise kind={kind}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Start practice' }));
}

describe('patient-owned functional practice evidence', () => {
  it.each(['word-finding', 'sentence-game'] as const)('%s offers 8 usable caregiver stages', kind => {
    render(<FunctionalPracticeExercise kind={kind}/>);
    fireEvent.click(screen.getByText('Care partner: choose a practice stage'));
    expect(screen.getAllByRole('button', { name: /Stage [1-8]:/ })).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: /Stage 8:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start practice' }));
    expect(screen.getByText('Active synthetic ' + kind + ' stage: 8')).toBeTruthy();
  });
  it('records objective recognition with modeled support, not clinical speech success', async () => {
    start();
    fireEvent.click(screen.getByRole('button', { name: 'Complete one practice round' }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({
      gameId: 'word_finding', trialMode: 'recognition',
      supportUsed: 'carrier_or_full_model',
      clinicalProgressionEligible: false,
      taskParameters: expect.objectContaining({
        practice_stage: 1,
        practice_input_mode: 'choice',
        clinical_score_eligible: false,
        independent_spoken_score_eligible: false,
      }),
    }));
    await waitFor(() => expect(screen.getByText('Practice saved')).toBeTruthy());
    expect(mocks.completeSession).toHaveBeenCalledTimes(1);
  });
  it('does not treat typed open responses as scored or independently spoken', async () => {
    start('sentence-game');
    fireEvent.click(screen.getByRole('button', { name: 'Complete typed practice round' }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));
    expect(mocks.submit).toHaveBeenCalledWith(expect.objectContaining({
      gameId: 'sentence_game', trialMode: 'mixed', accuracyScore: null,
      browserTranscript: null, clinicalProgressionEligible: false,
      taskParameters: expect.objectContaining({
        practice_input_mode: 'typed',
        practice_answer_correct: null, clinical_score_eligible: false,
      }),
    }));
  });
  it('never finishes or reports saved practice when raw event write fails', async () => {
    mocks.submit.mockResolvedValue({ ok: false });
    start();
    fireEvent.click(screen.getByRole('button', { name: 'Complete one practice round' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByText('Practice saved')).toBeNull();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.completeSession).not.toHaveBeenCalled();
  });
  it('holds final completion until every raw event write is resolved', async () => {
    let resolve!: (value: { ok: boolean }) => void;
    mocks.submit.mockImplementation(() => new Promise(r => { resolve = r; }));
    start();
    fireEvent.click(screen.getByRole('button', { name: 'Complete one practice round' }));
    expect(screen.getByText('Saving your practice…')).toBeTruthy();
    expect(mocks.commit).not.toHaveBeenCalled();
    resolve({ ok: true });
    await waitFor(() => expect(mocks.commit).toHaveBeenCalledTimes(1));
    expect(mocks.completeSession).toHaveBeenCalledTimes(1);
  });
  it('does not leak caregiver stage choice to another patient', () => {
    const page = render(<FunctionalPracticeExercise kind="sentence-game"/>);
    fireEvent.click(screen.getByText('Care partner: choose a practice stage'));
    fireEvent.click(screen.getByRole('button', { name: /Stage 8:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start practice' }));
    expect(screen.getByText('Active synthetic sentence-game stage: 8')).toBeTruthy();
    mocks.profileId = 'patient-synthetic-b';
    page.rerender(<FunctionalPracticeExercise kind="sentence-game"/>);
    fireEvent.click(screen.getByRole('button', { name: 'Start practice' }));
    expect(screen.getByText('Active synthetic sentence-game stage: 1')).toBeTruthy();
  });
});
