# Staging clinical session RPC regression

The `audit-session-summary-rpc.spec.ts` Playwright spec uses real 
`public.get_session_summary` via PostgREST on the allowlisted, synthetic-only
Supabase branch. It is selected in both desktop Chromium and mobile WebKit
staging runs, with one new anonymous-auth user per test.

- A graded 50-point result and a wrong cued result must score **25% task accuracy**
  (RPC fraction 0.25), not 50%/100%; the test compares the real persisted rows
  with the production canonical `reduceAccuracy`.
- Manual, noise, null-score, and quarantined `voice_practice` rows cannot
  enter the scored denominator.
- No scorable evidence returns NULL rather than 0 for accuracy and measurements.
  A truly measured 0ms / 0% / 0 cue stays zero.
- Difficulty is read from `task_parameters.difficulty_level`, never
  an unrelated older `inputs.task_params` decoy or fabricated level 1.
- Two distinct real authenticated user sessions demonstrate the owner's RPC
  succeeds while another user's same-session RPC is denied.

The SQL procedure is still SECURITY DEFINER with a per-session ownership
check. This test does not certify hospital access control, clinical scoring,
or historical data. Do not run it on the production Stroke backend. Its
isolation guard verifies the approved project reference before writes.
