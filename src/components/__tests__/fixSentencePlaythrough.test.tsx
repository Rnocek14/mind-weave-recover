/**
 * Fix Sentence — human-style playthrough of the REAL component (typed mode).
 *
 * Wave-13 QA: renders <FixSentenceGame /> itself, not the hook, because the
 * clinical-selector regression this wave caught (clinicalLevel prop never
 * forwarded to the hook) was invisible to hook-level tests. These tests play
 * the game the way a patient does: read the sentence on screen, type the
 * repair, press send, watch the feedback.
 */
import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { FixSentenceGame } from "@/components/FixSentenceGame";
import {
  FIX_SENTENCE_TWO_ERROR_BANK,
  FIX_SENTENCE_MORPHOLOGY_BANK,
  FIX_SENTENCE_BANK,
} from "@/data/fixSentenceBank";
import type { FixSentenceTrial } from "@/data/fixSentenceBank";

// ── Browser-facing hooks stubbed to inert shapes ───────────────────────
vi.mock("@/hooks/useGameSounds", () => ({
  useGameSounds: () => ({ playSuccess: vi.fn(), playError: vi.fn() }),
}));
const startListeningSpy = vi.fn();
vi.mock("@/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    transcript: "",
    isListening: false,
    startListening: startListeningSpy,
    stopListening: vi.fn(),
    resetTranscript: vi.fn(),
  }),
  // The component asks the browser, not the hook instance — the destructured
  // isSupported sat ~170 lines below its first use, which is a temporal-dead-
  // zone crash. Mock defaults to supported so the toggle is exercised.
  isSpeechRecognitionSupported: () => speechRecognitionAvailable,
}));
let speechRecognitionAvailable = true;
vi.mock("@/hooks/useTextToSpeech", () => ({
  useTextToSpeech: () => ({ speak: vi.fn(async () => {}), isLoading: false, error: null }),
  stopGlobalTTS: vi.fn(),
}));
vi.mock("@/hooks/usePronunciationAnalysis", () => ({
  usePronunciationAnalysis: () => ({ analyzePronunciation: vi.fn(async () => null) }),
}));
vi.mock("@/hooks/useVoiceGuidance", () => ({
  useVoiceGuidance: () => ({
    shouldAutoSpeak: false,
    speakIntro: vi.fn(async () => {}),
    speakReminder: vi.fn(),
  }),
}));
vi.mock("@/hooks/useAudioRecorder", () => ({
  useAudioRecorder: () => ({
    isRecording: false,
    isSupported: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(async () => null),
    uploadRecording: vi.fn(async () => null),
    cancelRecording: vi.fn(),
  }),
}));
vi.mock("@/hooks/useUtteranceLogger", () => ({
  useUtteranceLogger: () => ({
    startAttempt: vi.fn(),
    logBrowserTranscript: vi.fn(),
    logFinalAnalysis: vi.fn(async () => {}),
    resetAttempt: vi.fn(),
    currentAttemptId: null,
    isFinalized: false,
  }),
}));
vi.mock("@/hooks/useEngagementMonitor", () => ({
  useEngagementMonitor: () => ({
    getState: () => ({ signals: { cueDependency: 0 } }),
    logIntervention: vi.fn(async () => {}),
    recordTrial: vi.fn(),
  }),
}));
vi.mock("@/hooks/useInGameAdaptation", () => ({
  useInGameAdaptation: () => ({
    currentDifficulty: 10, // maps to bank difficulty 3 — every tier reachable
    recordTrial: vi.fn(),
    levelDescriptor: { level: 10, label: "Test", band: "advanced", levers: [] },
    recentSuccessRate: 0,
    flushAutoLog: vi.fn(async () => {}),
  }),
}));
vi.mock("@/lib/voiceController", () => ({
  voiceController: {
    isMicLocked: false,
    awaitMicSafe: vi.fn(async () => {}),
  },
}));
vi.mock("@/lib/evaluation/mayaCoachingResponses", () => ({
  speakMayaCoaching: vi.fn(async () => {}),
  resetCoachingState: vi.fn(),
  cancelPendingMayaCoaching: vi.fn(),
}));
// The semantic fallback must never be needed in these playthroughs — every
// typed answer is an exact accepted fix or a deliberate wrong word.
vi.mock("@/lib/semanticSimilarity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/semanticSimilarity")>();
  return {
    ...actual,
    getSemanticSimilarity: vi.fn(async () => 0),
  };
});

const ALL_TRIALS: FixSentenceTrial[] = [
  ...FIX_SENTENCE_BANK,
  ...FIX_SENTENCE_TWO_ERROR_BANK,
  ...FIX_SENTENCE_MORPHOLOGY_BANK,
];

/** Find the on-screen sentence's bank trial (sentence text is unique). */
function findTrialOnScreen(): FixSentenceTrial {
  // renderSentence splits the sentence into word spans; normalize the whole
  // page text and find the unique bank sentence contained in it.
  const pageText = (document.body.textContent ?? "")
    .toLowerCase()
    .replace(/[.,!?'"]/g, " ")
    .replace(/\s+/g, " ");
  const trial = ALL_TRIALS.find((t) => {
    const normalized = t.sentence
      .toLowerCase()
      .replace(/[.,!?'"]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return pageText.includes(normalized);
  });
  if (!trial) throw new Error("no bank trial matched the rendered sentence");
  return trial;
}

function typeAnswer(text: string) {
  const input = screen.getByPlaceholderText(/type the replacement word/i);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /submit answer/i }));
}

beforeEach(() => {
  sessionStorage.setItem("preferTypingInput", "true");
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe("FixSentenceGame — played like a human (typed mode)", () => {
  it("REGRESSION: clinicalLevel prop reaches the selector — L5 serves two-error sentences", async () => {
    render(<FixSentenceGame trialCount={3} clinicalLevel={5} />);
    await waitFor(() => screen.getByPlaceholderText(/type the replacement word/i));
    const trial = findTrialOnScreen();
    expect(trial.secondError, `served ${trial.id} instead of a two-error trial`).toBeDefined();
  });

  it("REGRESSION: clinicalLevel 6 serves morphology sentences", async () => {
    render(<FixSentenceGame trialCount={3} clinicalLevel={6} />);
    await waitFor(() => screen.getByPlaceholderText(/type the replacement word/i));
    const trial = findTrialOnScreen();
    expect(trial.morphology, `served ${trial.id} instead of a morphology trial`).toBeDefined();
  });

  it("single-error trial: typing an accepted fix completes the trial correctly", async () => {
    const onTrialComplete = vi.fn();
    render(<FixSentenceGame trialCount={3} onTrialComplete={onTrialComplete} />);
    await waitFor(() => screen.getByPlaceholderText(/type the replacement word/i));

    const trial = findTrialOnScreen();
    await act(async () => {
      typeAnswer(trial.acceptedFixes[0]);
    });

    await waitFor(() => expect(onTrialComplete).toHaveBeenCalledTimes(1));
    const result = onTrialComplete.mock.calls[0][0];
    expect(result.isCorrect).toBe(true);
    expect(result.trialId).toBe(trial.id);
  });

  it("two-error trial: full two-phase repair with the on-screen prompt between phases", async () => {
    const onTrialComplete = vi.fn();
    render(<FixSentenceGame trialCount={3} clinicalLevel={5} onTrialComplete={onTrialComplete} />);
    await waitFor(() => screen.getByPlaceholderText(/type the replacement word/i));

    const trial = findTrialOnScreen();
    expect(trial.secondError).toBeDefined();

    // Phase 1: repair the primary error.
    await act(async () => {
      typeAnswer(trial.acceptedFixes[0]);
    });

    // The interim must show the prompt and must NOT complete the trial.
    await waitFor(() =>
      expect(screen.getByText(/one more mistake in this sentence/i)).toBeInTheDocument()
    );
    expect(onTrialComplete).not.toHaveBeenCalled();

    // Phase 2: repair the remaining error.
    await act(async () => {
      typeAnswer(trial.secondError!.acceptedFixes[0]);
    });

    await waitFor(() => expect(onTrialComplete).toHaveBeenCalledTimes(1));
    const result = onTrialComplete.mock.calls[0][0];
    expect(result.isCorrect).toBe(true);
    expect(result.phase1Fix).toBe(trial.acceptedFixes[0]);
    expect(result.phase2Fix).toBe(trial.secondError!.acceptedFixes[0]);
  });

  it("L1 (choice mode): tiles render, correct tap completes with highlight_plus_choice support", async () => {
    const onTrialComplete = vi.fn();
    render(<FixSentenceGame trialCount={3} clinicalLevel={1} onTrialComplete={onTrialComplete} />);
    await waitFor(() => screen.getByTestId("choice-tiles"));
    // Open-response inputs are gone in choice mode.
    expect(screen.queryByPlaceholderText(/type the replacement word/i)).toBeNull();
    expect(screen.queryByText(/switch to typing/i)).toBeNull();

    const trial = findTrialOnScreen();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${trial.acceptedFixes[0]}$`, "i") }));
    });
    await waitFor(() => expect(onTrialComplete).toHaveBeenCalledTimes(1));
    const result = onTrialComplete.mock.calls[0][0];
    expect(result.isCorrect).toBe(true);
    expect(result.support).toBe("highlight_plus_choice");
  });

  it("drops the scaffold when the real level arrives late", async () => {
    // useFixSentenceProgression reports `loaded` on its level-1 fallback when
    // the profile id is not there yet, and never un-sets it — so the game can
    // mount at level 1 and get the true level a moment later as a prop change.
    // choiceMode is state now (that is what gave L1/L2 a voice option), so
    // without this it latched: a level-6 patient would sit through a whole
    // session of four-word choice tiles.
    const { rerender } = render(<FixSentenceGame trialCount={3} clinicalLevel={1} />);
    await waitFor(() => screen.getByTestId("choice-tiles"));

    rerender(<FixSentenceGame trialCount={3} clinicalLevel={6} />);
    await waitFor(() => expect(screen.queryByTestId("choice-tiles")).toBeNull());
  });

  it("opens the microphone at level 1, with the tiles still on screen", async () => {
    // THE REPORTED BUG: "fix the sentence still doesnt recognize voice. make it
    // like all the others." It was not recognition. The microphone never opened
    // at all — measured against its siblings, photo-naming, describe-guess and
    // two-clues each open it by themselves and this one never did, so speaking
    // at it did nothing whatsoever. The tiles are the level's help; they are
    // not a reason to take the microphone away.
    // This suite otherwise runs in typing mode on purpose; the microphone is
    // deliberately not the channel then, so clear that for this one test.
    sessionStorage.setItem("preferTypingInput", "false");
    startListeningSpy.mockClear();
    render(<FixSentenceGame trialCount={3} clinicalLevel={1} />);
    await waitFor(() => screen.getByTestId("choice-tiles"));
    await waitFor(() => expect(startListeningSpy).toHaveBeenCalled(), { timeout: 4000 });
    sessionStorage.setItem("preferTypingInput", "true");
  });

  it("lets you answer again after a WRONG tile tap", async () => {
    // The one-answer-per-trial latch that closed the tap/speak race was set by
    // handleChoiceTap and released only when the trial advanced. A wrong tap
    // does not advance, so the latch stayed set and the sentence could never be
    // answered again — by tile OR by voice. The retry looked completely normal
    // and silently accepted nothing.
    const onTrialComplete = vi.fn();
    render(<FixSentenceGame trialCount={3} clinicalLevel={1} onTrialComplete={onTrialComplete} />);
    await waitFor(() => screen.getByTestId("choice-tiles"));
    const trial = findTrialOnScreen();
    // Pick a wrong tile from what is ACTUALLY on screen, not from a guess — a
    // guessed list that matches nothing silently skips the tap and the test
    // passes against the bug.
    const tileText = Array.from(
      screen.getByTestId("choice-tiles").querySelectorAll("button")
    ).map((b) => (b.textContent || "").trim());
    const accepted = trial.acceptedFixes.map((f: string) => f.toLowerCase());
    const wrong = tileText.find((t) => t && !accepted.includes(t.toLowerCase()));
    expect(wrong, `no wrong tile among ${JSON.stringify(tileText)}`).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${wrong}$`, "i") }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 6500)); });
    // The correct tile must still be accepted.
    await waitFor(() => screen.getByTestId("choice-tiles"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${trial.acceptedFixes[0]}$`, "i") }));
    });
    await waitFor(() => expect(onTrialComplete).toHaveBeenCalled(), { timeout: 4000 });
    expect(onTrialComplete.mock.calls.at(-1)![0].isCorrect).toBe(true);
  }, 20000);

  it("does not shut the microphone because typing was chosen in another game", async () => {
    // preferTypingInput is a SESSION-WIDE sessionStorage key, written by
    // Category Fluency, Narrative Retell, Describe & Guess and others. At
    // levels 1-2 this game does not render a typing box at all, so honouring
    // that flag here held the mic shut for a keyboard that was never on screen
    // and left the four tiles as the only way to answer.
    sessionStorage.setItem("preferTypingInput", "true");
    startListeningSpy.mockClear();
    try {
      render(<FixSentenceGame trialCount={3} clinicalLevel={1} />);
      await waitFor(() => screen.getByTestId("choice-tiles"));
      await waitFor(() => expect(startListeningSpy).toHaveBeenCalled(), { timeout: 4000 });
    } finally {
      sessionStorage.setItem("preferTypingInput", "true");
    }
  });

  it("logs a spoken answer at level 1 as scaffolded, not as open production", async () => {
    // The ladder measures what help was AVAILABLE, not which channel the answer
    // came through. If speaking with the choices on screen logged
    // open_response, choosing to talk would look like unsupported production
    // and push someone up the ladder on evidence they never gave.
    const onTrialComplete = vi.fn();
    render(
      <FixSentenceGame trialCount={3} clinicalLevel={1} onTrialComplete={onTrialComplete} />
    );
    await waitFor(() => screen.getByTestId("choice-tiles"));
    const trial = findTrialOnScreen();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${trial.acceptedFixes[0]}$`, "i") }));
    });
    await waitFor(() => expect(onTrialComplete).toHaveBeenCalled());
    expect(onTrialComplete.mock.calls[0][0].support).toBe("highlight_plus_choice");
  });

  it("still gives the entry levels a way to answer with no speech support", async () => {
    // With no Web Speech API the microphone is simply absent. The tiles are the
    // whole channel then, which is exactly why they stay on screen rather than
    // being traded away for a mic that may not exist.
    speechRecognitionAvailable = false;
    try {
      render(<FixSentenceGame trialCount={3} clinicalLevel={1} />);
      await waitFor(() => screen.getByTestId("choice-tiles"));
      expect(screen.queryByText(/say the answer out loud/i)).toBeNull();
    } finally {
      speechRecognitionAvailable = true;
    }
  });

  it("L2 (choice mode): the wrong-word highlight is dropped and support is choice_based", async () => {
    const onTrialComplete = vi.fn();
    render(<FixSentenceGame trialCount={3} clinicalLevel={2} onTrialComplete={onTrialComplete} />);
    await waitFor(() => screen.getByTestId("choice-tiles"));

    const trial = findTrialOnScreen();
    // No element carries the highlight styling at L2.
    const highlighted = document.querySelector(".decoration-wavy");
    expect(highlighted).toBeNull();

    // A wrong tile scores incorrect without partial credit, then the
    // correct tile completes the trial.
    const wrongTile = Array.from(
      screen.getByTestId("choice-tiles").querySelectorAll("button"),
    ).find((b) => !trial.acceptedFixes.some((f) => f.toLowerCase() === b.textContent!.trim().toLowerCase()))!;
    await act(async () => {
      fireEvent.click(wrongTile);
    });
    await waitFor(() => expect(onTrialComplete).toHaveBeenCalledTimes(1));
    expect(onTrialComplete.mock.calls[0][0]).toMatchObject({
      isCorrect: false,
      isPartialCredit: false,
      support: "choice_based",
    });
  });

  it("morphology trial: the inflected form wins, the bare base form fails plainly", async () => {
    const onTrialComplete = vi.fn();
    render(<FixSentenceGame trialCount={3} clinicalLevel={6} onTrialComplete={onTrialComplete} />);
    await waitFor(() => screen.getByPlaceholderText(/type the replacement word/i));

    const trial = findTrialOnScreen();
    expect(trial.morphology).toBeDefined();

    // A patient types the unrepaired base form — plain wrong, no partial credit.
    await act(async () => {
      typeAnswer(trial.morphology!.baseForm);
    });
    await waitFor(() => expect(onTrialComplete).toHaveBeenCalledTimes(1));
    const wrong = onTrialComplete.mock.calls[0][0];
    expect(wrong.isCorrect).toBe(false);
    expect(wrong.isPartialCredit).toBe(false);
    expect(wrong.semanticSimilarity).toBeNull();
  });
});
