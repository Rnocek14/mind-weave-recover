## Goal

Get every game's content bank above the FLOOR (15 items per tier) and to TARGET (20 per tier) where possible, so the adaptive engine has real room to move. Today only 3 of 15 games clear that bar.

## Current state (from `contentCoverage` + `contentDepthAudit` harnesses)

| Game | T1 | T2 | T3 | Status |
|---|---|---|---|---|
| photo_naming | 58 | 73 | 33 | ready |
| fix_sentence | 20 | 20 | 20 | ready |
| sentence_construction | 30 | 24 | 32 | ready |
| detective_mind | 15 | 15 | 15 | at floor |
| multi_step_planning | 15 | 15 | 15 | at floor |
| abstract_compare | 16 | 16 | 16 | at floor |
| minimal_pairs (playable) | 16 | 17 | 15 | at floor |
| phonological_awareness | 16 | 22 | **14** | T3 below |
| two_clues | 50 | **6** | 18 | T2 critical |
| describe_guess | 16 | 15 | **14** | T3 below |
| meaning_match | 18 | **14** | 15 | T2 below |
| narrative_retell | **10** | 15 | **12** | T1+T3 below |
| semantic_features | **8** | 15 | **6** | T1+T3 critical |
| synonym_generator | 12 | 12 | 12 | tier tagging exists, just thin |
| dual_load_naming | **8** | **9** | **8** | critical everywhere |

## Strategy

Three priority waves. Each wave ends with the coverage harness green for the games it touched. Stop between waves so you can review the content before the next push.

### Wave 1 — Critical gaps (engine is currently lying)

Bring these to ≥20 per tier. These are games where, today, a patient lands at a level and sees the same items 3–5× per session.

1. **dual_load_naming** — add 12 sets per tier (currently 8/9/8 → 20/20/20). +36 sets. Each set = 3 memory words + 6 picture targets with emoji.
2. **semantic_features** — add 12 T1 and 14 T3 trials (currently 8/15/6 → 20/20/20). +26 trials. Reuse existing FEATURE_POOL, only author new word entries.
3. **two_clues** T2 — add 14 puzzles (currently 6 → 20). +14 puzzles with anchors/cluster/nearMisses/coachHints.
4. **synonym_generator** — add 8 prompts per tier (currently 12/12/12 → 20/20/20). +24 prompts. Tier tagging already exists in file.

Wave 1 total: ~100 new items. Largest authoring cost is two_clues (rich answer graphs) and dual_load (needs emoji pairing).

### Wave 2 — Below floor (one or two tiers)

Bring to ≥20 per tier.

5. **narrative_retell** — add 10 T1 stories and 8 T3 stories (currently 10/15/12 → 20/20/20). +18 stories. Each = 4 scenes + keyEvents + structureMap.
6. **meaning_match** T2 — add 6 items (14 → 20). +6 items.
7. **describe_guess** T3 — add 6 items (14 → 20). +6 items.
8. **phonological_awareness** T3 — add 6 trials (14 → 20). +6 trials.

Wave 2 total: ~36 new items.

### Wave 3 — At-floor games (no headroom for recency exclusion)

Lift from 15–17 → 20.

9. **detective_mind** — +5 per tier = +15 cases. Heaviest authoring (multi-clue mystery format).
10. **multi_step_planning** — +5 per tier = +15 items.
11. **abstract_compare** — +4 per tier = +12 items.
12. **minimal_pairs** — +4 T1, +3 T2, +5 T3 (playable pool). Also fill raw L4–L5 buckets (separate concern, listed as backlog).

Wave 3 total: ~50 new items.

### Grand total
~186 new content items across 12 games. Doable in three focused passes.

## How content gets authored

For each bank, the workflow per wave:

1. Read the existing bank file and the schema (interfaces, tier conventions, any aliases/cues/distractors).
2. Author new items that match the existing tier definition exactly — same word frequency, same syntactic complexity, same scene/event count. No drift in difficulty contract.
3. Reuse the existing helper structures (FEATURE_POOL for semantic_features, DEFAULT_STRUCTURE for narrative_retell, anchorAliases pattern for two_clues, etc.). Don't introduce new fields.
4. Run `bunx vitest run src/lib/leveling/__tests__/contentCoverage.test.ts src/data/__tests__/contentDepthAudit.test.ts` after each game. Green = move on.
5. For games with a `contentReadiness` field in `PER_GAME_CONTRACTS`, flip from `needs_bank_expansion` → `ready` once that game clears 20/20/20. This is what the `/games/:slug/about` surface reads.

## Technical notes (for reference)

- All banks live in `src/data/*.ts` as plain exported arrays — no DB writes.
- Tier values are 1|2|3 (game-internal); engine levels 1–10 map onto these via per-game progression files in `src/lib/progression/`. Bank work doesn't touch the engine.
- For minimal_pairs, the "playable pool" filter requires photo-bank coverage. Adding raw pairs without photo coverage won't lift the playable count. Either expand photo_bank or pick pairs from existing photo targets — the latter is faster.
- synonym_generator already has T1/T2/T3 arrays — the `needs_tier_tagging` label in the registry is stale and should be updated to `needs_bank_expansion` then `ready`.
- No migrations, no edge functions, no UI changes. This is pure data authoring against existing schemas.

## What I will NOT do in this scope

- Won't expand photo_bank (already healthy).
- Won't redesign tier contracts or progression archetypes (frozen per memory).
- Won't wire mastery confidence or change the level-up math.
- Won't ship the `/games` gating idea — separate decision.
- Won't touch sentence_construction or fix_sentence (already ready).

## Suggested next step

Start with **Wave 1** since it's where the engine is actively misbehaving. I'd recommend doing it as four sub-commits (one per game) so you can review each bank before the next.

Want me to start at the top of Wave 1 (dual_load_naming), or pick a different entry point?