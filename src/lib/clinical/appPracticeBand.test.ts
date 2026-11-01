import { describe, expect, it } from "vitest";
import { describeAppPracticeBand } from "./appPracticeBand";

describe("app difficulty target is a display-only range, not a clinical outcome", () => {
  it("uses exactly the displayed 65–80% practice band", () => {
    expect(describeAppPracticeBand(0.55)).toBe("55% · below app target");
    expect(describeAppPracticeBand(0.649)).toBe("65% · within app target");
    expect(describeAppPracticeBand(0.65)).toBe("65% · within app target");
    expect(describeAppPracticeBand(0.8)).toBe("80% · within app target");
    expect(describeAppPracticeBand(0.81)).toBe("81% · above app target");
    expect(describeAppPracticeBand(0.9)).toBe("90% · above app target");
  });
  it("never converts missing or out-of-range engine telemetry into performance", () => {
    for (const value of [null, NaN, Infinity, -0.05, 1.2]) {
      expect(describeAppPracticeBand(value)).toBeNull();
    }
  });
});
