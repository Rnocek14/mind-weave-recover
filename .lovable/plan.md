# Per-Game Difficulty: Honor Each Clinical Purpose

## The core insight

Every game already has a **per-level clinical promise** written in code:

- **PhotoNaming** (`photoNamingLevels.ts`): L1 heavy support → L8 phrase context + generalization
- **FixSentence** (`fixSentenceLevels.ts`): L1 obvious category violations → L8 ambiguous multi-valid sentences
- **MinimalPairs** (`minimalPairsLevels.ts`): L1 distinct contrasts → L8 fast discrimination under load

These ladders **train different cognitive skills**. PhotoNaming is about *lexical retrieval under fading support*. FixSentence is about *error type sophistication*. MinimalPairs is about *acoustic resolution + speed*.

A uniform "sub-tier slice + pressure knob" treatment would be wrong. The shared primitive must standardize *machinery*; each game must own *meaning*.

## Architecture

```text
┌──────────────────────────────────────────────────────┐
│  Shared primitive: GameIntensity                     │
│  - selectTrialsForLevel(slug, level, count) → trials │
│  - getLevelModifiers(slug, level) → modifiers        │
│  - getLevelLabel(slug, level) → string               │
│  Pure functions. No React. Auditable in one place.   │
└────────────────────┬─────────────────────────────────┘
                     │ delegates to per-game module
   ┌─────────────────┼─────────────────┐
   ▼                 ▼                 ▼
PhotoNaming      FixSentence      MinimalPairs
intensityMap     intensityMap     intensityMap
(lexical axis)   (error-type axis)(acoustic axis)
```

Each game registers a config that declares:
1. Its **primary difficulty axis** (what the clinical ladder is about)
2. Its **secondary axes** (pressure modifiers that compound the primary)
3. Its **level → axis-state mapping** (10 levels, what they pull)

The engine calls one shared function. Per-game logic lives in per-game files.

## Per-game intensity ladders

### PhotoNaming — Axis: lexical retrieval under fading support

Primary axis = **(word difficulty, support availability)** — they covary.

| Lvl | Word difficulty | Support available | Response window | Distractor chips |
|---|---|---|---|---|
| 1 | T1, top 500 frequency, 1-syl | semantic + phonemic + carrier on tap | none | n/a |
| 2 | T1, top 1000, 1-syl | semantic + phonemic on tap | none | n/a |
| 3 | T1, top 2000, 1–2-syl | semantic on tap | none | n/a |
| 4 | T2, top 3500, 1–2-syl | semantic on tap, costs a hint | none | n/a |
| 5 | T2, 3500–6000, 2-syl | semantic only after 8s silence | 20s soft | n/a |
| 6 | T2, 6000–8000, 2-syl + atypical exemplars | no semantic; phonemic after 10s | 18s soft | n/a |
| 7 | T2/T3 blend, 2–3-syl, lower frequency | no cues | 15s soft | n/a |
| 8 | T3, low-frequency, 2–3-syl | no cues | 12s firm | optional 1-chip foil |
| 9 | T3 stretch (atypical, late-acquired) | no cues | 10s firm | 2-chip foil |
| 10 | T3 stretch + phrase-context probe ("Say it in a sentence") | no cues | 10s firm | 2-chip foil |

Sort key inside content tier: `frequency_rank → syllable_count → age_of_acquisition`.
Stretch slice: tag ~12 of the 33 T3 photos with `stretch: true` for L9–10.

### FixSentence — Axis: error-type sophistication

Primary axis = **what kind of error must be detected and repaired**. This is the entire clinical point — repairing "pillow vs. soap" (category) is a different skill from repairing "coin vs. key" (function mismatch).

| Lvl | Error type pulled | Sentence length | Hint behavior | Multi-error? |
|---|---|---|---|---|
| 1 | category_error only (T1) | short (5–7 words) | "show me" button visible | no |
| 2 | category_error (T1, harder) + 20% semantic_swap | short | "show me" visible | no |
| 3 | semantic_swap (T2) dominant | 6–8 words | "show me" visible, costs hint | no |
| 4 | semantic_swap (T2) + 30% function_error preview | 6–8 words | "show me" after 10s silence | no |
| 5 | function_error (T2) dominant | 7–10 words | no "show me" | no |
| 6 | function_error (T3) | 8–11 words | no hint | no |
| 7 | function_error (T3, subtle) + 25% multiple_valid_repairs | 9–12 words | no hint | no |
| 8 | multiple_valid_repairs (T3) | 9–12 words | no hint | no |
| 9 | multiple_valid_repairs + 2-error sentences (Stretch) | 10–14 words | no hint | yes (2 errors) |
| 10 | 2-error sentences + paragraph-fragment context | 10–14 words | no hint | yes (2 errors) |

Sort key inside `errorType` cohort: `sentenceLength → wrongWordIndex` (errors late in sentence are harder — must hold sentence in working memory).

Bank work needed: tag 8–10 existing T3 items with `multiError: true` or curate a small `STRETCH_FIX_SENTENCES` slice of 12 two-error sentences for L9–10.

### MinimalPairs — Axis: acoustic resolution + speed

Primary axis = **(contrast distance, replay budget, response window)**. Replays are the real scaffold here — not cues.

| Lvl | Contrast type | Replay budget | Response window | Foil similarity |
|---|---|---|---|---|
| 1 | stop_fricative (max distance) | unlimited | none | distant photo foil |
| 2 | stop_fricative + place-of-articulation | 3 replays | none | distant photo foil |
| 3 | voicing contrasts (medium distance) | 2 replays | none | distant |
| 4 | voicing + fricative_affricate (single-feature) | 2 replays | 12s soft | medium |
| 5 | single-feature contrasts (T2 broadened) | 2 replays | 10s soft | medium |
| 6 | single-feature, medial position | 1 replay | 10s soft | close |
| 7 | single-feature, final position (hardest position) | 1 replay | 8s firm | close |
| 8 | within-pair confusable triads (Stretch) | 1 replay | 8s firm | very close |
| 9 | triads, no replay | 0 replays | 8s firm | very close |
| 10 | triads + dual-load (hold pair in memory through distractor) | 0 replays | 8s firm | very close |

Sort key inside cohort: `contrastDistance (computed from phoneme feature delta) → contrastPosition (initial < medial < final)`.

Bank work needed: compute `contrastDistance` once from existing `phoneme1`/`phoneme2`; tag confusable triads.

## Why the axes have to differ

| Game | If you only swap words | If you only add time pressure | If you only strip cues |
|---|---|---|---|
| PhotoNaming | partial — you still need fading support | partial — words still too easy | partial — words still too easy |
| FixSentence | wrong — easy sentences with subtle errors are harder than long sentences with obvious errors | useless — repair isn't a speed task | partial — error-type sophistication is the point |
| MinimalPairs | partial — replays still rescue any contrast | helps, but replays still mask difficulty | replays ARE the cue; budget is the lever |

This is why the primitive is *structural*, not *prescriptive*. Each game declares its own axes.

## Implementation plan

### Step 1 — Shared primitive (no behavior change yet)
- New `src/lib/intensity/gameIntensity.ts`:
  - `GameIntensityConfig` interface: `{ sortKey, levelMap, modifierMap }`
  - `selectTrialsForLevel(slug, level, candidates, count)` — sorts + slices
  - `getLevelModifiers(slug, level)` — returns `{ cueAvailability, responseWindowMs, replayBudget, foilSimilarity, multiError, stretch }` (game uses whichever apply)
- Per-game registries: `photoNamingIntensity.ts`, `fixSentenceIntensity.ts`, `minimalPairsIntensity.ts` — encode the three tables above
- Pure functions, full unit test for each level → expected slice + modifiers

### Step 2 — PhotoNaming wiring (reference game)
- `photoBank.getTrialsForLevel` calls `selectTrialsForLevel('photo-naming', level, ...)` after tier filter
- `PhotoNamingExercise.tsx`: read modifiers → drive existing cue/timer/chip code (most knobs already exist)
- Tag ~12 T3 photos with `stretch: true`
- Update `PHOTO_NAMING_LEVELS[n].description` to match the new content reality
- Verify with `/dev/adaptation-sim`: confirm L4–L7 now pull visibly different items

### Step 3 — FixSentence wiring
- Add `sentenceLength` to each `FixSentenceTrial` (computed once, write back)
- New selector reads errorType mix per level from intensity map
- Curate 10–12 two-error sentences for `STRETCH_FIX_SENTENCES`
- `FixSentenceExercise.tsx`: read modifiers → hide "show me" at L≥5, hide model at L≥6
- Update level descriptions

### Step 4 — MinimalPairs wiring
- Compute `contrastDistance` from phoneme feature table (one-shot util)
- New selector picks contrast cohort per level
- `MinimalPairsExercise.tsx`: read `replayBudget` → cap audio replay button; read `responseWindowMs` → enable soft timer at L≥4
- Curate or generate triads for L8–10

### Step 5 — Verification rig
- Extend `/dev/adaptation-sim` with **"Intensity Ladder"** panel per game: input level 1–10, see item IDs + modifier values rendered side-by-side. Eyeball that levels are visibly distinct.
- Extend `contentDepthAudit.test.ts`: report **per-level slice depth** (not just per-tier), warn if any level can't pull ≥5 items
- New memory: `architecture/per-game-intensity-system` documenting the 3 axes + how to add a 4th game

### Step 6 — Roll out Phase 2 games (one per session, post-validation)
For each: DetectiveMind, MultiStepPlanning, AbstractCompare, MeaningMatch, DualLoadNaming, Synonym, CategoryFluency, TwoClues, DescribeGuess.

Per-game work = define axis(es) + level map + modifier consumption. Should be ~30 min each once the primitive is proven.

## What does NOT change

- 5-trial engine logic, success bands, recap, soft regression
- Mastery / cue-dependency / governance gates
- Progression spec (10 levels, evidence rules, trial weights)
- Telemetry schema — `task_parameters.intensity_state` is additive

## Risk + mitigation

- **Per-level slice depth** → audit reports per-level; selector falls back to ±1 level cohort if a level can't fill its trial count
- **Pressure modifiers stacking too aggressively** → each game tunes its own ramp; PhotoNaming time window only kicks in at L≥5
- **Re-tagging burden (stretch slice, sentence length, contrast distance)** → all one-shot computed values written back to bank; no per-trial overhead
- **Tests on existing level evidence** → unchanged; we change content delivery, not what counts as evidence

## What success looks like for your dad

- PhotoNaming L5 vs L6: different words AND a soft timer appears
- FixSentence L4 vs L5: function-mismatch errors start replacing semantic swaps; "show me" disappears
- MinimalPairs L5 vs L6: same contrast types but moves to medial position, replays drop from 2 → 1
- He'll feel each level click into a new gear instead of a number going up
