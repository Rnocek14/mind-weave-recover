import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { SessionDetail } from '@/hooks/useSessionHistory';
import { SessionDetailPanel } from '../SessionDetailPanel';
import { SessionHistoryTimeline } from '../SessionHistoryTimeline';
import { SessionsTab } from '../patient-hub/SessionsTab';
import SessionHistory from '@/pages/SessionHistory';

const state = vi.hoisted(() => ({
  from: vi.fn(), rows: {} as Record<string, Record<string, unknown>[]>,
  history: [] as SessionDetail[],
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: state.from } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'synthetic-user' } }) }));
vi.mock('@/hooks/useSessionHistory', () => ({ useSessionHistory: () => ({
  sessions: state.history, allSessions: state.history, loading: false,
  filters: {}, updateFilters: vi.fn(), clearFilters: vi.fn(),
}) }));
vi.mock('@/components/HelpTooltip', () => ({ HelpLabel: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/AudioPlayback', () => ({ AudioPlayback: () => null }));
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const metadata = (elapsedMs: number) => ({ responseTiming: {
  version: 1, basis: 'trial_start_to_answer_acceptance', elapsedMs,
} });
const trial = (name: string, overrides: Record<string, unknown> = {}) => ({
  id: name, attempt_id: name, session_id: 'session-a', target_word: name,
  transcript: name, is_correct: true, exercise_slug: 'photo_naming',
  latency_ms: 30000, audio_meta: null, error_type: 'correct', cue_type_given: null,
  cue_was_effective: null, audio_storage_path: null, recording_duration_ms: null,
  pronunciation_status: null, semantic_similarity: null, phonological_similarity: null,
  stuck_type: null, speech_rate_wpm: null, created_at: '2026-10-28T12:00:00Z', ...overrides,
});
const session = {
  id: 'session-a', started_at: '2026-10-28T12:00:00Z', ended_at: '2026-10-28T12:01:00Z',
  duration_sec: 60, user_id: 'synthetic-user', profile_id: 'synthetic-profile', summary: null, plan: null,
};
function historySession(groups: Record<string, (number | null)[]>): SessionDetail {
  return {
    id: 'history-a', startedAt: session.started_at, endedAt: session.ended_at,
    durationSec: 60, summary: null, plan: null,
    exercises: Object.entries(groups).map(([slug, times]) => ({
      slug, accuracy: 100, totalTrials: times.length,
      trials: times.map((reactionTimeMs, index) => ({
        id: `${slug}-${index}`, round: index + 1, score: 1, reactionTimeMs,
        errorType: null, cueLevel: null, taskParameters: {}, outputs: {}, createdAt: session.started_at,
      })),
    })),
  };
}

beforeEach(() => {
  state.rows = {};
  state.history = [];
  state.from.mockReset().mockImplementation((table: string) => {
    let columns = '*';
    const query = {
      select: vi.fn((value: string) => { columns = value; return query; }),
      eq: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      then: (resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) => {
        // Honor column selection so failing to request audio_meta loses timing,
        // just as it does with the real database transport.
        const rows = (state.rows[table] ?? []).map(row => columns === '*' ? row
          : Object.fromEntries(columns.split(',').map(column => [column.trim(), row[column.trim()]])));
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return query;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('session response-time displays', () => {
  it('detail panel reads versioned response timing, excludes legacy completion latency, and shows zero', async () => {
    state.rows.utterance_analyses = [
      trial('zero-answer', { latency_ms: 10000, audio_meta: metadata(0) }),
      trial('measured-answer', { latency_ms: 20000, audio_meta: metadata(2000) }),
      trial('legacy-answer'),
    ];
    render(<SessionDetailPanel open onOpenChange={() => undefined} session={session} />);
    await screen.findByText('zero-answer');
    const summary = screen.getByText('Avg RT').parentElement!;
    expect(summary.textContent).toContain('1000ms');
    expect(screen.getByText('0ms')).toBeTruthy();
    expect(screen.queryByText('30.0s')).toBeNull();
    expect(screen.queryByText('10.0s')).toBeNull();
  });

  it('detail panel leaves a legacy-only average unavailable', async () => {
    state.rows.utterance_analyses = [trial('legacy-answer')];
    render(<SessionDetailPanel open onOpenChange={() => undefined} session={session} />);
    await screen.findByText('legacy-answer');
    expect(screen.getByText('Avg RT').parentElement!.textContent).toContain('—');
    expect(screen.queryByText('30.0s')).toBeNull();
  });

  it('detail event fallback averages only valid measured reaction times', async () => {
    state.rows.exercise_events = [0, 3000, null, -10].map((reaction_time_ms, index) => ({
      ...trial(`event-${index}`), score: 1, reaction_time_ms,
      task_parameters: { target_word: `event-${index}` },
    }));
    render(<SessionDetailPanel open onOpenChange={() => undefined} session={session} />);
    await screen.findByText('event-0');
    expect(screen.getByText('Avg RT').parentElement!.textContent).toContain('1500ms');
    expect(screen.getByText('0ms')).toBeTruthy();
  });

  it('history timeline uses a measured-only denominator and retains a zero trial', () => {
    render(<SessionHistoryTimeline sessions={[historySession({ 'photo-naming': [0, 2000, null] })]} />);
    fireEvent.click(screen.getByText('October 28, 2026'));
    expect(screen.getByText('Avg RT: 1000ms')).toBeTruthy();
    const firstTrial = screen.getAllByRole('row')[1];
    expect(within(firstTrial).getAllByRole('cell')[2].textContent).toBe('0');
  });

  it('history timeline distinguishes an unavailable average from a measured zero', () => {
    render(<SessionHistoryTimeline sessions={[historySession({ unknown: [null], zero: [0] })]} />);
    fireEvent.click(screen.getByText('October 28, 2026'));
    expect(screen.getByText('Avg RT: —')).toBeTruthy();
    expect(screen.getByText('Avg RT: 0ms')).toBeTruthy();
  });

  it('CSV exports measured averages, zero, and a blank for unavailable timing', async () => {
    state.history = [historySession({ 'photo-naming': [0, 2000, null], unknown: [null], zero: [0] })];
    let downloaded: Blob | undefined;
    const BaseURL = URL;
    vi.stubGlobal('URL', class extends BaseURL {
      static createObjectURL(blob: Blob) { downloaded = blob; return 'blob:synthetic-csv'; }
      static revokeObjectURL() {}
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<MemoryRouter><SessionHistory /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    expect(downloaded).toBeTruthy();
    const csv = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(downloaded!);
    });
    const value = (slug: string) => csv.split('\n').find(line => line.includes(`,${slug},`))!.split(',')[6];
    expect(value('photo-naming')).toBe('1000');
    expect(value('unknown')).toBe('');
    expect(value('zero')).toBe('0');
  });

  it('clinician sessions use measured event summary timing and normalized utterance detail timing', async () => {
    state.rows.sessions = [session];
    state.rows.exercise_events = [0, 2000, null].map((reaction_time_ms, index) => ({
      ...trial(`event-${index}`), reaction_time_ms, score: 1,
    }));
    state.rows.utterance_analyses = [
      trial('zero-answer', { latency_ms: 10000, audio_meta: metadata(0) }),
      trial('measured-answer', { latency_ms: 20000, audio_meta: metadata(2000) }),
      trial('legacy-answer'),
    ];
    render(<SessionsTab userId="synthetic-user" profileId="synthetic-profile" windowSize={7} />);
    await screen.findByText('Avg 1.0s');
    fireEvent.click(screen.getByRole('button', { name: /Wed, Oct 28/ }));
    const exercise = await screen.findByRole('button', { name: /Photo Naming.*3 trials/ });
    expect(exercise.textContent).toContain('1.0s');
    fireEvent.click(exercise);
    expect(screen.getByText('zero-answer').parentElement!.textContent).toContain('0.0s');
    expect(screen.getByText('legacy-answer').parentElement!.textContent).not.toContain('30.0s');
  });

  it('clinician session summaries display a measured zero without an audio or adaptation signal', async () => {
    state.rows.sessions = [session];
    state.rows.exercise_events = [{ ...trial('event-zero'), reaction_time_ms: 0, score: 1 }];
    render(<SessionsTab userId="synthetic-user" profileId="synthetic-profile" windowSize={7} />);
    await waitFor(() => expect(screen.getByText('Avg 0.0s')).toBeTruthy());
  });
});
