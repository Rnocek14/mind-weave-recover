import { useState, useMemo, useCallback } from "react";
import { useClinicianCaseload } from "@/hooks/useClinicianCaseload";
import { PatientCard } from "@/components/clinician/PatientCard";
import {
  CaseloadFilters,
  filterAndSortCaseload,
  type RiskFilter,
  type EngagementFilter,
  type SortPreset,
} from "@/components/clinician/CaseloadFilters";
import { Stethoscope, Users, Info, AlertTriangle, Bell, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { localYYYYMMDD } from "@/lib/localDate";

export default function ClinicianPanel() {
  const { patients, isLoading, error } = useClinicianCaseload();
  const { switchProfile } = useProfile();
  const navigate = useNavigate();

  // Filter/sort state
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [engagementFilter, setEngagementFilter] = useState<EngagementFilter>("all");
  const [sortPreset, setSortPreset] = useState<SortPreset>("needs_attention");

  const filtered = useMemo(
    () => filterAndSortCaseload(patients, search, riskFilter, engagementFilter, sortPreset),
    [patients, search, riskFilter, engagementFilter, sortPreset]
  );

  // Triage rollup counts
  const triage = useMemo(() => {
    const now = new Date();
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = localYYYYMMDD(threeDaysAgo);

    let critical = 0;
    let hasAlerts = 0;
    let inactive3d = 0;

    for (const p of patients) {
      if (p.criticalAlertCount > 0) critical++;
      if (p.activeAlertCount > 0) hasAlerts++;
      if (!p.lastActiveDate || p.lastActiveDate <= threeDaysAgoStr) inactive3d++;
    }

    return { critical, hasAlerts, inactive3d };
  }, [patients]);

  const handlePatientClick = useCallback(async (profileId: string) => {
    try {
      await switchProfile(profileId);
      navigate("/dashboard");
    } catch (err) {
      console.error("[ClinicianPanel] profile switch failed:", err);
      toast.error("Could not switch to patient profile");
    }
  }, [switchProfile, navigate]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Caseload</h1>
        </div>
      </div>

      {/* Mode A banner */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Caseload is currently based on profiles visible via permissions (Mode A).
          Clinician assignments will be enabled in Sprint 3.
        </p>
      </div>

      {/* Triage rollup */}
      {!isLoading && patients.length > 0 && (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            <span className="font-medium text-destructive">{triage.critical}</span>
            <span className="text-muted-foreground">Critical</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-medium text-amber-600">{triage.hasAlerts}</span>
            <span className="text-muted-foreground">Has alerts</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-medium">{triage.inactive3d}</span>
            <span className="text-muted-foreground">Inactive ≥3d</span>
          </div>
        </div>
      )}

      {/* Filters */}
      {!isLoading && patients.length > 0 && (
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
      )}

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-lg bg-muted/50 animate-pulse"
            />
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
