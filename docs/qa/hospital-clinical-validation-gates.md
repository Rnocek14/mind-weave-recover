# NeuroSpark — hospital clinical-validation and release gates
Status: **NOT CLEARED FOR HOSPITAL PATIENT USE**. Draft PR #77 is a development candidate, not authorization to deploy.

This is an evidence register. Do not replace missing proof with a test count, a percentage readiness score, or an AI opinion. Every release candidate must show exact frontend/backend revisions, datasets, sign-off, and failure recovery. Synthetic tests use the isolated backend only.

## Regulatory / intended-use decision — NOT VERIFIED
Document each user-visible function separately: aphasia task delivery, automatic answer scoring, personalized clinical progression, speech-quality metrics, home conversation assistance, clinician recommendations, clinical record parsing, and possible wearable prompts. Specify the targeted patient population, intended clinical claims, clinician supervision, contraindications and actionable outputs. Obtain written review from qualified US medical-device regulatory counsel before treating these as non-device wellness functionality; FDA evaluates intended medical purpose function by function.

References: https://www.fda.gov/medical-devices/digital-health-center-excellence/step-1-software-function-intended-medical-purpose and the FDA January 2026 CDS guidance https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software

## Engineering acceptance matrix (ALL must be verified)

| Gate | Required evidence | Status |
|---|---|---|
| G1: Patient identity and consent | Test clinician/caregiver/patient membership, account switching, authorization of records and recording access, consent and revocation, deletion and retention | **OPEN** #80; no real-world access sign-off |
| G2: Saved trial identity | For every supported game: correct, incorrect, cue, skip, mic denial; unique attempt_id, correct patient/profile/session, one durable row and reload, no success on a failed save, retry idempotency | **OPEN** #83; entry coverage is not full-flow coverage |
| G3: Speech evidence | Recorded WAV + actual microphone/provider → transcript → validity → scoring provenance → exercise_events/utterance_analyses → session summary → clinician dashboard and CSV; never substitute task correctness for ASR quality | **OPEN** #78, #85 |
| G4: Metric truthfulness | Null vs actual 0, denominator parity, no excluded/manual/no-response inflation; verify all completion paths, dashboards, timeline, clinician report, research export; prior data limitations stated | **PARTIAL** summary hook tests added 2026-10-30; full cross-surface reconciliation not done |
| G5: Audio and devices | Real iOS Safari, Android Chrome, desktop, varied mics/Bluetooth, long pauses, interruption/background, noisy spaces, caregiver voice, offline/permission denial | **NOT RUN** against this candidate on physical hardware |
| G6: Stroke usability | Aphasia-accessible spoken instructions, single large action, no reading dependency, large targets, captions, contrast/zoom, no hidden errors, no irrecoverable dead ends; test moderate-severe aphasia and caregiver-assisted mode | **NOT SIGNED OFF** |
| G7: Privacy and security | RLS isolation, non-admin denied from unrelated PHI, audio signed URLs, privileged RPC/Edge functions, incident response, access log, encryption/backup recovery, vendor BAAs where applicable | **OPEN** #80, #86 |
| G8: Clinical validation | SLP-defined scoring rubric, independent adjudicated reference dataset of representative aphasic speech, false positive/negative breakdown by severity and device, therapist concordance and clinically justified acceptance criteria | **NOT COMPLETED** |
| G9: Release governance | Exact frontend + database schema + function versions, required CI/staging on release SHA, checked protections on *all* hosting paths, backup/rollback rehearsal, synthetic post-release checks, named accountable approvers | **OPEN** |
| G10: Human factors and claims | Written intended use, limits and disclaimers, risk/hazard register, accessibility review, trial protocol/consent and IRB determination as applicable, independent clinician/medical/regulatory/privacy sign-off | **OPEN** |

## Research CSV privacy emergency stop (2026-10-30)
The pre-existing export workflow claimed its CSVs were de-identified while retaining raw IDs from `sessions` and `exercise_events` and selecting all fields, potentially including notes and dates. A weak deterministic browser hash is not a valid de-identification assessment. Draft candidate research download buttons and useResearchExport hook are now disabled/fail-closed until review. See #86. **This does not itself certify HIPAA compliance or prevent SQL/API access.**

HHS de-identification guidance: https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html
HHS HIPAA cloud/BAA guidance: https://www.hhs.gov/hipaa/for-professionals/special-topics/health-information-technology/cloud-computing/index.html

## Evidence required for a single trial (minimum audit trail)
Patient user and authorized profile; session ID and exercise slug; stable attempt ID and trial index; stimulus and answer provenance (production/recognition/scaffolded/manual, including mic-before-tap); cue support; raw and normalized transcripts with provider/source only where consented; speech-validity and measured/unknown flags; score and units; recording/response timing source; AI model/engine version; confirmed insert and reload; session reduction with denominator; clinician/export text and exact CSV fields. Never claim a metric is ASR quality when its actual basis is correctness of the task.

## Clinical reference set and human evaluation
An SLP lead defines intended outcomes, stimulus/task rules, error categories and acceptance thresholds **before** data are scored. Recruit a representative, consented group with aphasia/dysarthria/apraxia severity variation; capture appropriate device/noise conditions. Have at least two trained reviewers label a subset independently with disagreements adjudicated. Report sensitivity, specificity and abstention/unscorable rates for each relevant decision, by patient profile and input mode. Include caregiver speech, no response, code-switching, repetitions, self-correction, disfluency and interruption. Never use test microphone clips to claim live recognition accuracy.

## No-go rule
Do not merge, deploy to patients, share research CSVs as de-identified, or describe the product as clinically validated until the relevant gates have evidence attached and the necessary clinical, security, regulatory and privacy approvals are documented. A successful CI run only proves that the tests it executed passed.
