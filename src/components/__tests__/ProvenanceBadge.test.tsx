import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import type { PhysicalMeta } from "@/lib/buildSnapshotTimeline";

const NOW = new Date("2025-06-15T12:00:00Z").getTime();
const HOUR = 60 * 60 * 1000;

describe("ProvenanceBadge", () => {
  it("shows 'Manual' and 'No device connected' when coverageDays === 0", () => {
    const meta: PhysicalMeta = { coverageDays: 0, sourcesSeen: [], lastSyncAtMax: null };
    const { getByText } = render(<ProvenanceBadge physicalMeta={meta} nowMs={NOW} />);
    expect(getByText("Manual")).toBeInTheDocument();
    expect(getByText("No device connected")).toBeInTheDocument();
  });

  it("shows 'Objective' when coverageDays > 0 with recent sync", () => {
    const recentSync = new Date(NOW - 1 * HOUR).toISOString();
    const meta: PhysicalMeta = { coverageDays: 5, sourcesSeen: ["HealthKit"], lastSyncAtMax: recentSync };
    const { getByText, queryByText } = render(<ProvenanceBadge physicalMeta={meta} nowMs={NOW} />);
    expect(getByText("Objective")).toBeInTheDocument();
    expect(queryByText("Manual")).not.toBeInTheDocument();
  });

  it("shows '(stale)' text when sync is older than 72 hours", () => {
    const staleSync = new Date(NOW - 96 * HOUR).toISOString();
    const meta: PhysicalMeta = { coverageDays: 3, sourcesSeen: ["GoogleFit"], lastSyncAtMax: staleSync };
    const { container, getByText } = render(<ProvenanceBadge physicalMeta={meta} nowMs={NOW} />);
    expect(getByText("Objective")).toBeInTheDocument();
    expect(container.textContent).toContain("(stale)");
  });

  it("does NOT show '(stale)' when sync is recent", () => {
    const recentSync = new Date(NOW - 2 * HOUR).toISOString();
    const meta: PhysicalMeta = { coverageDays: 7, sourcesSeen: ["HealthKit"], lastSyncAtMax: recentSync };
    const { container } = render(<ProvenanceBadge physicalMeta={meta} nowMs={NOW} />);
    expect(container.textContent).not.toContain("(stale)");
  });

  it("shows source names in summary text", () => {
    const meta: PhysicalMeta = { coverageDays: 4, sourcesSeen: ["HealthKit", "GoogleFit"], lastSyncAtMax: new Date(NOW - 1 * HOUR).toISOString() };
    const { container } = render(<ProvenanceBadge physicalMeta={meta} nowMs={NOW} />);
    expect(container.textContent).toContain("HealthKit");
    expect(container.textContent).toContain("GoogleFit");
  });
});
