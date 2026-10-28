import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { LiveAnalysisProvider, useLiveAnalysis } from './LiveAnalysisContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <LiveAnalysisProvider>{children}</LiveAnalysisProvider>
);

describe('live speech metrics belong to the current attempt', () => {
  it('clears the previous transcript, analysis and scores when another attempt starts', () => {
    const { result } = renderHook(useLiveAnalysis, { wrapper });
    act(() => result.current.setLiveSnapshot({
      attemptId: 'apple-attempt', targetWord: 'apple', transcript: 'apple',
      pronunciationScore: 92, accuracyScore: 93, fluencyScore: 80,
      completenessScore: 100, prosodyScore: 75, asrConfidence: 0.95,
      errorType: 'correct', reasoning: 'Previous result', latencyMs: 1200,
      encouragementScore: 80, effortfulSpeech: true, currentDomain: 'lexical_retrieval',
    }));
    act(() => result.current.setLiveSnapshot({ attemptId: 'cup-attempt', targetWord: 'cup' }));
    expect(result.current.snapshot).toMatchObject({
      attemptId: 'cup-attempt', targetWord: 'cup', currentDomain: 'lexical_retrieval',
    });
    for (const field of ['transcript', 'pronunciationScore', 'accuracyScore', 'fluencyScore',
      'completenessScore', 'prosodyScore', 'asrConfidence', 'errorType', 'reasoning',
      'latencyMs', 'encouragementScore', 'effortfulSpeech'] as const) {
      expect(result.current.snapshot[field], field).toBeUndefined();
    }
  });

  it('accepts a real zero for the current attempt and rejects a late previous result', () => {
    const { result } = renderHook(useLiveAnalysis, { wrapper });
    act(() => result.current.setLiveSnapshot({ attemptId: 'old', targetWord: 'apple' }));
    act(() => result.current.setLiveSnapshot({ attemptId: 'new', targetWord: 'cup' }));
    act(() => result.current.setLiveSnapshot({ accuracyScore: 0, asrConfidence: 0 }, 'new'));
    act(() => result.current.setLiveSnapshot({ accuracyScore: 99, transcript: 'apple' }, 'old'));
    expect(result.current.snapshot.accuracyScore).toBe(0);
    expect(result.current.snapshot.asrConfidence).toBe(0);
    expect(result.current.snapshot.transcript).toBeUndefined();
    expect(result.current.snapshot.targetWord).toBe('cup');
  });

  it('does not restore a cleared session from an in-flight response', () => {
    const { result } = renderHook(useLiveAnalysis, { wrapper });
    act(() => result.current.setLiveSnapshot({ attemptId: 'finished', targetWord: 'apple' }));
    act(() => result.current.clearLiveAnalysis());
    act(() => result.current.setLiveSnapshot({ pronunciationScore: 90 }, 'finished'));
    expect(result.current.snapshot).toEqual({});
  });
});
