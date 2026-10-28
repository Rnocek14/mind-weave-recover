import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUtteranceLogger, type FinalAnalysisInput } from '../useUtteranceLogger';

// Exercise the actual hook and payload mapping. Only the database transport is
// replaced: these checks prove submitted evidence, not live database behavior.
const db = vi.hoisted(() => ({ from: vi.fn(), upsert: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: db }));

const context = (targetWord = 'spoon', sessionId = 'synthetic-session-a') => ({
  targetWord, sessionId, userId: 'synthetic-user', exerciseSlug: 'photo_naming',
  trialIndex: 1, attemptNumber: 1,
});
const finalInput = (overrides: Partial<FinalAnalysisInput> = {}): FinalAnalysisInput => ({
  transcript: 'spoon', transcriptSource: 'azure', ...overrides,
});

beforeEach(() => {
  db.from.mockReset().mockReturnValue({ upsert: db.upsert });
  db.upsert.mockReset().mockResolvedValue({ error: null });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

async function submit(input: FinalAnalysisInput) {
  const hook = renderHook(() => useUtteranceLogger());
  act(() => { hook.result.current.startAttempt(context()); });
  await act(async () => { await hook.result.current.logFinalAnalysis(input); });
  expect(db.from).toHaveBeenCalledWith('utterance_analyses');
  expect(db.upsert).toHaveBeenCalledOnce();
  return db.upsert.mock.calls[0][0];
}

describe('utterance metric evidence at the persistence boundary', () => {
  it('keeps measured scores and acoustic units intact, with unavailable optional prosody as null', async () => {
    const payload = await submit(finalInput({
      asrConfidence: 0.93, phonologicalSimilarity: 0.75, semanticSimilarity: 0.8,
      speechRateWpm: 80, pauseCount: 2, totalPauseMs: 500, avgPauseDurationMs: 250,
      recordingDurationMs: 3000, pronunciationScore: 81, accuracyScore: 77,
      fluencyScore: 63, completenessScore: 100,
      gopData: { words: [], transcript: 'spoon', duration: 3 },
    }));
    expect(payload).toMatchObject({
      transcript_source: 'whisper', audio_meta: { transcriptProvider: 'azure' }, asr_confidence: 0.93,
      phonological_similarity: 0.75, semantic_similarity: 0.8,
      speech_rate_wpm: 80, pause_count: 2, total_pause_ms: 500,
      avg_pause_duration_ms: 250, recording_duration_ms: 3000,
      gop_data: {
        pronunciationScore: 81, accuracyScore: 77, fluencyScore: 63,
        completenessScore: 100, prosodyScore: null, duration: 3,
      },
    });
  });

  it('does not manufacture measured zeros for absent pronunciation metrics or duration', async () => {
    const payload = await submit(finalInput({ gopData: { words: [] } }));
    expect(payload.gop_data).toMatchObject({
      pronunciationScore: null, accuracyScore: null, fluencyScore: null,
      completenessScore: null, prosodyScore: null, duration: null,
    });
  });

  it('preserves an explicit unavailable metric instead of falling back to a competing value', async () => {
    const payload = await submit(finalInput({
      pronunciationScore: 88, prosodyScore: 92,
      gopData: { pronunciationScore: null, prosodyScore: null },
    }));
    expect(payload.gop_data.pronunciationScore).toBeNull();
    expect(payload.gop_data.prosodyScore).toBeNull();
  });

  it('preserves genuine zero scores, zero timings, false flags, and explicit null observations', async () => {
    const payload = await submit(finalInput({
      asrConfidence: 0, isCorrect: false, phonologicalSimilarity: 0,
      semanticSimilarity: null, classificationConfidence: 0,
      speechRateWpm: 0, pauseCount: 0, totalPauseMs: 0, avgPauseDurationMs: 0,
      effortfulSpeech: false, fluencyAvailable: false, cueWasEffective: false,
      timeToSuccessAfterCueMs: 0, recordingDurationMs: 0, latencyToFirstWordMs: 0,
      gopData: {
        pronunciationScore: 0, accuracyScore: 0, fluencyScore: 0,
        completenessScore: 0, prosodyScore: 0, duration: 0,
      },
    }));
    expect(payload).toMatchObject({
      asr_confidence: 0, is_correct: false, phonological_similarity: 0,
      semantic_similarity: null, classification_confidence: 0,
      speech_rate_wpm: 0, pause_count: 0, total_pause_ms: 0, avg_pause_duration_ms: 0,
      effortful_speech: false, fluency_available: false, cue_was_effective: false,
      time_to_success_after_cue_ms: 0, recording_duration_ms: 0, latency_to_first_word_ms: 0,
      gop_data: {
        pronunciationScore: 0, accuracyScore: 0, fluencyScore: 0,
        completenessScore: 0, prosodyScore: 0, duration: 0,
      },
    });
  });

  it('retains explicitly unavailable confidence, acoustics, and cue efficacy as null', async () => {
    const payload = await submit(finalInput({
      asrConfidence: null, speechRateWpm: null, pauseCount: null,
      totalPauseMs: null, avgPauseDurationMs: null, effortfulSpeech: null,
      cueWasEffective: null,
    }));
    expect(payload).toMatchObject({
      asr_confidence: null, speech_rate_wpm: null, pause_count: null,
      total_pause_ms: null, avg_pause_duration_ms: null,
      effortful_speech: null, cue_was_effective: null,
    });
  });

  it('does not retain malformed or nonfinite score values as measurements', async () => {
    const payload = await submit(finalInput({
      gopData: {
        pronunciationScore: Number.NaN, accuracyScore: Infinity,
        fluencyScore: '72', completenessScore: -Infinity,
        prosodyScore: { value: 80 }, duration: '3',
      },
    }));
    expect(payload.gop_data).toMatchObject({
      pronunciationScore: null, accuracyScore: null, fluencyScore: null,
      completenessScore: null, prosodyScore: null, duration: null,
    });
  });

  it('keeps declared analysis provenance instead of relabeling every payload as Azure', async () => {
    const payload = await submit(finalInput({
      transcriptSource: 'browser',
      gopData: { source: 'alignment-proxy', schemaVersion: 'proxy-v1', accuracyScore: 42 },
    }));
    expect(payload.transcript_source).toBe('browser');
    expect(payload.gop_data).toMatchObject({ source: 'alignment-proxy', schemaVersion: 'proxy-v1' });
  });

  it('uses the historical transcript wire enum while merging actual Azure provenance with audio diagnostics', async () => {
    const payload = await submit(finalInput({
      pronunciationDiagnostics: {
        audioMeta: { originalMime: 'audio/webm', originalSize: 1000, wavSize: 8000, base64Len: 10668 },
      },
    }));
    // The existing database CHECK allows browser/whisper/manual, not azure.
    expect(payload.transcript_source).toBe('whisper');
    expect(payload.audio_meta).toEqual({
      originalMime: 'audio/webm', originalSize: 1000, wavSize: 8000, base64Len: 10668,
      transcriptProvider: 'azure',
    });
    expect(payload.gop_data).toBeNull();
  });

  it.each(['browser', 'whisper', 'manual'] as const)('preserves the existing %s transcript wire value', async transcriptSource => {
    const payload = await submit(finalInput({ transcriptSource }));
    expect(payload.transcript_source).toBe(transcriptSource);
    expect(payload.audio_meta).toBeUndefined();
  });

  it('stores a parse failure as failed analysis without invented pronunciation scores', async () => {
    const payload = await submit(finalInput({
      asrConfidence: null,
      pronunciationDiagnostics: { pronunciationStatus: 'failed', pronunciationErrorStage: 'parse' },
    }));
    expect(payload).toMatchObject({
      transcript_source: 'whisper', audio_meta: { transcriptProvider: 'azure' }, asr_confidence: null, gop_data: null,
      pronunciation_status: 'failed', pronunciation_error_stage: 'parse',
    });
  });

  it('binds a late metric result to its original attempt and waits for acknowledgement', async () => {
    let acknowledge!: (value: { error: null }) => void;
    db.upsert.mockReturnValueOnce(new Promise(resolve => { acknowledge = resolve; }));
    const { result } = renderHook(() => useUtteranceLogger());
    act(() => { result.current.startAttempt(context()); });
    const first = result.current.captureAttempt();
    act(() => { result.current.startAttempt(context('cup', 'synthetic-session-b')); });
    const saving = first.finalize(finalInput({
      gopData: { accuracyScore: 73, prosodyScore: null },
    }));
    expect(result.current.isFinalized).toBe(false);
    expect(db.upsert.mock.calls[0][0]).toMatchObject({
      attempt_id: first.attemptId, session_id: 'synthetic-session-a', target_word: 'spoon',
      gop_data: { accuracyScore: 73, prosodyScore: null },
    });
    await act(async () => {
      acknowledge({ error: null });
      expect(await saving).toMatchObject({ status: 'persisted', attemptId: first.attemptId });
    });
    // Acknowledging the old attempt must not mark the new attempt finalized.
    expect(result.current.isFinalized).toBe(false);
  });
});
