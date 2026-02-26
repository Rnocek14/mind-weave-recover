import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, SlidersHorizontal } from "lucide-react";
import type { CaseloadPatient } from "@/hooks/useClinicianCaseload";

export type RiskFilter = "all" | "critical" | "any_alert" | "none";
export type EngagementFilter = "all" | "inactive_3d" | "inactive_5d";
export type SortPreset = "needs_attention" | "most_inactive" | "declining" | "improving" | "alpha";

interface CaseloadFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  riskFilter: RiskFilter;
  onRiskFilterChange: (v: RiskFilter) => void;
  engagementFilter: EngagementFilter;
  onEngagementFilterChange: (v: EngagementFilter) => void;
  sortPreset: SortPreset;
  onSortPresetChange: (v: SortPreset) => void;
  totalCount: number;
  filteredCount: number;
}

export function CaseloadFilters({
  search,
  onSearchChange,
  riskFilter,
  onRiskFilterChange,
  engagementFilter,
  onEngagementFilterChange,
  sortPreset,
  onSortPresetChange,
  totalCount,
  filteredCount,
}: CaseloadFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Search + counts */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search patients..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filteredCount === totalCount
            ? `${totalCount} patient${totalCount !== 1 ? "s" : ""}`
            : `${filteredCount} of ${totalCount}`}
        </span>
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />

        <Select value={riskFilter} onValueChange={(v) => onRiskFilterChange(v as RiskFilter)}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Risk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risk</SelectItem>
            <SelectItem value="critical">Critical only</SelectItem>
            <SelectItem value="any_alert">Has alerts</SelectItem>
            <SelectItem value="none">No alerts</SelectItem>
          </SelectContent>
        </Select>

        <Select value={engagementFilter} onValueChange={(v) => onEngagementFilterChange(v as EngagementFilter)}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue placeholder="Engagement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All engagement</SelectItem>
            <SelectItem value="inactive_3d">Inactive ≥3d</SelectItem>
            <SelectItem value="inactive_5d">Inactive ≥5d</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortPreset} onValueChange={(v) => onSortPresetChange(v as SortPreset)}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="needs_attention">Needs attention</SelectItem>
            <SelectItem value="most_inactive">Most inactive</SelectItem>
            <SelectItem value="declining">Declining performance</SelectItem>
            <SelectItem value="improving">Most improved</SelectItem>
            <SelectItem value="alpha">Alphabetical</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/** Apply filters + sort to patient list */
export function filterAndSortCaseload(
  patients: CaseloadPatient[],
  search: string,
  riskFilter: RiskFilter,
  engagementFilter: EngagementFilter,
  sortPreset: SortPreset
): CaseloadPatient[] {
  let filtered = [...patients];

  // Search
  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.aphasiaLabel?.toLowerCase().includes(q) ?? false)
    );
  }

  // Risk filter
  if (riskFilter === "critical") {
    filtered = filtered.filter((p) => p.criticalAlertCount > 0);
  } else if (riskFilter === "any_alert") {
    filtered = filtered.filter((p) => p.activeAlertCount > 0);
  } else if (riskFilter === "none") {
    filtered = filtered.filter((p) => p.activeAlertCount === 0);
  }

  // Engagement filter
  if (engagementFilter !== "all") {
    const thresholdDays = engagementFilter === "inactive_3d" ? 3 : 5;
    filtered = filtered.filter((p) => {
      if (!p.lastActiveDate) return true; // no activity = inactive
      const days = Math.floor(
        (Date.now() - new Date(p.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return days >= thresholdDays;
    });
  }

  // Sort
  filtered.sort((a, b) => {
    switch (sortPreset) {
      case "needs_attention":
        // Critical first, then alerts, then inactive
        if (a.criticalAlertCount !== b.criticalAlertCount)
          return b.criticalAlertCount - a.criticalAlertCount;
        if (a.activeAlertCount !== b.activeAlertCount)
          return b.activeAlertCount - a.activeAlertCount;
        // Then by days since last active (desc)
        return daysSince(a.lastActiveDate) - daysSince(b.lastActiveDate);

      case "most_inactive":
        return daysSince(b.lastActiveDate) - daysSince(a.lastActiveDate);

      case "declining":
        return (a.accuracyDelta7d ?? 0) - (b.accuracyDelta7d ?? 0);

      case "improving":
        return (b.accuracyDelta7d ?? 0) - (a.accuracyDelta7d ?? 0);

      case "alpha":
        return a.name.localeCompare(b.name);

      default:
        return 0;
    }
  });

  return filtered;
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999;
  return Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  );
}
