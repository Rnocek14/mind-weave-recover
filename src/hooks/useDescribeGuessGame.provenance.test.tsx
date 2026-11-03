import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useGameSounds', () => ({
  useGameSounds: () => ({ playSuccess: vi.fn() }),
}));

import { useDescribeGuessGame } from './useDescribeGuessGame';
import { getDescribeGuessTrainingStage } from '@/lib/describeGuess/trainingStages';

const guess = {
  guessed: true,
  confidence: 0.82,
  bestWord: null,
  bestSimilarity: 0.8,
  top3Avg: 0.8,
  featureCount: 2,
  rulesPassed: ['meaning', 'features'],
};

describe('useDescribeGuessGame original result provenance', () => {
  it('never fabricates speech transcription from a typed description', async () => {
    const onTrialComplete = vi.fn();
    const { result } = renderHook(() => useDescribeGuessGame({
      trialCount: 1, difficulty: 1, onTrialComplete,
    }));
    expect(result.current.currentTrial).toBeTruthy();

    let output: ReturnType<typeof result.current.finalizeTrial> | undefined = undefined;
    await act(async () => {
      output = result.current.finalizeTrial(
        'you put a drink in this and hold it',
        guess,
        false,
        false,
        'typed',
      );
      await Promise.resolve();
    });

    expect(output).toMatchObject({
      inputMode: 'typed',
      browserTranscript: null,
      meaningWin: true,
    });
    expect(onTrialComplete).toHaveBeenCalledWith(
      expect.objectContaining({ inputMode: 'typed', browserTranscript: null }),
    );
  });

  it('retains actual recognized speech provenance when the source is spoken', async () => {
    const { result } = renderHook(() => useDescribeGuessGame({
      trialCount: 1, difficulty: 1,
    }));
    let output: ReturnType<typeof result.current.finalizeTrial> | undefined = undefined;
    act(() => {
      output = result.current.finalizeTrial(
        'this is something to hold your drink',
        guess, false, false, 'spoken',
      );
    });
    expect(output).toMatchObject({
      inputMode: 'spoken',
      browserTranscript: 'this is something to hold your drink',
    });
  });

  it('records actual Stage 4 described features from the selected photo, without mislabeling a typed answer as speech', async () => {
    const onTrialComplete=vi.fn();
    const {result}=renderHook(()=>useDescribeGuessGame({
      trialCount:1,trainingStage:getDescribeGuessTrainingStage(4),onTrialComplete,
    }));
    const trial=result.current.currentTrial!;
    const description=[
      trial.featureKeywords.function?.[0],trial.featureKeywords.location?.[0],
    ].filter(Boolean).join(' ');
    let output: ReturnType<typeof result.current.finalizeTrial>|undefined;
    await act(async()=>{
      result.current.recordPracticeHelpReveal();
      output=result.current.finalizeTrial(description,guess,false,false,'typed');
      // Production schedules onTrialComplete in queueMicrotask.
      // Flush that microtask, not just the synchronous result creation.
      await Promise.resolve();
    });
    expect(output).toMatchObject({
      inputMode:'typed',browserTranscript:null,practiceStage:4,
      practiceGoalObserved:true,practiceMissingFeatures:[],
      practiceHelpRevealed:true,
    });
    expect(onTrialComplete).toHaveBeenCalledWith(expect.objectContaining({
      practiceStage:4,practiceGoalObserved:true,
    }));
  });

  it('does not award Stage 7 describing-goal credit when the patient says the target name',()=>{
    const {result}=renderHook(()=>useDescribeGuessGame({
      trialCount:1,trainingStage:getDescribeGuessTrainingStage(7),
    }));
    const trial=result.current.currentTrial!;
    const description=[
      trial.featureKeywords.function?.[0],
      trial.featureKeywords.location?.[0],
      trial.featureKeywords.category?.[0],
      trial.target,
    ].filter(Boolean).join(' ');
    let output:ReturnType<typeof result.current.finalizeTrial>|undefined;
    act(()=>{output=result.current.finalizeTrial(description,guess,false,false,'spoken');});
    expect(output).toMatchObject({
      practiceStage:7,practiceTargetNamed:true,practiceGoalObserved:false,
      inputMode:'spoken',browserTranscript:description,
    });
  });

  it('defaults missing source tags to unknown, never independent spoken truth', () => {
    const { result } = renderHook(() => useDescribeGuessGame({
      trialCount: 1, difficulty: 1,
    }));
    let output: ReturnType<typeof result.current.finalizeTrial> | undefined = undefined;
    act(() => {
      output = result.current.finalizeTrial('you drink from it', guess, false);
    });
    expect(output).toMatchObject({
      inputMode: 'unknown',
      browserTranscript: null,
    });
  });
});
