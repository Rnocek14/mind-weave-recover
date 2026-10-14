import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { SessionReviewTab } from '../../SessionReviewTab';

const backend = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: backend }));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../SessionSummaryStrip', () => ({
  SessionSummaryStrip: ({ accuracyPct, cueDependencyPct }: { accuracyPct: number; cueDependencyPct: number }) => (
    <div data-testid="review-summary">accuracy={accuracyPct};cues={cueDependencyPct}</div>
  ),
}));
vi.mock('../VoiceEvidenceGrid', () => ({
  VoiceEvidenceGrid: ({ trials }: { trials: { target_word: string }[] }) => (
    <div>{trials.map((trial, index) => <span key={index}>{trial.target_word}</span>)}</div>
  ),
}));
vi.mock('../ErrorPatternBreakdown', () => ({ ErrorPatternBreakdown: () => null, categoryOfTrial: () => ['correct'] }));
vi.mock('../SoundsToWatch', () => ({ SoundsToWatch: () => null }));
vi.mock('../CueResponsePanel', () => ({ CueResponsePanel: () => null }));
vi.mock('../SessionNotesPanel', () => ({ SessionNotesPanel: () => null }));
vi.mock('../AcrossTimeView', () => ({ AcrossTimeView: () => null }));
vi.mock('../ExcludedClipsAudit', () => ({ ExcludedClipsAudit: () => null }));
vi.mock('../AxisEvidencePanel', () => ({ AxisEvidencePanel: () => null }));

type DbResult = { data: unknown; error: unknown };
const ok = (data: unknown): DbResult => ({ data, error: null });
function query(result: DbResult | Promise<DbResult>) {
  return {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (value: DbResult) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
}
function deferred() {
  let resolve!: (result: DbResult) => void;
  const promise = new Promise<DbResult>((r) => { resolve = r; });
  return { resolve, promise };
}
const session = (id: string) => ({ id, started_at: '2026-09-20T12:00:00Z', duration_sec: 120 });
const trial = (word: string) => ({
  attempt_id: word, target_word: word, transcript: word, is_correct: true,
  exercise_slug: 'photo_naming', cue_type_given: 'none',
  validity_label: 'valid_attempt', counts_toward_score: true,
});

beforeEach(() => { backend.from.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Session Review patient isolation', () => {
  it('hides patient A immediately while patient B loads, then selects a B session', async () => {
    const pendingB = deferred();
    let sessionQueries = 0;
    let trialQueries = 0;
    const requestedSessions: ReturnType<typeof query>[] = [];
    backend.from.mockImplementation((table: string) => {
      if (table === 'sessions') return query(++sessionQueries === 1 ? ok([session('a')]) : pendingB.promise);
      if (table === 'utterance_analyses') {
        const response = query(ok([trial(++trialQueries === 1 ? 'patient-a-word' : 'patient-b-word')]));
        requestedSessions.push(response);
        return response;
      }
      return query(ok([]));
    });
    const { rerender } = render(<SessionReviewTab profileId="patient-a" />);
    await screen.findByText('patient-a-word');
    rerender(<SessionReviewTab profileId="patient-b" />);
    expect(screen.queryByText('patient-a-word')).toBeNull();
    expect(screen.queryByTestId('review-summary')).toBeNull();
    await act(async () => { pendingB.resolve(ok([session('b')])); });
    await screen.findByText('patient-b-word');
    expect(requestedSessions[1].eq).toHaveBeenCalledWith('session_id', 'b');
    expect(screen.queryByText('patient-a-word')).toBeNull();
  });

  it('ignores an old patient session-list response after the profile changes', async () => {
    const pendingA = deferred();
    let sessionQueries = 0;
    backend.from.mockImplementation((table: string) => {
      if (table === 'sessions') return query(++sessionQueries === 1 ? pendingA.promise : ok([session('b')]));
      if (table === 'utterance_analyses') return query(ok([trial('patient-b-word')]));
      return query(ok([]));
    });
    const { rerender } = render(<SessionReviewTab profileId="patient-a" />);
    rerender(<SessionReviewTab profileId="patient-b" />);
    await screen.findByText('patient-b-word');
    await act(async () => { pendingA.resolve(ok([session('a')])); });
    expect(screen.getByText('patient-b-word')).toBeTruthy();
    expect(backend.from.mock.calls.filter(([table]) => table === 'utterance_analyses')).toHaveLength(1);
  });

  it('does not mistake none for a cue or discard genuine errors', async () => {
    backend.from.mockImplementation((table: string) => {
      if (table === 'sessions') return query(ok([session('a')]));
      if (table === 'utterance_analyses') return query(ok([
        trial('independent'),
        { ...trial('measured-error'), is_correct: false, cue_type_given: 'semantic' },
        { ...trial('noise'), is_correct: false, cue_type_given: 'full_word', validity_label: 'background_noise', counts_toward_score: false },
      ]));
      return query(ok([]));
    });
    render(<SessionReviewTab profileId="patient-a" />);
    await waitFor(() => expect(screen.getByTestId('review-summary').textContent).toBe('accuracy=50;cues=50'));
  });
});
