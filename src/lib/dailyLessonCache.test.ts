import { describe, expect, it, vi } from "vitest";
import { DAILY_LESSON_CACHE_KEY, invalidateDailyLessonCache, isDailyLessonCacheFresh } from "./dailyLessonCache";

describe("daily plans refresh when a session ends or a new day begins", () => {
  const now = new Date(2026, 10, 1, 12, 0, 0);
  it("accepts only a fresh plan from the same calendar day", () => {
    expect(isDailyLessonCacheFresh(now.getTime() - 60000, now)).toBe(true);
    expect(isDailyLessonCacheFresh(now.getTime() - 31 * 60000, now)).toBe(false);
    expect(isDailyLessonCacheFresh(now.getTime() + 1000, now)).toBe(false);
    const early = new Date(2026, 10, 1, 0, 5, 0);
    const previousNight = new Date(2026, 9, 31, 23, 55, 0);
    expect(isDailyLessonCacheFresh(previousNight.getTime(), early)).toBe(false);
    expect(isDailyLessonCacheFresh(NaN, now)).toBe(false);
  });

  it("invalidates only the lesson cache without disturbing an in-progress lesson", () => {
    const removeItem = vi.fn();
    expect(invalidateDailyLessonCache({ removeItem })).toBe(true);
    expect(removeItem).toHaveBeenCalledExactlyOnceWith(DAILY_LESSON_CACHE_KEY);
    expect(removeItem).not.toHaveBeenCalledWith("lessonFlowState");
  });

  it("never blocks session completion when browser storage is unavailable", () => {
    const removeItem = vi.fn(() => { throw Error("storage disabled"); });
    expect(invalidateDailyLessonCache({ removeItem })).toBe(false);
  });
});
