# Speech classifier quarantine investigation - 2026-10-28

## Reproduction before correction

All 25 skipped cases in `src/lib/__tests__/errorClassifier.test.ts` were enabled
at commit `13a30a45556c468c8b775a6dd5f8bd5ad5aeae5c`. Only the embedding transport
was replaced with an unavailable-service response; no live provider was called.
CI 516, run `40671038925`, executed all 2,112 unit cases: 2,107 passed,
5 failed, 0 skipped. The failures were the four expected semantic relationships
(cat/dog, animal/dog, puppy/dog, chair/table) and semantic-error classification.
The evidence job retained the actual assertion results.

The real fallback correctly produced a related-category relationship, but the
shared naming-answer lexical guard reduced it to 0.45. The classifier's
existing `> 0.45` semantic-error branch consequently could not see it and
returned `unrelated`. This is an application wiring defect demonstrated by
existing expectations, not a new clinical threshold.

## Correction and preserved boundaries

An explicit `error_classification` comparison mode preserves the underlying
raw semantic relationship for error-type analysis. The classifier and its
compatibility relationship helper select that mode. Default `word_to_word`
naming validation still uses its existing lexical cap. Description mode,
normalization, nonsense rejection, raw cosine arithmetic, fallback word groups,
classifier numeric thresholds, ASR gates and the pattern-analysis window are
unchanged. Category-related substitutions remain errors, never exact matches.

The restored original file has 35 executable cases. All five semantic failure
expectations are retained. Each test gets fresh modules and a controlled offline
transport so a prior test cannot supply its embedding cache or disabled state.

Two historical tests had to be made meaningful, not weakened:

- The old dug/dog review assertion only ran inside a condition requiring a
  similarity between 0.45 and 0.55. Actual character similarity is 2/3, so it
  performed no assertion. It now explicitly checks review/retry on an uncertain,
  unrelated transcript; additional embedding fixtures exercise the semantic
  review boundary directly.
- The old ASR comparison assumed a 0.4-confidence semantic label must have less
  confidence than a 0.95-confidence one. The existing early gate is strictly
  below 0.4, and semantic-label confidence is derived from semantic similarity,
  not ASR confidence. The corrected case uses 0.39 and explicitly requires an
  uncertain/retry outcome. Additional cases preserve exactly 0.4 and the
  unrelated-response boundary at 0.6. Production confidence rules did not change.

The additional semantic-contract suite executes the real classifier and scorer
with controlled provider vectors/errors. It checks naming-mode isolation,
source provenance, cache reuse, raw low scores, uncertain review, provider
failure, nonsense, no-response, exact matches and confidence boundaries.
These synthetic vectors establish application behavior, not model accuracy.

## Unit completion is now required

`bun run test` runs the locked Vitest CLI through `scripts/run-unit-tests.mjs`.
It deletes any old report, fixes retries/focused-only/no-tests settings, and
reconciles the new JSON report against every individual assertion. Skipped,
pending, todo, unknown, failed, empty, inconsistent or missing evidence fails.
A runner crash cannot reuse a green stale report. File filters still work with
`bun run test -- <test-file>`; exploratory flags belong in `test:watch`.

Both ordinary CI and evidence/build use that same command. Thirty native Node
checks exercise the report validator and runner, including stale files and
failed subprocesses, and are included in `test:qa-gates`. They passed locally.
The retained CI 515 report (2,087 passes plus 25 skips) was fed to the new
validator; it correctly failed and named the skipped assertions.

Read the current candidate's CI results for final full-suite counts; this file
records the reproduction and implementation, not a future run as complete.

## Release limits

This change alters diagnostic semantic values on affected new attempts; it does
not backfill historical records. Compare historical reports with awareness of
the code revision and scorer source. End-to-end saved-report reconciliation and
representative clinician review remain required before release. Classification
heuristics are not clinically validated by these tests.

GitHub main protection remains an administrator setup step. No release was
performed. Read-only queries to the existing hosted test branch
`stdiuaxigqttgdwiwbtp` now succeeded: 171 migration records, zero auth users,
zero sessions and zero exercise events. This establishes database reachability
and an empty core dataset; it does not establish anonymous-auth configuration,
backend source revision, Azure credentials or complete RLS coverage. No records,
credentials, projects or functions were written by those probes.
