## Goal

Keep the secure invite path, add a self-service professional path gated by admin approval, and keep patient signup fully open.

## Resulting signup flow

```text
User signs up on /auth
        │
        ├─ Email matches a role_invitation? ──► auto-granted role ──► role home (/admin, /clinician/review, /caregiver)
        │
        ├─ User picked "I'm a clinician/caregiver" (no invite)? ──► role_request row (status: pending)
        │                                                          └─► lands on /pending-approval (no role yet)
        │                                                                 admin approves ──► role granted ──► role home
        │
        └─ Default (patient) ──► /today
```

Admin never loses control: self-selecting a role only creates a *request*; it grants nothing until an admin approves. Patients still sign up freely with no gate.

## What gets built

### 1. Database — `role_requests` table + approval function
- New table `public.role_requests`: `user_id`, `email`, `requested_role` (clinician/caregiver only — never admin), `status` (pending/approved/rejected), `note`, `reviewed_by`, `reviewed_at`, timestamps.
- GRANTs: `authenticated` can INSERT their own + SELECT their own; admins SELECT/UPDATE all; `service_role` ALL.
- RLS: users insert/read their own request; admins (`has_role admin`) read + update all.
- A `SECURITY DEFINER` function `approve_role_request(p_request_id, p_decision)` callable by admins only — on approve it inserts into `user_roles` and marks the request approved; on reject it marks rejected. This keeps role-granting server-side (no client-side privilege escalation).

### 2. Signup UI (`src/pages/Auth.tsx`)
- In sign-up mode, add an optional selector: **"I'm signing up as…"** → Patient (default) / Clinician / Caregiver.
- Patient = current behavior (nothing extra).
- Clinician/Caregiver = after `signUp` succeeds, insert a `role_requests` row for that user, then route to `/pending-approval`.
- Admin is intentionally NOT offered (invite-only).

### 3. Redirect logic (`src/pages/Auth.tsx` useEffect)
- After login, if the user has **no role** but an **open pending request**, send them to `/pending-approval` instead of `/today`.
- Otherwise unchanged (role → role home; plain patient → /today).

### 4. New page `src/pages/PendingApproval.tsx`
- Calm, adult-tone screen: "Your [clinician/caregiver] access is awaiting admin approval." Shows their requested role and a sign-out button. Auto-redirects to the role home once approved (re-checks permissions). If rejected, shows a neutral message to contact the admin.
- Wired as a route in `App.tsx`.

### 5. Admin review UI (`src/components/admin/UserRoleManager.tsx`)
- Add a **"Requests"** tab listing pending `role_requests` (name, email, requested role, note, date) with **Approve** / **Reject** buttons calling `approve_role_request`.
- Show a small count badge so pending requests are visible at a glance.

## Technical notes
- Role granting stays in a server-side `SECURITY DEFINER` function gated by `has_role(auth.uid(),'admin')` — the client never writes to `user_roles` directly.
- `requested_role` is constrained to `clinician`/`caregiver` via a validation trigger (no admin self-requests).
- Patient signup path is untouched, so open registration keeps working.
- Existing invite trigger (`handle_new_user`) is left as-is and continues to take priority.

## Out of scope
- Email notifications to admins on new requests (can add later via transactional email if you want).
