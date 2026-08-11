import { describe, it, expect } from "vitest";
import { buildPresetLesson, type LessonPreset } from "@/lib/dailyLessonEngine";

const ALL_PRESETS: LessonPreset[] = [
  "comprehension_session",
  "core_communication",
  "expression_focused",
  "comprehension_focused",
  "low_energy",
  "depth_battery_onboarding",
  "depth_battery_weekly",
];

describe("lesson preset integrity", () => {
  // buildPresetLesson rejects any preset containing an unpolished exercise.
  // Before this suite existed, 6 of 7 presets (including Light Session, the
  // one for fatigued survivors) silently failed that check and were dead
  // code. Every preset must build, always.
  it.each(ALL_PRESETS)("preset '%s' builds (all blocks polished)", (preset) => {
    const lesson = buildPresetLesson(preset);
    expect(lesson).not.toBeNull();
    expect(lesson!.blocks.length).toBeGreaterThan(0);
  });
});
