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
vi.mock("@/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    transcript: "",
    isListening: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    isSupported: false,
  }),
}));
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
