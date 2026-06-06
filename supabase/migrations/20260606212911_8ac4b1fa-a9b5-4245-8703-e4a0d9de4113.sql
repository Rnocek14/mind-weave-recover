insert into public.role_invitations (email, role, note, created_by)
values
  ('demo.clinician@gmail.com', 'clinician', 'QA test clinician account', '3a2ae857-680d-4ceb-af7c-095ae3036b2d'),
  ('demo.caregiver@gmail.com', 'caregiver', 'QA test caregiver account', '3a2ae857-680d-4ceb-af7c-095ae3036b2d')
on conflict do nothing;