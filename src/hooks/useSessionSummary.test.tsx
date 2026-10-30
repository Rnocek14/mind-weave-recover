import { act, cleanup, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: mocks.rpc },
}));

import { useSessionSummary } from './useSessionSummary';
import { SessionSummaryCard } from '@/components/SessionSummaryCard';

const row = (overrides: Record<string, unknown> = {}) => ({
  total_trials: 0,
  accuracy: null,
  avg_rt_ms: null,
  median_rt_ms: null,
  avg_cue_level: null,
  cue_reduction: null,
  start_difficulty: null,
  end_difficulty: null,
  error_breakdown: { semantic_related: 0, timeout: 0, unrelated: 0 },
  timeout_count: 0,
  ...overrides,
});

beforeEach(() => {
  mocks.rpc.mockReset();
});
afterEach(() => cleanup());

describe('session summary evidence and patient isolation', () => {
  it('keeps an absent accuracy distinct from a genuinely measured 0%', async () => {
    mocks.rpc.mockImplementation((_name: string, params: { p_session_id: string }) =>
      Promise.resolve({
        data: [params.p_session_id === 'measured-zero'
          ? row({ total_trials: 2, accuracy: 0, avg_rt_ms: 0, avg_cue_level: 0 })
          : row()],
        error: null,
      }),
    );
    const subject = renderHook(({ id }) => useSessionSummary(id), {
      initialProps: { id: 'no-measurement' as string | null },
    });
    await waitFor(() => expect(subject.result.current.loading).toBe(false));
    expect(subject.result.current.summary?.accuracy).toBeNull();
    expect(subject.result.current.summary?.avgRtMs).toBeNull();
    expect(subject.result.current.summary?.avgCueLevel).toBeNull();

    subject.rerender({ id: 'measured-zero' });
    await waitFor(() => expect(subject.result.current.loading).toBe(false));
    expect(subject.result.current.summary?.accuracy).toBe(0);
    expect(subject.result.current.summary?.avgRtMs).toBe(0);
    expect(subject.result.current.summary?.avgCueLevel).toBe(0);
  });

  it('shows no accuracy, response time or cue measurement for a null-only session', async () => {
    mocks.rpc.mockResolvedValue({ data: [row()], error: null });
    render(<SessionSummaryCard sessionId="synthetic-null-metrics" />);
    await screen.findByText('Session Performance');
    expect(within(screen.getByText('Accuracy').parentElement!).getByText('—')).toBeTruthy();
    expect(within(screen.getByText('Avg Response').parentElement!).getByText('—')).toBeTruthy();
    expect(within(screen.getByText('Avg Cues/Trial').parentElement!).getByText('—')).toBeTruthy();
    expect(screen.queryByText('0%')).toBeNull();
    expect(screen.queryByText('0.0s')).toBeNull();
    expect(screen.queryByText('Great Progress!')).toBeNull();
  });

  it('clears the previous patient/session immediately when the active session changes or clears', async () => {
    mocks.rpc.mockResolvedValue({ data: [row({ total_trials: 1, accuracy: 0.8 })], error: null });
    const subject = renderHook(({ id }) => useSessionSummary(id), {
      initialProps: { id: 'session-a' as string | null },
    });
    await waitFor(() => expect(subject.result.current.summary?.accuracy).toBe(0.8));
    subject.rerender({ id: 'session-b' });
    // Must not expose old session evidence even for one render before the effect starts.
    expect(subject.result.current.summary).toBeNull();
    subject.rerender({ id: null });
    expect(subject.result.current.summary).toBeNull();
    expect(subject.result.current.error).toBeNull();
    await waitFor(() => expect(subject.result.current.loading).toBe(false));
  });

  it('never lets an earlier session response replace the latest selected session', async () => {
    const pending = new Map<string, (value: unknown) => void>();
    mocks.rpc.mockImplementation((_name: string, params: { p_session_id: string }) =>
      new Promise(resolve => pending.set(params.p_session_id, resolve)),
    );
    const subject = renderHook(({ id }) => useSessionSummary(id), {
      initialProps: { id: 'session-a' },
    });
    await waitFor(() => expect(pending.has('session-a')).toBe(true));
    subject.rerender({ id: 'session-b' });
    await waitFor(() => expect(pending.has('session-b')).toBe(true));

    await act(async () => {
      pending.get('session-b')!({ data: [row({ accuracy: 0.6, total_trials: 4 })], error: null });
    });
    expect(subject.result.current.summary?.accuracy).toBe(0.6);
    await act(async () => {
      pending.get('session-a')!({ data: [row({ accuracy: 0.99, total_trials: 4 })], error: null });
    });
    expect(subject.result.current.summary?.accuracy).toBe(0.6);
    expect(subject.result.current.error).toBeNull();
  });

  it('fails closed on denied or unverified reads rather than showing the last result', async () => {
    mocks.rpc.mockImplementation((_name: string, params: { p_session_id: string }) =>
      Promise.resolve(params.p_session_id === 'unavailable'
        ? { data: null, error: { message: 'Synthetic RLS denial' } }
        : { data: [row({ accuracy: 1, total_trials: 1 })], error: null }),
    );
    const subject = renderHook(({ id }) => useSessionSummary(id), {
      initialProps: { id: 'available' },
    });
    await waitFor(() => expect(subject.result.current.summary?.accuracy).toBe(1));
    subject.rerender({ id: 'unavailable' });
    await waitFor(() => expect(subject.result.current.error).toMatch(/unavailable|denial|failed/i));
    expect(subject.result.current.summary).toBeNull();
    expect(subject.result.current.loading).toBe(false);
  });
});
