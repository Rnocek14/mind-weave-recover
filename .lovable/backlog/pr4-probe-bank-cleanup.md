# Cleanup ticket: PROBE_WORDS overlap with PHOTO_BANK

Status: open · Filed by PR4 sanity review (Phase 2.5).

## Problem

PR4 selector tests surfaced that **all 10 entries in `PROBE_WORDS`
(`src/data/probeWords.ts`) also appear as training targets in
`PHOTO_BANK`** (`src/data/photoBank.ts`). The runtime segregation
(`isGeneralizationProbe: true` flag) holds, but the *content* contract
"probes never appear in training" is broken.

Until this is fixed, L8 Photo Naming sessions cannot be labeled as
"generalization evidence". UI/clinician-facing wording must stay:

- **OK:** "Generalization probe attempt"
- **NOT OK:** "Generalization achieved", "Transfer proven",
  "Generalization evidence", "Untrained probe performance"

## Definition of done

1. Split `PROBE_WORDS` into a non-training-only target set.
   - Keep the currently-overlapping items (`tree`, `book`, `shoe`,
     `watch`, `flower`, `spoon`, `key`, `nose`, `ball`, `door`) as
     **training-only**; remove them from `PROBE_WORDS`.
   - Recruit ≥ 10 new probe targets with photos that do NOT appear in
     `PHOTO_BANK`. Maintain difficulty distribution (≥ 4 easy / ≥ 4
     medium / ≥ 2 hard).
2. Add a Vitest that FAILS if any probe target appears in the training
   bank (replace the soft warning currently in
   `photoNamingContentSelector.test.ts`).
3. Re-enable stronger clinician-facing wording (e.g. "untrained probe
   performance") only after the test is green.

## Blocker notes for downstream work

- Do not market or describe L8 outputs as transfer / generalization
  evidence until this ticket closes.
- The `isGeneralizationProbe` flag is still authoritative for *runtime*
  segregation (mastery aggregators must continue to exclude probe
  trials unless explicitly opted in).
