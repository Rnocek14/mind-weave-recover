## What we're doing
Adding ~120 trial items across 6 banks so every **clinically-supported** engine difficulty has ≥20 items. No engine, hook, bridge, level-spec, schema, or gate changes — pure content + the audit harness.

## How this affects the app and the levels you already have

**Short answer:** users won't see new levels, new mechanics, or a re-shuffled ladder. They will see the existing levels actually *work the way the spec already says they work*. Three concrete effects:

### 1. Existing level mappings are unchanged
The bridges (`semanticFeaturesDifficultyBridge`, `phonologicalAwarenessDifficultyBridge`, `sentenceConstructionDifficultyBridge`, etc.) and the level specs (`*Levels.ts`) stay exactly as written. L1 still pulls bank-diff 1, L6 still pulls bank-diff 3, etc. We are only filling the buckets those bridges already point at.

### 2. Users who were silently stuck at a content ceiling will now escalate properly
Today, when the engine asks for "5 trials at bank-diff 4" and the bank has 6 items, `getTrialsForLevel` returns the same 6 every session. Recency-exclusion can't do its job, and in some games the level can't fill a round at all. After Phase 1–3, every clinically-supported diff has ≥20 items, so:
- variety/recency works as designed across a full session
- level-up doesn't stall on "no fresh content"
- the per-diff section of `contentDepthAudit` goes green for the diffs the bridges actually use

This is invisible to users — no UI changes, no copy changes, no "new level unlocked" event. It's the ladder finally being load-bearing.

### 3. Aspirational ceilings stay aspirational
`_shared/implementedCeiling.ts` already clamps promotion past unimplemented levels (e.g. phono L8 degraded-signal, semantic-features L8 untrained-probe). We are **not** removing those clamps. So:
- phono `L1–L6 ready, L7 thin, L8 aspirational` → after Phase 2 becomes `L1–L7 ready, L8 aspirational`. The L8 clamp stays. No fake degraded-signal trials.
- semantic-features `L1–L5 ready, L6–L7 thin, L8 aspirational` → after Phase 1 becomes `L1–L7 ready, L8 aspirational`. L8 clamp stays.
- sentence-construction bank diffs 1–10 are all clinically-supported by the existing bridge; all get filled.

### What does *not* change
- No new exercises, no new tiers, no renamed levels.
- No change to `clinical_progression_state` schema or how the engine reads it.
- No change to gate logic, soft-regression scaffold, recency primitive, mastery shadow, or the validity gate.
- No clinical-evidence doc rewrites beyond updating the "readiness" line per level (truthful follow-up to new content).

## Per-bank scope (Path 2, ~120 items)

```text
semantic-features        +~30   d2: 13→20  d3: 7→20  d4: 11→20  d5: 9→20*
                                *L8 stays aspirational; d5 fills up to but not past
                                 the L7 ceiling. PHOTO_BANK gating still applies —
                                 any candidate without an asset is dropped, not faked.

phonological-awareness   +~25   d2: 12→20  d3: 10→20  d4: 8→20  d5: 6→20
                                d6–d10 NOT filled (no runtime mode; L8 clamp stays)

sentence-construction    +~55   d4: 8→20  d5: 8→20  d6: 8→20  d7: 8→20
                                d8: 8→20  d9: 8→20  d10: 8→20  (all clinically used)

meaning-match            +~13   T1: 18→20  T2: 14→20  T3: 15→20  (single-scale)

detective-mind           +~15   T1/T2/T3: 15→20 each

multi-step-plan          +~15   T1/T2/T3: 15→20 each

two-clues                + 2    T3: 18→20

minimal-pairs            (DEFERRED)  raw d4/d5 = 0 — those are aspirational
                                     L7/L8 modes per the existing bridge docs.
                                     Filling here would create dead content.
                                     Flag as separate decision, not in this plan.
```

## Phases (audit must be green between each)

```text
Phase 1 — Unblocks below-floor escalation
  semantic-features (~30) → audit
  phonological-awareness (~25) → audit
  meaning-match T2 (+6) → audit

Phase 2 — Fills the long ladder
  sentence-construction (~55, split d4–d7 then d8–d10) → audit between halves

Phase 3 — Thin tiers, variety
  detective-mind (+15) → audit
  multi-step-plan (+15) → audit
  two-clues T3 (+2), meaning-match T1/T3 (+7) → audit

Phase 4 — Spot-check & document
  Difficulty parity within tier, frequency-band parity (sem_features,
  synonym_generator pattern), recency/duplicate scan.
  Append final audit snapshot to .lovable/plan.md.
  File two separate scoped decisions (NOT done in this plan):
    - phono L8 degraded-signal mode (runtime work)
    - minimal-pairs L7/L8 modes (runtime work)
```

## Discipline (same as Wave 1)
- One bank per file edit. No batched cross-schema writes.
- `bunx vitest run src/data/__tests__/contentDepthAudit.test.ts` between every step. Red = stop.
- No engine/hook/bridge/level-spec/gate/schema changes anywhere in this plan. If a gap *requires* one, surface it and stop instead of working through it.
- Any candidate item missing a required asset (photo, audio, paired distractor) is dropped, not invented.

## Risk surface
- **Lowest-risk content work we do.** Banks are append-only, typed, and covered by `contentDistinctness` + `contentDepthAudit` tests. No runtime behavior changes.
- One thing to watch: difficulty parity drift. If new sentence-construction d9/d10 items are secretly d6-level, users will appear to "level up" without real challenge. Phase 4 spot-check is the gate for this.

Ready to start Phase 1 on approval.