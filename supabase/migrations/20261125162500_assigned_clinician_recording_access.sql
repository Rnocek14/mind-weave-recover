grant select on public.recovery_score_snapshots, public.user_speech_profiles to authenticated;
create policy "Assigned clinician reads selected speech profile" on public.user_speech_profiles
for select to authenticated using (public.is_assigned_clinician((select auth.uid()), profile_id));

-- Absence of an opt-in row keeps clinician playback off. Each sibling has an independent choice.
create table public.clinician_recording_permissions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.clinician_recording_permissions enable row level security;
revoke all on public.clinician_recording_permissions from public, anon, authenticated;
grant select, insert (profile_id), delete on public.clinician_recording_permissions to authenticated;
create policy "Owner manages clinician playback" on public.clinician_recording_permissions
for all to authenticated using (exists (
  select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid()) and p.profile_kind = 'patient'
)) with check (exists (
  select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid()) and p.profile_kind = 'patient'
));
create policy "Assigned clinician sees playback permission" on public.clinician_recording_permissions
for select to authenticated using (public.is_assigned_clinician((select auth.uid()), profile_id));

-- Only the exact patient-uploaded object linked to the selected session and utterance may be signed.
create policy "Assigned clinician reads opted-in practice recordings" on storage.objects
for select to authenticated using (
  bucket_id = 'session-recordings' and exists (
    select 1 from public.utterance_analyses u
    join public.sessions s on s.id = u.session_id and s.user_id = u.user_id
    join public.clinician_recording_permissions permission on permission.profile_id = s.profile_id
    where u.audio_storage_path = storage.objects.name
      and (u.profile_id is null or u.profile_id = s.profile_id)
      and storage.objects.owner_id = s.user_id::text
      and split_part(storage.objects.name, '/', 1) = s.user_id::text
      and split_part(storage.objects.name, '/', 2) = s.id::text
      and public.is_assigned_clinician((select auth.uid()), s.profile_id)
  )
);
