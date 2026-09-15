/**
 * Saying the word must not make the app go quiet for 75 seconds.
 *
 * This is the regression test for the bug that the cut-off fix created.
 *
 * Removing the zero-wait fast-track was right — it ended the turn mid-sentence.
 * But the "patient silence path" it fell through to could not actually decide
 * this case. DescribeGuessGame passed `promptText: trial.target` into the
 * shared classifier, and promptSimilarity is `matchedPromptWords / promptWords`.
 * Every one of the 57 bank targets is a single word, so the moment the
 * transcript contained it the ratio was 1.0 → state 'reading' →
 * suppressAutoSubmit → decideAutoSubmit returned 'suppressed' on every tick
 * until the 75s backstop. Producing the word you were reaching for — the best
 * thing that can happen in this game — was rewarded with 75 seconds of nothing.
 *
 * The unit tests either side of this passed throughout: decideAutoSubmit was
 * correct given its inputs, and the classifier was correct given its inputs.
 * The defect lived in the wiring between them, so the test has to span both.
 */
import { describe, it, expect } from 'vitest';
import { classifySpeechState } from '@/lib/speechStateClassifier';
import { TIMING_PROFILES, getProfileMultiplier } from '@/lib/speechTimingProfiles';
import { decideAutoSubmit, DG_COVERAGE_TARGET } from '@/lib/describeGuess/autoSubmitDecision';
import { DESCRIBE_GUESS_BANK } from '@/data/describeGuessBank';

/** The real chain DescribeGuessGame's 200ms poll runs, minus React. */
function pollOnce(opts: {
  transcript: string;
  elapsedMs: number;
  silenceMs: number;
  promptText?: string;
  featureCount: number;
}) {
  const state = classifySpeechState({
    transcript: opts.transcript,
    elapsedMs: opts.elapsedMs,
    silenceDurationMs: opts.silenceMs,
    promptText: opts.promptText,
  });
  const profile = TIMING_PROFILES.discourse;
  const multiplier = getProfileMultiplier(profile, state.state, state.confidence);
  return decideAutoSubmit({
    silenceMs: opts.silenceMs,
    elapsedMs: opts.elapsedMs,
    featureCount: opts.featureCount,
    classifierThresholdMs: Math.round(profile.baseSilenceMs * multiplier),
    suppressAutoSubmit: state.suppressAutoSubmit,
  });
}

describe('a described answer that also contains the target word', () => {
  it('is taken within seconds, not held for the backstop', () => {
    const d = pollOnce({
      transcript: 'you drink your coffee out of it its a cup',
      elapsedMs: 9_000,
      silenceMs: 5_000,
      featureCount: DG_COVERAGE_TARGET, // the game credits a spoken target word
    });
    expect(d.shouldEvaluate).toBe(true);
    expect(d.reason).not.toBe('backstop');
  });

  it('is still given the full silence floor before it is taken', () => {
    const d = pollOnce({
      transcript: 'you drink your coffee out of it its a cup',
      elapsedMs: 9_000,
      silenceMs: 1_200,
      featureCount: DG_COVERAGE_TARGET,
    });
    expect(d.shouldEvaluate).toBe(false);
  });
});

describe('the classifier can no longer mistake an answer for prompt-reading', () => {
  it('does not call a single-word prompt echoed in a sentence "reading"', () => {
    for (const trial of DESCRIBE_GUESS_BANK.slice(0, 20)) {
      const state = classifySpeechState({
        transcript: `i think it is a ${trial.target} you use it every day`,
        elapsedMs: 8_000,
        silenceDurationMs: 4_000,
        promptText: trial.target,
      });
      expect(state.suppressAutoSubmit, `${trial.target} suppressed auto-submit`).toBe(false);
    }
  });

  it('does not fire on the two-word compare prompt either', () => {
    // AbstractCompare passes "wordA and wordB" — naming both is how you answer.
    const state = classifySpeechState({
      transcript: 'a cat and a dog are both animals you keep at home',
      elapsedMs: 8_000,
      silenceDurationMs: 4_000,
      promptText: 'cat and dog',
    });
    expect(state.suppressAutoSubmit).toBe(false);
  });

  it('still catches someone reading a real sentence prompt back', () => {
    // The signal is preserved where it means something: a sentence-length
    // prompt repeated verbatim is echoing, not answering.
    const sentence = 'the boy walked to the store to buy some milk';
    const state = classifySpeechState({
      transcript: sentence,
      elapsedMs: 8_000,
      silenceDurationMs: 4_000,
      promptText: sentence,
    });
    expect(state.state).toBe('reading');
    expect(state.suppressAutoSubmit).toBe(true);
  });
});

describe('the struggle signals cannot latch a turn open forever', () => {
  // The second stall, found after the 'reading' one was fixed. Two signals are
  // enough to return suppressAutoSubmit, and two of them fired on ordinary
  // speech:
  //   - the restart pattern matched any two of (the|a|i|it|wait|no) ANYWHERE,
  //     which is most English sentences
  //   - wordRate divided by elapsedMs, which keeps growing through the very
  //     silence being judged, so the measured rate fell below 30wpm and stayed
  //     there — elapsedMs only ever grows, so it could never unlatch
  // Together: a normal answer, a normal pause, and the turn ran to the 75s
  // backstop.
  const SENTENCE = 'i think it is a thing you drink out of in the kitchen';

  it('does not call a fluent sentence a restart', () => {
    const state = classifySpeechState({
      transcript: SENTENCE,
      elapsedMs: 9_000,
      silenceDurationMs: 4_000,
    });
    expect(state.suppressAutoSubmit).toBe(false);
  });

  it('still recognises an actual restart', () => {
    const state = classifySpeechState({
      transcript: 'um the the the uh thing',
      elapsedMs: 9_000,
      silenceDurationMs: 1_000,
    });
    expect(state.state).toBe('struggling');
  });

  it('measures speaking rate, so waiting longer cannot make it worse', () => {
    // Same words, same speaking time — only the pause grows. A judgement that
    // gets more pessimistic the longer it waits can never resolve.
    const at = (silence: number) =>
      classifySpeechState({
        transcript: SENTENCE,
        elapsedMs: 6_000 + silence,
        silenceDurationMs: silence,
      }).suppressAutoSubmit;

    for (const silence of [1_000, 5_000, 20_000, 60_000]) {
      expect(at(silence), `suppressed after ${silence}ms of silence`).toBe(false);
    }
  });

  it('ends the turn instead of running to the backstop', () => {
    const d = pollOnce({
      transcript: SENTENCE,
      elapsedMs: 13_000,
      silenceMs: 7_000,
      featureCount: 1,
    });
    expect(d.shouldEvaluate).toBe(true);
    expect(d.reason).not.toBe('backstop');
  });
});
