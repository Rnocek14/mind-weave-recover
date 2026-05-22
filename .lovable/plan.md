## Goal
Lift every progression-wired game to ✅ healthy (≥20 items per tier) so the engine can always find a next-tier item. Same discipline as Wave 1: each phase ends with the audit harness green before moving on. No engine, hook, or bridge changes — content + spot-checks only.

## Current state (just ran the audit)

```
🔴 BELOW FLOOR (engine can't reliably level into this tier)
  semantic-features        T2=13  T3=7
  phonological-awareness   T2=10  T3=14
  meaning-match            T2=14

⚠️  THIN (levels but variety stalls)
  meaning-match            T1=18  T3=15
  two-clues                T3=18
  detective-mind           T1=15  T2=15  T3=15
  multi-step-plan          T1=15  T2=15  T3=15
  minimal-pairs (raw)      T1=16  T3=17
  minimal-pairs (playable) T1=16  T2=17  T3=15
```

## Phases

### Phase 1 — Below-floor (unblocks level-up)
Highest priority; these tiers mathematically prevent escalation.

1. **semantic-features** — +7 T2, +13 T3
   - T3 items must match existing `PHOTO_BANK` assets and be low-frequency / multi-step semantic features.
   - If a candidate target lacks a photo, drop it; do not invent assets.
2. **phonological-awareness** — +10 T2 (bank diff 3), +6 T3 (bank diff 4–5)
   - T2: onset/coda contrasts.
   - T3: vowel + multi-phoneme + nonword/low-frequency contrasts at diff 4–5. **L8 stays aspirational** (degraded-signal mode not built); flag separately, do not fake-fill diff 6–10.
3. **meaning-match** — +6 T2

→ Run audit. Confirm all three exit 🔴.

### Phase 2 — Thin tiers, expressive games
Variety / recency comfort across a full session.

4. **two-clues** — +2 T3
5. **meaning-match** — +2 T1, +5 T3

→ Run audit.

### Phase 3 — Thin tiers, receptive comprehension games
6. **detective-mind** — +5 each tier (T1/T2/T3)
7. **multi-step-plan** — +5 each tier (T1/T2/T3)

→ Run audit.

### Phase 4 — Minimal pairs
Two views (raw bank vs playable trials after filter).

8. **minimal-pairs** — +4 T1 raw, +3 T3 raw; ensure +5 T3 playable after filter

→ Run audit. Confirm every game ✅ healthy.

### Phase 5 — Spot-check & document
- Difficulty parity within tier (no diff-2 item filed as T3, etc.).
- Frequency band where relevant (semantic_features, synonym_generator pattern).
- Recency-exclusion sanity (no near-duplicates).
- Append final audit snapshot to `.lovable/plan.md`.
- Surface the phono-awareness L8 gap as a separate scoped decision (bank mode work, not content work).

## Discipline (carried from Wave 1)
- Each phase ends with `bunx vitest run src/data/__tests__/contentDepthAudit.test.ts`. Green = move on. Red = stop and fix before next phase.
- One game per file edit; no batch-editing multiple banks in a single tool call when the schemas differ.
- No changes to: hooks, level specs, bridges, gate logic, schema, or new game/tier introduction.

## What I'm NOT doing
- Touching `clinical_progression_state` (still a usage gap, not a code gap).
- Filling phono diff 6–10 (no runtime mode for it; would create dead content).
- Extending PHOTO_BANK to match invented semantic-features targets (asset work is its own decision).

## Estimated scope
- Phase 1: ~29 items across 3 files
- Phase 2: ~9 items across 2 files
- Phase 3: ~30 items across 2 files
- Phase 4: ~12 items in 1 file
- Total: ~80 new items, 5 audit runs, 1 final spot-check pass.

Ready to start Phase 1 on approval.