import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearSensitiveDeviceData, scopedKey, setDeviceScope } from "./deviceStore";
import {
  getPresentedFunctionalScripts,
  recordPresentedFunctionalScript,
} from "./scriptPracticeQueue";

describe("presented functional phrases stay device- and lesson-scoped", () => {
  beforeEach(() => {
    localStorage.clear();
    setDeviceScope("patient-one");
  });
  afterEach(() => {
    localStorage.clear();
    setDeviceScope(null);
  });

  it("records a PRESENTED practice phrase exactly once per session, with no claims about speech", () => {
    expect(recordPresentedFunctionalScript("need_help", "session-a")).toBe(true);
    expect(recordPresentedFunctionalScript("need_help", "session-a")).toBe(true);
    const own = getPresentedFunctionalScripts("session-a");
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ sessionId: "session-a", scriptId: "need_help" });
    expect(own[0]).not.toHaveProperty("speechVerified");
    expect(own[0]).not.toHaveProperty("transferScore");
    expect(own[0]).not.toHaveProperty("transcript");
  });

  it("does not silently fall back to daily/global data when a lesson ID is invalid", () => {
    recordPresentedFunctionalScript("need_help", "session-a");
    recordPresentedFunctionalScript("im_thirsty", "session-b");
    expect(getPresentedFunctionalScripts("session-a").map(x => x.scriptId)).toEqual(["need_help"]);
    expect(getPresentedFunctionalScripts("session-b").map(x => x.scriptId)).toEqual(["im_thirsty"]);
    expect(getPresentedFunctionalScripts("")).toEqual([]);
    expect(getPresentedFunctionalScripts(undefined)).toEqual([]);
    expect(getPresentedFunctionalScripts("../../session-b")).toEqual([]);
    expect(recordPresentedFunctionalScript("need_help", "../../bad")).toBe(false);
    expect(recordPresentedFunctionalScript("unapproved phrase", "session-a")).toBe(false);
  });

  it("never shares a local phrase list between profiles on the same device", () => {
    recordPresentedFunctionalScript("need_help", "same-id");
    setDeviceScope("patient-two");
    expect(getPresentedFunctionalScripts("same-id")).toEqual([]);
    recordPresentedFunctionalScript("im_thirsty", "same-id");
    setDeviceScope("patient-one");
    expect(getPresentedFunctionalScripts("same-id").map(x => x.scriptId)).toEqual(["need_help"]);
  });

  it("handles corrupted or future/legacy entries without a blank-screen crash", () => {
    localStorage.setItem(scopedKey("functionalScriptPractice_v1"), "{oops");
    expect(getPresentedFunctionalScripts("s-1")).toEqual([]);
    expect(recordPresentedFunctionalScript("need_more_time", "s-1")).toBe(true);
    expect(getPresentedFunctionalScripts("s-1").map(x => x.scriptId))
      .toEqual(["need_more_time"]);
  });

  it("is wiped on logout through the shared sensitive-data cleanup", () => {
    recordPresentedFunctionalScript("need_help", "s-1");
    expect(getPresentedFunctionalScripts("s-1")).toHaveLength(1);
    clearSensitiveDeviceData();
    setDeviceScope("patient-one");
    expect(getPresentedFunctionalScripts("s-1")).toHaveLength(0);
  });

  it("keeps at most 40 bounded recent practice markers", () => {
    for (let i = 0; i < 45; i++) {
      recordPresentedFunctionalScript("need_help", `s-${i}`);
    }
    expect(getPresentedFunctionalScripts("s-0")).toHaveLength(0);
    expect(getPresentedFunctionalScripts("s-44")).toHaveLength(1);
  });
});
