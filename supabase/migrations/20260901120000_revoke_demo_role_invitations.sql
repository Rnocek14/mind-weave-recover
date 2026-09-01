-- Remove the seeded QA role invitations for demo.clinician@gmail.com /
-- demo.caregiver@gmail.com (20260606212911). handle_new_user() auto-grants the
-- invited role to whoever signs up with a matching email — these are publicly
-- registerable Gmail addresses we do not control, so the pending invitations
-- are an unauthenticated path to the clinician role (and with it, assigned
-- patients' clinical data). Revoke anything already claimed, then delete the
-- invitations.
--
-- Do not re-seed invitations for addresses the team does not own; QA accounts
-- belong on a team-controlled domain.

-- 1) Revoke roles granted through these invitations, and (belt-and-braces)
--    any clinician/caregiver role sitting on an auth user registered with
--    these addresses regardless of how it was granted.
with demo_users as (
  select used_by as user_id
  from public.role_invitations
  where lower(email) in ('demo.clinician@gmail.com', 'demo.caregiver@gmail.com')
    and used_by is not null
  union
  select id as user_id
  from auth.users
  where lower(email) in ('demo.clinician@gmail.com', 'demo.caregiver@gmail.com')
)
delete from public.user_roles ur
using demo_users du
where ur.user_id = du.user_id
  and ur.role in ('clinician', 'caregiver');

-- 2) Revoke any patient assignments those accounts hold.
update public.clinician_assignments ca
set revoked_at = now()
from auth.users u
where ca.clinician_id = u.id
  and lower(u.email) in ('demo.clinician@gmail.com', 'demo.caregiver@gmail.com')
  and ca.revoked_at is null;

update public.caregiver_assignments cga
set revoked_at = now()
from auth.users u
where cga.caregiver_id = u.id
  and lower(u.email) in ('demo.clinician@gmail.com', 'demo.caregiver@gmail.com')
  and cga.revoked_at is null;

-- 3) Delete the invitations themselves (claimed or not) so the auto-grant
--    path can never fire for these addresses again.
delete from public.role_invitations
where lower(email) in ('demo.clinician@gmail.com', 'demo.caregiver@gmail.com');
