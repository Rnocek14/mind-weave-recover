/**
 * Hook for cohort-level analytics queries.
 * Queries across patients using phenotype columns, exercise events, retention snapshots,
 * cue data, adaptation events, and functional check-ins.
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

import { cohortPractice, readCohortProfiles, readCohortSessions, readCohortEvents } from "@/lib/clinical/cohortPractice";
import { readAllById } from "@/lib/clinical/readAllById";
import { pairedGamePractice, type CohortDimension } from "@/lib/clinical/pairedGamePractice";
import { isComparableScoredEvent } from "@/lib/clinical/metricsPresentation";
import { hasDeliveredCue } from "@/lib/clinical/scoredEvidence";

// ── Types ──

export interface PhenotypeDistribution {
  field: string;
  counts: { value: string; count: number }[];
}

export interface CueEffectivenessRow {
  cueType: string;
  phenotypeField: string;
  phenotypeValue: string;
  immediateSuccessRate: number;
  trialCount: number;
  retentionEffect: number | null;
}

export interface RetentionCohortRow {
  phenotypeField: string;
  phenotypeValue: string;
  totalWords: number;
  retainedWords: number;
  weakWords: number;
  lostWords: number;
  retentionRate: number;
  patientCount: number;
}

export interface RetentionByExercise {
  exerciseSlug: string;
  totalWords: number;
  retainedWords: number;
  retentionRate: number;
}

export interface RetentionByCue {
  cueType: string;
  totalWords: number;
  retainedWords: number;
  retentionRate: number;
}

export interface PlateauRow {
  phenotypeValue: string;
  patientCount: number;
  avgSessionsToPlateauOrNull: number | null;
  plateauRate: number;
  predictors: string[];
}

export interface FunctionalTrend {
  checkinDate: string;
  avgCommunication: number | null;
  avgParticipation: number | null;
  avgIndependence: number | null;
  avgBurden: number | null;
  count: number;
}

export interface AdaptationEffectivenessRow {
  adaptationType: string;
  fireCount: number;
  phenotypeValue: string;
  patientCount: number;
  avgConfidence: string;
}

// ── Helper ──

function avg(arr: number[]): number {
  return arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;
}

function classifyRetention(bestScore: number | null, sessionCount: number | null): "retained" | "weak" | "lost" {
  if ((sessionCount ?? 0) < 2) return "weak";
  if ((bestScore ?? 0) >= 4) return "retained";
  if ((bestScore ?? 0) >= 2) return "weak";
  return "lost";
}

type ProfileRow = {
  id: string;
  profile_name: string;
  aphasia_type: string | null;
  stroke_mechanism_tag: string | null;
  laterality: string | null;
  primary_territory: string | null;
  chronicity_tag: string | null;
};

// ── Hook ──

export function useCohortAnalytics(dimension: CohortDimension) {
  const [phenotypeDistributions, setPhenotypeDistributions] = useState<PhenotypeDistribution[]>([]);
  const [practice, setPractice] = useState<{
    profiles: Awaited<ReturnType<typeof readCohortProfiles>>;
    events: Awaited<ReturnType<typeof readCohortEvents>>;
    sessions: Map<string, string>;
  } | null>(null);
  const gamePractice = useMemo(() => practice
    ? pairedGamePractice(practice.profiles, practice.events, practice.sessions, dimension) : [], [practice, dimension]);
  const [cueEffectiveness, setCueEffectiveness] = useState<CueEffectivenessRow[]>([]);
  const [retentionByCohort, setRetentionByCohort] = useState<RetentionCohortRow[]>([]);
  const [retentionByExercise, setRetentionByExercise] = useState<RetentionByExercise[]>([]);
  const [retentionByCue, setRetentionByCue] = useState<RetentionByCue[]>([]);
  const [plateauData, setPlateauData] = useState<PlateauRow[]>([]);
  const [functionalTrends, setFunctionalTrends] = useState<FunctionalTrend[]>([]);
  const [adaptationEffectiveness, setAdaptationEffectiveness] = useState<AdaptationEffectivenessRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  const [coverage, setCoverage] = useState<ReturnType<typeof cohortPractice>["counts"] | null>(null);
  const fetchData = useCallback(async () => {
    const request = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const [profiles, sessions, events, allRetention, allCheckins, allAdaptations] = await Promise.all([
        readCohortProfiles(), readCohortSessions(), readCohortEvents(),
        readAllById(after => {
          let q = supabase.from("retention_snapshots").select("id, profile_id, word, best_score, last_score, session_count, topic").order("id").limit(500);
          if (after) q = q.gt("id", after);
          return q;
        }),
        readAllById(after => {
          let q = supabase.from("functional_checkins").select("id, checkin_date, communication_of_needs, conversational_participation, independence_level, caregiver_burden, profile_id").order("id").limit(500);
          if (after) q = q.gt("id", after);
          return q;
        }),
        readAllById(after => {
          let q = supabase.from("adaptation_events").select("id, adaptation_type, confidence, profile_id").order("id").limit(500);
          if (after) q = q.gt("id", after);
          return q;
        }),
      ]);
      if (request !== requestId.current) return;
      const profileMap = new Map<string, ProfileRow>(profiles.map(p => [p.id, p]));
      const { counts, sessionProfileMap, eventList } = cohortPractice(profiles, sessions, events);
      setCoverage(counts);
      const inCohort = (row: { profile_id: string | null }) => !!row.profile_id && profileMap.has(row.profile_id);
      const retentionData = allRetention.filter(inCohort);
      const checkins = allCheckins.filter(inCohort).sort((a, b) => a.checkin_date.localeCompare(b.checkin_date) || a.id.localeCompare(b.id));
      const adaptations = allAdaptations.filter(inCohort);
      setPractice({ profiles, events: eventList, sessions: sessionProfileMap });

      // ─── 1. Phenotype distributions ───
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

      // ─── 3. Cue Effectiveness by Cohort ───
      {
        const cueMap = new Map<string, { successes: number; total: number; patients: Set<string> }>();
        for (const e of eventList) {
          if (!hasDeliveredCue(e.cue_type_given) || typeof e.cue_was_effective !== "boolean" || !isComparableScoredEvent(e)) continue;
          const profileId = sessionProfileMap.get(e.session_id);
          if (!profileId) continue;
          const profile = profileMap.get(profileId);
          const aphasiaType = profile?.aphasia_type || "unknown";
          const key = `${e.cue_type_given}||${aphasiaType}`;
          if (!cueMap.has(key)) cueMap.set(key, { successes: 0, total: 0, patients: new Set() });
          const c = cueMap.get(key)!;
          c.total++;
          c.patients.add(profileId);
          if (e.cue_was_effective) c.successes++;
        }

        const cueRows: CueEffectivenessRow[] = Array.from(cueMap.entries())
          .filter(([, c]) => c.total >= 3)
          .map(([key, c]) => {
            const [cueType, phenotypeValue] = key.split("||");
            return {
              cueType,
              phenotypeField: "aphasia_type",
              phenotypeValue,
              immediateSuccessRate: Math.round((c.successes / c.total) * 100),
              trialCount: c.total,
              retentionEffect: null, // requires joining with retention snapshots
            };
          })
          .sort((a, b) => b.immediateSuccessRate - a.immediateSuccessRate);

        setCueEffectiveness(cueRows);
      }

      // ─── 4. Retention / Carryover by Cohort ───
      {
        const retMap = new Map<string, { retained: number; weak: number; lost: number; patients: Set<string>; total: number }>();
        const retByExMap = new Map<string, { retained: number; total: number }>();
        // No direct exercise link on retention_snapshots, so skip retentionByExercise for now

        if (retentionData) {
          for (const r of retentionData) {
            if (!r.profile_id) continue;
            const profile = profileMap.get(r.profile_id);
            const aphasiaType = profile?.aphasia_type || "unknown";
            const key = `aphasia_type||${aphasiaType}`;
            if (!retMap.has(key)) retMap.set(key, { retained: 0, weak: 0, lost: 0, patients: new Set(), total: 0 });
            const g = retMap.get(key)!;
            g.total++;
            g.patients.add(r.profile_id);
            const cls = classifyRetention(r.best_score, r.session_count);
            g[cls]++;

            // By topic (proxy for exercise)
            const topic = r.topic || "general";
            if (!retByExMap.has(topic)) retByExMap.set(topic, { retained: 0, total: 0 });
            const te = retByExMap.get(topic)!;
            te.total++;
            if (cls === "retained") te.retained++;
          }
        }

        setRetentionByCohort(
          Array.from(retMap.entries()).map(([key, g]) => {
            const [phenotypeField, phenotypeValue] = key.split("||");
            return {
              phenotypeField,
              phenotypeValue,
              totalWords: g.total,
              retainedWords: g.retained,
              weakWords: g.weak,
              lostWords: g.lost,
              retentionRate: g.total > 0 ? Math.round((g.retained / g.total) * 100) : 0,
              patientCount: g.patients.size,
            };
          })
        );

        setRetentionByExercise(
          Array.from(retByExMap.entries())
            .filter(([, v]) => v.total >= 2)
            .map(([exerciseSlug, v]) => ({
              exerciseSlug,
              totalWords: v.total,
              retainedWords: v.retained,
              retentionRate: v.total > 0 ? Math.round((v.retained / v.total) * 100) : 0,
            }))
            .sort((a, b) => b.retentionRate - a.retentionRate)
        );

        // Retention by cue — not directly available without joining events to retention, set empty
        setRetentionByCue([]);
      }

      // ─── 5. Plateau / Regression ───
      {
        // Group events by profile, compute accuracy over sessions
        const sessionDates = new Map(sessions.map(s => [s.id, s.started_at]));
        const profileAccuracyOverTime = new Map<string, { sessionAccuracies: number[]; fatigueFlags: number; lowAdherence: boolean }>();
        const profileSessionScores = new Map<string, Map<string, number[]>>();

        for (const e of eventList) {
          const profileId = sessionProfileMap.get(e.session_id);
          if (!profileId || e.score == null || !isComparableScoredEvent(e)) continue;
          if (!profileSessionScores.has(profileId)) profileSessionScores.set(profileId, new Map());
          const pss = profileSessionScores.get(profileId)!;
          if (!pss.has(e.session_id)) pss.set(e.session_id, []);
          pss.get(e.session_id)!.push(e.score);
        }

        for (const [profileId, sessMap] of profileSessionScores) {
          const sessionAccuracies = Array.from(sessMap.entries()).sort(([a], [b]) =>
            (sessionDates.get(a) ?? "").localeCompare(sessionDates.get(b) ?? "") || a.localeCompare(b)).map(([,scores]) => {
            const correct = scores.filter((s) => s > 0).length;
            return Math.round((correct / scores.length) * 100);
          });
          const totalSessions = sessionAccuracies.length;
          profileAccuracyOverTime.set(profileId, {
            sessionAccuracies,
            fatigueFlags: 0, // would need daily_readiness join
            lowAdherence: totalSessions < 3,
          });
        }

        // Detect plateau: last 3 sessions within 5% range and no improvement
        const plateauByType = new Map<string, { plateauCount: number; total: number; patients: Set<string> }>();

        for (const [profileId, data] of profileAccuracyOverTime) {
          if (data.sessionAccuracies.length < 3) continue;
          const profile = profileMap.get(profileId);
          const aphasiaType = profile?.aphasia_type || "unknown";
          if (!plateauByType.has(aphasiaType)) plateauByType.set(aphasiaType, { plateauCount: 0, total: 0, patients: new Set() });
          const g = plateauByType.get(aphasiaType)!;
          g.total++;
          g.patients.add(profileId);

          const accs = data.sessionAccuracies;
          if (accs.length >= 3) {
            const lastThree = accs.slice(-3);
            const range = Math.max(...lastThree) - Math.min(...lastThree);
            const isFlat = range <= 5;
            const noImprovement = lastThree[lastThree.length - 1] <= lastThree[0];
            if (isFlat && noImprovement) g.plateauCount++;
          }
        }

        setPlateauData(
          Array.from(plateauByType.entries())
            .filter(([, g]) => g.total > 0)
            .map(([phenotypeValue, g]) => ({
              phenotypeValue,
              patientCount: g.patients.size,
              avgSessionsToPlateauOrNull: null,
              plateauRate: Math.round((g.plateauCount / g.total) * 100),
              predictors: g.plateauCount > 0 ? ["Flat accuracy trend", "No improvement in last 3 sessions"] : [],
            }))
        );
      }

      // ─── 6. Functional Trends ───
      if (checkins) {
        const byDate = new Map<string, { reports: number; comm: number[]; part: number[]; ind: number[]; bur: number[] }>();
        for (const c of checkins) {
          const date = c.checkin_date;
          if (!byDate.has(date)) byDate.set(date, { reports: 0, comm: [], part: [], ind: [], bur: [] });
          const d = byDate.get(date)!;
          d.reports++;
          if (c.communication_of_needs != null) d.comm.push(c.communication_of_needs);
          if (c.conversational_participation != null) d.part.push(c.conversational_participation);
          if (c.independence_level != null) d.ind.push(c.independence_level);
          if (c.caregiver_burden != null) d.bur.push(c.caregiver_burden);
        }
        setFunctionalTrends(
          Array.from(byDate.entries()).map(([date, d]) => ({
            checkinDate: date,
            avgCommunication: d.comm.length ? avg(d.comm) : null,
            avgParticipation: d.part.length ? avg(d.part) : null,
            avgIndependence: d.ind.length ? avg(d.ind) : null,
            avgBurden: d.bur.length ? avg(d.bur) : null,
            count: d.reports,
          }))
        );

      }

      // ─── 7. Adaptation Effectiveness ───
      if (adaptations) {
        const adaptMap = new Map<string, { count: number; patients: Set<string>; confidences: string[] }>();
        for (const a of adaptations) {
          const profile = a.profile_id ? profileMap.get(a.profile_id) : null;
          const aphasiaType = profile?.aphasia_type || "unknown";
          const key = `${a.adaptation_type}||${aphasiaType}`;
          if (!adaptMap.has(key)) adaptMap.set(key, { count: 0, patients: new Set(), confidences: [] });
          const g = adaptMap.get(key)!;
          g.count++;
          g.confidences.push(a.confidence);
          if (a.profile_id) g.patients.add(a.profile_id);
        }

        setAdaptationEffectiveness(
          Array.from(adaptMap.entries())
            .filter(([, g]) => g.count >= 2)
            .map(([key, g]) => {
              const [adaptationType, phenotypeValue] = key.split("||");
              const modeConf = g.confidences.sort((a, b) =>
                g.confidences.filter(c => c === b).length - g.confidences.filter(c => c === a).length
              )[0];
              return {
                adaptationType,
                fireCount: g.count,
                phenotypeValue,
                patientCount: g.patients.size,
                avgConfidence: modeConf || "unknown",
              };
            })
            .sort((a, b) => b.fireCount - a.fireCount)
        );
      }
    } catch (err) {
      if (request !== requestId.current) return;
      setCoverage(null);
      setPractice(null);
      console.error("[CohortAnalytics] Error:", err);
      setError("Failed to load cohort analytics data");
    } finally {
      if (request === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => { requestId.current++; };
  }, [fetchData]);

  return {
    phenotypeDistributions,
    gamePractice,
    cueEffectiveness,
    retentionByCohort,
    retentionByExercise,
    retentionByCue,
    plateauData,
    functionalTrends,
    adaptationEffectiveness,
    isLoading,
    error,
    refetch: fetchData,
    coverage,
  };
}
