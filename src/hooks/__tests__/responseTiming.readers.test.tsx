import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionHistory } from '../useSessionHistory';
import { useSessionDetail } from '../useSessionDetail';
import { useCapabilitySpeechCorrelation } from '../useCapabilitySpeechCorrelation';
import { generateSessionInsight } from '@/lib/sessionInsightGenerator';

// Exercise the real readers and domain logic. Only Supabase transport and the
// active profile are controlled. The projection honors each actual select so
// forgetting to fetch response provenance cannot accidentally pass these tests.
const db = vi.hoisted(() => ({ from: vi.fn(), rows: {} as Record<string, Record<string, unknown>[]> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: db }));
vi.mock('@/hooks/useActiveProfileId', () => ({ useActiveProfileId: () => 'synthetic-profile' }));

const sessionId = 'synthetic-session';
const stamp = '2026-10-28T12:00:00Z';
const metadata = (elapsedMs: unknown, overrides: Record<string, unknown> = {}) => ({
  originalMime: 'audio/webm', transcriptProvider: 'azure',
  responseTiming: { version: 1, basis: 'trial_start_to_answer_acceptance', elapsedMs, ...overrides },
});
const utterance = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, attempt_id: id, session_id: sessionId, exercise_slug: 'photo_naming',
  target_word: 'apple', transcript: 'apple', is_correct: true, error_type: 'correct',
  created_at: stamp, latency_ms: 20000, audio_meta: null, ...overrides,
});
const event = (id: string, value: unknown) => ({
  id, attempt_id: id, session_id: sessionId, exercise_slug: 'photo_naming',
  created_at: stamp, score: 1, reaction_time_ms: value, task_parameters: {}, outputs: {},
});

beforeEach(() => {
  db.rows = {
    sessions: [{ id: sessionId, started_at: stamp, ended_at: stamp, duration_sec: 60 }],
    capability_assessments: [{ motor_score: 4, vision_score: 10, attention_score: 10 }],
  };
  db.from.mockReset().mockImplementation((table: string) => {
    let selected = '*';
    const read = () => (db.rows[table] ?? []).map(row => selected === '*' ? row
      : Object.fromEntries(selected.split(',').map(field => field.trim()).filter(Boolean).map(field => [field, row[field]])));
    const query = {
      select: vi.fn((fields: string) => { selected = fields; return query; }),
      eq: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      maybeSingle: () => Promise.resolve({ data: read()[0] ?? null, error: null }),
      then: (resolve: (result: { data: Record<string, unknown>[]; error: null }) => unknown) =>
        Promise.resolve({ data: read(), error: null }).then(resolve),
    };
    return query;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function history() {
  const hook = renderHook(() => useSessionHistory('synthetic-user', 'synthetic-profile'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.error).toBeNull();
  return hook.result.current.allSessions[0]?.exercises[0]?.trials ?? [];
}
async function details() {
  const hook = renderHook(() => useSessionDetail());
  await act(async () => { await hook.result.current.fetchTrials(sessionId); });
  return hook.result.current.trials;
}
async function capability() {
  const hook = renderHook(() => useCapabilitySpeechCorrelation('synthetic-user'));
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  expect(hook.result.current.error).toBeNull();
  return hook.result.current.analytics!;
}

describe('persisted response timing is distinct from analysis completion', () => {
  it('history uses accepted-answer provenance, never the slower service completion duration', async () => {
    db.rows.utterance_analyses = [
      utterance('measured', { latency_ms: 90000, audio_meta: metadata(2400) }),
      utterance('legacy', { latency_ms: 1200 }),
      utterance('zero', { audio_meta: metadata(0) }),
      utterance('unknown-version', { audio_meta: metadata(500, { version: 2 }) }),
    ];
    expect((await history()).map(row => row.reactionTimeMs)).toEqual([2400, null, 0, null]);
  });

  it('session details preserve raw diagnostics while exposing separate observed response time', async () => {
    db.rows.utterance_analyses = [
      utterance('measured', { latency_ms: 90000, audio_meta: metadata(2400) }),
      utterance('legacy', { latency_ms: 1200 }),
      utterance('zero', { audio_meta: metadata(0) }),
      utterance('wrong-basis', { audio_meta: metadata(500, { basis: 'analysis_completed' }) }),
    ];
    const result = await details();
    expect(result.map(row => row.latency_ms)).toEqual([90000, 1200, 20000, 20000]);
    expect(result.map(row => row.response_time_ms)).toEqual([2400, null, 0, null]);
  });

  it('keeps real event response timing as its own source, including zero and unavailable values', async () => {
    db.rows.exercise_events = [event('zero', 0), event('observed', 1800), event('missing', null), event('invalid', -1)];
    expect((await history()).map(row => row.reactionTimeMs)).toEqual([0, 1800, null, null]);
    const result = await details();
    expect(result.map(row => row.response_time_ms)).toEqual([0, 1800, null, null]);
    expect(result.every(row => row.source_table === 'exercise_events')).toBe(true);
  });

  it('validates adaptation-event timing when it is the only historical source', async () => {
    db.rows.adaptation_trial_logs = [
      { id: 'zero', session_id: sessionId, exercise_slug: 'photo_naming', correct: true, reaction_time_ms: 0 },
      { id: 'invalid', session_id: sessionId, exercise_slug: 'photo_naming', correct: true, reaction_time_ms: '1200' },
    ];
    expect((await history()).map(row => row.reactionTimeMs)).toEqual([0, null]);
  });
});

describe('capability correlations use measured response timing without changing thresholds', () => {
  it('does not describe a slow server or a legacy completion duration as a slow patient response', async () => {
    db.rows.utterance_analyses = [
      utterance('slow-server', { latency_ms: 90000, audio_meta: metadata(1000) }),
      utterance('legacy', { latency_ms: 40000 }),
    ];
    const result = await capability();
    expect(result.motorLatencyCorrelation).toBeNull();
    expect(result.recommendations).not.toContain('Extended time windows may reduce pressure');
  });

  it('includes measured zero and excludes unavailable timing from the response-time denominator', async () => {
    db.rows.utterance_analyses = [
      utterance('zero', { audio_meta: metadata(0) }),
      utterance('measured', { audio_meta: metadata(8000) }),
      ...Array.from({ length: 3 }, (_, i) => utterance(`legacy-${i}`, { latency_ms: 1000 })),
    ];
    expect((await capability()).motorLatencyCorrelation).toMatchObject({ strength: 0.8, description: expect.stringContaining('4.0s avg') });
  });

  it.each([
    [4, 3000, false], [4, 3001, true], [5, 5000, false],
  ])('keeps motor=%i and response=%ims on the existing threshold side', async (motor, milliseconds, expected) => {
    db.rows.capability_assessments = [{ motor_score: motor }];
    db.rows.utterance_analyses = [utterance('observed', { latency_ms: milliseconds, audio_meta: metadata(milliseconds) })];
    expect((await capability()).motorLatencyCorrelation !== null).toBe(expected);
  });

  it('does not round an observed average before applying the existing 3000ms threshold', async () => {
    db.rows.utterance_analyses = [3000, 3000, 3001].map((value, index) =>
      utterance(`observed-${index}`, { latency_ms: value, audio_meta: metadata(value) }));
    expect((await capability()).motorLatencyCorrelation?.strength).toBeCloseTo((9001 / 3) / 5000);
  });
});

describe('session response insight uses only measured observations', () => {
  const trial = (value: number | null) => ({ exercise_slug: 'photo_naming', is_correct: true, reaction_time_ms: value });

  it('preserves zero in a mixed observed average while excluding missing values', () => {
    const result = generateSessionInsight([trial(0), trial(4000), trial(null)]);
    expect(result.exerciseBreakdown[0].avgLatencyMs).toBe(2000);
    expect(result.strengths.some(text => text.startsWith('Fast responses'))).toBe(false);
  });

  it('keeps all-unavailable response timing unavailable', () => {
    const result = generateSessionInsight([trial(null), trial(null)]);
    expect(result.exerciseBreakdown[0].avgLatencyMs).toBeNull();
    expect(result.strengths.some(text => text.startsWith('Fast responses'))).toBe(false);
  });

  it.each([[0, true], [1999, true], [2000, false]])('keeps the existing fast-response boundary for %ims', (value, expected) => {
    const result = generateSessionInsight([trial(value)]);
    expect(result.exerciseBreakdown[0].avgLatencyMs).toBe(value);
    expect(result.strengths.some(text => text.startsWith('Fast responses'))).toBe(expected);
  });
});
