/**
 * Hook for cohort-level analytics queries.
 * Admin-only — queries across patients using phenotype columns and retention snapshots.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PhenotypeDistribution {
  field: string;
  counts: { value: string; count: number }[];
}

export interface RetentionByPhenotype {
  phenotype: string;
  phenotypeValue: string;
  avgRetentionRate: number;
  patientCount: number;
  wordCount: number;
}

export interface CueEffectiveness {
  cueType: string;
  phenotypeValue: string;
  avgAccuracy: number;
  trialCount: number;
}

export interface GamePerformance {
  exerciseSlug: string;
  phenotypeValue: string;
  avgAccuracy: number;
  trialCount: number;
}

export interface FunctionalTrend {
  checkinDate: string;
  avgCommunication: number;
  avgParticipation: number;
  avgIndependence: number;
  avgBurden: number;
  count: number;
}

export interface CohortExportRow {
  profileId: string;
  profileName: string;
  aphasiaType: string | null;
  laterality: string | null;
  chronicity: string | null;
  strokeMechanism: string | null;
  sessionCount: number;
  trialCount: number;
  avgAccuracy: number | null;
  retentionRate: number | null;
  adaptationCount: number;
  latestFunctionalScore: number | null;
}

export function useCohortAnalytics() {
  const [phenotypeDistributions, setPhenotypeDistributions] = useState<PhenotypeDistribution[]>([]);
  const [retentionByPhenotype, setRetentionByPhenotype] = useState<RetentionByPhenotype[]>([]);
  const [functionalTrends, setFunctionalTrends] = useState<FunctionalTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Phenotype distributions
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, aphasia_type, stroke_mechanism_tag, laterality, primary_territory, chronicity_tag, profile_name");

      if (profiles) {
        const fields = ["aphasia_type", "stroke_mechanism_tag", "laterality", "primary_territory", "chronicity_tag"] as const;
        const distributions: PhenotypeDistribution[] = fields.map((field) => {
          const countMap = new Map<string, number>();
          for (const p of profiles) {
            const val = (p as any)[field] || "unknown";
            countMap.set(val, (countMap.get(val) || 0) + 1);
          }
          return {
            field,
            counts: Array.from(countMap.entries())
              .map(([value, count]) => ({ value, count }))
              .sort((a, b) => b.count - a.count),
          };
        });
        setPhenotypeDistributions(distributions);
      }

      // 2. Retention by phenotype
      const { data: retentionData } = await supabase
        .from("retention_snapshots")
        .select("profile_id, word, best_score, session_count");

      if (retentionData && profiles) {
        const profileMap = new Map(profiles.map((p) => [p.id, p]));
        const grouped = new Map<string, { totalRetained: number; totalTracked: number; wordCount: number; patients: Set<string> }>();

        for (const r of retentionData) {
          if (!r.profile_id || (r.session_count ?? 0) < 2) continue;
          const profile = profileMap.get(r.profile_id);
          const aphasiaType = profile?.aphasia_type || "unknown";
          const key = `aphasia_type:${aphasiaType}`;

          if (!grouped.has(key)) grouped.set(key, { totalRetained: 0, totalTracked: 0, wordCount: 0, patients: new Set() });
          const g = grouped.get(key)!;
          g.totalTracked++;
          g.wordCount++;
          g.patients.add(r.profile_id);
          if ((r.best_score ?? 0) >= 3) g.totalRetained++;
        }

        setRetentionByPhenotype(
          Array.from(grouped.entries()).map(([key, g]) => {
            const [phenotype, phenotypeValue] = key.split(":");
            return {
              phenotype,
              phenotypeValue,
              avgRetentionRate: g.totalTracked > 0 ? Math.round((g.totalRetained / g.totalTracked) * 100) : 0,
              patientCount: g.patients.size,
              wordCount: g.wordCount,
            };
          })
        );
      }

      // 3. Functional trends
      const { data: checkins } = await supabase
        .from("functional_checkins")
        .select("checkin_date, communication_of_needs, conversational_participation, independence_level, caregiver_burden")
        .order("checkin_date", { ascending: true });

      if (checkins) {
        const byDate = new Map<string, { comm: number[]; part: number[]; ind: number[]; bur: number[] }>();
        for (const c of checkins) {
          const date = c.checkin_date;
          if (!byDate.has(date)) byDate.set(date, { comm: [], part: [], ind: [], bur: [] });
          const d = byDate.get(date)!;
          if (c.communication_of_needs != null) d.comm.push(c.communication_of_needs);
          if (c.conversational_participation != null) d.part.push(c.conversational_participation);
          if (c.independence_level != null) d.ind.push(c.independence_level);
          if (c.caregiver_burden != null) d.bur.push(c.caregiver_burden);
        }
        setFunctionalTrends(
          Array.from(byDate.entries()).map(([date, d]) => ({
            checkinDate: date,
            avgCommunication: avg(d.comm),
            avgParticipation: avg(d.part),
            avgIndependence: avg(d.ind),
            avgBurden: avg(d.bur),
            count: d.comm.length,
          }))
        );
      }
    } catch (err) {
      console.error("[CohortAnalytics] Error:", err);
      setError("Failed to load cohort analytics data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // CSV export
  const generateExport = useCallback(async (): Promise<CohortExportRow[]> => {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, profile_name, aphasia_type, laterality, chronicity_tag, stroke_mechanism_tag");

    if (!profiles) return [];

    const rows: CohortExportRow[] = [];

    for (const p of profiles) {
      const { count: sessionCount } = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", p.id);

      const { data: events } = await supabase
        .from("exercise_events")
        .select("score, session_id")
        .in("session_id", (await supabase.from("sessions").select("id").eq("profile_id", p.id)).data?.map(s => s.id) || []);

      const { count: adaptationCount } = await supabase
        .from("adaptation_events")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", p.id);

      const { data: latestCheckin } = await supabase
        .from("functional_checkins")
        .select("communication_of_needs, conversational_participation, independence_level, caregiver_burden")
        .eq("profile_id", p.id)
        .order("checkin_date", { ascending: false })
        .limit(1);

      const scores = events?.map(e => e.score).filter((s): s is number => s != null) || [];
      const avgAcc = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + (b > 0 ? 1 : 0), 0) / scores.length * 100) : null;

      const fc = latestCheckin?.[0];
      const functionalAvg = fc ? Math.round(((fc.communication_of_needs || 0) + (fc.conversational_participation || 0) + (fc.independence_level || 0) + (fc.caregiver_burden || 0)) / 4 * 20) : null;

      rows.push({
        profileId: p.id,
        profileName: p.profile_name,
        aphasiaType: p.aphasia_type,
        laterality: p.laterality,
        chronicity: p.chronicity_tag,
        strokeMechanism: p.stroke_mechanism_tag,
        sessionCount: sessionCount || 0,
        trialCount: events?.length || 0,
        avgAccuracy: avgAcc,
        retentionRate: null, // would need retention_snapshots aggregation
        adaptationCount: adaptationCount || 0,
        latestFunctionalScore: functionalAvg,
      });
    }

    return rows;
  }, []);

  return { phenotypeDistributions, retentionByPhenotype, functionalTrends, isLoading, error, refetch: fetchData, generateExport };
}

function avg(arr: number[]): number {
  return arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
}
