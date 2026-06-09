# Launch Accessibility & Data-Quality Plan

Goal: make sure the *right* users (including moderate/severe aphasia) can reach therapy, and that the profiles we collect at launch are reconstructable later. This is all **plumbing and routing** — it does not touch the frozen therapy/adaptation engine.

Guiding principle: **Setup Actor ≠ Therapy Actor.** Buyer/caregiver/clinician do the heavy setup; the survivor sees one `START`.

---

## Current state (verified)

- `parse-clinical-notes` already returns `profile_source: 'hybrid'` + an overall `confidence`, with `source_phrases` per field. There is **no per-field confidence** and **no provenance column on `profiles`**.
- `clinical_notes` stores `raw_text` (pasted text) + `parsing_confidence`. There is **no file-storage bucket** — "upload" today means pasting text.
- `consent_documents` / `consent_records` exist but are wired to clinical-trial `enrollment_id`. There is **no data-processing consent path for ad-hoc document upload**.
- `profiles` has no `profile_source` / `field_confidence` columns.
- `Welcome.tsx` is the patient first-run (2 steps → Start). `OnboardingGate` routes patient→`/welcome`. There is **no survivor self-start telemetry**.

---

## Workstream A — Must-do before charging money

### A1. Security cleanup (manual + verify)
Per project memory, remaining pre-launch items:
- Fully delete QA throwaway account `test123@gmail.com` in the Auth dashboard.
- Enable Leaked Password Protection in Auth settings.
- Re-run the security scanner; confirm no `error`-level findings remain.
These are dashboard actions; I'll provide the links and re-run the scan to confirm.

### A2. Profile provenance (becomes impossible to reconstruct later)
Add to `profiles`:
- `profile_source text` — enum-style check: `'onboarding' | 'caregiver' | 'document' | 'clinician'`.
- `field_confidence jsonb` — per-field `{ aphasia_type: 'high'|'medium'|'low', ... }` for the major clinical fields.
Persist these everywhere a profile is created/updated:
- onboarding screener → `onboarding`
- document parse → `document` (carry per-field confidence derived from parser `source_phrases` presence + LLM confidence)
- caregiver manual entry → `caregiver`
- clinician override → `clinician`
Also mirror `profile_source` onto each new `clinical_profile_versions` row (it already has `source_type`/`overall_confidence`; we add the per-field map into `profile_data`).

### A3. Consent flow for document upload
Documents (discharge summaries, SLP evals) are medical records. Before any upload:
- A lightweight **data-processing consent checkpoint** reusing `consent_documents` (a new non-trial document version) + a `consent_records` row not tied to a trial `enrollment_id` (relax that linkage / add nullable path).
- A private storage bucket `clinical-documents` (RLS: owner + assigned clinician/admin only) if we move from paste-text to real file upload (see B1). Consent must be recorded *before* the file is stored.

### A4. Survivor self-start telemetry (first-class KPI)
New table `survivor_self_start_events` (or reuse `shadow_events` with a typed event): records each time a survivor reaches `START` on the daily surface, with:
- `caregiver_present` (derived/asked once), `day_index` since account creation,
- joins to `profiles.aphasia_type` + severity for cohort breakdown.
Report Day 1/3/7/14/30 independent-start rate, broken down by **severity, aphasia type, caregiver present/not**. No UI dashboard required for launch — just clean capture so the data exists.

---

## Workstream B — High value (front-door accessibility)

### B1. Move the note parser to the onboarding front door
New caregiver setup funnel (setup actor, not survivor):
```text
Create account
   -> "Who are you setting this up for?"  (routing hint ONLY, not a role grant)
   -> Upload / paste document  (optional, with A3 consent)  --AI parses-->
   -> Plain-language profile review (B2)
   -> Payment
   -> Hand off: survivor device boots to START
```
- The fork is a **presentation hint** over existing `uiMode`/`user_roles` — tapping "for someone else" must NOT confer caregiver data authority to a patient account.
- "Skip for now → quick screener → provisional profile" stays a true equal path (no upload gate), with `clinical_profile_versions` logging supersession.

### B2. Plain-language profile review
Render the parsed draft in caregiver-legible language (not Broca's/territory codes up front). Show clinical codes underneath/expandable. Confirm → writes profile with `profile_source='document'` + per-field confidence.

### B3. Derived coaching defaults (survivor surface = one START)
- Coaching level is **derived** from the clinical profile/severity (default voice-led/Full Coaching for higher support needs) — never asked of the survivor.
- Lesson-plan review becomes optional and caregiver/clinician-facing only.
- Survivor daily surface: `TODAY'S PRACTICE / [ START ] / ~15 min / Ready when you are` — no settings, no coaching level, no plan review fork.

---

## Explicitly kept frozen (no changes)
A.3 mastery enforcement, soft regression, structured error taxonomy, intelligence layer, cohort recommendations. This plan only makes therapy *reachable* and the dataset *honest* — it does not make the engine smarter.

---

## Suggested build order
1. A2 provenance columns + persistence (cheapest, highest irreversibility cost).
2. A4 self-start telemetry capture.
3. A3 consent + private bucket.
4. B1/B2/B3 onboarding front-door + survivor single-START surface.
5. A1 security verification immediately before publish.

## Technical notes
- Migrations: add `profile_source`, `field_confidence` to `profiles`; relax `consent_records.enrollment_id` to nullable + add a consent-type discriminator; create `survivor_self_start_events` with GRANTs + RLS (owner insert/select; clinician/admin select via existing assignment helpers); create `clinical-documents` private bucket + `storage.objects` policies.
- Parser: extend `parse-clinical-notes` to emit a per-field confidence map alongside the existing overall confidence (derive from `source_phrases` coverage + LLM confidence).
- No edits to adaptation/mastery/scoring code paths.

Want me to scope this as one launch milestone, or split A (data-quality/security) and B (onboarding UX) into two separate build passes?
