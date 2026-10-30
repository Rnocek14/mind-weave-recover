import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Link, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const controls = vi.hoisted(() => ({
  lookup: 'allowed' as 'allowed' | 'denied' | 'error',
  metricError: false,
  profileLookups: vi.fn(),
  calculateStreak: vi.fn(async () => 2),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'signed-in-clinician' } }),
}));
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ isAdmin: false }),
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    activeProfile: {
      id: 'clinician-own-profile', user_id: 'signed-in-clinician',
      profile_name: 'Clinician own account',
    },
  }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (name: string) => {
      if (name !== 'profiles') throw new Error('Unmocked clinical query: ' + name);
      let requested: string | null = null;
      const q = {
        select: () => q,
        eq: (field: string, value: string) => {
          if (field === 'id') requested = value;
          return q;
        },
        maybeSingle: async () => {
          controls.profileLookups(requested);
          if (controls.lookup === 'denied') return { data: null, error: null };
          if (controls.lookup === 'error') return { data: null, error: { message: 'synthetic denied' } };
          return {
            data: {
              id: requested, user_id: 'owner-' + requested,
              profile_name: 'Patient ' + requested,
              profile_kind: 'patient',
            },
            error: null,
          };
        },
      };
      return q;
    },
  },
}));
vi.mock('@/hooks/useWeeklyRecoverySnapshot', () => ({
  useWeeklyRecoverySnapshot: () => ({
    timeline: [], flags: [], lastActiveDate: null,
    isLoading: false, error: null,
  }),
}));
vi.mock('@/hooks/useWeeklySessionTimeline', () => ({
  useWeeklySessionTimeline: () => ({
    isLoading: false,
    error: controls.metricError ? 'Synthetic session-history read failed' : null,
  }),
}));
vi.mock('@/hooks/useWeeklySessionStats', () => ({
  useWeeklySessionStats: () => ({
    trialCount: 12, priorTrialCount: 4,
    sessionCount: 2, avgAccuracy: 75, priorAvgAccuracy: 70,
    accuracySlope: 0.02, isLoading: false, error: null,
  }),
}));
vi.mock('@/hooks/useRecoveryAlerts', () => ({
  useRecoveryAlerts: () => ({
    alerts: [], unacknowledgedCount: 0,
  }),
}));
vi.mock('@/hooks/useStreakCalculation', () => ({
  calculateStreak: controls.calculateStreak,
}));
vi.mock('@/lib/generateProgressNote', () => ({
  generateProgressNote: () => ({ narrative: 'Synthetic reviewed note' }),
}));
vi.mock('@/lib/formatEhrSummary', () => ({
  formatEhrSummary: () => 'Synthetic EHR summary',
}));
vi.mock('@/components/tour/DashboardTour', () => ({
  DashboardTour: () => null,
}));
vi.mock('@/components/RoleHelpButton', () => ({
  RoleHelpButton: () => null,
}));
vi.mock('@/components/patient-hub/ProfileCompletenessBanner', () => ({
  ProfileCompletenessBanner: () => null,
}));
vi.mock('@/components/patient-hub/SessionsTab', () => ({
  SessionsTab: ({ userId, profileId }: { userId: string; profileId: string }) =>
    <span data-testid="session-identity">{userId}:{profileId}</span>,
}));
vi.mock('@/components/patient-hub/SessionReviewTab', () => ({
  SessionReviewTab: () => null,
}));
vi.mock('@/components/patient-hub/SpeechProfileTab', () => ({
  SpeechProfileTab: () => null,
}));
vi.mock('@/components/patient-hub/PatientInfoTab', () => ({
  PatientInfoTab: () => null,
}));
vi.mock('@/components/patient-hub/IntelligenceTab', () => ({
  IntelligenceTab: () => null,
}));
vi.mock('@/components/leveling/RecoveryProfileSection', () => ({
  RecoveryProfileSection: () => null,
}));
vi.mock('@/components/patient-hub/glance/ClinicianStatusCard', () => ({
  ClinicianStatusCard: () => null,
}));
vi.mock('@/components/patient-hub/glance/ClinicianPracticeCard', () => ({
  ClinicianPracticeCard: () => null,
}));
vi.mock('@/components/patient-hub/glance/ClinicianListenCard', () => ({
  ClinicianListenCard: ({ userId, profileId }: { userId: string; profileId: string }) =>
    <span data-testid="listen-identity">{userId}:{profileId}</span>,
}));
vi.mock('@/components/patient-hub/glance/ClinicianProgressCard', () => ({
  ClinicianProgressCard: ({ userId, profileId, recentTrials, priorTrials }: {
    userId: string; profileId: string; recentTrials: number; priorTrials: number;
  }) =>
    <span data-testid="progress-identity">{userId}:{profileId},recent={recentTrials},prior={priorTrials}</span>,
}));
vi.mock('@/components/patient-hub/glance/ClinicianLevelsCard', () => ({
  ClinicianLevelsCard: ({ userId, profileId }: { userId: string; profileId: string }) =>
    <span data-testid="levels-identity">{userId}:{profileId}</span>,
}));

import PatientHub from '../PatientHub';

function mount(initial = '/clinician/review?profile=patient-a') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Link to="/clinician/review?profile=patient-b">Switch to B</Link>
      <Routes>
        <Route path="/clinician/review" element={<PatientHub />} />
        <Route path="/clinician/caseload" element={<div>Caseload route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  controls.lookup = 'allowed';
  controls.metricError = false;
});
afterEach(() => cleanup());

describe('clinician PatientHub verified patient ownership boundary', () => {
  it('queries the selected patient, not the signed-in clinician, through all glance cards', async () => {
    mount();
    expect(await screen.findByTestId('listen-identity')).toHaveTextContent('owner-patient-a:patient-a');
    expect(screen.getByTestId('progress-identity')).toHaveTextContent(
      'owner-patient-a:patient-a,recent=12,prior=4',
    );
    expect(screen.getByTestId('levels-identity')).toHaveTextContent('owner-patient-a:patient-a');
    expect(screen.queryByText('Clinician own account')).toBeNull();
    expect(screen.getByText('Patient patient-a')).toBeVisible();
    expect(controls.profileLookups).toHaveBeenCalledWith('patient-a');
    await waitFor(() => expect(controls.calculateStreak).toHaveBeenCalledWith(
      'owner-patient-a', 'patient-a'
    ));
    expect(screen.getByRole('button', { name: 'Copy EHR' })).toBeEnabled();
  });

  it.each(['denied', 'error'] as const)(
    'does not open, print or copy clinical records when patient read is %s', async mode => {
      controls.lookup = mode;
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        mount();
        expect(await screen.findByRole('heading', { name: 'Patient unavailable' })).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Copy EHR' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Print' })).toBeNull();
        expect(screen.queryByTestId('listen-identity')).toBeNull();
        expect(screen.getByRole('button', { name: 'Back to Caseload' })).toBeVisible();
      } finally { warn.mockRestore(); }
    },
  );

  it('disables all reports and exports when a required clinical metrics query fails', async () => {
    controls.metricError = true;
    mount();
    expect(await screen.findByRole('heading', { name: 'Clinical metrics unavailable' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Copy EHR' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy Note' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Print' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  it('remounts patient-scoped data when the clinician selects a different patient', async () => {
    mount();
    expect(await screen.findByTestId('listen-identity')).toHaveTextContent('owner-patient-a:patient-a');
    screen.getByRole('link', { name: 'Switch to B' }).click();
    // The previously mounted patient's card already exists; wait for the
    // router transition and new patient lookup rather than querying the old node.
    await waitFor(() => {
      expect(screen.getByTestId('listen-identity')).toHaveTextContent('owner-patient-b:patient-b');
    });
    expect(screen.queryByText('Patient patient-a')).toBeNull();
    expect(screen.getByText('Patient patient-b')).toBeVisible();
  });
});
