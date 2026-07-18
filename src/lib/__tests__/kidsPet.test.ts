import { describe, it, expect } from "vitest";
import {
  feedPet,
  getPetStage,
  getNextPetStage,
  getPetStageProgress,
  previousDay,
  PET_STAGES,
  DEFAULT_PET,
  type KidsPetState,
} from "@/lib/kidsPet";

const pet = (overrides: Partial<KidsPetState> = {}): KidsPetState => ({
  ...DEFAULT_PET,
  ...overrides,
});

describe("pet stages", () => {
  it("stage thresholds are strictly increasing from zero", () => {
    expect(PET_STAGES[0].minXp).toBe(0);
    for (let i = 1; i < PET_STAGES.length; i++) {
      expect(PET_STAGES[i].minXp).toBeGreaterThan(PET_STAGES[i - 1].minXp);
    }
  });

  it("maps xp to the correct stage at and around boundaries", () => {
    expect(getPetStage(0).stage).toBe(0);
    expect(getPetStage(19).stage).toBe(0);
    expect(getPetStage(20).stage).toBe(1);
    expect(getPetStage(9999).stage).toBe(PET_STAGES.length - 1);
  });

  it("progress runs 0→1 within a stage and 1 when maxed", () => {
    expect(getPetStageProgress(0)).toBe(0);
    expect(getPetStageProgress(10)).toBeCloseTo(0.5);
    expect(getPetStageProgress(9999)).toBe(1);
    expect(getNextPetStage(9999)).toBeNull();
  });
});

describe("feedPet", () => {
  it("adds xp and starts a streak on first feed", () => {
    const next = feedPet(pet(), 8, "2026-07-18");
    expect(next.xp).toBe(8);
    expect(next.streakDays).toBe(1);
    expect(next.lastFedDay).toBe("2026-07-18");
  });

  it("same-day feeds add xp without changing the streak", () => {
    const day1 = feedPet(pet(), 8, "2026-07-18");
    const again = feedPet(day1, 5, "2026-07-18");
    expect(again.xp).toBe(13);
    expect(again.streakDays).toBe(1);
  });

  it("consecutive days grow the streak; a gap resets to 1, never punishes xp", () => {
    let p = feedPet(pet(), 8, "2026-07-18");
    p = feedPet(p, 8, "2026-07-19");
    expect(p.streakDays).toBe(2);
    p = feedPet(p, 8, "2026-07-25"); // gap
    expect(p.streakDays).toBe(1);
    expect(p.xp).toBe(24); // xp only ever grows
  });

  it("negative xp awards are clamped to zero", () => {
    const next = feedPet(pet({ xp: 10 }), -50, "2026-07-18");
    expect(next.xp).toBe(10);
  });
});

describe("previousDay", () => {
  it("handles month and year boundaries", () => {
    expect(previousDay("2026-07-18")).toBe("2026-07-17");
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
    expect(previousDay("2026-01-01")).toBe("2025-12-31");
  });
});
