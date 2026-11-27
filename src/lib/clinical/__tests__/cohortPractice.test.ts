import { describe, expect, it } from "vitest";
import { cohortPractice } from "../cohortPractice";
import { readAllById } from "../readAllById";

describe("research coverage", () => {
  it("counts distinct patients, empty visits, retries and legacy attempts separately", () => {
    const base = { id: "e", attempt_id: "a", session_id: "s", profile_id: "p", exercise_slug: "photo_naming",
      trial_index: 0, created_at: null, score: 1 };
    const visit = { id: "s", profile_id: "p", started_at: "" };
    const result = cohortPractice([{id:"p"}, {id:"sibling"}], [visit, {...visit,id:"empty"}],
      [base, base, {...base, id:"b", attempt_id:"b"}, {...base, id:"c", attempt_id:null, profile_id:null, trial_index:null},
        {...base, id:"bad", attempt_id:"bad",profile_id:"sibling"}]);
    expect(result.counts).toEqual({patientCount:2,sessionCount:2,trialCount:3,indexedCount:1,unindexedCount:1});
  });
  it("reads past 5,000 records even when the backend caps a page below the request", async () => {
    const records = Array.from({length:5012}, (_, i) => ({id: String(i).padStart(5,"0")}));
    const result = await readAllById(async after => ({ data:records.filter(r => !after || r.id > after).slice(0,171), error:null }));
    expect(result).toEqual(records);
  });
});
