import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  failTable: '' as string,
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'synthetic-clinician' } }) }));
vi.mock('@/hooks/useSessionDetail', () => ({
  useSessionDetail: () => ({
    trials: [],
    loading: false,
    fetchTrials: vi.fn(),
    playAudio: vi.fn(),
    stopAudio: vi.fn(),
    playingId: null,
  }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        not: () => q,
        gte: () => q,
        order: () => q,
        in: () => q,
        limit: () => q,
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => {
          const data = table === 'sessions' ? [{
            id: 'synthetic-session', started_at: new Date().toISOString(),
            ended_at: new Date().toISOString(), duration_sec: 12,
            summary: { accuracy: 50 }, plan: null, mood_rating: null,
            caregiver_notes: null, engagement_summary: null,
            user_id: 'synthetic-owner', profile_id: 'synthetic-profile',
          }] : table === 'exercise_events' ? [
            { session_id: 'synthetic-session', exercise_slug: 'fix_sentence', score: 100,
              counts_toward_score: true, validity_label: 'valid_attempt',
              task_parameters: {}, engagement_flags: {}, reaction_time_ms: 1000, audio_storage_path: null },
            { session_id: 'synthetic-session', exercise_slug: 'fix_sentence', score: 50,
              counts_toward_score: true, validity_label: 'valid_attempt',
              task_parameters: {}, engagement_flags: {}, reaction_time_ms: 1200, audio_storage_path: null },
            { session_id: 'synthetic-session', exercise_slug: 'fix_sentence', score: 0,
              counts_toward_score: true, validity_label: 'valid_attempt',
              task_parameters: {}, engagement_flags: {}, reaction_time_ms: 1400, audio_storage_path: null },
            { session_id: 'synthetic-session', exercise_slug: 'fix_sentence', score: 0,
              counts_toward_score: false, validity_label: 'background_noise',
              task_parameters: {}, engagement_flags: {}, reaction_time_ms: null, audio_storage_path: null },
          ] : [];
          return Promise.resolve({
            data: fixture.failTable === table ? null : data,
            error: fixture.failTable === table ? { message: 'Synthetic denied clinical read' } : null,
          }).then(resolve, reject);
        },
      };
      return q;
    },
  },
}));

import { SessionsTab } from './SessionsTab';

beforeEach(() => { fixture.failTable = ''; });
afterEach(() => cleanup());

describe('clinician Session Review measured task score', () => {
  it('displays a graded score with the correct scorable denominator and a short session', async () => {
    render(<SessionsTab profileId="synthetic-profile" userId="synthetic-owner" windowSize={7} timeline={[]} />);
    expect(await screen.findByText('3 trials')).toBeVisible();
    expect(screen.getByText('Fix Sentence 50%')).toBeVisible();
    expect(screen.getByText('50%')).toBeVisible();
    expect(screen.queryByText('4 trials')).toBeNull();
  });

  it('does not tell a clinician no practice occurred when the evidence request failed', async () => {
    fixture.failTable = 'exercise_events';
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      render(<SessionsTab profileId="synthetic-profile" userId="synthetic-owner" windowSize={7} timeline={[]} />);
      expect(await screen.findByRole('alert')).toHaveTextContent('Clinical session details unavailable');
      expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
      expect(screen.queryByText('No sessions in this time window.')).toBeNull();
    } finally { spy.mockRestore(); }
  });
});
