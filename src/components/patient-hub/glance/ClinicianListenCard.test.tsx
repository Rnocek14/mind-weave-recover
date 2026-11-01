import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicianListenCard } from './ClinicianListenCard';

const backend = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: backend }));

const calls: Array<{ table: string; eq: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn> }> = [];
function query(table: string, data: unknown, error: unknown = null) {
  const q = {
    select: vi.fn(), eq: vi.fn(), gte: vi.fn(), not: vi.fn(),
    order: vi.fn(), limit: vi.fn(), in: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  };
  for (const key of ['select', 'eq', 'gte', 'not', 'order', 'limit', 'in'] as const) {
    q[key].mockReturnValue(q);
  }
  calls.push({ table, eq: q.eq, in: q.in });
  return q;
}
beforeEach(() => { calls.length = 0; backend.from.mockReset(); });
afterEach(cleanup);
const renderCard = (userId = 'patient-owner', profileId?: string) =>
  render(<MemoryRouter><ClinicianListenCard userId={userId} profileId={profileId} /></MemoryRouter>);

describe('ClinicianListenCard: safely selected voice examples', () => {
  it('selects only eligible clips from the opened patient, not flagged background speech', async () => {
    backend.from.mockImplementation((table: string) => {
      if (table === 'sessions') return query(table, [{ id: 'patient-session' }]);
      if (table === 'utterance_analyses') return query(table, [
        {
          id: 'one', session_id: 'patient-session', transcript: 'cup', target_word: 'cup',
          audio_storage_path: 'patient/recording-1.webm', created_at: new Date().toISOString(),
          is_correct: true, asr_confidence: 0.9, recording_duration_ms: 2500,
          validity_label: 'valid_attempt',
        },
        {
          id: 'other', session_id: 'patient-session', transcript: 'the television said something',
          audio_storage_path: 'patient/recording-2.webm', created_at: new Date().toISOString(),
          is_correct: false, recording_duration_ms: 3000,
          validity_label: 'background_noise', counts_toward_score: false,
        },
      ]);
      throw new Error('Unexpected table');
    });
    renderCard('patient-owner', 'opened-profile');
    await waitFor(() => expect(screen.getByText('"cup"')).toBeInTheDocument());
    expect(screen.queryByText(/the television said something/)).not.toBeInTheDocument();
    expect(screen.getByText('Clear response example')).toBeInTheDocument();
    expect(screen.getByText('Transcription: 90%')).toHaveAttribute(
      'title', 'Speech transcription confidence; not patient voice verification',
    );
    expect(calls.find(c => c.table === 'sessions')?.eq).toHaveBeenCalledWith('profile_id', 'opened-profile');
    expect(calls.find(c => c.table === 'sessions')?.eq).toHaveBeenCalledWith('user_id', 'patient-owner');
    expect(calls.find(c => c.table === 'utterance_analyses')?.in).toHaveBeenCalledWith('session_id', ['patient-session']);
  });

  it('never falls back to an account-wide search when the patient is unknown', async () => {
    renderCard('viewer');
    await screen.findByText('No qualifying recordings in the last 7 days.');
    expect(backend.from).not.toHaveBeenCalled();
  });

  it('does not hide a permissions failure behind "no clips"', async () => {
    backend.from.mockImplementation((table: string) => query(table, null, { message: 'denied' }));
    renderCard('patient-owner', 'opened-profile');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Voice examples could not be loaded'));
    expect(screen.queryByText('No qualifying recordings in the last 7 days.')).not.toBeInTheDocument();
  });
});
