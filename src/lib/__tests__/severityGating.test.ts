import { describe, it, expect } from "vitest";
import {
  isSevereAphasiaProfile,
  filterForSeverity,
  SEVERE_APHASIA_FRIENDLY_EXERCISES,
} from "@/lib/exerciseGating";
import { POLISHED_EXERCISES } from "@/lib/polishedExercises";

const severeProfile = {
  extraction_metadata: { severe_aphasia_mode: true },
};
const mildProfile = {
  extraction_metadata: { severe_aphasia_mode: false },
};

describe("isSevereAphasiaProfile", () => {
  it("is true only for an explicit severe_aphasia_mode flag", () => {
    expect(isSevereAphasiaProfile(severeProfile)).toBe(true);
    expect(isSevereAphasiaProfile(mildProfile)).toBe(false);
    expect(isSevereAphasiaProfile(null)).toBe(false);
    expect(isSevereAphasiaProfile(undefined)).toBe(false);
    expect(isSevereAphasiaProfile({ extraction_metadata: {} })).toBe(false);
    // Truthy-but-not-true values must not trigger the gate.
    expect(
      isSevereAphasiaProfile({ extraction_metadata: { severe_aphasia_mode: "yes" } })
    ).toBe(false);
  });
});

describe("filterForSeverity", () => {
  const catalog = [
    "photo-naming",
    "sentence-construction",
    "narrative-retell",
    "minimal-pairs",
    "detective-mind",
  ];

  it("passes everything through for non-severe profiles", () => {
    expect(filterForSeverity(catalog, mildProfile)).toEqual(catalog);
    expect(filterForSeverity(catalog, null)).toEqual(catalog);
  });

  it("restricts severe profiles to the tap-based subset", () => {
    expect(filterForSeverity(catalog, severeProfile)).toEqual([
      "photo-naming",
      "minimal-pairs",
    ]);
  });

  it("never filters to an empty list (safety valve)", () => {
    const noFriendly = ["sentence-construction", "narrative-retell"];
    expect(filterForSeverity(noFriendly, severeProfile)).toEqual(noFriendly);
  });

  it("keeps at least one POLISHED exercise reachable for daily sessions", () => {
    // The daily lesson engine applies the severity gate and then the
    // polished allowlist. If this intersection ever empties, severe
    // patients get no auto-built session — fail loudly here instead.
    const polishedFriendly = SEVERE_APHASIA_FRIENDLY_EXERCISES.filter(s =>
      (POLISHED_EXERCISES as readonly string[]).includes(s)
    );
    expect(polishedFriendly.length).toBeGreaterThan(0);
  });
});
