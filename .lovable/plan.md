
# Clinical Trial Readiness Layer

Goal: turn the app from "good clinical product" into "Mercy feasibility-pilot candidate." No new therapy features. This is the governance + safety + auditability layer that gets us through an IRB and into a hospital partner.

This plan is intentionally scoped to a **feasibility pilot** (5–15 patients, 4–8 weeks). Not an RCT. Not a 510(k) submission.

---

## What we're building (8 components)

### 1. Trial enrollment + eligibility gating

A new onboarding branch for trial participants. Gated by a screening form against documented inclusion/exclusion criteria.

Inclusion (defaults — clinician-editable per study):
- Adult (≥18)
- Confirmed aphasia diagnosis
- ≥1 month post-stroke
- Sufficient hearing/vision to use the app
- Caregiver or clinician available
- English fluent pre-stroke

Exclusion (defaults):
- Severe global aphasia (no functional comprehension)
- Active uncontrolled medical/psychiatric condition
- Concurrent enrollment in another aphasia trial
- Cognitive impairment preventing consent

If a screened patient fails any criterion, they cannot be enrolled in the trial — but can still use the app in non-trial mode.

### 2. Consent + data-use flow

A standalone consent module captured as a signed record:
- Plain-language summary (8th-grade reading level)
- Audio narration (uses the new natural TTS mode)
- Capacity assessment checkbox by clinician
- Caregiver co-sign field for surrogate consent
- E-signature (typed full name + timestamp + IP)
- Versioned consent document — every change creates a new version, requires re-consent

Consent record is immutable once signed.

### 3. Trial-mode lock ("frozen build")

A study creates an `engine_version_pin` — every patient enrolled in that study runs on a specific code path, scorer config, lesson generator version, and adaptation policy. Even when we ship new code, enrolled patients keep the pinned behavior until the study ends.

Implementation: a `trial_runtime_config` table; runtime reads from it instead of `profiles.runtime_config` for trial patients. No more "engine drift mid-study."

### 4. Adverse event (AE) + safety reporting

A structured AE pathway accessible from:
- Patient session end (caregiver prompt: "Anything we should know?")
- Clinician hub (always-visible "Report event" button)
- Automatic triggers (3+ session abandons, accuracy drop >30%, frustration signal, prolonged silence pattern)

AE record captures: type, severity (mild/moderate/severe/SAE), narrative, related session(s), reporter, timestamp. Severe/SAE events trigger an alert to the study clinician within the app (no email yet — out of scope for v1).

### 5. Baseline + weekly outcome assessments

A new assessments module that prompts:
- **Baseline** (at enrollment): clinician enters WAB-R AQ, CADL-2 score, ASHA-FACS rating, caregiver burden (Zarit short form). Optional: QAB. We don't compute these — we capture the values.
- **Weekly**: 5 functional check-in items (already exist) + caregiver-rated communication confidence (1-7 scale) + "any change since last week" free text.
- **Exit** (study end): repeat baseline measures.

This is the bridge between in-app metrics and the gold-standard instruments reviewers ask about.

### 6. Clinician trial-review dashboard

A new top-level clinician tab visible only when a study is active: **Trial**.

Three jobs (matches existing 3-tab ceiling pattern):
- **Roster**: enrolled patients, status, days remaining, missed sessions, open AEs
- **Safety**: all AEs across the cohort, unresolved first
- **Compliance**: weekly assessments due/completed, consent versions, dose adherence

### 7. Exportable weekly clinical report

One-click PDF + CSV export per patient:
- Demographics (de-identified by default; toggle for clinician copy)
- Sessions completed, total minutes, dose adherence
- Accuracy trends per exercise type
- Cue-fade trajectory
- Open + resolved AEs
- Weekly assessment scores
- Clinician notes timeline
- Engine version pin + consent version

Goes to `/mnt/documents/` for clinician download. Not emailed (PHI).

### 8. PHI / BAA / audit hardening

Code + config changes (the legal BAA itself is out of scope — that's a Lovable/Supabase contract):
- Audio bucket access logged to a new `phi_access_log` table on every signed-URL request
- Append-only constraint on `adaptation_events`, `clinician_overrides`, `adverse_events`, `consent_records` (revoke UPDATE/DELETE for non-service roles)
- A `de_identified_export` view that strips name, email, exact stroke date (replaced with month bucket), exact birth date (age band only)
- Document our PHI inventory in `docs/PHI_INVENTORY.md`

---

## Phasing (recommended order)

We don't ship this in one push. Two sub-releases:

**Phase A — "We can enroll" (1 week)**
1. Trial-mode lock (#3) — must come first or everything else is unstable mid-study
2. Eligibility gating (#1)
3. Consent flow (#2)
4. Trial-review dashboard skeleton (#6) — Roster only

**Phase B — "We can monitor + report" (1 week)**
5. AE reporting (#4)
6. Baseline + weekly assessments (#5)
7. Trial dashboard Safety + Compliance tabs (#6)
8. Weekly report export (#7)
9. PHI audit hardening (#8)

Each phase is independently shippable. Phase A alone is enough to start a paper-only enrollment conversation with Mercy. Phase B is needed before any patient actually uses the app.

---

## What this plan deliberately does NOT do

- No email/SMS notifications to clinicians (out of scope for pilot)
- No FDA / 510(k) work
- No multi-site study coordination
- No new therapy features or scorer changes
- No automated outcome computation (we capture clinician-entered scores)
- No engine refactor — trial-mode is a thin wrapper over current runtime

---

## Technical details

(For implementation reference — skip if non-technical.)

**New tables**
- `studies` — id, name, status (draft/active/closed), inclusion_criteria (jsonb), exclusion_criteria (jsonb), engine_version_pin (text), pi_clinician_id, started_at, ended_at
- `study_enrollments` — study_id, user_id, status (screening/consented/active/withdrawn/completed), enrolled_at, withdrawn_at, withdrawal_reason
- `eligibility_screenings` — enrollment_id, criterion_key, met (bool), notes, screened_by, screened_at
- `consent_records` — enrollment_id, consent_version, signed_name, signed_at, ip_hash, capacity_confirmed_by, surrogate_signed_name, document_text_snapshot
- `consent_documents` — version, body_md, audio_url, effective_from
- `trial_runtime_config` — study_id, runtime_config (jsonb snapshot at study start), scorer_version, engine_version
- `adverse_events` — enrollment_id, event_type, severity, narrative, session_id, reported_by, reported_at, resolved_at, resolution_notes
- `outcome_assessments` — enrollment_id, assessment_type (baseline/weekly/exit), instrument (wab_r/cadl_2/facs/zarit/custom), score_jsonb, administered_by, administered_at
- `phi_access_log` — user_id (subject), accessor_id, resource_type, resource_id, action, accessed_at

**Append-only enforcement**
RLS policies + revoke UPDATE/DELETE from `authenticated`. Service role retains full access for audit-corrected entries that must be logged separately.

**Engine pin mechanism**
`useTrialEngineConfig()` hook resolves runtime via `study_enrollments → trial_runtime_config` first, falls back to `profiles.runtime_config`. Single switchpoint in `runCoachTurn.ts` and `drillSelector.ts`.

**Consent re-trigger**
On app load, compare patient's last `consent_records.consent_version` to current `consent_documents` active version. If newer version exists, route to re-consent before allowing trial activity.

**Files touched (estimate)**
- ~8 new migrations
- ~12 new components (trial pages, consent flow, AE form, assessment forms, report export)
- ~4 modified files (App.tsx routes, ClinicianProtectedRoute, runtime resolution, types)

---

## Decision needed before I start

Approve Phase A scope as listed, or trim it. After Phase A ships and you've shown it to Mercy, we decide Phase B based on their feedback.
