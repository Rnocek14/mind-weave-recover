import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_MAYA_TURNS,
  MAX_REVIEW_ITEMS,
  __ALL_LINE_POOLS,
  onFinishRequest,
  onRepairAnswer,
  onSelfReportedAttempt,
  onSilence,
  onSkipTopic,
  onUserUtterance,
  startReview,
  summarize,
  violatesOneQuestionRule,
} from "./reviewConversation";

const apple = { word: "apple", category: "food", struggled: true };
const cup = { word: "cup", category: "household", struggled: false };

describe("post-practice review: bounded, evidence-honest dialogue", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0));
  afterEach(() => vi.restoreAllMocks());

  it("never presents the same practiced target twice, including case variants", () => {
    const start = startReview([
      { ...apple, word: "Apple " },
      apple,
      cup,
      { word: "garden", category: "nature", struggled: false },
    ]);
    expect(start.state.items.map((item) => item.word)).toEqual(["apple", "cup", "garden"]);
    expect(start.state.items.length).toBeLessThanOrEqual(MAX_REVIEW_ITEMS);
  });

  it("only claims practice happened, not that a patient successfully named a word", () => {
    const first = startReview([apple]);
    expect(first.mayaLine).not.toMatch(/you (said|named) (the )?apple/i);
    expect(first.mayaLine).toContain("We practiced apple");
  });

  it("keeps every authored Maya template to at most one question", () => {
    for (const line of __ALL_LINE_POOLS.flat()) {
      expect(violatesOneQuestionRule(line), line).toBe(false);
    }
  });

  it("finishes even if the patient says nothing, never trapping them in a loop", () => {
    let turn = startReview([
      apple, cup,
      { word: "garden", category: "nature", struggled: true },
      { word: "shirt", category: "clothing", struggled: false },
    ]);
    for (let n = 0; n < 40 && turn.state.phase !== "done"; n += 1) {
      turn = onSilence(turn.state);
    }
    expect(turn.state.phase).toBe("done");
    expect(turn.state.mayaTurns).toBeLessThanOrEqual(MAX_MAYA_TURNS);
    expect(summarize(turn.state).released).toBe(4);
  });

  it("ignores duplicate ASR finals instead of making another cue or scoring it again", () => {
    const start = startReview([apple]);
    const first = onUserUtterance(start.state, "that other one");
    const count = first.state.mayaTurns;
    const duplicate = onUserUtterance(first.state, "that other one");
    expect(duplicate.mayaLine).toBe("");
    expect(duplicate.events).toEqual([]);
    expect(duplicate.state.mayaTurns).toBe(count);
  });

  it("does not confuse a substring such as carpet with the target car", () => {
    const start = startReview([{ word: "car", category: "transportation", struggled: true }]);
    const reply = onUserUtterance(start.state, "that carpet is red");
    expect(reply.events.some((e) => e.type === "elicited_use" || e.type === "spontaneous_use")).toBe(false);
    expect(reply.state.items[0].status).toBe("pending");
  });

  it("waits for an explicit confirmation of low-confidence ASR and rejects repeated finals", () => {
    const start = startReview([apple]);
    const uncertain = onUserUtterance(start.state, "apple", [], 0.3);
    expect(uncertain.state.phase).toBe("repair");
    expect(uncertain.events).toContainEqual({ type: "repair_started", word: "apple" });

    const duplicate = onUserUtterance(uncertain.state, "apple", [], 0.3);
    expect(duplicate.state.phase).toBe("repair");
    expect(duplicate.events).toEqual([]);
    expect(duplicate.mayaLine).toBe("");

    const verified = onUserUtterance(duplicate.state, "yes");
    expect(verified.events).toContainEqual({ type: "repair_confirmed", word: "apple" });
    expect(verified.state.phase).toBe("done");
  });

  it("accepts deliberate clear word repetition as an aphasia repair", () => {
    const start = startReview([apple]);
    const uncertain = onUserUtterance(start.state, "apple", [], 0.2);
    expect(uncertain.state.phase).toBe("repair");
    const spokenAgain = onUserUtterance(uncertain.state, "apple", [], 0.92);
    expect(spokenAgain.events).toContainEqual({ type: "repair_confirmed", word: "apple" });
    expect(spokenAgain.events).toContainEqual({ type: "elicited_use", word: "apple" });
    expect(spokenAgain.state.phase).toBe("done");
  });

  it("asks for verification when the recognizer has no confidence score", () => {
    const start = startReview([apple]);
    // Interim-final recovery may produce a transcript without confidence.
    // Unknown quality must never be silently treated as confident retrieval.
    const uncertain = onUserUtterance(start.state, "apple", [], null);
    expect(uncertain.state.phase).toBe("repair");
    expect(uncertain.events).toContainEqual({ type: "repair_started", word: "apple" });
    expect(uncertain.events.some((e) => e.type === "elicited_use")).toBe(false);
  });

  it("does not count a word as independent if the patient needed a cue before ASR repair", () => {
    const start = startReview([apple]);
    const cued = onUserUtterance(start.state, "the thing I want");
    expect(cued.state.cueGivenForActive).toBe(true);
    const uncertain = onUserUtterance(cued.state, "apple", [], 0.2);
    expect(uncertain.state.phase).toBe("repair");
    const confirmed = onRepairAnswer(uncertain.state, true);
    expect(confirmed.events).toContainEqual({ type: "cued_use", word: "apple" });
    expect(confirmed.events.some((e) => e.type === "elicited_use")).toBe(false);
    expect(summarize(confirmed.state).cued).toBe(1);
  });

  it("retains a rejected speech-recognition repair as an explicit audit event", () => {
    const start = startReview([apple]);
    const uncertain = onUserUtterance(start.state, "apple", [], 0.1);
    const rejected = onRepairAnswer(uncertain.state, false);
    expect(rejected.events).toContainEqual({ type: "repair_rejected", word: "apple" });
    expect(summarize(rejected.state).elicited).toBe(0);
  });

  it("records microphone-unavailable self-report as unverified, never spoken success", () => {
    const start = startReview([apple]);
    const attempted = onSelfReportedAttempt(start.state);
    expect(attempted.events).toContainEqual({ type: "self_reported_attempt", word: "apple" });
    expect(summarize(attempted.state)).toEqual({
      spontaneous: 0, elicited: 0, cued: 0, released: 0, unverified: 1, total: 1,
    });
    expect(attempted.events.some((e) => ["cued_use", "elicited_use", "spontaneous_use"].includes(e.type))).toBe(false);
  });

  it("switches to low-demand choices for minimal replies and still finishes", () => {
    const start = startReview([apple, cup]);
    const yes = onUserUtterance(start.state, "yes");
    const no = onUserUtterance(yes.state, "no");
    expect(no.state.lowDemandMode).toBe(true);
    expect(no.mayaLine).toMatch(/cup or /i);
    let turn = no;
    for (let n = 0; n < 10 && turn.state.phase !== "done"; n += 1) {
      turn = onSilence(turn.state);
    }
    expect(turn.state.phase).toBe("done");
    expect(turn.state.mayaTurns).toBeLessThanOrEqual(MAX_MAYA_TURNS);
  });

  it("honors immediate stop and skip without continuing to ask questions", () => {
    const start = startReview([apple, cup]);
    const skipped = onSkipTopic(start.state);
    expect(skipped.events).toContainEqual({ type: "item_released", word: "apple" });
    const finished = onFinishRequest(skipped.state);
    expect(finished.state.phase).toBe("done");
    expect(onUserUtterance(finished.state, "cup").events).toEqual([]);
  });

  it("ends safely even with an empty practice queue", () => {
    const start = startReview([]);
    expect(start.state.phase).toBe("done");
    expect(summarize(start.state).total).toBe(0);
  });
});
