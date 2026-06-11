# Investigation: Photo Naming validity classifier mislabels correct trials

Status: OPEN — separate from data-integrity plumbing (#1/#3, now fixed)
Severity: MED–HIGH (clinical signal quality)

## Symptom
On Photo Naming sessions, correct spoken trials are scored as 100 but the
speech validity gate stamps `validity_label = no_response` / `background_noise`
and `counts_toward_score = false`. Result: session summary `scored_trials = 0`
and accuracy fields (`accuracy`, `asr_accuracy`, `independent_accuracy`,
`cue_assisted_accuracy`, `practice_accuracy`) come back null even though the
patient answered correctly.

## Why this is NOT bundled with #1/#3
#1 (`adaptation_events.profile_id`) and #3 (duplicate empty sessions) are pure
data-plumbing fixes. This is clinical signal quality — touching it means
changing the validity classifier / scoring path, which is explicitly out of
scope for the data-integrity pass.

## Investigation checklist (do BEFORE changing any logic)
1. ASR capture — is audio actually reaching the recognizer on Photo Naming?
   Compare against Pattern Match (which scores fine).
2. Transcript source — which transcript field feeds the validity gate vs the
   scorer? A mismatch (scorer sees text, gate sees empty) would explain
   score=100 + label=no_response.
3. Acoustic gate — confirm the background_noise / no_response thresholds and
   what acoustic features they read; check for an empty/missing feature vector.
4. Classifier thresholds — review confidence cutoffs and whether a low-confidence
   default is silently set to `no_response`.

## Do NOT
- Do not change validity labels, scoring, adaptation/progression thresholds,
  or UX until the root cause above is confirmed.
