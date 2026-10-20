# Clinical Simulation Lab — execution plan (test branch only)

## Safety boundary
- This branch is **not** a production deployment.
- No writes to live patient, session, event, progression, or research tables.
- Synthetic profile IDs and synthetic event fixtures only.
- Clinical recordings require verified permission for download, processing by Azure, retention, and the intended use.
- Do not interpret synthetic test success as clinical efficacy.
- No external audio replay until isolated storage, permissions, cost limits and credentials are verified.

## Phase 0 — current baseline
- Added deterministic Vitest characterization tests for /r/ phoneme mapping, target-word ranking, and progression-driven game selection.
- These assert **current code behavior**. They are not proof that the implementation is clinically appropriate.
- Run: `npm test -- src/lib/__tests__/clinicalSimulationLab.characterization.test.ts`
- CI execution status: NOT YET VERIFIED.

## Phase 1 — isolate and instrument
1. Record exact main-branch SHA and freeze baseline test results.
2. Provision a separate Supabase test project, not a namespace inside the live patient database.
3. Ensure all test accounts, storage buckets, analytics and edge functions are isolated.
4. Add immutable run ID, patient-fixture ID, scenario ID, engine version, event schema version and expected-decision fields.
5. Build a read-only replay adapter around real scoring and progression functions; never insert fake events into production.
6. Compare expected and observed selections and emit a diff, not a silent pass.

## Phase 2 — audio corpus and Azure verification
1. Start with openly licensed audio with known transcripts (normal speech baseline).
2. Add explicit permission/consent and license records for any clinical recordings.
3. Preserve independent reference labels for target word, spoken word, phoneme error, speaker, and recording conditions.
4. Validate Azure transcription, pronunciation output and alignment separately.
5. Mark unsupported or low-confidence speech evidence as not eligible for clinical mastery.
6. Test no-speech, noise, non-target response, word substitution, cue, caregiver voice, retries and Azure outage.
7. No raw audio or patient data in GitHub.

## Phase 3 — synthetic 30-day sessions
- Scenarios: /r/ targeting, semantic cue benefit, phonemic cue benefit, plateau, fatigue, recognition error, caregiver contamination, multi-domain changes.
- Reuse the real dailyLessonEngine and clinicalProgression functions.
- Verify stimulus stays in the patient's content tier, support is distinct from skill, progression has sufficient eligible evidence, and untrained probes remain separate from practiced outcomes.
- Test cross-game priority without treating unrelated game levels as commensurate.

## Phase 4 — cohort analysis
- Exclude synthetic patients from any real research cohort.
- Normalize game-specific score scales and eligible event validity.
- Aggregate longitudinal change within patients before comparing groups.
- Display patient counts, trial counts, missingness, uncertainty and covariates.
- Cohort-derived rules remain shadow-only until clinical review and prospective validation.

## Release gates
- Build, lint, typecheck and full unit/e2e suite pass.
- Audio benchmark meets predeclared accuracy and safety criteria.
- Every failed trial and adaptation is traceable to evidence.
- Clinician review of therapeutic targets and representative errors.
- Privacy/security audit and production rollback plan approved.
- No production promotion or data backfill without explicit approval.
