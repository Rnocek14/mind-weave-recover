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
import { Stethoscope, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

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
