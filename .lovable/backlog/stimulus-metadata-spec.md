# Stimulus Metadata — Specification (NOT IMPLEMENTED)

**Status:** SPEC ONLY. Near top of backlog. Do not implement during the freeze.
**Why it exists:** Separate *"patient improved"* from *"item was easier."* This is the silent confound that invalidates most rehab-app research. Backfillable onto existing banks at any time, but painful once 10k+ trials are logged against uncharacterized stimuli.
**Companion to:** `intervention-exposure-snapshot-spec.md` (that freezes *who the patient was*; this characterizes *what the item was*). Together they give the outcome dataset its independent variables.

---

## 1. The problem

If Word A (common / concrete / 1 syllable) and Word B (rare / abstract / 4 syllables) are scored the same, then accuracy gains are uninterpretable: did the patient get better, or did the rotation happen to serve easier items? Without per-item difficulty characterization, every cross-time and cross-cohort comparison is confounded.

## 2. Design principles

1. **Static content tagging, NOT runtime telemetry.** Lives on the stimulus banks (`src/data/*`), not on event rows.
2. **Backfillable.** Can be added to existing banks incrementally; no migration urgency (unlike the exposure snapshot, which is irrecoverable).
3. **Engine-invisible at first.** Tag now for analysis; only later (post-freeze, post-N) consider letting difficulty selection read it.
4. **Source-of-truth-tagged.** Each field records whether it came from a published norm (e.g. SUBTLEX, MRC, Kuperman AoA) or an internal estimate, so analysts can weight accordingly.

## 3. Per-item fields (target vocabulary)

```text
item_id                 stable id per stimulus
trained_vs_untrained    is this item used in training rotation, probe-only, or both?
lexical_frequency       e.g. SUBTLEX zipf; source tagged
word_length_chars
syllable_count
phonological_complexity clusters / markedness score; source tagged
semantic_category       living/nonliving, tool/animal/food, etc.
imageability            MRC-style 100-700 or normalized; source tagged
concreteness            Brysbaert norms; source tagged
age_of_acquisition      Kuperman AoA where practical; source tagged
distractor_type         (for choice items) semantic / phonological / unrelated
foil_distance           (for choice items) similarity of distractor to target
metadata_source         {field: 'published'|'estimated'|'unknown'}
metadata_version        'v1'
```

Sentence/discourse items get an analogous set: length, clause count, syntactic complexity, verb argument structure, reversibility.

## 4. Rollout order (when unfrozen)

1. Photo Naming bank first (most trials, clearest signal).
2. Fix Sentence / sentence banks.
3. Minimal Pairs (phonological complexity is the key axis).
4. Remaining banks opportunistically.

## 5. DO-NOT (this freeze)

- Do NOT let difficulty selection / adaptation read these fields yet.
- Do NOT block on perfect published norms — tag `estimated` and refine later.
- Do NOT create runtime tables; this is content-layer metadata.

**Trigger to start:** freeze lifts AND/OR a research analysis needs item-difficulty controls. Tagging itself is harmless and can begin before analysis demand exists.
