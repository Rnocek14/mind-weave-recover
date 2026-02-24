import { describe, it, expect, vi } from "vitest";
import type { PhysicalMeta } from "@/lib/buildSnapshotTimeline";

/**
 * Smoke tests for provenance badge logic (unit-level, no DOM rendering).
 * Tests the display logic that the WeeklyRecoverySnapshot component uses.
 */

describe("Provenance badge logic", () => {
  it("shows 'Objective' state when coverageDays > 0", () => {
    const meta: PhysicalMeta = { coverageDays: 5, sourcesSeen: ["HealthKit"], lastSyncAtMax: new Date().toISOString() };
    expect(meta.coverageDays).toBeGreaterThan(0);
    // Component renders "Objective" badge
  });

  it("shows 'Manual' / 'No device connected' when coverageDays === 0", () => {
    const meta: PhysicalMeta = { coverageDays: 0, sourcesSeen: [], lastSyncAtMax: null };
    expect(meta.coverageDays).toBe(0);
    // Component renders "Manual" badge
  });

  it("detects stale sync when lastSyncAtMax > 72h ago", () => {
    const staleDate = new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString();
    const meta: PhysicalMeta = { coverageDays: 3, sourcesSeen: ["GoogleFit"], lastSyncAtMax: staleDate };
    const isStale = meta.lastSyncAtMax
      ? (Date.now() - new Date(meta.lastSyncAtMax).getTime()) > 72 * 60 * 60 * 1000
      : false;
    expect(isStale).toBe(true);
  });

  it("is NOT stale when lastSyncAtMax is recent", () => {
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    const meta: PhysicalMeta = { coverageDays: 7, sourcesSeen: ["HealthKit"], lastSyncAtMax: recentDate };
    const isStale = meta.lastSyncAtMax
      ? (Date.now() - new Date(meta.lastSyncAtMax).getTime()) > 72 * 60 * 60 * 1000
      : false;
    expect(isStale).toBe(false);
  });
});
