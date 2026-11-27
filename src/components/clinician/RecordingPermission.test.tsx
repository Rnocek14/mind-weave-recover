import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordingPermission } from "./RecordingPermission";

const backend = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase:backend }));
afterEach(cleanup);
beforeEach(() => backend.from.mockReset());

describe("per-patient clinician recording permission", () => {
  it("reads, grants and revokes only the displayed profile", async () => {
    const allowed = new Set(["sibling"]);
    const lookup = vi.fn((_: string, id: string) => ({
      maybeSingle: async () => ({ data: allowed.has(id) ? { profile_id:id } : null, error:null }),
    }));
    const insert = vi.fn(async ({ profile_id }: { profile_id: string }) => {
      allowed.add(profile_id);
      return { error:null };
    });
    const revoke = vi.fn(async (_: string, id: string) => { allowed.delete(id); return { error:null }; });
    backend.from.mockReturnValue({ select:() => ({ eq:lookup }), insert, delete:() => ({ eq:revoke }) });
    render(<QueryClientProvider client={new QueryClient()}><RecordingPermission profileId="subject" name="Patient" /></QueryClientProvider>);
    fireEvent.click(await screen.findByRole("button",{ name:"Allow clinician playback" }));
    const off = await screen.findByRole("button",{ name:"Turn off clinician playback" });
    await waitFor(() => expect(off).toBeEnabled());
    fireEvent.click(off);
    await screen.findByRole("button",{ name:"Allow clinician playback" });
    expect(lookup).toHaveBeenCalledWith("profile_id","subject");
    expect(insert).toHaveBeenCalledWith({ profile_id:"subject" });
    expect(revoke).toHaveBeenCalledWith("profile_id","subject");
    expect([...allowed]).toEqual(["sibling"]);
  });

  it("shows an unavailable read with a retry before allowing an edit", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data:null, error:new Error("unavailable") });
    backend.from.mockReturnValue({ select:() => ({ eq:() => ({ maybeSingle }) }) });
    render(<QueryClientProvider client={new QueryClient()}><RecordingPermission profileId="subject" name="Patient" /></QueryClientProvider>);
    expect(await screen.findByRole("button",{ name:"Retry permission lookup" })).toBeVisible();
    expect(screen.queryByRole("button",{ name:"Allow clinician playback" })).toBeNull();
  });
});
