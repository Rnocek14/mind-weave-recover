# Speaker integrity: consented shadow pilot (2026-10-30)

## Status and clinical boundary

**Experimental, OFF by default, NOT merged, NOT deployed and NOT a clinical gate.** This branch adds a research-only speaker matching channel. Scores, levels, support, response correctness, dialogue advancement and clinician outcome measurements continue to use the existing system. A speaker match is not proof of patient identity and a mismatch is not a clinical error.

This work is stacked on draft PR #88 and requires its safety changes before release.

## Why this matters

Web Speech, Azure transcription and a microphone can interpret a caregiver's answer, a television or Maya playback as patient speech. An ASR transcript does not establish *who spoke*. This feature adds observational voice evidence so we can measure contamination before changing clinical logic.

## Technical design

1. **Consent and enrollment** — A caregiver/account owner opens Speech Profile in caregiver/clinician UI (pilot flag required), reads the biometric disclosure, confirms consent or applicable legal authorization and records one 5–30-second, single-patient sample. A good sample has varied natural speech, minimal background noise, and no caregiver overlap. The provider recommends a single speaker, normal speaking style, and at most 30 seconds.
2. **Privacy** — The actual enrollment audio is sent directly through the owner-authenticated Edge handler to a temporary provider media object; the app does not store an enrollment WAV. Provider returns a voiceprint. NeuroSpark encrypts it with a separate AES-256-GCM environment key and retains only ciphertext/IV and consent metadata. Pyannote says input media is automatically removed within 48 hours and completed job output within 24 hours; these are vendor claims pending contractual confirmation. Revocation removes local voiceprint, provider job reference and local shadow checks, but does not instantly erase provider-owned temporary media; a data-processing agreement, retention review, response-to-deletion policy and legal assessment are required.
3. **Session attempts** — After the existing speech attempt has been saved to the private \`session-recordings\` bucket, selected Photo Naming and Conversation Coach paths can ask the Edge handler to queue a *shadow* check. The handler verifies the authenticated owner, patient profile, session, exact attempt ID and storage path. It never takes arbitrary audio URLs or arbitrary recording paths from the client.
4. **Speaker assessment** — pyannoteAI speaker identification with one enrolled print, diarization and confidence returns possible patient segments and unrecognized segments. The shared parser conservatively labels \`patient_candidate\`, \`mixed_speakers\`, \`unmatched_speaker\`, or \`uncertain\`. Missing confidence, small spoken amount, invalid response and multiple voices abstain or require review.
5. **Human audit** — An authorized account owner can request a short (90-second) signed audio URL for the exact check, listen to the recording and enter a manual speaker label. Human labels are separate from automated evidence and never edit a clinical score.
6. **Asynchronous resolution** — Provider jobs are polled when enrollment is in progress or when the audit panel is refreshed. No real-time dialog blocking. A newly queued check may remain pending until the review panel is reopened/refreshed. A reliable private, authenticated background worker and automatic timeout handling would be needed for production-scale processing.

## Configuration in a disposable environment ONLY

- Apply migration \`supabase/migrations/20261030183000_speaker_integrity_shadow.sql\` to a **verified synthetic, isolated Supabase instance**, not production.
- Deploy the new \`speaker-integrity\` Edge function **only** to that instance. \`verify_jwt=false\` means the function performs its own \`getAuthedUser\` JWT verification before every sensitive action.
- Configure secrets \`PYANNOTEAI_API_KEY\` and \`SPEAKER_VOICEPRINT_AES_KEY_B64\` (independent cryptographically random 32-byte AES key encoded with Base64). Keep those out of GitHub, logs, client bundles and uploaded recordings. Do not rotate without decrypt/re-encrypt migration; otherwise revoke and re-enroll consented samples.
- Enable the server flag \`SPEAKER_INTEGRITY_ENABLED=true\` **only after** vendor privacy/contractual approval. The client panel and queue additionally require build-time \`VITE_SPEAKER_INTEGRITY_SHADOW=true\`.
- Server defaults OFF, client defaults OFF. Missing/failed provider/enrollment/auth/data fields never count as patient failure.

## Data boundaries

- No direct client grants for enrollment/check tables; RLS is on, and the server service-role client checks the actual owner of each profile, session, attempt and path.
- Keep raw audio in the existing private \`session-recordings\` bucket. No new public audio bucket. Encrypted voiceprints are not exposed via the client response. API outputs omit provider job identifiers and raw segment responses.
- No cross-profile enrollment mixing. Only the owner of the patient profile can initiate consent, enqueue/check/review or revoke. This is conservative even when a clinician is assigned; future clinician access needs an explicit, separately tested authorization policy.
- This feature does **not** claim HIPAA/biometric compliance; a vendor BAA/DPA (if required), consent/legal-authority model, data retention, key management, deletion and audit plan must be reviewed.
- A person with aphasia may change speaking style and often says short sounds/words. An uncertain match must not be treated as an incorrect answer or evidence of regression.

## Regression and evaluation plan

### Automated code contracts

- \`src/lib/speech/speakerIntegrity.test.ts\`: actual shared parser with patient-only, other voice, multiple voices, low-confidence, short speech and malformed provider fixtures.
- \`scripts/speaker-integrity-handlers.test.mjs\`: actual Edge HTTP handler, mocked JWT/DB/provider; no network or secrets. Covers unauthorized caller, wrong patient profile, consent gate, audio ownership/path rejection, missing enrollment, private history and revocation.
- \`bun run test:speech:handlers\` includes both existing Azure handler checks and new speaker handler tests, and remains part of \`bun run qa\`.
- \`bun run qa\` covers lint, typecheck, unit tests, production integration and controlled browser paths.

### Required before enabling even in a pilot

- Verify migrated test database schema, RLS/role grants and audio storage policies with two *synthetic* patient accounts, including cross-owner denial and unauthenticated denial for all Edge actions.
- Vendor-compatible test WAV/WebM/MP4; enroll one speaker, poll ready, queue recordings with 1 and 2 speakers, poll complete, ensure private result and human review survive reload, verify revoke removes all derived data. No real patient recordings in CI.
- Compare with manually labeled target and non-target speaker segments across noise, Maya audio tail, caregiver help, TV, different microphones, short utterances, severely dysarthric/aphasic speech, fluctuations across days. Measure false target acceptance, false patient rejection, missed overlaps, unclassified rate, and differences by clinical profile. Report confusion matrix and confidence intervals, not only overall accuracy.
- Review speaker-matching thresholds and whether very short clips should be matchable at all. The current 2-second minimum and score threshold 60 are unvalidated technical review defaults and **must not be represented as clinical thresholds**.
- Review data protection impact, patient usability and ability to withdraw consent; confirm vendor data retention/BAA or equivalent before patient audio leaves approved systems.
- Test actual iOS/Safari, Android/Chrome and Bluetooth headsets and normal microphone/ASR coexistence.

### Future, separate change only after evaluation

If speaker identity reaches an acceptable threshold on labeled post-stroke recordings, a **new clinically reviewed PR** may add an independent-scoring eligibility gate to every applicable game, summary and longitudinal metric. It should handle short/unavailable data as "unverified," never "wrong," and reconcile past rows. This feature intentionally makes **no such change**.

## Rollback

Keep both flags OFF to disable the feature without changing games or therapy metrics. The migration contains only opt-in research tables; removing it or dropping it must be a separate authorized database operation after securely deleting enrolled prints and audits. Never reset a production database to roll back this feature.
