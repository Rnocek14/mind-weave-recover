
# Frictionless Caregiver → Patient → First Therapy

## Goal
A family caregiver can sign up, name the person recovering, and reach a real therapy session in under ~3 minutes — **no admin approval, no patient login, no clinician assignment**. Survivors stay self-serve. Clinicians stay invite/approval-gated (they touch other people's clinical data). The therapy engine, scoring, and adaptation are not touched.

## Core model (confirmed)
```text
Care Account (family)
  ├─ Member: Caregiver  (account owner, NOT a patient profile)
  └─ Patient Profile: "the person recovering"  (has the recovery record)
```
- Caregiver identity = a `care_account_members` row (role `caregiver`/`owner`) + a profile flagged as a non-patient account record. It is **hidden** from the patient profile list — never renamed into the patient.
- Patient data lives under the caregiver's `auth.uid()`, so the existing `profiles` RLS (`auth.uid() = user_id`) and all session/profile scoping keep working with **zero RLS rewrites**. Optional survivor login later is still supported by the existing nullable `user_id` + membership graph.
- Language is **"Who is recovering?"**, never "Create a patient profile."

## Three trust lanes
```text
Survivor   → sign up → /welcome → /today (Start)
Caregiver  → sign up "helping someone" → Who is recovering? → Start practice
Clinician  → sign up → role request / invite → /pending-approval (UNCHANGED)
```

---

## Phase 1 — Data foundation (one migration)
1. **`profiles.profile_kind`** — text, default `'patient'`. Values: `'patient'` | `'account_owner'`. All 330 existing rows stay `'patient'` (correct — they are survivors). Patient profile lists filter to `profile_kind = 'patient'`.
2. **Update `handle_new_user` trigger** to read `raw_user_meta_data->>'account_intent'`:
   - For every new signup: create a `care_accounts` row (`self` for survivor, `family` for caregiver), set the new profile's `care_account_id`, and insert an `owner` membership. (Today the trigger creates none — backfill only covered pre-existing users; this makes new accounts consistent with the backfilled ones.)
   - If `account_intent = 'caregiver'`: the auto-created profile is flagged `profile_kind = 'account_owner'`, account type `family`, and the member also gets a `caregiver` role row in `care_account_members`. **No patient profile is created** at signup.
   - Otherwise (survivor): unchanged behaviour — one `patient` profile.
   - Clinician/admin role grants via `role_invitations` stay exactly as-is.
3. No new policies needed (caregiver-created patient profiles are owned by the caregiver's `auth.uid()`; covered by existing `profiles` ALL policy). `service_role`/`authenticated` grants already exist on these tables.

## Phase 2 — Signup routing (`Auth.tsx`, `useAuth.signUp`)
- Reframe the signup role selector: **"I'm recovering" / "I'm helping someone" / "I'm a clinician."**
- "Helping someone" (caregiver) is now **self-serve**: pass `account_intent: 'caregiver'` in signup metadata. **Do not** create a `role_request` and **do not** route to `/pending-approval`.
- Clinician path is unchanged: still creates a `role_request` and lands on `/pending-approval`.
- Post-auth redirect logic:
  - admin/clinician DB role → role home (unchanged).
  - pending clinician request / `requested_role` metadata → `/pending-approval` (unchanged).
  - `account_intent = 'caregiver'` **and** no `profile_kind='patient'` profile yet → `/caregiver/setup`.
  - `account_intent = 'caregiver'` with a patient profile → `/caregiver`.
  - else (survivor) → existing `/welcome` → `/today` flow.

## Phase 3 — Caregiver setup screen (`/caregiver/setup`, new page)
Single, low-cognitive-load screen titled **"Who are you helping?"**:
- First name (required), last name (optional), optional stroke date.
- Optional **"Add their therapy notes"** (links to existing notes upload; skippable — never blocks reaching Start).
- On submit: create the patient profile (`profile_kind='patient'`, same `care_account_id`, `user_id` = caregiver), add a `patient` membership, set it active via `switch_active_profile`, then route to **caregiver home with a primary "Start practice for [name]" button** (or straight into the session — see Phase 4).
- Multi-person households: the same screen is reachable later via an "Add another person" action.

## Phase 4 — Caregiver home launcher (`CaregiverPortal.tsx`)
- Add a prominent primary action: **"Start practice for [patient name]"** at the top of the five Glance Cards.
- It ensures the patient profile is active, then navigates to the **same session entry the patient Start uses** (reusing Today's launch path / `/lesson`), scoped to the active patient profile. No engine changes — it's the existing flow with the caregiver-managed profile active.
- Empty state: if no patient profile exists, the page shows the "Who is recovering?" call-to-action instead of monitoring cards (prevents today's dead-end).

## Phase 5 — Patient profile list filtering
- `ProfileContext.fetchProfiles` filters the patient list to `profile_kind = 'patient'` so the caregiver's own `account_owner` record never shows in `ProfileSwitcher` or as an active profile. Survivors are unaffected.
- Rename `CreateProfileDialog` copy to the "Who is recovering?" framing and reuse it for "Add another person."

## Phase 6 — Patient path cleanup (light)
- Survivor lands faster: keep `/welcome` short; ensure "Start" is the dominant action on `/today`. Remove redundant marketing CTAs in the authed survivor path where they sit between login and Start. (No engine or content changes.)

## Explicitly OUT of scope (this slice)
- Real billing — **free-to-start**; we set `care_accounts.subscription_status` hooks but never block practice. (Paddle/Stripe deferred.)
- Therapy Remote, CPT/caregiver coaching, realtime/co-therapy features.
- Clinician self-serve, clinician→patient discovery, patient→clinician invite flows.
- Folding `caregiver_assignments`/`clinician_assignments` into membership; making membership the active access model.
- Therapy engine, scoring, adaptation, exercise content.

---

## Technical notes
- **Why no RLS rewrite:** caregiver-created patient profiles carry the caregiver's `user_id`; `profiles`/`sessions`/analytics already scope by `user_id` (+ `profile_id`). Membership tables remain ownership/future-proofing only, exactly as the Care Account memo states.
- **Detecting caregiver at routing time:** `user_metadata.account_intent` (set at signup) + presence/absence of a `profile_kind='patient'` profile. Persistent signal is the `account_owner` profile and the `caregiver` membership row, so it survives across devices/sessions.
- **Trigger safety:** all branches keep creating exactly one profile per new auth user (survivor=patient, caregiver=account_owner), so nothing that assumes "a profile exists for every user" breaks.
- **Verification before done:** new survivor signup still reaches `/today` Start; new caregiver signup reaches a real session via "Start practice for [name]" with no `/pending-approval` and no admin action; clinician signup still lands on `/pending-approval`; existing 330 profiles unchanged (`profile_kind='patient'`); `ProfileSwitcher` never shows the caregiver's own record.

## Open follow-ups (post-launch, not now)
- Subscribe step + provider once demand is validated.
- Survivor self-login attach to an existing caregiver-managed profile.
- Patient/caregiver-initiated clinician invitations (safer than clinician discovery).
