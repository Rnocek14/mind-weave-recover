# Care Account Identity Model — Minimal Irreversible Slice

## The model (answers to the nine questions)

| Question | Answer |
|---|---|
| Who owns the account? | A **Care Account** (household container), not a person. |
| Who owns the profile? | The Care Account. A profile *belongs to* an account; people are *members*. |
| Who pays? | A **payer** attached to the account — a member (family/self-pay) or external clinic. One shape covers all three. |
| Who can invite whom? | Account **owner** (and clinic admin) invites caregivers, clinicians, and the survivor. |
| Who sees what? | Eventually derived from **membership + member role**. (Not active yet — see cautions.) |
| How does a caregiver create a patient? | Caregiver creates a Care Account + profile inside it. Needs **no survivor login**. |
| How does a patient log in later? | Survivor's new login **attaches as the `patient` member** — profile is never re-parented. |
| How does a clinician connect? | Added as a `clinician` member — same operation as any member. |
| How does billing work? | Subscription/entitlement keyed to the **Care Account** with a payer pointer. |

## Safety scan result (the approval gate) — PASSED

Read-only scan of `profiles.user_id` assumptions before relaxing nullability:
- **No `user_id!` non-null assertions** in the codebase.
- **Every profile insert explicitly sets `user_id`** (`ProfileContext.tsx`, `Onboarding.tsx`) → existing flows keep creating login-backed profiles.
- **All ownership reads use `.eq('user_id', …)`**; **`profiles` RLS is `user_id = auth.uid()`**. A NULL `user_id` row cannot match these filters → cannot leak, cannot break a join.
- **This slice creates ZERO NULL-`user_id` rows** (caregiver-create flow is deferred). Nullability is a *permissive* relaxation: no existing row or query changes. **Current behavior is identical; onboarding for all parties is unchanged.**

## What we build now (and only this)

The single irreversible thing is **ownership shape**. UI, payments, invite flows, and RLS rewrites are reversible and deferred.

### New tables
**`care_accounts`** — `name`, `created_by`, `account_type` (`family` | `self` | `clinic`), billing anchor (`subscription_status` default `none`, `payer_member_id` nullable, `payer_external_ref` nullable).

**`care_account_members`** — `care_account_id`, `user_id` (nullable — patient member can exist before a login), `member_role` (`owner` | `caregiver` | `patient` | `clinician`), `invited_email` (nullable), `status` (`active` | `pending` | `revoked`).

### Profiles changes (the irreversible columns)
- Add `profiles.care_account_id` (uuid, nullable now → backfilled → long-term owner key).
- **Make `profiles.user_id` nullable** — the core enabler for optional survivor login. (Safe per scan above.)

### Backfill (keeps all existing data working)
For every existing profile: create one `care_account`, set `profiles.care_account_id`, add an `owner` member and a `patient` member pointing at current `profiles.user_id`.
- `account_type` = **`self`** for an auth user with a single profile.
- `account_type` = **`family`** where one auth user owns **multiple** profiles.

### RLS strategy for this slice
- New tables get GRANTs → RLS → policies in correct order. Members read their own account; only owner/admin writes membership.
- **Existing `profiles`/`sessions`/assignment RLS is left untouched.** The account graph is added *beside* the current `user_id`-based system.
- **Explicit caution: `care_account_members` does NOT control access yet.** It future-proofs ownership only. Caregiver/clinician/remote access still flows through today's roles + assignment tables until a later, deliberate RLS migration.

## Explicitly deferred (do NOT build now)
- Caregiver "create patient" UI + survivor attach/onboarding flow.
- Invite UI and email-attach automation (table shape ready; flow later).
- Payment processing / Stripe-Paddle (anchor exists; charging later).
- Rewriting profile/session/assignment RLS to be account-derived.
- Folding `caregiver_assignments` / `clinician_assignments` into membership (they coexist for now).

## Why this supports the future remote/co-therapy plan
It creates the exact graph that plan needs — one recovery record, many authorized people:
```text
care_account
  -> profile
       -> members: patient / caregiver / clinician
```
Later additions (caregiver second-device remote, clinician live supervision, companion mode, prescribed protocols, family access, one payment per journey, optional patient login) attach **without re-parenting patient data**.

## Technical notes
- One migration: create the two tables (GRANTs → RLS → policies), add the two `profiles` columns, run the backfill in the same migration so no profile is ever account-less.
- Add `care_account_member_role` and `account_type` enums.
- Add a `has_care_account_role(_user, _account, _role)` security-definer helper (mirrors `has_role`) to keep future RLS recursion-free.
- After approval, regenerate types. No app code change is required for this slice — verified by the scan (no path assumes a non-null `user_id`).
- Record a core memory: "Care Account is the ownership/billing unit; profiles belong to accounts; survivor login is optional and attaches as a member; membership is not yet the active access model."
