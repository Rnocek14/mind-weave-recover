import type { ReactNode } from 'react';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePronunciationAnalytics } from '../usePronunciationAnalytics';
import { usePronunciationScoreAnalytics } from '../usePronunciationScoreAnalytics';

// Real query/aggregation hooks; only the persisted row transport and active
// profile are replaced. This does not verify live database permissions.
const db = vi.hoisted(() => ({ from: vi.fn(), rows: {} as Record<string, Record<string, unknown>[]> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: db }));
vi.mock('@/hooks/useActiveProfileId', () => ({ useActiveProfileId: () => 'synthetic-profile' }));
const clients: QueryClient[] = [];

beforeEach(() => {
  db.rows = {};
  db.from.mockReset().mockImplementation((table: string) => ({
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
    then: (resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) =>
      Promise.resolve({ data: db.rows[table] ?? [], error: null }).then(resolve),
  }));
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

const row = (overrides: Record<string, unknown> = {}) => ({
  created_at: '2026-10-28T12:00:00Z', target_word: 'apple', audio_storage_path: null,
  speech_rate_wpm: null, pause_count: null, avg_pause_duration_ms: null,
  asr_confidence: null, recording_duration_ms: null, gop_data: null, ...overrides,
});
const scores = (value: number | null, overrides: Record<string, unknown> = {}) => ({
  source: 'azure', pronunciationScore: value, accuracyScore: value,
  fluencyScore: value, completenessScore: value, prosodyScore: value, ...overrides,
});

async function queryAnalytics() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = renderHook(() => usePronunciationAnalytics('synthetic-user', 'synthetic-profile'), { wrapper });
  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  return hook.result.current.data!;
}

async function queryScores() {
  const hook = renderHook(() => usePronunciationScoreAnalytics('synthetic-user'));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.error).toBeNull();
  return hook.result.current.analytics;
}

describe('persisted speech analytics measurement integrity', () => {
  it('averages measured zero and 100 as 50 while excluding unavailable observations', async () => {
    db.rows.utterance_analyses = [
      row({ speech_rate_wpm: 0, asr_confidence: 0, pause_count: 0,
        recording_duration_ms: 60000, avg_pause_duration_ms: 0, gop_data: scores(0) }),
      row({ speech_rate_wpm: 100, asr_confidence: 1, pause_count: 2,
        recording_duration_ms: 60000, avg_pause_duration_ms: 500, gop_data: scores(100) }),
      row({ pause_count: 2 }), // No duration: no measured pauses/minute.
    ];
    const result = await queryAnalytics();
    expect(result.overallStats).toMatchObject({
      avgSpeechRate: 50, avgConfidence: 0.5, avgPauseFrequency: 1,
      avgPronunciationScore: 50, avgAccuracyScore: 50, avgFluencyScore: 50, totalTrials: 3,
    });
    expect(result.timeSeries[0]).toMatchObject({
      speechRate: 50, confidence: 0.5, pauseFrequency: 1, avgPauseDuration: 250,
      pronunciationScore: 50, accuracyScore: 50, fluencyScore: 50, completenessScore: 50,
      trialCount: 3,
    });
  });

  it('preserves an all-zero day and represents an unmeasured day as null', async () => {
    db.rows.utterance_analyses = [
      row({ speech_rate_wpm: 0, asr_confidence: 0, pause_count: 0, avg_pause_duration_ms: 0,
        recording_duration_ms: 60000, gop_data: scores(0) }),
      row({ created_at: '2026-10-29T12:00:00Z', gop_data: scores(null) }),
    ];
    const result = await queryAnalytics();
    expect(result.timeSeries[0]).toMatchObject({
      speechRate: 0, confidence: 0, pauseFrequency: 0, avgPauseDuration: 0,
      pronunciationScore: 0, accuracyScore: 0, fluencyScore: 0, completenessScore: 0,
    });
    expect(result.timeSeries[1]).toMatchObject({
      speechRate: null, confidence: null, pauseFrequency: null, avgPauseDuration: null,
      pronunciationScore: null, accuracyScore: null, fluencyScore: null, completenessScore: null,
    });
    expect(result.overallStats.avgConfidence).toBe(0);
  });

  it('rejects invalid scale/range values instead of allowing them into averages', async () => {
    db.rows.utterance_analyses = [
      row({ speech_rate_wpm: 80, asr_confidence: 0.4, gop_data: scores(40) }),
      ...[-1, NaN, Infinity, '100'].map(value => row({
        speech_rate_wpm: value, asr_confidence: value, gop_data: scores(null, {
          pronunciationScore: value, accuracyScore: value, fluencyScore: value,
        }),
      })),
      row({ asr_confidence: 1.1, gop_data: scores(101) }),
    ];
    expect((await queryAnalytics()).overallStats).toMatchObject({
      avgSpeechRate: 80, avgConfidence: 0.4,
      avgPronunciationScore: 40, avgAccuracyScore: 40, avgFluencyScore: 40,
    });
  });

  it('does not invent measured averages when every field is unavailable', async () => {
    db.rows.utterance_analyses = [row({ pause_count: 2, recording_duration_ms: 0 })];
    expect((await queryAnalytics()).overallStats).toMatchObject({
      avgSpeechRate: null, avgConfidence: null, avgPauseFrequency: null,
      avgPronunciationScore: null, avgAccuracyScore: null, avgFluencyScore: null,
    });
  });

  it('preserves zeros and skips null denominators in the legacy events fallback too', async () => {
    db.rows.sessions = [{ id: 'synthetic-session' }];
    db.rows.exercise_events = [
      { created_at: '2026-10-28T12:00:00Z', whisper_confidence: 0,
        acoustic_metrics: { speechRateWpm: 0, pauseCount: 0, totalDurationSec: 60, avgPauseDurationMs: 0 } },
      { created_at: '2026-10-28T12:01:00Z', whisper_confidence: 1,
        acoustic_metrics: { speechRateWpm: 100, pauseCount: 2, totalDurationSec: 60, avgPauseDurationMs: 500 } },
      { created_at: '2026-10-28T12:02:00Z', whisper_confidence: null,
        acoustic_metrics: { speechRateWpm: null, pauseCount: 2, totalDurationSec: null, avgPauseDurationMs: null } },
    ];
    const result = await queryAnalytics();
    expect(result.overallStats).toMatchObject({
      avgSpeechRate: 50, avgConfidence: 0.5, avgPauseFrequency: 1, totalTrials: 3,
      avgPronunciationScore: null, hasAzureData: false,
    });
    expect(result.timeSeries[0]).toMatchObject({ avgPauseDuration: 250, trialCount: 3 });
  });
});

describe('persisted pronunciation score aggregation', () => {
  it('retains zero-score attempts, words, audio, phonemes, and daily trends', async () => {
    db.rows.utterance_analyses = [0, 100].map(value => row({
      audio_storage_path: `synthetic/${value}.wav`,
      gop_data: scores(value, { words: [{ phonemes: [{ phoneme: 'a', accuracyScore: value }] }] }),
    }));
    const result = await queryScores();
    expect(result).toMatchObject({
      sampleCount: 2, overallScore: 50, accuracyScore: 50, fluencyScore: 50,
      completenessScore: 50, prosodyScore: 50,
      weeklyTrend: [{ date: '2026-10-28', avgScore: 50, count: 2 }],
      hardestPhonemes: [{ phoneme: 'a', avgAccuracy: 50, sampleCount: 2 }],
    });
    expect(result!.needsPracticeWords[0]).toMatchObject({
      word: 'apple', avgScore: 50, sampleCount: 2,
      examples: [{ score: 0, audioPath: 'synthetic/0.wav' }, { score: 100, audioPath: 'synthetic/100.wav' }],
    });
  });

  it('uses each score\'s own valid observations and preserves unavailable breakdowns', async () => {
    db.rows.utterance_analyses = [
      row({ gop_data: scores(0, { accuracyScore: null, fluencyScore: 0, completenessScore: null, prosodyScore: null }) }),
      row({ gop_data: scores(100, { accuracyScore: 100, fluencyScore: null, completenessScore: null, prosodyScore: 0 }) }),
    ];
    expect(await queryScores()).toMatchObject({
      sampleCount: 2, overallScore: 50, accuracyScore: 100, fluencyScore: 0,
      completenessScore: null, prosodyScore: 0,
    });
  });

  it('excludes invalid pronunciation scales without discarding valid zero', async () => {
    db.rows.utterance_analyses = [
      row({ gop_data: scores(0) }), row({ gop_data: scores(100) }),
      ...[-1, 101, NaN, Infinity, null, '50'].map(value =>
        row({ gop_data: scores(null, { pronunciationScore: value }) })),
    ];
    expect(await queryScores()).toMatchObject({ overallScore: 50, sampleCount: 2 });
  });
});
