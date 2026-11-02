# NeuroSpark hospital pilot — release-blocker verification (2026-11-02)

**Scope:** security and data-isolation engineering review, not clinical validation, HIPAA attestation or FDA classification. This is a proposed draft change only. No database migration, test-data reset, account creation, live provider verification, or deployment was performed.

## Observed evidence (read-only)
- The connected production database and the branch labelled hospital-integrity have different migration histories. Production has 164 recorded migrations; the branch has 176. The branch includes 12 migration versions absent from production.
- Production's Supabase Security Advisor reports 43 anonymously executable and 46 authenticated-executable SECURITY DEFINER functions. Those findings require per-function authorization review. Several observed production function definitions provide insufficient caller authorization, including elevated role management, clinical profile access and speech worker operations.
- The existing hospital-integrity branch has populated users and sessions even though it was originally created with `with_data:false`. All 2,725 currently counted auth users were anonymous accounts created Oct 28–30, 2026; recorded sessions number 5,688. These facts **do not prove that stored audio and sessions are synthetic**. Do not run test account creation, record insertion, cleanups, rebase or reset there until data provenance is reviewed by the owner.
- The corresponding protected staging data attestation is deliberately not populated by this PR. Do not mark it approved merely because a branch name or public target manifest says “synthetic-only.”
- The live GitHub repository has an active ruleset (ID 26032983) requiring the `Regression gate`. Its required check policy is not strict and does **not** itself verify clinical safety, staging data isolation, or all deployment entry points.

## This draft branch proposes

1. A reviewed SQL migration, `20261102195000_hospital_privileged_rpc_perimeter.sql`, to deny elevated administrative, speech worker and maintenance RPC access from public callers; preserve `service_role` entry where necessary; and add scoped access guards to patient-specific clinical profile, session and stats RPCs. The SQL is **not applied**.
2. `scripts/hospital-staging-attestation.mjs`, a short-lived, exact-project operator attestation gate. It performs no network request and is **not independent proof** that data is test-only.
3. Hooks in the release workflow, direct speech service CLI, direct hosted Playwright staging suite and `qa:release` so hosted checks cannot accidentally create more accounts or write to an unreviewed backend.
4. Offline tests that must pass in ordinary regression CI.

## Required manual data review before any hosted tests

Identify and positively verify the records in the existing hospital-integrity branch as disposable synthetic data, including generated speech/audio and user sessions; or select a new, separately priced and explicitly approved clean test backend. If provenance cannot be verified, **do not attest**.

Only after the owner confirms that the exact backend is disposable and contains no production/patient records, set these variables in the protected **`neurospark-e2e` GitHub environment**:

| Variable | Meaning |
| --- | --- |
| `NEUROSPARK_STAGING_DATA_ATTESTED_REF` | Exact reviewed project ref, currently `stdiuaxigqttgdwiwbtp` |
| `NEUROSPARK_STAGING_DATA_ATTESTED_SCOPE` | Exact value `synthetic-only-reviewed` |
| `NEUROSPARK_STAGING_DATA_ATTESTED_AT` | Current UTC time in `YYYY-MM-DDTHH:mm:ssZ` format, valid for under 24 hours |

No secrets, passwords or clinical sample data go in these values. A human set of these variables is an administrative sign-off **only**; the checks must still verify actual authenticated writes, RLS denials and read-back.

## Promotion gate — must all be independently proven

- [ ] Security engineer reviews the migration and all remaining exposed SECURITY DEFINER functions and triggers; no unintended public privileged RPC remains.
- [ ] Migration is applied to a positively isolated backend, SQL syntax and desired roles confirmed there; signed-out, patient A vs B, caregiver, clinician and admin tests show appropriate allow/deny results for the actual RPCs and RLS policies.
- [ ] Caller compatibility checked for speech workers, cron, clinician actions and legacy patient flows. No service-role key reaches the browser; qualified functions and appropriate search paths are verified.
- [ ] Existing production permissions are reconciled in a separately authorized maintenance window with rollback, security-adviser read-back and immediate negative-access smoke. Do not treat an applied file as proof of successful enforcement.
- [ ] Every released gameplay change passes same-revision regression, authenticated isolated persistence (write/read/refresh), representative aphasic speech/device testing, and SLP-reviewed scoring/progression.
- [ ] Historical scores potentially affected by wrong trial eligibility, order or support are reviewed in a versioned, non-destructive analysis with clinician oversight; original patient rows remain unchanged.
- [ ] HIPAA/privacy/security and business-associate contracting assessed with counsel and hospital partners; regulatory intended-use and FDA-device determination documented by qualified reviewers.
- [ ] Usability with people with severe aphasia, slow responses, interruption, no microphone, and realistic caregivers; clear “not assessed” rather than fabricated zero or success.
- [ ] All deployment routes (not only GitHub Pages) locked to the candidate, tested rollback and monitoring, with hospital pilot sign-off.

**Unverified:** whether the migration executes successfully on isolated Postgres; function-level cross-user authorization after application; real data persistence; speech accuracy on aphasic utterances; physical-device behavior; clinical effectiveness.

Run only the offline checks while staging provenance is unresolved:

```sh
node --test scripts/hospital-staging-attestation.test.mjs scripts/staging-workflow.test.mjs
bun run qa
```

`bun run qa:release` is intentionally **blocked** without current attestation and valid isolated backend configuration. It must not fall back to production.
