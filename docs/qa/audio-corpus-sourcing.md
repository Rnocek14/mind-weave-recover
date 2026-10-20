# Audio corpus sourcing and Azure benchmark — execution record

## Sources verified (2026-10-14)
- Mozilla Common Voice: CC0 speech clips + human transcripts, **distributed via Mozilla Data Collective**. Use only official MDC download/access; do not mirror or rehost audio in GitHub. Speaker reidentification forbidden. Source: https://commonvoice.mozilla.org/dav/terms
- AphasiaBank: controlled access for eligible researchers; request authorization and agree to ground rules. Do not scrape or download without access. Source: https://talkbank.org/aphasia/access.html
- AphasiaBank Recovery Corpus: aphasia-research-only use; do not assume commercial product testing is permitted. Source: https://talkbank.org/aphasia/access/English/NonProtocol/Recovery.html

## Retrieval status
No real audio files have been downloaded into this repository. This execution environment could not reach external audio hosts; Mozilla MDC access and authorized clinical recordings must be provisioned before replay. No Azure service was called.

## Data contract
For every authorized clip, maintain a private manifest with:
- caseId, sourceId, corpus version, source license and permission record
- SHA256 of audio file, duration, encoding, locale, recording condition
- referenceTranscript (independently annotated, not Azure-generated)
- expectedSpeaker, detectedSpeaker if independently verified
- Azure model/version, configuration, recognition output and raw service error
- eligibility for transcript WER, separate eligibility for phoneme scoring and clinical mastery
- transcript adjudicator ID (pseudonymous), annotation date, and disagreement notes

Never include audio, credentials, direct participant identifiers, or private transcripts in GitHub.

## Benchmark procedure
1. Import authorized audio into a separate access-controlled test storage location.
2. Check manifest, licenses, checksums, duplicates and held-out speaker splits.
3. Invoke the actual Azure adapter with explicit rate/cost limits, log output and failures.
4. Score with `src/lib/clinicalSimulation/audioBenchmark.ts` using independently annotated references.
5. Report WER by clean, noise, aphasia and caregiver conditions **separately**.
6. Measure no-speech, false-positive mastery, speaker leakage, and recognition failure rates.
7. For aphasia, use expert annotation for paraphasias, neologisms and unintelligible speech; WER alone is insufficient.
8. Do not enable progression based on benchmark data. Run any proposed adaptive changes in shadow mode first.

## Current limits
This first implementation scores *precomputed transcript pairs*, not raw audio or Azure pronunciation assessments. It is not an Azure integration, not an aphasia validation study, and not a hospital-readiness certification.
