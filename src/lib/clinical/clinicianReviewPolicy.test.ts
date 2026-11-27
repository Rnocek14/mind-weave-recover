import { describe, expect, it } from "vitest";
import { clinicianReviewSummary, comparablePracticeDelta } from "./clinicianReviewPolicy";

const base = {
  criticalAlerts: 0,
  otherAlerts: 0,
  activeDays7d: 4,
  lastActiveDate: "2026-10-31",
  scoredRecent: 15,
  scoredPrior: 15,
  practiceDeltaPp: null,
};

describe("clinician review priorities are not diagnoses", () => {
  it("never concludes stable or recovered from adequate practice activity", () => {
    const result = clinicianReviewSummary(base);
    expect(result.title).toBe("Practice data available");
    expect(result.priority).toBe("routine");
    expect(result.nextStep).not.toMatch(/increase difficulty|reduce cue|stable recovery|discharge/i);
  });

  it("treats missing activity as an unknown gap rather than non-adherence", () => {
    const result = clinicianReviewSummary({ ...base, activeDays7d: 0, lastActiveDate: null });
    expect(result.priority).toBe("measurement");
    expect(result.title).toBe("No recent practice recorded");
    expect(result.nextStep).toMatch(/expected gap/);
    expect(JSON.stringify(result)).not.toMatch(/lazy|non-adher|under.dos/i);
  });

  it("prioritizes actual app flags over raw score changes without prescribing a treatment change", () => {
    const result = clinicianReviewSummary({ ...base, criticalAlerts: 2, practiceDeltaPp: -20 });
    expect(result.priority).toBe("alert");
    expect(result.reason).toContain("2 high-priority app alerts");
    expect(result.nextStep).toMatch(/before taking clinical action/i);
    expect(result.nextStep).not.toMatch(/reduce|increase|advance/);
  });

  it("keeps missing and invalid comparisons unavailable instead of showing clinical decline", () => {
    expect(comparablePracticeDelta(70, 90, 9, 30)).toBeNull();
    expect(comparablePracticeDelta(null, 90, 30, 30)).toBeNull();
    expect(comparablePracticeDelta(70, null, 30, 30)).toBeNull();
    expect(comparablePracticeDelta(NaN, 90, 30, 30)).toBeNull();
    expect(comparablePracticeDelta(70, 90, 10, 10)).toBe(-20);
    const result = clinicianReviewSummary({ ...base, practiceDeltaPp: -12 });
    expect(result.title).toBe("Practice score change");
    expect(result.nextStep).toMatch(/task difficulty, cueing, recording quality/i);
  });

  it("distinguishes uncertain observations from incorrect patient answers", () => {
    const result = clinicianReviewSummary({
      ...base, activeDays7d: 3, scoredRecent: 0, scoredPrior: 18,
    });
    expect(result.priority).toBe("measurement");
    expect(result.title).toBe("Not enough scored data");
    expect(result.nextStep).toContain("Do not interpret missing scores as failures");
  });

  it("does not use a small score sample as a clinical warning", () => {
    const result = clinicianReviewSummary({
      ...base, scoredRecent: 2, scoredPrior: 3, practiceDeltaPp: -40,
    });
    expect(result.title).not.toBe("Practice score change");
    expect(result.title).not.toContain("Declining");
  });
});
