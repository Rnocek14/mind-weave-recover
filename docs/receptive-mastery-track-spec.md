# Receptive Mastery Track — Proposal (v0.1, doc-first)

**Status:** SPEC ONLY. No code exists or should exist until this document
is reviewed (ideally with an SLP) and merged — per the change process in
`docs/telemetry-validation-checklist.md` §6: doc → detector/engine → dashboard.

## 1. Why

`masterySignalRouting.ts` routes `trialMode:'recognition'` to `excluded`
by design: mixing receptive judgments into the expressive EWMA would
conflate axes ("same precedent as minimal_pairs" appears four times in
that file's comments). The cost: four receptive games — minimal_pairs,
meaning_match, detective_mind, phonological_awareness — generate rich,
correctly-tagged trials that build NO longitudinal skill state at all.
Comprehension progress is currently invisible to mastery, the clinician
hub, and the Recovery Score.

## 2. Proposal

A parallel `receptive` mastery axis with the same machinery, never mixed:

- **New rows, not new tables.** `user_skill_mastery` gains
  `axis: 'expressive' | 'receptive'` (default `'expressive'`, additive
  migration; existing rows untouched). Uniqueness becomes
  (user, profile, skill_node, axis).
- **Routing.** `routeTrialMode` returns a third verdict `receptive`
  (instead of `excluded`) for `trialMode:'recognition'` on a new
  `ADOPTED_RECEPTIVE_SLUGS` allowlist: `minimal_pairs`, `meaning_match`,
  `detective_mind`, `phonological_awareness`. Everything else keeps its
  current verdict — the expressive path is byte-identical.
- **Same EWMA, separate stream.** `flushMasteryShadow` writes receptive
  trials into `axis='receptive'` rows using the existing decay/confidence
  parameters until receptive-specific calibration is justified by data.
- **Difficulty weighting.** Receptive trials carry chance-rate context
  (2-choice ≈ 50% floor, 4-choice ≈ 25%). v0.1 stores `chance_rate` in
  the mastery row's evidence payload; the EWMA itself stays uncorrected
  until observed distributions justify a correction (record before tune).

## 3. Shadow-first rollout (mirrors Voice Engine v2)

1. **Phase A (shadow):** write receptive rows; nothing reads them for
   gating. Verify volumes/distributions in `/dev/mastery-shadow`.
2. **Phase B (display):** clinician hub shows a receptive line, labeled
   "comprehension — informational, does not gate difficulty".
3. **Phase C (gating, separate proposal):** receptive mastery may inform
   receptive-game level floors only. Never expressive floors.

## 4. Invariants (testable)

- No trial contributes to both axes.
- Expressive EWMAs are bit-identical before/after Phase A (pin with a
  regression test over a fixed trial fixture).
- `skipped_unknown` semantics unchanged for untagged trials.
- Receptive rows only from slugs on `ADOPTED_RECEPTIVE_SLUGS`.

## 5. Open questions for review

1. Does detective_mind (inferential reading) belong on the same axis as
   minimal_pairs (auditory discrimination), or does v0.2 need
   `receptive_auditory` vs `receptive_reading`? (v0.1 lumps; the trial
   rows retain slug so a later split is lossless.)
2. Should hint-assisted recognition trials route as `scaffolded` rather
   than `receptive`? (v0.1: follow the existing per-game trialMode
   emission unchanged.)
3. Minimum trials before a receptive row renders in Phase B (proposal: 20,
   matching the expressive display floor).
