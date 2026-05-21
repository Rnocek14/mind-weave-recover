
# Clinically-Backed Leveling for All 17 Games — Phased Execution Plan

## 1. What the research actually gives us

The deep-research doc is a complete clinical design-of-record. For every one of the 17 games it locks down:

- **Clinical target** (one sentence, e.g. "convergent lexical retrieval from sparse semantic cues").
- **Primary axis** — exactly ONE dimension that drives L1→L8 (e.g. cue diagnosticity, syntactic complexity, semantic distance, inferential load).
- **Banned axes** — what NOT to use (e.g. "don't ladder by raw frequency", "don't ladder by cue fade").
- **Archetype** — content-expanding / pressure / hybrid / open-ended.
- **Orthogonal support model** — what cueing is allowed and how it must stay separate from content level.
- **Candidate L1–L8 rungs** — concrete, item-level examples.
- **Confidence label** — High / Moderate / Exploratory.
- **Known integrity caveats** — the exact failure modes to guard against.
- **Cross-family map** — which engine helpers can be shared.

**Confidence inventory:**
- **High (1):** `sentence-construction` (TUF / mapping therapy).
- **Moderate (10):** `semantic-features`, `meaning-match`, `category-fluency`, `narrative-retell`, `multi-step-plan`, `pattern-match`, `phonological-awareness`, `dual-load-naming`, `conversation-coach`, `minimal-pairs` (already shipped).
- **Exploratory (6):** `two-clues`, `synonym-generator`, `describe-guess`, `thought-continuation`, `abstract-compare`, `detective-mind`, `conversation-partner`.

Already shipped at `status: 'full'`: `photo-naming`, `fix-sentence`, `minimal-pairs`. Remaining: **14 games**.

## 2. What "done" means for each game

Every game ends up in exactly ONE of these honest states in `clinicalLadderRegistry.ts`:

| Tier | Registry status | What ships | UI surface |
|---|---|---|---|
| A — Full ladder | `'full'` | `<slug>Levels.ts` + `ContentSelector.ts` + `DifficultyBridge.ts` + `Intensity.ts` + evidence doc | "Full L1–L8 ladder" badge, all 8 rows ready |
| B — Structural ladder | `'structural'` (new) | Same 5 artifacts, but L6–L8 rows tagged `readiness: 'thin' \| 'aspirational'` | Same table; amber/muted chips on weak rows |
| C — Design of record | `'design-only'` (new) | Evidence doc + L1–L8 spec table only; runtime stays on generic engine | "Planned — runtime uses generic engine" banner; design table still rendered |

No "generic" entry survives in the registry once Phase 5 ships — every game has at least a design-of-record.

## 3. Tier assignment per game

Driven by (a) research confidence and (b) the three engineering constraints (content-bank depth, rubric scorer availability, untrained-probe banks).

**Tier A — Full (4 new + 3 existing = 7):**
`semantic-features`, `meaning-match`, `two-clues`, `category-fluency`
(plus existing `photo-naming`, `fix-sentence`, `minimal-pairs`)

**Tier B — Structural (7):**
`synonym-generator`, `sentence-construction`, `multi-step-plan`, `pattern-match`, `detective-mind`, `phonological-awareness`, `dual-load-naming`

**Tier C — Design-of-record (6):**
`describe-guess`, `narrative-retell`, `thought-continuation`, `abstract-compare`, `conversation-coach`, `conversation-partner`
(all require discourse-rubric scorer work that is out of scope for this build)

## 4. Phased execution

Five phases. Each phase is independently shippable and reversible (registry-flag controlled).

### Phase 0 — Foundations (1 day)

Pure infra so the rest can move fast in parallel.

1. Extend `LadderStatus` to `'full' | 'structural' | 'design-only' | 'telemetry-only' | 'generic'`.
2. Add `Readiness = 'ready' | 'thin' | 'aspirational'` to every level spec (already exists in `minimal-pairs`).
3. Create `src/lib/progression/_shared/`:
   - `buildLevelSpec.ts` — tiny factory so each game's `Levels.ts` is ~40 lines.
   - `lexicalRetrievalLevels.ts` — shared helper for the semantic family.
   - `discourseRubricLevels.ts` — shared helper for the discourse family.
4. Update `ClinicalLibrary.tsx` `STATUS_BADGE` map: add `structural` and `design-only` variants.
5. Update `GameAboutPage.tsx` to render a "Planned — runtime on generic engine" banner when `status === 'design-only'`.

### Phase 1 — Tier A Semantic core (Days 2–4)

Ship full ladders for the 4 highest-confidence remaining semantic games using shared lexical helper.

Per game (~½ day each):
1. `<slug>Levels.ts` — L1–L8 spec copied from research, every rung labelled `readiness: 'ready'`.
2. `<slug>ContentSelector.ts` — pool partitioning over existing bank.
3. `<slug>DifficultyBridge.ts` — maps engine 1–10 → level 1–8 + soft-regression parity.
4. `<slug>Intensity.ts` — registered in `intensity/index.ts`.
5. `docs/clinical-evidence/<slug>.md` — TL;DR + caveats from research.
6. Registry entry → `status: 'full'`.
7. Tests: snapshot of L1–L8 table, bridge monotonicity, selector pool non-empty per level.

**Games:** `semantic-features`, `meaning-match`, `two-clues`, `category-fluency`.

End of Phase 1: 7 of 17 games at full ladder.

### Phase 2 — Tier B Structural ladders (Days 5–8)

Same 5-artifact pattern as Tier A, but `readiness` honesty is inside the table:

- L1–L5 rungs → `'ready'`
- L6–L7 → `'thin'` (engine selects but content bank is shallow)
- L8 → `'aspirational'` (engine selects, item set is a stub, telemetry flags caveat)

Each game also writes a `KNOWN_CAVEATS` block into its evidence doc (verbatim from research).

**Games (½ day each):** `synonym-generator`, `sentence-construction`, `multi-step-plan`, `pattern-match`, `detective-mind`, `phonological-awareness`, `dual-load-naming`.

Shared helpers used: `lexicalRetrievalLevels` for synonym/two-clues; new `executiveLoadLevels` for plan/pattern/detective; existing `minimalPairsLevels` patterns adapted for `phonological-awareness` and `dual-load-naming`.

End of Phase 2: 14 of 17 games at structural-or-better.

### Phase 3 — Tier C Design-of-record (Days 9–10)

No runtime change. For each game:

1. Write evidence doc with full L1–L8 spec table, banned axes, caveats.
2. Add registry entry with `status: 'design-only'` and the L1–L8 rung descriptions (description + targetSupport + readiness only — no attempts/accuracy columns).
3. `/games/:slug/about` page automatically renders the design table + banner.

**Games:** `describe-guess`, `narrative-retell`, `thought-continuation`, `abstract-compare`, `conversation-coach`, `conversation-partner`.

End of Phase 3: all 17 games have a published clinical design. No game shows as "generic" anywhere.

### Phase 4 — Adaptive engine wiring + validation (Days 11–12)

1. For every Tier A and Tier B game, confirm `useInGameAdaptation` is wired and the universal adaptation telemetry fires.
2. Run `/dev/adaptation-sim` across all 14 ladders with the 5 synthetic profiles. Required assertions: gate behaves, no inappropriate L→L jumps, soft-regression triggers correctly, narration follows ban-list.
3. Run `bannedClinicalLanguage.test.ts` across every new evidence doc.
4. Run `useRecencyExclusion` adoption check per Tier A game.
5. Flip registry: confirm zero entries at `status: 'generic'`.

### Phase 5 — Clinician/patient surfacing (Days 13–14)

Pure presentation work to make the new ladders visible and honest.

1. `ClinicalLibrary.tsx`: filter chips for Full / Structural / Design-only; readiness chips on each row.
2. `GameAboutPage.tsx`: confidence label badge (High/Moderate/Exploratory) + caveats accordion drawn from registry.
3. `AboutGameLink` already wired everywhere (exercise cards, level-up banner, pause overlay, session summary, Patient Hub Plan tab) — no changes.
4. Write `docs/clinical-evidence/ladders-summary.md`: one-row-per-game master table (axis / archetype / confidence / readiness range / scorer dependency).
5. Clinician review pass on the 6 exploratory-confidence games before unhiding.

## 5. Risks and how each phase de-risks them

| Risk | Mitigation |
|---|---|
| Discourse rubric scope creep eats the whole sprint | Tier C exists for exactly this — Phase 3 ships design only, scorer work is its own future track |
| Content banks too thin for L6–L8 on some Tier B games | `readiness: 'thin'/'aspirational'` makes this visible to clinicians instead of hidden |
| Banned-language drift in evidence docs | Phase 4 step 3 runs `bannedClinicalLanguage.test.ts` against every new doc |
| Engine accidentally jumps the L6→L8 gap on exploratory games | Phase 4 adaptation-sim required assertions block ship |
| Clinicians see "exploratory" rating and lose trust | Phase 5 surfacing pairs every exploratory badge with the matching caveats list from research |

## 6. Technical details (for engineering reference)

```text
src/lib/progression/
  _shared/
    buildLevelSpec.ts
    lexicalRetrievalLevels.ts
    discourseRubricLevels.ts
    executiveLoadLevels.ts
  semanticFeaturesLevels.ts        + ContentSelector + DifficultyBridge
  meaningMatchLevels.ts            + ContentSelector + DifficultyBridge
  twoCluesLevels.ts                + ContentSelector + DifficultyBridge
  categoryFluencyLevels.ts         + ContentSelector + DifficultyBridge
  synonymGeneratorLevels.ts        + ContentSelector + DifficultyBridge
  sentenceConstructionLevels.ts    + ContentSelector + DifficultyBridge
  multiStepPlanLevels.ts           + ContentSelector + DifficultyBridge
  patternMatchLevels.ts            + ContentSelector + DifficultyBridge
  detectiveMindLevels.ts           + ContentSelector + DifficultyBridge
  phonologicalAwarenessLevels.ts   + ContentSelector + DifficultyBridge
  dualLoadNamingLevels.ts          + ContentSelector + DifficultyBridge

src/lib/intensity/
  + 11 new per-game intensity files, registered in index.ts

src/lib/clinicalLadderRegistry.ts
  - LadderStatus union: add 'structural' | 'design-only'
  - 14 entries updated; 6 design-only entries carry rung tables
  - rowsFromSpec generalized to accept any spec shape

src/pages/ClinicalLibrary.tsx
  - STATUS_BADGE: add structural + design-only variants
  - GameCard: design-only branch renders compact table

src/pages/GameAboutPage.tsx
  - Banner when status === 'design-only'
  - Confidence badge + caveats accordion for all statuses

docs/clinical-evidence/
  + 14 new <slug>.md files
  + ladders-summary.md (master index)
```

No database migrations. No edge functions. No new tables. No changes to scoring authority (`responseValidation.ts`), drill selection (`drillSelector.ts`), or trial-logging contract. Pure additive spec + bridge + UI work.

## 7. Deliverable timeline

| Phase | Days | Output |
|---|---|---|
| 0 | 1 | Shared helpers + UI variants ready |
| 1 | 3 | 4 new Tier A ladders live (7 total full) |
| 2 | 4 | 7 Tier B structural ladders live (14 total) |
| 3 | 2 | 6 Tier C designs published (17 total) |
| 4 | 2 | Full sim sweep + telemetry green |
| 5 | 2 | Clinician/patient surfacing complete |
| **Total** | **14 days** | **17/17 games clinically backed, leveled, and adaptive** |
