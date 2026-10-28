import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { LiveAnalysisProvider, useLiveAnalysis } from '@/contexts/LiveAnalysisContext';
import { toUtteranceAnalysis } from '@/types/utteranceAnalysis';
import { photoNamingLiveSnapshot } from './photoNamingLiveSnapshot';

const wrapper = ({ children }: { children: ReactNode }) => <LiveAnalysisProvider>{children}</LiveAnalysisProvider>;
const completed = () => ({
  attemptId: 'apple-attempt', trialIndex: 1, browserTranscript: 'apple',
  utteranceAnalysis: toUtteranceAnalysis('apple', {
    errorType: 'correct', confidence: 0.9, phonological_similarity: 1, semantic_similarity: 1,
  }, 100, undefined, 0.94),
});

describe('the Photo Naming page merges only measurements it owns', () => {
  it('preserves real pronunciation scores when the same-attempt page write completes later', () => {
    const { result } = renderHook(useLiveAnalysis, { wrapper });
    act(() => result.current.setLiveSnapshot({ attemptId: 'apple-attempt', targetWord: 'apple', trialIndex: 1 }));
    // The game can publish PA results while the page awaits submitTrial.
    act(() => result.current.setLiveSnapshot({
      pronunciationScore: 84, accuracyScore: 87, fluencyScore: 0, completenessScore: 100, prosodyScore: undefined,
    }, 'apple-attempt'));
    const callback = completed();
    act(() => result.current.setLiveSnapshot(photoNamingLiveSnapshot(callback, 'apple'), callback.attemptId));
    expect(result.current.snapshot).toMatchObject({
      pronunciationScore: 84, accuracyScore: 87, fluencyScore: 0, completenessScore: 100,
      transcript: 'apple', asrConfidence: 0.94,
    });
    expect(result.current.snapshot.prosodyScore).toBeUndefined();
  });

  it('uses the completed trial identity rather than the disabled or stale pivot counter', () => {
    const { result } = renderHook(useLiveAnalysis, { wrapper });
    act(() => result.current.setLiveSnapshot({ attemptId: 'apple-attempt', trialIndex: 1 }));
    const callback = completed();
    act(() => result.current.setLiveSnapshot(photoNamingLiveSnapshot(callback, 'apple'), callback.attemptId));
    expect(result.current.snapshot.trialIndex).toBe(1);
  });

  it('rejects the previous page callback after another attempt begins', () => {
    const { result } = renderHook(useLiveAnalysis, { wrapper });
    act(() => result.current.setLiveSnapshot({ attemptId: 'cup-attempt', targetWord: 'cup', trialIndex: 2 }));
    const callback = completed();
    act(() => result.current.setLiveSnapshot(photoNamingLiveSnapshot(callback, 'apple'), callback.attemptId));
    expect(result.current.snapshot).toMatchObject({ attemptId: 'cup-attempt', targetWord: 'cup', trialIndex: 2 });
    expect(result.current.snapshot.transcript).toBeUndefined();
  });

  it('preserves an observed empty transcript and never substitutes the target', () => {
    expect(photoNamingLiveSnapshot({ whisperTranscript: '', browserTranscript: 'apple', trialIndex: 1 }, 'apple').transcript).toBe('');
    expect(photoNamingLiveSnapshot({ trialIndex: 1 }, 'apple').transcript).toBeUndefined();
  });
});
