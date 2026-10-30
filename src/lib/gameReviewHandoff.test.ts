import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { setDeviceScope } from "./deviceStore";
import { getTodaysPracticedWords } from "./reviewQueue";
import {
  recordFixSentenceReviewTargets,
  recordTwoCluesReviewTargets,
} from "./gameReviewHandoff";
import type { TwoCluesTrialResult } from "@/hooks/useTwoCluesGame";
import type { FixSentenceTrialResult } from "@/hooks/useFixSentenceGame";

const twoClues = (overrides: Partial<TwoCluesTrialResult> = {}): TwoCluesTrialResult => ({
  puzzleId: "tc-animals-1",
  clues: ["tweets", "flies"],
  anchors: ["bird"],
  spokenWord: "bird",
  matchedWord: "bird",
  tier: "strong",
  score: 100,
  reachedAnchor: true,
  semanticSimilarity: 1,
  reactionTimeMs: 4000,
  attemptNumber: 1,
  ...overrides,
});

const fixSentence = (overrides: Partial<FixSentenceTrialResult> = {}): FixSentenceTrialResult => ({
  trialId: "fs_1",
  sentence: "I washed my hands with a pillow.",
  wrongWord: "pillow",
  spokenWord: "soap",
  matchedFix: "soap",
  isCorrect: true,
  isPartialCredit: false,
  selfCorrected: false,
  semanticSimilarity: 1,
  reactionTimeMs: 2300,
  attemptNumber: 1,
  difficulty: 1,
  phonemeTargets: ["/s/"],
  support: "open_response",
  ...overrides,
});

describe("completed-game to bounded Maya practice handoff", () => {
  beforeEach(() => {
    localStorage.clear();
    setDeviceScope("patient-one");
  });
  afterEach(() => {
    localStorage.clear();
    setDeviceScope(null);
  });

  it("queues graph-matched Two Clues answers, not an unspoken intended anchor", () => {
    expect(recordTwoCluesReviewTargets([
      twoClues({ spokenWord: "sparrow", matchedWord: "sparrow", tier: "related", reachedAnchor: false }),
      twoClues({ spokenWord: "bird", matchedWord: "bird", attemptNumber: 2 }),
    ], "lesson-1")).toBe(2);
    const words = getTodaysPracticedWords({ sessionId: "lesson-1" });
    expect(words.map((w) => w.word)).toEqual(["bird", "sparrow"]);
    expect(words.find((w) => w.word === "sparrow")).toMatchObject({
      category: "animals", responseMode: "unknown",
    });
    expect(words.find((w) => w.word === "bird")?.struggled).toBe(true);
  });

  it("excludes uncertain, creative, skipped, ASR-only and missing-match responses", () => {
    recordTwoCluesReviewTargets([
      twoClues({ tier: "uncertain", matchedWord: undefined, spokenWord: "something" }),
      twoClues({ tier: "creative", matchedWord: "butterfly", spokenWord: "butterfly" }),
      twoClues({ tier: "strong", matchedWord: "bird", spokenWord: "" }),
      twoClues({ tier: "related", matchedWord: undefined, spokenWord: "cabbage" }),
      twoClues({ tier: "strong", matchedWord: "bird...", spokenWord: "bird" }),
      twoClues({ tier: "strong", matchedWord: "cabbage", spokenWord: "cabbage" }),
      twoClues({ tier: "related", matchedWord: "bird", spokenWord: "bird" }),
      twoClues({ puzzleId: "nonexistent", matchedWord: "bird" }),
    ], "lesson-1");
    expect(getTodaysPracticedWords({ sessionId: "lesson-1" })).toEqual([]);
  });

  it("uses a real matched lexical Fix Sentence repair, not the incorrect stimulus", () => {
    recordFixSentenceReviewTargets([
      fixSentence(),
      fixSentence({ trialId: "fs_8", sentence: "She poured coffee into a shoe.",
        wrongWord: "shoe", matchedFix: "cup", spokenWord: "cup",
        support: "choice_based" }),
    ], "lesson-1");
    const words = getTodaysPracticedWords({ sessionId: "lesson-1" });
    expect(words.map((w) => w.word)).toEqual(["cup", "soap"]);
    expect(words.some((w) => w.word === "pillow" || w.word === "shoe")).toBe(false);
    expect(words.find((w) => w.word === "cup")).toMatchObject({
      category: "household", struggled: true, responseMode: "selection",
      sourceGames: ["fix_sentence"],
    });
  });

  it("does not turn grammar, two-error or unrecognized trials into naming prompts", () => {
    recordFixSentenceReviewTargets([
      fixSentence({ trialId: "fsm_1", matchedFix: "walked", spokenWord: "walked" }),
      fixSentence({ trialId: "fs2_1", matchedFix: "cup", spokenWord: "cup" }),
      fixSentence({ trialId: "unknown", matchedFix: "soap", spokenWord: "soap" }),
      fixSentence({ phaseAdvance: true }),
      fixSentence({ isCorrect: false, matchedFix: null }),
      fixSentence({ isCorrect: true, matchedFix: null }),
      fixSentence({ isCorrect: true, matchedFix: "not-a-repair" }),
    ], "lesson-1");
    expect(getTodaysPracticedWords({ sessionId: "lesson-1" })).toEqual([]);
  });

  it("retains valid short phrases for the exact contiguous-token review matcher", () => {
    recordFixSentenceReviewTargets([
      fixSentence({ trialId: "fs_5", matchedFix: "steering wheel", spokenWord: "steering wheel" }),
    ], "lesson-2");
    expect(getTodaysPracticedWords({ sessionId: "lesson-2" }).map((w) => w.word))
      .toEqual(["steering wheel"]);
  });

  it("never writes unscopeable handoffs or promotes repeated completion callbacks", () => {
    recordTwoCluesReviewTargets([twoClues()], null);
    recordFixSentenceReviewTargets([fixSentence()], undefined);
    expect(getTodaysPracticedWords()).toEqual([]);

    recordTwoCluesReviewTargets([twoClues()], "lesson-1");
    recordTwoCluesReviewTargets([twoClues()], "lesson-1");
    recordFixSentenceReviewTargets([fixSentence()], "lesson-1");
    recordFixSentenceReviewTargets([fixSentence()], "lesson-1");
    expect(getTodaysPracticedWords({ sessionId: "lesson-1" }).map((w) => w.word))
      .toEqual(["bird", "soap"]);
  });

  it("does not copy a successful response from one lesson into another", () => {
    recordTwoCluesReviewTargets([twoClues()], "lesson-A");
    recordFixSentenceReviewTargets([fixSentence()], "lesson-B");
    expect(getTodaysPracticedWords({ sessionId: "lesson-A" }).map((x) => x.word))
      .toEqual(["bird"]);
    expect(getTodaysPracticedWords({ sessionId: "lesson-B" }).map((x) => x.word))
      .toEqual(["soap"]);
  });
});
