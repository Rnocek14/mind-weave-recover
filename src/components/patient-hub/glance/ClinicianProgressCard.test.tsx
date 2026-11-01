import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicianProgressCard } from './ClinicianProgressCard';

const backend = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: backend }));

const activeQueries: Array<{ table: string; eq: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn> }> = [];

function query(table: string, rows: unknown[], error: unknown = null) {
  const q = {
    eq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
    select: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) =>
      Promise.resolve({ data: rows, error }).then(resolve),
  };
  q.eq.mockReturnValue(q);
  q.in.mockReturnValue(q);
  q.gte.mockReturnValue(q);
  q.select.mockReturnValue(q);
  q.limit.mockReturnValue(q);
  activeQueries.push({ table, eq: q.eq, in: q.in });
  return q;
}

beforeEach(() => {
  activeQueries.length = 0;
  backend.from.mockReset();
});
afterEach(cleanup);

describe('ClinicianProgressCard patient-scoped and honest evidence', () => {
  it('reads opened patient, excludes noise, and shows measured response counts', async () => {
    const now = new Date().toISOString();
    backend.from.mockImplementation((table: string) => {
      if (table === 'sessions') return query(table, [{ id: 'patient-session' }]);
      if (table === 'utterance_analyses') return query(table, [
        { created_at: now, is_correct: true, validity_label: 'valid_attempt' },
        { created_at: now, is_correct: false, validity_label: 'valid_attempt' },
        { created_at: now, is_correct: false, validity_label: 'background_noise', counts_toward_score: false },
      ]);
      throw new Error('Unexpected table ' + table);
    });
    render(<ClinicianProgressCard userId="actual-patient-owner" profileId="opened-patient" />);
    await waitFor(() => expect(screen.getByText('50%')).toBeInTheDocument());
    expect(screen.getByText(/2 scored answers across 1 active days/)).toBeInTheDocument();
    const sessions = activeQueries.find(q => q.table === 'sessions');
    const speech = activeQueries.find(q => q.table === 'utterance_analyses');
    expect(sessions?.eq).toHaveBeenCalledWith('user_id', 'actual-patient-owner');
    expect(sessions?.eq).toHaveBeenCalledWith('profile_id', 'opened-patient');
    expect(speech?.eq).toHaveBeenCalledWith('user_id', 'actual-patient-owner');
    expect(speech?.in).toHaveBeenCalledWith('session_id', ['patient-session']);
    expect(screen.getByRole('img', { name: /gaps? in the line mean no scored answers/i })).toBeInTheDocument();
  });

  it('never calls an account-wide speech query without an opened patient profile', async () => {
    render(<ClinicianProgressCard userId="viewer-account" />);
    await waitFor(() => expect(screen.getByText(/No scored speech attempts in the last 28 days/)).toBeInTheDocument());
    expect(backend.from).not.toHaveBeenCalled();
  });

  it('reports a failed read instead of presenting a fabricated flat trajectory', async () => {
    backend.from.mockImplementation((table: string) => query(table, [], { message: 'synthetic permission failure' }));
    render(<ClinicianProgressCard userId="actual-patient-owner" profileId="opened-patient" />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Practice trend could not be loaded/));
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });
});
