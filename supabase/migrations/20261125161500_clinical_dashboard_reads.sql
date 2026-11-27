-- Authorize the Data API to apply the existing authenticated row policies.
-- Explicit grants are required on projects without the old default table grants.
grant select on table public.profiles, public.sessions, public.exercise_events,
  public.clinician_assignments, public.clinical_progression_state, public.adaptation_trial_logs,
  public.utterance_analyses, public.daily_readiness, public.dose_logs, public.physical_daily_metrics,
  public.recovery_alerts, public.learning_rates, public.retention_snapshots, public.adaptation_events,
  public.functional_checkins, public.functional_goals, public.goal_progress_ratings,
  public.clinician_overrides, public.user_ui_profile, public.capability_assessments
to authenticated;

-- Program analytics count sessions for accessible patient profiles, including empty visits.
create policy "Admin dashboard reads patient sessions" on public.sessions for select to authenticated
using (public.has_role((select auth.uid()), 'admin') and exists (
  select 1 from public.profiles p where p.id = sessions.profile_id and p.profile_kind = 'patient'
));

-- The session joins also cover older speech and adaptation rows that lack a profile tag.
create policy "Assigned clinician reads patient speech examples" on public.utterance_analyses
for select to authenticated using (exists (
  select 1 from public.sessions s
  where s.id = utterance_analyses.session_id and s.user_id = utterance_analyses.user_id
    and (utterance_analyses.profile_id is null or utterance_analyses.profile_id = s.profile_id)
    and public.is_assigned_clinician((select auth.uid()), s.profile_id)
));
create policy "Assigned clinician reads patient adaptation trials" on public.adaptation_trial_logs
for select to authenticated using (
  (session_id is null and profile_id is not null and public.is_assigned_clinician((select auth.uid()), profile_id))
  or exists (
    select 1 from public.sessions s
    where s.id = adaptation_trial_logs.session_id and s.user_id = adaptation_trial_logs.user_id
      and (adaptation_trial_logs.profile_id is null or adaptation_trial_logs.profile_id = s.profile_id)
      and public.is_assigned_clinician((select auth.uid()), s.profile_id)
  )
);
create policy "Assigned clinician reads dashboard readiness" on public.daily_readiness for select to authenticated
using (public.is_assigned_clinician((select auth.uid()), profile_id));
create policy "Assigned clinician reads dashboard dose" on public.dose_logs for select to authenticated
using (public.is_assigned_clinician((select auth.uid()), profile_id));
create policy "Assigned clinician reads dashboard activity" on public.physical_daily_metrics for select to authenticated
using (public.is_assigned_clinician((select auth.uid()), profile_id));
