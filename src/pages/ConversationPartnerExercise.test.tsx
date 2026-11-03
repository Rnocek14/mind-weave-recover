import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  profileId: 'patient-a' as string | null,
  navigate: vi.fn(),
  completeSession: vi.fn(),
  unmount: vi.fn(),
}));
vi.mock('react-router-dom', async (imp) => {
  const real = await imp<typeof import('react-router-dom')>();
  return { ...real,
    useNavigate: () => mocks.navigate,
    useLocation: () => ({ state: {} }),
  };
});
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'synthetic-user' }, loading: false }),
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    activeProfile: mocks.profileId ? { id: mocks.profileId } : null,
    loading: false,
  }),
}));
vi.mock('@/hooks/useStandaloneSession', () => ({
  useStandaloneSession: () => ({
    activeSessionId: mocks.profileId ? 'session-' + mocks.profileId : null,
    isCreatingSession: false,
  }),
}));
vi.mock('@/hooks/useSessionLifecycle', () => ({
  useSessionLifecycle: () => ({ completeSession: mocks.completeSession }),
}));
vi.mock('@/hooks/useRestoredLessonContext', () => ({
  useRestoredLessonContext: () => ({
    fromLesson: false, returnTo: '/today', sessionId: null, adaptations: null,
  }),
}));
vi.mock('@/hooks/useSessionAdaptation', () => ({
  useSessionAdaptation: () => ({}),
}));
vi.mock('@/lib/adaptationTelemetry', () => ({
  buildAdaptationTelemetry: () => ({}),
}));
vi.mock('@/hooks/useExerciseMidSessionPivot', () => ({
  useExerciseMidSessionPivot: () => ({}),
}));
vi.mock('@/components/ConversationPartnerGame', async () => {
  const { useEffect } = await import('react');
  return {
    ConversationPartnerGame: ({
      userId, profileId, sessionId, onComplete,
    }: {
      userId: string; profileId: string; sessionId: string | null;
      onComplete: (value: {
        turnsCompleted: number; avgLatencyMs: number;
        completionRate: number; userAIRatio: number;
      }) => void;
    }) => {
      useEffect(() => () => { mocks.unmount(); }, []);
      return (
        <div>
          <p>Game patient {profileId} in {sessionId}</p>
          <button onClick={() => onComplete({
            turnsCompleted: 3, avgLatencyMs: 900,
            completionRate: 100, userAIRatio: 50,
          })}>Complete synthetic conversation</button>
        </div>
      );
    },
  };
});

vi.mock('@/components/ConversationStagePracticeSession',()=>({
  ConversationStagePracticeSession:({kind,profileId,sessionId,onSaved}:{
    kind:string;profileId:string;sessionId:string;
    onSaved:(turns:number)=>Promise<void>;
  })=><div>
    <p>Structured {kind} for {profileId} in {sessionId}</p>
    <button onClick={()=>void onSaved(4)}>Complete synthetic scripted practice</button>
  </div>,
}));

import ConversationPartnerExercise from './ConversationPartnerExercise';

describe('Conversation Partner patient-scoped session UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.profileId = 'patient-a';
    mocks.completeSession.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  it('does not let a patient start without an active owned profile/session', () => {
    mocks.profileId = null;
    render(<ConversationPartnerExercise />);
    expect((screen.getByRole('button', { name: 'Start Conversation' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/Game patient/)).toBeNull();
  });

  it('remounts and stops the old game when the care partner switches patients mid-turn', () => {
    const { rerender } = render(<ConversationPartnerExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Conversation' }));
    expect(screen.getByText('Game patient patient-a in session-patient-a')).toBeTruthy();

    mocks.profileId = 'patient-b';
    rerender(<ConversationPartnerExercise />);
    expect(screen.queryByText('Game patient patient-a in session-patient-a')).toBeNull();
    expect(screen.queryByText('Game patient patient-b in session-patient-b')).toBeNull();
    expect(screen.getByRole('button', { name: 'Start Conversation' })).toBeTruthy();
    expect(mocks.unmount).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Start Conversation' }));
    expect(screen.getByText('Game patient patient-b in session-patient-b')).toBeTruthy();
  });

  it('offers an optional structured role-play without changing the original live entry',async()=>{
    render(<ConversationPartnerExercise/>);
    expect(screen.getByRole('button',{name:'Start Conversation'})).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Guided role-play (8 practice stages)'}));
    expect(screen.getByText('Structured conversation-partner for patient-a in session-patient-a')).toBeTruthy();
    expect(screen.queryByText(/Game patient patient-a/)).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Complete synthetic scripted practice'}));
    await waitFor(()=>expect(mocks.completeSession).toHaveBeenCalledTimes(1));
  });

  it('does not carry structured practice across a patient switch',()=>{
    const view=render(<ConversationPartnerExercise/>);
    fireEvent.click(screen.getByRole('button',{name:'Guided role-play (8 practice stages)'}));
    expect(screen.getByText('Structured conversation-partner for patient-a in session-patient-a')).toBeTruthy();
    mocks.profileId='patient-b';
    view.rerender(<ConversationPartnerExercise/>);
    expect(screen.queryByText('Structured conversation-partner for patient-a in session-patient-a')).toBeNull();
    expect(screen.getByRole('button',{name:'Guided role-play (8 practice stages)'})).toBeTruthy();
  });

  it('never exposes another patient\'s saved completion summary', async () => {
    const { rerender } = render(<ConversationPartnerExercise />);
    fireEvent.click(screen.getByRole('button', { name: 'Start Conversation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Complete synthetic conversation' }));
    await waitFor(() => expect(screen.getByText('Great conversation!')).toBeTruthy());
    expect(mocks.completeSession).toHaveBeenCalledTimes(1);
    mocks.profileId = 'patient-b';
    rerender(<ConversationPartnerExercise />);
    expect(screen.queryByText('Great conversation!')).toBeNull();
    expect(screen.getByRole('button', { name: 'Start Conversation' })).toBeTruthy();
  });
});
