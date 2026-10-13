import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/voiceController', () => ({
  voiceController: {
    subscribeSessionPaused: vi.fn(() => () => {}),
  },
}));

import { useSpeechRecognition } from './useSpeechRecognition';

class FakeSpeechRecognition {
  static latest: FakeSpeechRecognition | null = null;

  continuous = false;
  interimResults = false;
  lang = '';
  maxAlternatives = 1;

  onstart: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeSpeechRecognition.latest = this;
  }

  start() {
    this.onstart?.();
  }

  stop() {
    this.onend?.();
  }
}

function speechEvent(
  transcript: string,
  isFinal: boolean,
  confidence: number | undefined,
  alternates: Array<{ transcript: string; confidence?: number }> = []
) {
  const result: any[] & { isFinal?: boolean } = [
    { transcript, confidence },
    ...alternates,
  ];
  result.isFinal = isFinal;
  return { results: [result] };
}

describe('useSpeechRecognition recognition metadata integrity', () => {
  beforeEach(() => {
    FakeSpeechRecognition.latest = null;
    (window as any).SpeechRecognition = FakeSpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
  });

  it('clears stale engine metadata when an interim transcript is promoted on end', () => {
    const onResult = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onResult, enabled: true })
    );
    const recognition = FakeSpeechRecognition.latest!;

    act(() => {
      recognition.onresult?.(
        speechEvent('apple', true, 0.91, [
          { transcript: 'apply', confidence: 0.12 },
        ])
      );
    });

    expect(result.current.getLastRecognition()).toMatchObject({
      transcript: 'apple',
      confidence: 0.91,
    });

    act(() => {
      recognition.onresult?.(speechEvent('water', false, 0.44));
      recognition.onend?.();
    });

    expect(onResult).toHaveBeenLastCalledWith('water');
    expect(result.current.getLastRecognition()).toEqual({
      transcript: 'water',
      confidence: null,
      alternatives: [],
    });
  });

  it('clears recognition metadata when transcript state is reset', () => {
    const { result } = renderHook(() =>
      useSpeechRecognition({ onResult: vi.fn(), enabled: true })
    );
    const recognition = FakeSpeechRecognition.latest!;

    act(() => {
      recognition.onresult?.(speechEvent('banana', true, 0.88));
    });
    expect(result.current.getLastRecognition()).not.toBeNull();

    act(() => {
      result.current.resetTranscript();
    });

    expect(result.current.getLastRecognition()).toBeNull();
  });
});
