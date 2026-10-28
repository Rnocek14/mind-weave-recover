import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { VoiceEvidenceGrid } from '../VoiceEvidenceGrid';
import { AcrossTimeView } from '../AcrossTimeView';
import type { TrialData } from '@/hooks/useSessionDetail';

const db = vi.hoisted(() => ({ from: vi.fn(), rows: {} as Record<string, Record<string, unknown>[]> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: db.from } }));
const trial = (name: string, overrides: Partial<TrialData> = {}): TrialData => ({
  attempt_id: name, target_word: name, transcript: name, is_correct: true,
  exercise_slug: 'photo_naming', latency_ms: 30000, error_type: 'correct',
  cue_type_given: null, cue_was_effective: null,
  audio_storage_path: `synthetic/${name}.wav`, recording_duration_ms: 1000,
  pronunciation_status: 'complete', semantic_similarity: null, phonological_similarity: null,
  stuck_type: null, speech_rate_wpm: null, created_at: '2026-10-28T12:00:00Z',
  validity_label: 'valid_attempt', counts_toward_score: true, ...overrides,
});
const metadata = (elapsedMs: number) => ({ responseTiming: {
  version: 1, basis: 'trial_start_to_answer_acceptance', elapsedMs,
} });

beforeEach(() => {
  db.rows = {};
  db.from.mockReset().mockImplementation((table: string) => {
    let columns = '*';
    const query = {
      select: vi.fn((value: string) => { columns = value; return query; }),
      eq: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(), ilike: vi.fn().mockReturnThis(),
      then: (resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) => {
        const rows = (db.rows[table] ?? []).map(row => columns === '*' ? row
          : Object.fromEntries(columns.split(',').map(column => [column.trim(), row[column.trim()]])));
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return query;
  });
});
afterEach(() => cleanup());

describe('voice evidence timing provenance', () => {
  it('ranks measured response time instead of analysis completion, retaining a measured zero', () => {
    render(<VoiceEvidenceGrid trials={[
      trial('slow-answer-fast-analysis', { latency_ms: 100, response_time_ms: 3000 }),
      trial('zero-answer-slow-analysis', { latency_ms: 20000, response_time_ms: 0 }),
      trial('unmeasured-answer', { latency_ms: 1, response_time_ms: null }),
    ]} />);
    const card = screen.getByText('Best response').closest('.rounded-lg')!;
    expect(within(card as HTMLElement).getByText('zero-answer-slow-analysis')).toBeTruthy();
    expect(within(card as HTMLElement).getByText('0.0s')).toBeTruthy();
    expect(within(card as HTMLElement).queryByText('20.0s')).toBeNull();
  });

  it('makes no fastest or no-cue claim when only an unmeasured cued response exists', () => {
    render(<VoiceEvidenceGrid trials={[trial('legacy-cued-answer', { cue_type_given: 'semantic' })]} />);
    expect(screen.queryByText(/fastest/i)).toBeNull();
    expect(screen.queryByText(/no cue/i)).toBeNull();
    expect(screen.queryByText('30.0s')).toBeNull();
    expect(screen.getByText(/response time unavailable/i)).toBeTruthy();
  });

  it('preserves the existing validity and recording-quality filters during selection', () => {
    render(<VoiceEvidenceGrid trials={[
      trial('eligible-answer', { response_time_ms: 2000 }),
      trial('excluded-noise', { response_time_ms: 0, validity_label: 'background_noise' }),
      trial('excluded-short', { response_time_ms: 0, recording_duration_ms: 399 }),
    ]} />);
    expect(screen.getByText('eligible-answer')).toBeTruthy();
    expect(screen.queryByText('excluded-noise')).toBeNull();
    expect(screen.queryByText('excluded-short')).toBeNull();
  });

  it('across-time view reads response metadata, renders zero, and omits legacy completion durations', async () => {
    db.rows.sessions = [{ id: 'synthetic-session' }];
    db.rows.utterance_analyses = [
      { ...trial('zero-answer'), session_id: 'synthetic-session', audio_meta: metadata(0) },
      { ...trial('measured-answer'), session_id: 'synthetic-session', audio_meta: metadata(1500) },
      { ...trial('legacy-answer'), session_id: 'synthetic-session', audio_meta: null },
    ];
    render(<AcrossTimeView currentSessionTrials={[trial('apple')]} profileId="synthetic-profile" />);
    await screen.findByText('"zero-answer"');
    expect(screen.getByText('0.0s')).toBeTruthy();
    expect(screen.getByText('1.5s')).toBeTruthy();
    expect(screen.queryByText('30.0s')).toBeNull();
  });
});
