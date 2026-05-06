## Per-Game Leveling Contract — Specification Phase

This plan creates a **single design document** (`src/docs/PER_GAME_LEVELING_CONTRACT.md`) plus a **typed but unused** TypeScript registry (`src/lib/leveling/perGameContracts.ts`) that captures, for every game, what Level 1–10 means.

Nothing wires into live gameplay. `useInGameAdaptation`, `AdaptiveDifficultyController`, the mastery shadow layer, and all game hooks remain untouched. The registry is exported but not imported by any runtime path — it exists so future PRs can opt games in one at a time behind a flag.

---

### Why this step

The mastery shadow layer is logging skill-domain progress, but each game still defines "harder" differently (tier 1–3, level 1–5, internal flags). Before any visible level/progress UI ships, we need a written contract per game answering:

- What gets harder from L1 → L10?
- What softens (support inflation) when the user struggles, *without* dropping the visible level?
- How fast can a fresh user climb early levels while clearly succeeding?
- When does the system actually drop a level (hard regression) vs. just add cues (soft regression)?
- Does the current content bank actually *have* L1–L10 material, or only L1–L3?
- What's the wiring risk per game?

---

### Deliverables

**1. `src/docs/PER_GAME_LEVELING_CONTRACT.md`**

Structure:
- Global model (universal rules: start at L1, fast climb while on a roll, soft-before-hard regression, never punish one bad trial, fatigue ≠ decline).
- Universal level bands (reuses existing `LEVEL_LABELS`/`LEVEL_LEVERS` from `src/lib/gameLevels.ts`).
- Per-game section for each of the 15 games in `src/hooks/use*Game.ts`:
  - Photo Naming, Two Clues, Describe & Guess, Meaning Match, Minimal Pairs, Phonological, Semantic Feature, Synonym Generator, Fix Sentence, Sentence Construction, Narrative Retell, Multi-Step Plan, Abstract Compare, Dual-Load Naming, Detective Mind.
- Master table at the end (Game | L1–10 difficulty drivers | Support/ease drivers | Fast level-up rule | Level-down rule | Content ready? | Wiring risk | Recommendation).

For each game I'll fill the table from what's already in the codebase: existing tier tags in the data banks, current `useInGameAdaptation` config, content counts per tier (e.g. Two Clues has tier 1/2/3 tagged; Meaning Match has tier-tagged items; Abstract Compare has only ~83 lines so likely L1–L3 only). Games where content is thin will be flagged "needs bank expansion — shadow only."

**2. `src/lib/leveling/perGameContracts.ts`**

A typed, exported, **unused** registry:

```ts
export interface PerGameLevelingContract {
  slug: string;
  internalScale: { min: number; max: number };
  difficultyDrivers: string[];     // what increases L1 → L10
  supportDrivers: string[];        // what softens (cues/time/choices)
  fastClimb: { upToLevel: number; consecutiveStrongTrials: number };
  hardRegression: { minPoorSessions: number; cueIndependenceFloor: number };
  progressWeights: {
    correctNoCue: number;
    correctLightCue: number;
    correctHeavyCue: number;
    incorrect: number;
    skip: number;
  };
  contentReadiness: 'ready' | 'needs_bank_expansion' | 'needs_tier_tagging' | 'shadow_only';
  wiringRisk: 'low' | 'medium' | 'high';
}

export const PER_GAME_CONTRACTS: Record<string, PerGameLevelingContract> = { ... };
```

No game imports it. No hook reads it. It's purely a machine-readable mirror of the doc so the next phase can wire it behind a flag with type safety.

**3. Optional: a single dev-only audit page** `src/pages/dev/LevelingContractDev.tsx` (admin-gated, reuses the pattern from `MasteryShadowDev.tsx`) that renders the registry as a sortable table. Skip if you'd rather keep this PR doc-only — say the word.

---

### Universal model captured in the doc

- Everyone starts L1 on every game.
- **Fast climb:** L1 → L3 can move after 2–3 strong unaided trials (success + no cue + reasonable RT). L4+ requires sustained cue-independence.
- **Soft regression first:** struggle adds cues / time / fewer distractors at the *same visible level*. Only after N poor sessions with low cue-independence does the visible level drop by 1.
- **Never punish a single trial or single session.** Bad days inflate support; they don't drop level.
- **Cue-dependency gate** (already exists in `useInGameAdaptation`) remains the guard against premature up-level.
- **Mastery shadow layer stays observational.** This contract describes the *intended* connection point but does not make it.

---

### What this plan does NOT do

- Does not modify any game hook.
- Does not modify `useInGameAdaptation`, `AdaptiveDifficultyController`, `gameLevels.ts`, or the mastery layer.
- Does not change any UI patient-facing or clinician-facing.
- Does not add a DB migration.
- Does not introduce a feature flag (no behavior to flag yet).

### Acceptance

- The doc covers all 15 games with the 8-column table filled.
- The TS registry compiles and matches the doc.
- Build is green; no game's runtime behavior changes.
- We then have a concrete artifact to review together before deciding which game to wire first (likely Photo Naming or Two Clues — both have the deepest tagged content).
