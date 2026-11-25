import { describe, it, expect } from "vitest";
import { pairedGamePractice } from "../pairedGamePractice";

const now = Date.UTC(2026, 9, 31);
const people = ["a", "b", "c", "d"].map(id => ({ id, stroke_mechanism_tag: "ischemic", aphasia_type: id === "b" ? "expressive" : null }));
const sessions = new Map(people.map(p => [p.id, p.id]));
function event(id: string, day: number, score: number, level = 4, mode = "production") {
  return { session_id: id, created_at: new Date(now + (day - 31) * 86400000).toISOString(),
    exercise_slug: "photo_naming", score, task_parameters: { unified_trial_v1: true, game_level: level, trial_mode: mode } };
}
const compute = (events: ReturnType<typeof event>[]) => pairedGamePractice(people, events, sessions, "stroke_mechanism_tag", now);
describe("paired game practice", () => {
  it("keeps one change per patient when the mix of players reverses", () => {
    const rows = [event("a", 1, 100), event("b", 22, 0), ...Array.from({ length: 50 }, () => event("b", 1, 0)),
      ...Array.from({ length: 50 }, () => event("a", 22, 100))];
    expect(compute(rows.reverse())[0]).toMatchObject({ recorded: 2, baseline: 2, paired: 2, median: 0, q1: 0, q3: 0 });
  });
  it("shows partial windows, missing follow-up and changed task conditions separately", () => {
    const rows = [event("a",1,0),event("a",28,100),event("b",1,100),event("b",22,0,5),
      event("c",1,100),event("c",29,0),event("d",12,0),event("d",30,100)];
    expect(compute(rows)[0]).toMatchObject({ recorded:4, baseline:4, paired:1, pending:1, unmatched:1, absent:1, median:null });
  });
  it("matches level and mode before averaging and separates current stroke and aphasia groups", () => {
    const rows = [event("a",1,0),event("a",7,100,5),event("a",22,100),event("a",28,0,5),
      event("b",1,0),event("b",22,100),event("b",28,0,4,"recognition")];
    expect(compute(rows)[0]).toMatchObject({ paired:2, median:50, q1:25, q3:75 });
    expect(pairedGamePractice(people,rows,sessions,"aphasia_type",now)).toHaveLength(2);
  });
  it("keeps legacy, invalid and manual records visible only as recorded coverage", () => {
    const base = event("a",1,100);
    const cases = [{ ...base, score:1 }, { ...base, counts_toward_score:false }, { ...base, created_at:"bad" },
      { ...base, task_parameters:{ ...base.task_parameters, manual_confirmed:true } },
      { ...base, task_parameters:{ ...base.task_parameters, unified_trial_v1:false } }];
    expect(compute(cases)[0]).toMatchObject({ recorded:1, baseline:0, paired:0, median:null });
  });
});
