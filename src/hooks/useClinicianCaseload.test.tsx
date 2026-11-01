import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClinicianCaseload } from "./useClinicianCaseload";

const backend = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: backend }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "viewer" } }) }));

type Reply = { data: unknown; error: { message: string } | null };
function chain(reply: Reply) {
  const q = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), not: vi.fn(), gte: vi.fn(),
    in: vi.fn(), is: vi.fn(),
    then: (resolve: (r: Reply) => unknown) => Promise.resolve(reply).then(resolve),
  };
  for (const key of ["select", "eq", "order", "not", "gte", "in", "is"] as const)
    q[key].mockReturnValue(q);
  return q;
}
function ago(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}
function configure({ failEvents = false }: { failEvents?: boolean } = {}) {
  const rows: Record<string, Reply> = {
    profiles: { data: [{
      id: "p-one", user_id: "patient-owner", profile_name: "Synthetic Patient",
      is_active: true, stroke_date: null, clinical_profile: null, aphasia_type: null,
      laterality: null, chronicity_tag: null, stroke_mechanism_tag: null,
    }], error: null },
    sessions: { data: [
      { id: "recent", profile_id: "p-one", ended_at: ago(1), duration_sec: 180 },
      { id: "prior", profile_id: "p-one", ended_at: ago(10), duration_sec: 180 },
    ], error: null },
    exercise_events: { data: [
      ...Array.from({ length: 12 }, () => ({
        session_id: "recent", score: 0.7, exercise_slug: "photo_naming",
        validity_label: "valid_attempt", counts_toward_score: true,
      })),
      ...Array.from({ length: 12 }, () => ({
        session_id: "prior", score: 0.8, exercise_slug: "photo_naming",
        validity_label: "valid_attempt", counts_toward_score: true,
      })),
      { session_id: "recent", score: 100, exercise_slug: "photo_naming",
        validity_label: "background_noise", counts_toward_score: false },
      { session_id: "recent", score: 100, exercise_slug: "conversation_coach",
        validity_label: "valid_attempt" },
      { session_id: "recent", score: 100, exercise_slug: "photo_naming",
        validity_label: "manual_confirmed" },
      { session_id: "recent", score: 100, exercise_slug: "photo_naming",
        clinician_validity_override: "not_patient" },
    ], error: failEvents ? { message: "synthetic read error" } : null },
    recovery_alerts: { data: [], error: null },
    dose_logs: { data: [{ profile_id: "p-one", log_date: ago(1).slice(0, 10) }], error: null },
  };
  backend.from.mockImplementation((table: string) => {
    const response = rows[table];
    if (!response) throw Error("Unexpected Supabase table " + table);
    return chain(response);
  });
}

beforeEach(() => backend.from.mockReset());

describe("caseload aggregations use the SAME validity policy as patient review", () => {
  it("excludes noise, non-patient, manually confirmed and non-comparable data", async () => {
    configure();
    const { result } = renderHook(() => useClinicianCaseload());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.patients).toHaveLength(1);
    expect(result.current.patients[0]).toMatchObject({
      trials7d: 12, priorTrials7d: 12, avgAccuracy7d: 70,
      accuracyDelta7d: -10, trend: "down",
    });
    expect(backend.from).toHaveBeenCalledWith("exercise_events");
  });

  it("fails closed rather than displaying fabricated good scores on a failed data read", async () => {
    configure({ failEvents: true });
    const { result } = renderHook(() => useClinicianCaseload());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.patients).toHaveLength(0);
    expect(result.current.error).toMatch(/could not be loaded reliably/i);
  });
});
