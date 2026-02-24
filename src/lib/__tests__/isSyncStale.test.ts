import { describe, it, expect } from "vitest";
import { isSyncStale } from "@/lib/isSyncStale";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2025-06-15T12:00:00Z").getTime();

describe("isSyncStale", () => {
  it("returns false when lastSyncAtMax is null", () => {
    expect(isSyncStale(null, NOW)).toBe(false);
  });

  it("returns false when sync is 1 hour ago", () => {
    const recent = new Date(NOW - 1 * HOUR).toISOString();
    expect(isSyncStale(recent, NOW)).toBe(false);
  });

  it("returns false at exactly 72 hours", () => {
    const boundary = new Date(NOW - 72 * HOUR).toISOString();
    expect(isSyncStale(boundary, NOW)).toBe(false);
  });

  it("returns true when sync is 73 hours ago", () => {
    const old = new Date(NOW - 73 * HOUR).toISOString();
    expect(isSyncStale(old, NOW)).toBe(true);
  });

  it("returns true when sync is 7 days ago", () => {
    const veryOld = new Date(NOW - 7 * 24 * HOUR).toISOString();
    expect(isSyncStale(veryOld, NOW)).toBe(true);
  });
});
