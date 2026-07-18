import { describe, it, expect } from "vitest";
import {
  startReview,
  onUserUtterance,
  onRepairAnswer,
  onSkipTopic,
  onFinishRequest,
  onSilence,
  detectPendingWord,
  violatesOneQuestionRule,
  __ALL_LINE_POOLS,
  MAX_MAYA_TURNS,
  MAX_REVIEW_ITEMS,
  type ReviewState,
} from "@/lib/reviewConversation";

const PRACTICED = [
  { word: "garden", category: "nature", struggled: true },
  { word: "spoon", category: "household", struggled: false },
  { word: "jacket", category: "clothing", struggled: false },
];

function fresh() {
  return startReview(PRACTICED);
}

describe("authored line discipline", () => {
  it("every line in every pool asks at most one question", () => {
    for (const pool of __ALL_LINE_POOLS) {
      for (const line of pool) {
        expect(violatesOneQuestionRule(line), `multi-question line: "${line}"`).toBe(false);
      }
    }
  });

  it("every line is short (aphasia-friendly, under 90 chars pre-fill)", () => {
    for (const pool of __ALL_LINE_POOLS) {
      for (const line of pool) {
        expect(line.length, `too long: "${line}"`).toBeLessThanOrEqual(90);
      }
    }
  });
});

describe("startReview", () => {
  it("greets and opens the first frame, struggled words first", () => {
    const { state, mayaLine } = fresh();
    expect(state.phase).toBe("frame");
    expect(state.items[0].word).toBe("garden"); // struggled → first
    expect(mayaLine.toLowerCase()).toContain("garden");
  });

  it("caps items at MAX_REVIEW_ITEMS", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      word: `word${i}`,
      category: "generic",
      struggled: false,
    }));
    const { state } = startReview(many);
    expect(state.items.length).toBe(MAX_REVIEW_ITEMS);
  });
});

describe("elicited and spontaneous use", () => {
  it("scores the active word as elicited and moves to the next frame", () => {
    const t1 = fresh();
    const t2 = onUserUtterance(t1.state, "yes i love my garden", [], 0.9);
    expect(t2.events.some((e) => e.type === "elicited_use" && e.word === "garden")).toBe(true);
    expect(t2.state.items[0].status).toBe("elicited");
    // moved forward to the next item's frame
    expect(t2.mayaLine.toLowerCase()).toContain("spoon");
  });

  it("scores a NON-active pending word as spontaneous (the transfer gold)", () => {
    const t1 = fresh(); // active = garden
    const t2 = onUserUtterance(t1.state, "i was eating soup with a spoon", [], 0.9);
    expect(t2.events.some((e) => e.type === "spontaneous_use" && e.word === "spoon")).toBe(true);
    expect(t2.state.items.find((i) => i.word === "spoon")?.status).toBe("spontaneous");
  });

  it("detects stemmed variants (gardens → garden)", () => {
    const t1 = fresh();
    const t2 = onUserUtterance(t1.state, "i have two gardens", [], 0.9);
    expect(t2.state.items[0].status).toBe("elicited");
  });
});

describe("cued production tier", () => {
  it("the framed word produced AFTER its cue scores as cued, not elicited", () => {
    const t1 = fresh();
    const t2 = onUserUtterance(t1.state, "i don't remember", [], 0.9); // triggers cue
    expect(t2.mayaLine.toLowerCase()).toContain("garden");
    const t3 = onUserUtterance(t2.state, "garden", [], 0.9);
    expect(t3.state.items[0].status).toBe("cued");
    expect(t3.events.some((e) => e.type === "cued_use" && e.word === "garden")).toBe(true);
  });
});

describe("verify-don't-guess repair", () => {
  it("low confidence triggers a repair question instead of assuming", () => {
    const t1 = fresh();
    const t2 = onUserUtterance(t1.state, "garden", [], 0.3);
    expect(t2.state.phase).toBe("repair");
    expect(t2.events.some((e) => e.type === "repair_started")).toBe(true);
    expect(t2.mayaLine.toLowerCase()).toContain("garden");
    expect(t2.state.items[0].status).toBe("pending"); // NOT credited yet
  });

  it("a hit found only in an ASR alternative also triggers repair", () => {
    const t1 = fresh();
    const t2 = onUserUtterance(t1.state, "carton", [{ transcript: "garden", confidence: 0.4 }], 0.8);
    expect(t2.state.phase).toBe("repair");
  });

  it("confirmed repair credits the word; rejected repair does not", () => {
    const a = onUserUtterance(fresh().state, "garden", [], 0.3);
    const confirmed = onRepairAnswer(a.state, true);
    expect(confirmed.state.items[0].status).toBe("elicited");

    const b = onUserUtterance(fresh().state, "garden", [], 0.3);
    const rejected = onRepairAnswer(b.state, false);
    expect(rejected.state.items[0].status).not.toBe("elicited");
    expect(rejected.state.phase).not.toBe("repair"); // moved on, not stuck
  });

  it("silence during repair is treated as no and the conversation moves on", () => {
    const a = onUserUtterance(fresh().state, "garden", [], 0.3);
    const next = onSilence(a.state);
    expect(next.state.phase).not.toBe("repair");
  });
});

describe("anti-loop guarantees", () => {
  it("an unmatched item gets exactly one cue then is released — never flogged", () => {
    const t1 = fresh();
    const t2 = onUserUtterance(t1.state, "i don't know", [], 0.9);
    // one cue for the active word
    expect(t2.mayaLine.toLowerCase()).toContain("garden");
    const t3 = onUserUtterance(t2.state, "still nothing", [], 0.9);
    expect(t3.state.items[0].status).toBe("released");
    expect(t3.events.some((e) => e.type === "item_released" && e.word === "garden")).toBe(true);
    // and the conversation moved to the NEXT item
    expect(t3.mayaLine.toLowerCase()).toContain("spoon");
  });

  it("the review ALWAYS terminates within the turn budget, whatever the user says", () => {
    let turn = fresh();
    let guard = 0;
    while (turn.state.phase !== "done" && guard < 50) {
      turn = onUserUtterance(turn.state, "hmm not sure about that", [], 0.9);
      guard++;
    }
    expect(turn.state.phase).toBe("done");
    expect(turn.state.mayaTurns).toBeLessThanOrEqual(MAX_MAYA_TURNS + 1);
    expect(guard).toBeLessThan(20);
  });

  it("no Maya line repeats within a session (until a pool is exhausted)", () => {
    let turn = fresh();
    const lines: string[] = [turn.mayaLine];
    let guard = 0;
    while (turn.state.phase !== "done" && guard < 30) {
      turn = onUserUtterance(turn.state, "hmm", [], 0.9);
      if (turn.mayaLine) lines.push(turn.mayaLine);
      guard++;
    }
    // Split compound lines into their component sentences for the check
    const seen = new Set<string>();
    for (const l of lines) {
      expect(seen.has(l), `repeated full line: "${l}"`).toBe(false);
      seen.add(l);
    }
  });

  it("escape hatches always work: skip releases the topic, finish ends immediately", () => {
    const t1 = fresh();
    const skipped = onSkipTopic(t1.state);
    expect(skipped.state.items[0].status).toBe("released");

    const t2 = fresh();
    const finished = onFinishRequest(t2.state);
    expect(finished.state.phase).toBe("done");
    const complete = finished.events.find((e) => e.type === "review_complete");
    expect(complete).toBeTruthy();
  });

  it("done state ignores further input (no zombie turns)", () => {
    const finished = onFinishRequest(fresh().state);
    const after = onUserUtterance(finished.state, "garden spoon jacket", [], 0.9);
    expect(after.mayaLine).toBe("");
    expect(after.events).toEqual([]);
  });
});

describe("detectPendingWord", () => {
  it("never matches completed items", () => {
    const t1 = fresh();
    const t2 = onUserUtterance(t1.state, "my garden is great", [], 0.9); // garden done
    const detection = detectPendingWord(t2.state as ReviewState, "the garden again", [], 0.9);
    expect(detection).toBeNull(); // garden no longer pending
  });

  it("does not false-match short words inside other words", () => {
    const { state } = startReview([{ word: "car", category: "transportation", struggled: false }]);
    const detection = detectPendingWord(state, "i ate a carrot", [], 0.9);
    expect(detection).toBeNull();
  });
});
