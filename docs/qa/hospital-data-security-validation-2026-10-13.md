# Hospital data-integrity and privacy validation — 2026-10-13

Status: **Engineering validation only. Not clinical validation or HIPAA certification.**

## Environments and scope

- Production project: existing real patient records. No patient-data seeding or destructive schema resets.
- Isolated Supabase staging project: `stdiuaxigqttgdwiwbtp`, populated by replaying migrations **without production data**.
- Supabase branch replay reached all **164 historical migrations**.
- Historical migration scripts include production-specific users and obsolete demo-seeding statements. The current production migration history was repaired with guards; **these corrections must be retained and independently audited**. Replaying stale original files can recreate failures.
- Legacy, inactive demo logins with known historical credentials were disabled and password-rotated in production. Existing role/profile records were preserved.

## Database staging checks

1. Privileged RPC lockdown: `anon` and `authenticated` lost direct EXECUTE on 12 sensitive admin, clinician and speech-worker functions; `service_role` retained EXECUTE.
2. Atomic session-summary patch RPC: synthetic transactions confirmed existing summary keys and nested exercise scores are retained when other writers update. Closing a session, duplicate closing, open-only writes after close and post-close metric updates were checked.
3. Patient-scoped clinical RPC changes: anon direct execution disabled for profile read/write, session summary, exercise statistics and specific self-scoped helpers. Worker maintenance limited to service role.
4. Fixed a pre-existing ambiguous PostgreSQL function overload: `get_exercise_stats_last7d(uuid,text)` conflicted with the defaulted three-argument overload. The three-argument function with `pid DEFAULT NULL` supports both call forms.
5. Fixed a pre-existing report ordering ambiguity: when two events have identical timestamps, use `created_at, round, id` consistently to determine first/last difficulty and cue order.
6. Rollback-only synthetic transactions passed the calculation checks for session summary, 2/3-argument exercise statistics, clinical-profile version creation and lookup. All input tests used artificial identities; no test row was committed.

## What remains unproven

- Real signed-in patient, caregiver and assigned-clinician API authorization in a deployed browser using **separate synthetic auth accounts**.
- Speech-worker queue operations after privileges are applied to the intended production credentials.
- True parallel-client update contention (smoke tests validated atomic SQL merge, not two network sessions racing).
- The 14 currently skipped authenticated Playwright browser journeys.
- Live microphone recognition, accessibility and task completion across all 17 therapy games on patient hardware.
- Clinical validity: within-session measures cannot be represented as durable recovery or treatment efficacy.

## Deployment safety

- Do not merge client code that invokes `merge_session_summary` or `end_session_with_summary_patch` until those database RPCs exist in the matching deployment environment.
- Treat the staged database migrations as a coordinated, versioned deployment. After deploying, verify the function privileges and clinical report outputs again.
- Leave privileged RPCs not explicitly reviewed unchanged; the Supabase linter also flags role helpers, triggers and caller-authorized functions whose execution contexts need independent evaluation.
- Any production schema change must have a rollback and verification path. Preserve audit evidence for healthcare stakeholders.
