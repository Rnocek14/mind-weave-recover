import { useState, useMemo, useCallback } from "react";
import { useClinicianCaseload, type CaseloadPatient } from "@/hooks/useClinicianCaseload";
import { PatientCard } from "@/components/clinician/PatientCard";
import {
  CaseloadFilters,
  filterAndSortCaseload,
  type RiskFilter,
  type EngagementFilter,
  type SortPreset,
} from "@/components/clinician/CaseloadFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleHelpButton } from "@/components/RoleHelpButton";
import { DashboardTour } from "@/components/tour/DashboardTour";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Stethoscope, Users, AlertTriangle, Clock, X, RefreshCw,
  Brain, ExternalLink, ClipboardList
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { localYYYYMMDD } from "@/lib/localDate";

export default function ClinicianPanel() {
  const { patients, isLoading, error, lastUpdatedAt, refetch } = useClinicianCaseload();
  const { switchProfile } = useProfile();
  const navigate = useNavigate();

  // Filter/sort state
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [engagementFilter, setEngagementFilter] = useState<EngagementFilter>("all");
  const [sortPreset, setSortPreset] = useState<SortPreset>("needs_attention");
  const [aphasiaFilter, setAphasiaFilter] = useState("all");
  const [lateralityFilter, setLateralityFilter] = useState("all");
  const [chronicityFilter, setChronicityFilter] = useState("all");

  // Apply base filters first
  const baseFiltered = useMemo(
    () => filterAndSortCaseload(patients, search, riskFilter, engagementFilter, sortPreset),
    [patients, search, riskFilter, engagementFilter, sortPreset]
  );

  // Apply phenotype filters on top
  const filtered = useMemo(() => {
    let result = baseFiltered;
    if (aphasiaFilter !== "all") {
      result = result.filter(p => (p.aphasiaType || "unknown") === aphasiaFilter);
    }
    if (lateralityFilter !== "all") {
      result = result.filter(p => (p.laterality || "unknown") === lateralityFilter);
    }
    if (chronicityFilter !== "all") {
      result = result.filter(p => (p.chronicity || "unknown") === chronicityFilter);
    }
    return result;
  }, [baseFiltered, aphasiaFilter, lateralityFilter, chronicityFilter]);

  // Unique phenotype values for filter dropdowns
  const phenotypeOptions = useMemo(() => {
    const aphasia = new Set<string>();
    const lat = new Set<string>();
    const chron = new Set<string>();
    for (const p of patients) {
      aphasia.add(p.aphasiaType || "unknown");
      lat.add(p.laterality || "unknown");
      chron.add(p.chronicity || "unknown");
    }
    return {
      aphasia: Array.from(aphasia).sort(),
      laterality: Array.from(lat).sort(),
      chronicity: Array.from(chron).sort(),
    };
  }, [patients]);

  // Needs attention patients
  const needsAttention = useMemo(() => {
    const now = new Date();
    const threeDaysAgo = localYYYYMMDD(new Date(now.getTime() - 3 * 86400000));
    return patients.filter(p =>
      p.criticalAlertCount > 0 ||
      p.trend === "down" ||
      (!p.lastActiveDate || p.lastActiveDate <= threeDaysAgo) ||
      (p.activeAlertCount > 0 && p.trend !== "up")
    ).sort((a, b) => {
      if (a.criticalAlertCount !== b.criticalAlertCount) return b.criticalAlertCount - a.criticalAlertCount;
      if (a.trend === "down" && b.trend !== "down") return -1;
      if (b.trend === "down" && a.trend !== "down") return 1;
      return b.activeAlertCount - a.activeAlertCount;
    }).slice(0, 5);
  }, [patients]);

  // Cohort snapshot
  const cohortSnapshot = useMemo(() => {
    const withAccuracy = patients.filter(p => p.avgAccuracy7d != null);
    const avgAccuracy = withAccuracy.length > 0
      ? Math.round(withAccuracy.reduce((s, p) => s + p.avgAccuracy7d!, 0) / withAccuracy.length)
      : null;
    const avgAdherence = patients.length > 0
      ? Math.round(patients.reduce((s, p) => s + p.adherenceDays7d, 0) / patients.length * 10) / 10
      : null;

    const issueCounts: Record<string, number> = {};
    for (const p of patients) {
      if (p.trend === "down") issueCounts["Declining"] = (issueCounts["Declining"] || 0) + 1;
      if (p.criticalAlertCount > 0) issueCounts["Critical alerts"] = (issueCounts["Critical alerts"] || 0) + 1;
      if (!p.lastActiveDate || p.lastActiveDate <= localYYYYMMDD(new Date(Date.now() - 3 * 86400000)))
        issueCounts["Low adherence"] = (issueCounts["Low adherence"] || 0) + 1;
    }
    const topIssue = Object.entries(issueCounts).sort((a, b) => b[1] - a[1])[0];

    return { avgAccuracy, avgAdherence, topIssue: topIssue ? `${topIssue[0]} (${topIssue[1]})` : "None" };
  }, [patients]);

  const handlePatientClick = useCallback(async (profileId: string) => {
    try {
      await switchProfile(profileId);
      navigate("/clinician/review");
    } catch (err) {
      console.error("[ClinicianPanel] profile switch failed:", err);
      toast.error("Could not switch to patient profile");
    }
  }, [switchProfile, navigate]);

  const hasActiveFilters = riskFilter !== "all" || engagementFilter !== "all" || search.trim() ||
    aphasiaFilter !== "all" || lateralityFilter !== "all" || chronicityFilter !== "all";

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      <DashboardTour role="clinician" ready={!isLoading} />
      {/* Header */}
      <div data-tour="cl-header" className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Clinician Dashboard</h1>
          <Badge variant="secondary" className="text-xs">{patients.length} patients</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RoleHelpButton role="clinician" spotlight className="h-7 w-7" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/clinician/trial")}
            className="h-7 gap-1.5 text-xs"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Trial
          </Button>
          <span>
            {lastUpdatedAt
              ? lastUpdatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
              : "—"}
          </span>
          <button
            type="button"
            onClick={refetch}
            disabled={isLoading}
            className="p-1 rounded-md hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="Refresh caseload"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Needs Attention Section — PRIMARY, visually dominant */}
      {!isLoading && needsAttention.length > 0 && (
        <Card data-tour="cl-attention" className="border-l-4 border-l-destructive/60 shadow-md">
          <CardHeader className="pb-3 pt-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Needs Attention
              <Badge variant="destructive" className="text-xs">{needsAttention.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-2">
              {needsAttention.map(p => {
                // Build reason string
                const reasons: string[] = [];
                if (p.criticalAlertCount > 0) reasons.push(`${p.criticalAlertCount} critical alert${p.criticalAlertCount > 1 ? "s" : ""}`);
                if (p.trend === "down") reasons.push("declining accuracy");
                if (!p.lastActiveDate || p.lastActiveDate <= localYYYYMMDD(new Date(Date.now() - 3 * 86400000)))
                  reasons.push("inactive ≥3d");
                if (p.activeAlertCount > 0 && p.criticalAlertCount === 0) reasons.push(`${p.activeAlertCount} alert${p.activeAlertCount > 1 ? "s" : ""}`);

                return (
                  <button
                    key={p.profileId}
                    onClick={() => handlePatientClick(p.profileId)}
                    className="w-full flex items-center justify-between text-sm p-3 rounded-lg hover:bg-muted/60 transition-colors text-left border border-border/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-semibold truncate">{p.name}</span>
                      {p.aphasiaLabel && <span className="text-xs text-muted-foreground shrink-0">{p.aphasiaLabel}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">{reasons.join(" · ")}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cohort Snapshot */}
      {!isLoading && patients.length > 0 && (
        <div data-tour="cl-cohort" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Avg Accuracy</div>
            <div className="text-lg font-bold">{cohortSnapshot.avgAccuracy != null ? `${cohortSnapshot.avgAccuracy}%` : "—"}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Avg Adherence</div>
            <div className="text-lg font-bold">{cohortSnapshot.avgAdherence != null ? `${cohortSnapshot.avgAdherence}d/wk` : "—"}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">Top Issue</div>
            <div className="text-sm font-medium mt-0.5">{cohortSnapshot.topIssue}</div>
          </Card>
          <Card className="p-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate("/admin/cohort-research")}>
            <div className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              Research <ExternalLink className="w-2.5 h-2.5" />
            </div>
            <div className="text-sm font-medium mt-0.5 text-primary">Cohort Analytics →</div>
          </Card>
        </div>
      )}

      {/* Filters — single surface (removed redundant triage chips) */}
      {!isLoading && patients.length > 0 && (
        <div data-tour="cl-filters" className="space-y-3">
          <CaseloadFilters
            search={search}
            onSearchChange={setSearch}
            riskFilter={riskFilter}
            onRiskFilterChange={setRiskFilter}
            engagementFilter={engagementFilter}
            onEngagementFilterChange={setEngagementFilter}
            sortPreset={sortPreset}
            onSortPresetChange={setSortPreset}
            totalCount={patients.length}
            filteredCount={filtered.length}
          />
          {/* Phenotype filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Brain className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Phenotype:</span>
            {phenotypeOptions.aphasia.length > 1 && (
              <Select value={aphasiaFilter} onValueChange={setAphasiaFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Aphasia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All aphasia</SelectItem>
                  {phenotypeOptions.aphasia.map(v => (
                    <SelectItem key={v} value={v}>{v === "unknown" ? "Not classified" : v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {phenotypeOptions.laterality.length > 1 && (
              <Select value={lateralityFilter} onValueChange={setLateralityFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Laterality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sides</SelectItem>
                  {phenotypeOptions.laterality.map(v => (
                    <SelectItem key={v} value={v}>{v === "unknown" ? "Unknown" : v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {phenotypeOptions.chronicity.length > 1 && (
              <Select value={chronicityFilter} onValueChange={setChronicityFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Chronicity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All phases</SelectItem>
                  {phenotypeOptions.chronicity.map(v => (
                    <SelectItem key={v} value={v}>{v === "unknown" ? "Unknown" : v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setRiskFilter("all");
                  setEngagementFilter("all");
                  setSearch("");
                  setAphasiaFilter("all");
                  setLateralityFilter("all");
                  setChronicityFilter("all");
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto sm:ml-0"
              >
                <X className="w-3 h-3" />
                <span>Clear filters</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">
          <p className="text-sm">{error}</p>
        </div>
      ) : patients.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Users className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">No assigned patients</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Patient assignments will appear here once linked by an administrator.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No patients match the current filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((patient) => (
            <PatientCard
              key={patient.profileId}
              patient={patient}
              onClick={handlePatientClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
