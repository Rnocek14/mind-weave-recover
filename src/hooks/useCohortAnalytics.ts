/**
 * Hook for cohort-level analytics queries.
 * Queries across patients using phenotype columns, exercise events, retention snapshots,
 * cue data, adaptation events, and functional check-ins.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface PhenotypeDistribution {
  field: string;
  counts: { value: string; count: number }[];
}

export interface GameEffectivenessRow {
  exerciseSlug: string;
  phenotypeField: string;
  phenotypeValue: string;
  avgScore: number;
  trialCount: number;
  patientCount: number;
  improvementSlope: number | null;
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
  avgCommunication: number;
  avgParticipation: number;
  avgIndependence: number;
  avgBurden: number;
  count: number;
}

export interface FunctionalImpactRow {
  phenotypeValue: string;
  avgInAppAccuracy: number;
  avgFunctionalScore: number;
  gap: number;
  patientCount: number;
}

export interface AdaptationEffectivenessRow {
  adaptationType: string;
  fireCount: number;
  phenotypeValue: string;
  patientCount: number;
  avgConfidence: string;
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

export function useCohortAnalytics() {
  const [phenotypeDistributions, setPhenotypeDistributions] = useState<PhenotypeDistribution[]>([]);
  const [gameEffectiveness, setGameEffectiveness] = useState<GameEffectivenessRow[]>([]);
  const [cueEffectiveness, setCueEffectiveness] = useState<CueEffectivenessRow[]>([]);
  const [retentionByCohort, setRetentionByCohort] = useState<RetentionCohortRow[]>([]);
  const [retentionByExercise, setRetentionByExercise] = useState<RetentionByExercise[]>([]);
  const [retentionByCue, setRetentionByCue] = useState<RetentionByCue[]>([]);
  const [plateauData, setPlateauData] = useState<PlateauRow[]>([]);
  const [functionalTrends, setFunctionalTrends] = useState<FunctionalTrend[]>([]);
  const [functionalImpact, setFunctionalImpact] = useState<FunctionalImpactRow[]>([]);
  const [adaptationEffectiveness, setAdaptationEffectiveness] = useState<AdaptationEffectivenessRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // ─── Shared: profiles ───
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, profile_name, aphasia_type, stroke_mechanism_tag, laterality, primary_territory, chronicity_tag");

      if (!profiles) throw new Error("Failed to load profiles");

      const profileMap = new Map<string, ProfileRow>(profiles.map((p) => [p.id, p]));

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

      // ─── Shared: sessions → profile mapping ───
      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, profile_id, started_at");

      const sessionProfileMap = new Map<string, string>();
      const profileSessionIds = new Map<string, string[]>();
      if (sessions) {
        for (const s of sessions) {
          if (s.profile_id) {
            sessionProfileMap.set(s.id, s.profile_id);
            if (!profileSessionIds.has(s.profile_id)) profileSessionIds.set(s.profile_id, []);
            profileSessionIds.get(s.profile_id)!.push(s.id);
          }
        }
      }

      // ─── Shared: exercise events (limited to 5000) ───
      const { data: events } = await supabase
        .from("exercise_events")
        .select("session_id, exercise_slug, score, cue_type_given, cue_was_effective, reaction_time_ms, created_at, trial_index")
        .order("created_at", { ascending: true })
        .limit(5000);

      const eventList = events || [];

      // ─── 2. Game Effectiveness by Cohort ───
      {
        const gameMap = new Map<string, { scores: number[]; patients: Set<string>; timestamps: number[] }>();
        for (const e of eventList) {
          if (!e.exercise_slug || e.score == null) continue;
          const profileId = sessionProfileMap.get(e.session_id);
          if (!profileId) continue;
          const profile = profileMap.get(profileId);
          const aphasiaType = profile?.aphasia_type || "unknown";
          const key = `${e.exercise_slug}||${aphasiaType}`;
          if (!gameMap.has(key)) gameMap.set(key, { scores: [], patients: new Set(), timestamps: [] });
          const g = gameMap.get(key)!;
          g.scores.push(e.score);
          g.patients.add(profileId);
          g.timestamps.push(new Date(e.created_at || 0).getTime());
        }

        const gameRows: GameEffectivenessRow[] = Array.from(gameMap.entries())
          .filter(([, g]) => g.scores.length >= 3)
          .map(([key, g]) => {
            const [exerciseSlug, phenotypeValue] = key.split("||");
            // Simple improvement slope: compare first third vs last third
            const third = Math.max(1, Math.floor(g.scores.length / 3));
            const firstThird = avg(g.scores.slice(0, third));
            const lastThird = avg(g.scores.slice(-third));
            return {
              exerciseSlug,
              phenotypeField: "aphasia_type",
              phenotypeValue,
              avgScore: avg(g.scores),
              trialCount: g.scores.length,
              patientCount: g.patients.size,
              improvementSlope: Math.round((lastThird - firstThird) * 10) / 10,
            };
          })
          .sort((a, b) => (b.improvementSlope ?? 0) - (a.improvementSlope ?? 0));

        setGameEffectiveness(gameRows);
      }

      // ─── 3. Cue Effectiveness by Cohort ───
      {
        const cueMap = new Map<string, { successes: number; total: number; patients: Set<string> }>();
        for (const e of eventList) {
          if (!e.cue_type_given) continue;
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
      const { data: retentionData } = await supabase
        .from("retention_snapshots")
        .select("profile_id, word, best_score, last_score, session_count, topic");

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
        const profileAccuracyOverTime = new Map<string, { sessionAccuracies: number[]; fatigueFlags: number; lowAdherence: boolean }>();
        const profileSessionScores = new Map<string, Map<string, number[]>>();

        for (const e of eventList) {
          const profileId = sessionProfileMap.get(e.session_id);
          if (!profileId || e.score == null) continue;
          if (!profileSessionScores.has(profileId)) profileSessionScores.set(profileId, new Map());
          const pss = profileSessionScores.get(profileId)!;
          if (!pss.has(e.session_id)) pss.set(e.session_id, []);
          pss.get(e.session_id)!.push(e.score);
        }

        for (const [profileId, sessMap] of profileSessionScores) {
          const sessionAccuracies = Array.from(sessMap.values()).map((scores) => {
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
      const { data: checkins } = await supabase
        .from("functional_checkins")
        .select("checkin_date, communication_of_needs, conversational_participation, independence_level, caregiver_burden, profile_id")
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

        // Functional impact: compare in-app accuracy to functional scores by phenotype
        const profileFunctionalScores = new Map<string, number>();
        for (const c of checkins) {
          if (!c.profile_id) continue;
          const scores = [c.communication_of_needs, c.conversational_participation, c.independence_level].filter((s): s is number => s != null);
          if (scores.length > 0) {
            profileFunctionalScores.set(c.profile_id, avg(scores));
          }
        }

        const impactByType = new Map<string, { inAppScores: number[]; functionalScores: number[]; patients: Set<string> }>();
        for (const [profileId, funcScore] of profileFunctionalScores) {
          const profile = profileMap.get(profileId);
          const aphasiaType = profile?.aphasia_type || "unknown";
          if (!impactByType.has(aphasiaType)) impactByType.set(aphasiaType, { inAppScores: [], functionalScores: [], patients: new Set() });
          const g = impactByType.get(aphasiaType)!;
          g.functionalScores.push(funcScore);
          g.patients.add(profileId);

          // Get in-app accuracy for this profile
          const profileEvents = eventList.filter(e => {
            const pid = sessionProfileMap.get(e.session_id);
            return pid === profileId && e.score != null;
          });
          if (profileEvents.length > 0) {
            const correct = profileEvents.filter(e => (e.score ?? 0) > 0).length;
            g.inAppScores.push(Math.round((correct / profileEvents.length) * 100));
          }
        }

        setFunctionalImpact(
          Array.from(impactByType.entries())
            .filter(([, g]) => g.functionalScores.length > 0 && g.inAppScores.length > 0)
            .map(([phenotypeValue, g]) => {
              const avgInApp = avg(g.inAppScores);
              const avgFunc = avg(g.functionalScores.map(s => s * 20)); // scale 1-5 to 0-100
              return {
                phenotypeValue,
                avgInAppAccuracy: avgInApp,
                avgFunctionalScore: avgFunc,
                gap: Math.round(avgInApp - avgFunc),
                patientCount: g.patients.size,
              };
            })
        );
      }

      // ─── 7. Adaptation Effectiveness ───
      const { data: adaptations } = await supabase
        .from("adaptation_events")
        .select("adaptation_type, confidence, profile_id")
        .limit(2000);

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

      const { data: sessionIds } = await supabase.from("sessions").select("id").eq("profile_id", p.id);
      const sids = sessionIds?.map(s => s.id) || [];

      const { data: events } = sids.length > 0
        ? await supabase.from("exercise_events").select("score").in("session_id", sids)
        : { data: [] };

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

      const scores = (events || []).map(e => e.score).filter((s): s is number => s != null);
      const avgAcc = scores.length > 0 ? Math.round(scores.filter(s => s > 0).length / scores.length * 100) : null;

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
        trialCount: (events || []).length,
        avgAccuracy: avgAcc,
        retentionRate: null,
        adaptationCount: adaptationCount || 0,
        latestFunctionalScore: functionalAvg,
      });
    }
    return rows;
  }, []);

  return {
    phenotypeDistributions,
    gameEffectiveness,
    cueEffectiveness,
    retentionByCohort,
    retentionByExercise,
    retentionByCue,
    plateauData,
    functionalTrends,
    functionalImpact,
    adaptationEffectiveness,
    isLoading,
    error,
    refetch: fetchData,
    generateExport,
  };
}
