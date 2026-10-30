import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scopedKey, setDeviceScope } from "./deviceStore";
import {
  clearReviewedWords,
  getTodaysPracticedWords,
  recordPracticedWord,
} from "./reviewQueue";
import { getAllLedgers } from "./transferLedger";

describe("session-scoped, non-clinical review handoff", () => {
  beforeEach(() => {
    localStorage.clear();
    setDeviceScope("patient-one");
  });
  afterEach(() => {
    localStorage.clear();
    setDeviceScope(null);
  });

  it("never exposes another lesson's words or clears them after the first review", () => {
    recordPracticedWord("lamp", "household", false, {
      sessionId: "session-a", sourceGame: "photo_naming", responseMode: "speech",
    });
    recordPracticedWord("lamp", "household", true, {
      sessionId: "session-b", sourceGame: "photo_naming", responseMode: "selection",
    });
    recordPracticedWord("cup", "household", false, {
      sessionId: "session-b", sourceGame: "two_clues",
    });

    expect(getTodaysPracticedWords({ sessionId: "session-a" }).map((x) => x.word)).toEqual(["lamp"]);
    expect(getTodaysPracticedWords({ sessionId: "session-b" }).map((x) => x.word))
      .toEqual(["lamp", "cup"]);

    clearReviewedWords(["lamp"], { sessionId: "session-a" });
    expect(getTodaysPracticedWords({ sessionId: "session-a" })).toHaveLength(0);
    expect(getTodaysPracticedWords({ sessionId: "session-b" })).toHaveLength(2);
  });

  it("keeps a duplicate practice item once while retaining struggle and source", () => {
    expect(recordPracticedWord("  LAMP ", "household", false, {
      sessionId: "s-1", sourceGame: "photo_naming", responseMode: "selection",
    })).toBe(true);
    recordPracticedWord("lamp", "generic", true, {
      sessionId: "s-1", sourceGame: "fix_sentence", responseMode: "unknown",
    });
    recordPracticedWord("lamp", "generic", false, {
      sessionId: "s-1", sourceGame: "fix_sentence",
    });

    const words = getTodaysPracticedWords({ sessionId: "s-1" });
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({
      word: "lamp", category: "household", struggled: true,
      sourceGames: ["photo_naming", "fix_sentence"],
      responseMode: "selection",
    });
    // Replaying trials must never turn a local practice marker into multiple
    // clinical successes, or even multiple daily practice-ledger events.
    expect(getAllLedgers().find((l) => l.word === "lamp")?.events
      .filter((e) => e.tier === "practice")).toHaveLength(1);
  });

  it("preserves legacy unscoped entries only for direct daily review", () => {
    recordPracticedWord("garden", "nature", false);
    expect(getTodaysPracticedWords().map((p) => p.word)).toEqual(["garden"]);
    expect(getTodaysPracticedWords({ sessionId: "s-1" })).toEqual([]);
  });

  it("rejects malformed explicit session IDs rather than mixing into daily queue", () => {
    expect(recordPracticedWord("apple", "food", false, {
      sessionId: "../../other",
    })).toBe(false);
    expect(recordPracticedWord("apple", "food", false, {
      sessionId: "bad\nkey",
    })).toBe(false);
    expect(getTodaysPracticedWords()).toHaveLength(0);
    expect(getTodaysPracticedWords({ sessionId: "../../other" })).toEqual([]);
  });

  it("does not mix practice between two patient profiles on a shared device", () => {
    recordPracticedWord("knife", "household", true, { sessionId: "same-session" });
    setDeviceScope("patient-two");
    expect(getTodaysPracticedWords({ sessionId: "same-session" })).toEqual([]);
    recordPracticedWord("book", "household", false, { sessionId: "same-session" });
    setDeviceScope("patient-one");
    expect(getTodaysPracticedWords({ sessionId: "same-session" }).map((p) => p.word))
      .toEqual(["knife"]);
  });

  it("does not count a session target as speech when it came from a chip", () => {
    recordPracticedWord("water", "household", false, {
      sessionId: "session-1", sourceGame: "photo_naming", responseMode: "selection",
    });
    const item = getTodaysPracticedWords({ sessionId: "session-1" })[0];
    expect(item.responseMode).toBe("selection");
    expect(item).not.toHaveProperty("speechVerified");
    expect(item).not.toHaveProperty("transferScore");
  });

  it("can recover gracefully from corrupted local storage without throwing", () => {
    localStorage.setItem(scopedKey("reviewQueue_practicedWords"), "{bad json");
    expect(getTodaysPracticedWords()).toEqual([]);
    expect(recordPracticedWord("book", "household", false, { sessionId: "s-1" }))
      .toBe(true);
    expect(getTodaysPracticedWords({ sessionId: "s-1" }).map((x) => x.word))
      .toEqual(["book"]);
  });

  it("bounds the local queue to its newest 30 practice targets", () => {
    for (let i = 0; i < 35; i++) {
      recordPracticedWord(`item${i}`, "generic", false, { sessionId: "s-1" });
    }
    const words = getTodaysPracticedWords({ sessionId: "s-1" });
    expect(words).toHaveLength(30);
    expect(words.some((x) => x.word === "item0")).toBe(false);
    expect(words.some((x) => x.word === "item34")).toBe(true);
  });
});
