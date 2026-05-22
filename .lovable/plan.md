## Where we are

Two separate "healths" to look at — they're often confused.

### 1. Persistence health (the DB itself)

`clinical_progression_state` query right now:

```
exercise_slug | profiles | with_progress | leveled_up | max_lvl
photo-naming  |    1     |       0       |     1      |    2
```

That's the entire table. 13 progression hooks exist (`usePhotoNamingProgression`, `useSemanticFeaturesProgression`, … `useCategoryFluencyProgression`) — all wired to `applySessionToState` + `saveProgressionState`. So the **plumbing is in place**; the row count is 1 because almost no one has actually played sessions since the wave-1 work landed. This is a usage gap, not a code gap. We can't judge "do users level up" from production data until trial users run sessions.

### 2. Content-bank health (can the engine *find* the next-tier item to escalate to?)

This is the one that actually blocks leveling — if T2 only has 8 items, the engine literally can't keep T2 sessions fresh enough to satisfy the evidence gate, and the user stalls.

Latest audit run (just executed):

```
Game                          T1     T2     T3   Status
PhotoNaming                    58     73     33   ✅ healthy
DetectiveMind                  15     15     15   ⚠️  thin
MultiStepPlanning              15     15     15   ⚠️  thin
MinimalPairs (raw)             16     30     17   ⚠️  thin
MinimalPairs (playable)        16     17     15   ⚠️  thin
```

And from the wave-1 work we already verified:

```
SemanticFeatures               20     20     20   ✅ healthy
DualLoadNaming                 20     21     20   ✅ healthy
SynonymGenerator               20     20     20   ✅ healthy
TwoClues                       50     20     18   ⚠️ T3 thin (pre-existing)
```

**Not yet audited** (no rows in the harness at all): `fix-sentence`, `meaning-match`, `phonological-awareness`, `sentence-construction`, `category-fluency`. Five games with progression hooks but no content-depth coverage in CI. We don't actually know if they can level up.

## The honest answer to your question

- **Below floor (15) — blocked from leveling:** none right now.
- **Thin (15–19) — will level but stall faster than they should:** DetectiveMind (all 3 tiers), MultiStepPlanning (all 3 tiers), MinimalPairs (T1, T3), TwoClues (T3).
- **Unknown — could be anywhere:** fix-sentence, meaning-match, phonological-awareness, sentence-construction, category-fluency.
- **Healthy:** PhotoNaming, SemanticFeatures, DualLoadNaming, SynonymGenerator.

The unknowns are the bigger risk than the thin ones. Thin means "works, less variety." Unknown means we're flying blind.

## Plan

### Step 1 — Extend the audit harness to cover all 14 games
One source of truth. Add the missing 5 to `contentDepthAudit.test.ts` so every game prints `T1/T2/T3` counts on every CI run. Run it, get the real numbers. No content changes yet.

### Step 2 — Triage based on step 1 output
Categorize the now-complete picture into: below floor (urgent), thin (target work), healthy. Surface that table to you before writing any content.

### Step 3 — Close below-floor tiers first
Anything <15 gets lifted to 20 immediately. These are the only ones that mathematically block level-up.

### Step 4 — Lift thin tiers to 20 (target)
The known-thin set: DetectiveMind, MultiStepPlanning, MinimalPairs, TwoClues T3. Plus whatever step 2 surfaces. Each tier gets enough items to satisfy variety + the existing recency-exclusion window without re-serving the same trial.

### Step 5 — Spot-check the new items
Difficulty parity within tier, frequency band where relevant (semantic_features / synonym_generator pattern), no leaks across tiers. Same discipline we applied in wave 1.

### Step 6 — Re-run audit, confirm green across all 14 games
Then we have a defensible "every game can level up" claim.

### What I'm *not* doing in this plan
- Not touching `clinical_progression_state` — the row-count problem is "users haven't played," not a schema issue.
- Not changing progression hooks, level specs, or the gate logic.
- Not adding new games or new tiers.
- Pure content + harness work.

## Notes for implementation
- Each new game audited needs whatever its content-source export is (`DETECTIVE_CASES`, `PLANNING_ITEMS`, etc.) — for the 5 unknowns I'll find the equivalent in `src/data/` and the tier classifier in `src/lib/progression/<game>DifficultyBridge.ts`.
- Recency-exclusion standard says we want enough items that the LRU window doesn't repeat within a session. 20/tier is the conservative target; some games may want more if a single session pulls many trials at one tier.
- All work guarded by the existing audit test — green = move on, same rule as wave 1.

Want me to proceed?