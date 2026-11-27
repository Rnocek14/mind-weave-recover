import { supabase } from "@/integrations/supabase/client";
import { readAllById } from "./readAllById";
import { normalizeExerciseSlug } from "@/lib/exerciseSlugNormalizer";
import { isScoredClinicalEvidence, type ScoredEvidence } from "./scoredEvidence";

export const readCohortProfiles = () => readAllById(after => {
  let q = supabase.from("profiles")
    .select("id, profile_name, aphasia_type, stroke_mechanism_tag, laterality, primary_territory, chronicity_tag")
    .eq("profile_kind", "patient").order("id").limit(500);
  if (after) q = q.gt("id", after);
  return q;
});

export const readCohortSessions = () => readAllById(after => {
  let q = supabase.from("sessions").select("id, profile_id, started_at").not("profile_id", "is", null).order("id").limit(500);
  if (after) q = q.gt("id", after);
  return q;
});

export const readCohortEvents = () => readAllById(after => {
  let q = supabase.from("exercise_events")
    .select("id, profile_id, session_id, attempt_id, exercise_slug, score, cue_type_given, cue_was_effective, created_at, trial_index, counts_toward_score, validity_label, clinician_validity_override, task_parameters, engagement_flags")
    .not("exercise_slug", "is", null).order("id").limit(500);
  if (after) q = q.gt("id", after);
  return q;
});

type Session = { id: string; profile_id: string | null; started_at: string };
type Event = ScoredEvidence & { id: string; session_id: string; profile_id: string | null; attempt_id: string | null;
  exercise_slug: string | null; trial_index: number | null; created_at: string | null; score: number | null };

export function cohortPractice<P extends { id: string }, E extends Event>(profiles: P[], sessions: Session[], events: E[]) {
  const perPatient = new Map(profiles.map(p => [p.id, { sessions: 0, attempts: 0, indexed: 0, unindexed: 0, scored: 0, positive: 0 }]));
  const sessionProfileMap = new Map<string, string>();
  for (const s of sessions) {
    if (!s.profile_id || sessionProfileMap.has(s.id)) continue;
    const patient = perPatient.get(s.profile_id);
    if (!patient) continue;
    sessionProfileMap.set(s.id, s.profile_id);
    patient.sessions++;
  }
  const seenAttempts = new Set<string>();
  const indexed = new Set<string>();
  const eventList: E[] = [];
  let unindexed = 0;
  for (const e of events) {
    const pid = sessionProfileMap.get(e.session_id);
    // A legacy event can inherit its session's patient. A conflicting explicit
    // tag is ambiguous and must never be attributed to either patient.
    if (!pid || !e.exercise_slug?.trim() || (e.profile_id && e.profile_id !== pid)) continue;
    const attempt = e.attempt_id ? `attempt:${e.attempt_id}` : `event:${e.id}`;
    if (seenAttempts.has(attempt)) continue;
    seenAttempts.add(attempt);
    eventList.push(e);
    const patient = perPatient.get(pid)!;
    patient.attempts++;
    if (Number.isInteger(e.trial_index) && e.trial_index! >= 0) {
      const key = JSON.stringify([e.session_id, normalizeExerciseSlug(e.exercise_slug), e.trial_index]);
      if (!indexed.has(key)) { indexed.add(key); patient.indexed++; }
    } else { unindexed++; patient.unindexed++; }
    if (e.score != null && isScoredClinicalEvidence(e)) {
      patient.scored++;
      if (e.score > 0) patient.positive++;
    }
  }
  eventList.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id));
  const counts = { patientCount: perPatient.size, sessionCount: sessionProfileMap.size, trialCount: seenAttempts.size,
    indexedCount: indexed.size, unindexedCount: unindexed };
  return { counts, perPatient, sessionProfileMap, eventList };
}
