import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { readAllById } from "@/lib/clinical/readAllById";
import { toProgressionSlug } from "@/lib/exerciseSlugNormalizer";
import { getGameClinicalProfile } from "@/lib/leveling/clinicalRungs";

const logFields = "id, exercise_slug, trial_index, created_at, difficulty, difficulty_change_direction, difficulty_change_from, difficulty_change_to, escalation_blocked, success_rate" as const;
type Trial = { id: string; exercise_slug: string; trial_index: number; created_at: string; difficulty: number;
  difficulty_change_direction: string | null; difficulty_change_from: number | null; difficulty_change_to: number | null;
  escalation_blocked: boolean; success_rate: number | null };
type Stage = { exercise_slug: string; current_level: number; last_updated_at: string };

async function readRecentTrials(profileId: string, since: string) {
  const [tagged, sessions] = await Promise.all([
    readAllById(after => {
      let q = supabase.from("adaptation_trial_logs").select(logFields).eq("profile_id", profileId)
        .gte("created_at", since).order("id").limit(500);
      if (after) q = q.gt("id", after);
      return q;
    }),
    readAllById(after => {
      let q = supabase.from("sessions").select("id").eq("profile_id", profileId)
        .or(`ended_at.is.null,ended_at.gte.${since},started_at.gte.${since}`).order("id").limit(500);
      if (after) q = q.gt("id", after);
      return q;
    }),
  ]);
  // Some older log rows identify the patient only through their session.
  // There is no PostgREST foreign key from adaptation_trial_logs to sessions.
  for (let i = 0; i < sessions.length; i += 100) {
    const ids = sessions.slice(i, i + 100).map(session => session.id);
    const legacy = await readAllById(after => {
      let q = supabase.from("adaptation_trial_logs").select(logFields)
        .is("profile_id", null).in("session_id", ids).gte("created_at", since).order("id").limit(500);
      if (after) q = q.gt("id", after);
      return q;
    });
    tagged.push(...legacy);
  }
  return tagged;
}

export function groupPracticeLevels(stages: Stage[], trials: Trial[]) {
  const rows = new Map<string, { slug: string; stage?: Stage; latest?: Trial; count: number }>();
  function game(raw: string) {
    const slug = toProgressionSlug(raw);
    const row = rows.get(slug) ?? { slug, count: 0 };
    rows.set(slug, row);
    return row;
  }
  for (const stage of stages) {
    const row = game(stage.exercise_slug);
    if (!row.stage || stage.last_updated_at > row.stage.last_updated_at) row.stage = stage;
  }
  for (const trial of trials) {
    const row = game(trial.exercise_slug);
    row.count++;
    const last = row.latest;
    if (!last || trial.created_at > last.created_at || (trial.created_at === last.created_at &&
      (trial.trial_index > last.trial_index || (trial.trial_index === last.trial_index && trial.id > last.id)))) row.latest = trial;
  }
  return [...rows.values()].sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
}

export function ClinicianLevelsCard({ userId, profileId }: { userId: string; profileId: string }) {
  const stages = useQuery({
    queryKey: ["clinician-saved-stage", userId, profileId], retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("clinical_progression_state")
        .select("exercise_slug, current_level, last_updated_at").eq("profile_id", profileId);
      if (error) throw error;
      return data;
    },
  });
  const trials = useQuery({ queryKey: ["clinician-task-difficulty", userId, profileId], retry: false,
    queryFn: () => readRecentTrials(profileId, new Date(Date.now() - 14 * 86400000).toISOString()) });
  const rows = groupPracticeLevels(stages.data ?? [], trials.data ?? []);
  return <Card className="space-y-3 p-5">
    <h2 className="flex items-center gap-2 text-sm font-semibold"><Layers className="h-4 w-4 text-primary" />Skill level and task difficulty</h2>
    <p className="text-xs text-muted-foreground">Saved stage across sessions and the latest practice difficulty in the past 14 days.</p>
    {stages.isError && <p role="alert" className="text-sm">Saved stages unavailable. <Button variant="link" size="sm" onClick={() => stages.refetch()}>Retry stages</Button></p>}
    {trials.isError && <p role="alert" className="text-sm">Practice difficulty unavailable. <Button variant="link" size="sm" onClick={() => trials.refetch()}>Retry practice</Button></p>}
    {stages.isPending || trials.isPending ? <p role="status" className="text-sm">Loading practice levels…</p> :
      !rows.length && !stages.isError && !trials.isError ? <p className="text-sm text-muted-foreground">No saved stage or recent adaptation trials for this patient.</p> :
      <ul className="divide-y">{rows.map(({ slug, stage, latest, count }) => {
        // Some engines store the post-decision difficulty on the row. The explicit
        // from/to pair preserves the challenge the person actually received.
        const changed = latest?.difficulty_change_direction === "up" || latest?.difficulty_change_direction === "down";
        const presented = latest?.difficulty_change_from ?? (changed ? null : latest?.difficulty);
        const profile = getGameClinicalProfile(slug);
        return <li key={slug} className="space-y-1.5 py-2">
          <div className="text-sm font-medium">{profile?.title ?? slug.replace(/-/g, " ")}</div>
          {profile?.dominantAxis && <p className="text-xs text-muted-foreground">Practice target · {profile.dominantAxis}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-semibold text-primary">{stage ? `Saved L${stage.current_level}` : stages.isError ? "Stage unavailable" : "No saved stage"}</span>
            {latest && <span>{presented == null ? "Presented difficulty unknown" : `Presented D${presented}`}</span>}
            {latest?.difficulty_change_to != null && <span>Next D{latest.difficulty_change_to}</span>}
          </div>
          <div className="text-xs text-muted-foreground">{trials.isError ? "Trial count unavailable" : `${count} recorded adaptation ${count === 1 ? "trial" : "trials"}`}
            {latest?.escalation_blocked && " · Increase held on last trial"}
            {latest?.success_rate != null && ` · Last recorded success rate ${Math.round(latest.success_rate * 100)}%`}
          </div>
        </li>;
      })}</ul>}
  </Card>;
}
