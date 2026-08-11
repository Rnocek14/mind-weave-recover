# Unimplemented Clinical Tiers — Roadmap

**Status:** survey + recommended build order. Doc-first per
`docs/telemetry-validation-checklist.md` §6 — nothing here is a commitment
to code; each item ships only after its own spec is reviewed.

Snapshot date: 2026-08-11 (post L5 two-error launch, post semantic-features
L8 unlock). Source of truth is each game's `*Levels.ts` — this doc is a map,
not a mirror; when they disagree, the spec files win.

## 1. Where every ladder stands

**Polished games (clinical selectors live).** Rungs not listed are implemented.

| Game | Planned rungs | tierKey | Blocked on |
|---|---|---|---|
| fix_sentence | L6 | `mixed_morphology` | bank tags + morpheme-aware scoring — **spec ready** (`docs/fix-sentence-morphology-spec.md`) |
| fix_sentence | L7 | `embedded_clauses` | syntactic-structure tags on bank |
| fix_sentence | L8 | `open_ended_repair` | LLM-graded judge (server) |
| minimal_pairs | L7 | `degraded_signal` | WebAudio degradation chain — **spec ready** (`docs/minimal-pairs-l7-l8-spec.md`) |
| minimal_pairs | L8 | `triplet_rt` | triplet trial type + RT bands — same spec |
| phonological_awareness | L8 | `degraded_signal` | same audio chain as minimal_pairs L7 (build once, reuse) |
| meaning_match | L8 | `figurative` | figurative-language stimuli (shared cluster, §2) |
| two_clues | L8 | `figurative` | same cluster |
| category_fluency | L8 | `figurative_set` | same cluster |
| synonym_generator | L8 | `constrained_output` | constraint mechanic (shared cluster, §2) |
| dual_load_naming | L8 | `constrained_output` | same cluster |
| multi_step_planning | L8 | `constrained_output` | same cluster |
| sentence_construction | L8 | `open_complex` | LLM-graded judge (pairs with fix_sentence L8) |
| detective_mind | L8 | `novel_abstract_case` | novel-case generation + open scoring |
| photo_naming | L7–L8 | partial | carrier-phrase caveat / probe overlap — content, not engine |
| semantic_features | — | — | **fully implemented as of this wave** (d=5 pool 9 → 20; ceiling L8) |

**Dark games (whole ladder is design-of-record; game runs on engine
difficulty only):** abstract_compare, conversation_coach,
conversation_partner, describe_guess, narrative_retell,
thought_continuation. Their `*Levels.ts` ladders are fully specified with
`implemented: false` on every rung. Blocked on each game graduating into
the polished-exercise allowlist first — wiring a clinical selector to an
unpolished game inverts the quality order.

## 2. Shared infrastructure clusters (build once, unlock several)

1. **Audio degradation chain** — minimal_pairs L7 + phonological_awareness
   L8. One WebAudio insert (noise mix + low-pass) over the existing TTS
   `HTMLAudioElement` unlocks both. Spec: `docs/minimal-pairs-l7-l8-spec.md`.
2. **Figurative-language bank** — meaning_match L8, two_clues L8,
   category_fluency L8. One reviewed idiom/metaphor stimulus bank with
   per-game adapters. Needs SLP review *before* engine work — figurative
   stimuli are the highest-risk content class for aphasia (opaque idioms
   frustrate more than they treat).
3. **Constrained-output mechanic** — synonym_generator, dual_load_naming,
   multi_step_planning L8. A shared "exclusion constraint" trial wrapper
   (e.g. "name it WITHOUT using the word X" / time-window bands).
4. **LLM-graded open scoring** — fix_sentence L8, sentence_construction L8,
   detective_mind L8. Server-side judge (edge function), rubric per game,
   cost-capped. Largest lift; do last, after the cheaper tiers prove the
   demand.

## 3. Recommended order

1. ~~semantic_features L8 content unlock~~ — **done this wave**.
2. Fix Sentence L6 morphology (spec ready; pure client, mirrors the shipped
   L5 pattern).
3. Audio degradation chain → minimal_pairs L7, then phonological_awareness
   L8 (spec ready).
4. minimal_pairs L8 triplet/RT (depends on nothing above, but sequenced
   after L7 so the tier ladder fills bottom-up).
5. Figurative bank (content + SLP review) → meaning_match / two_clues /
   category_fluency L8.
6. Constrained-output wrapper → the three `constrained_output` L8s.
7. LLM-judge cluster.
8. Dark-game ladders — only as each game is polished into the allowlist.

## 4. Flagged decisions (need a human call, not code)

- **semantic_features L6 floor.** The difficulty bridge holds L6 at bank
  floor 3 because d=4 was thin when authored. d=4 now holds 20 trials.
  Raising the L6 floor to 4 matches the ladder's documented intent but is
  a patient-facing difficulty jump for anyone currently sitting at L6.
  Recommend: raise only behind a fresh-session check, or ride until the
  SLP review.
- **photo rendering in SemanticFeatureGame.** `trial.imageCategory` holds
  word-level values (`'apple'`) but `PHOTO_BANK.category` holds broad
  classes (`'kitchenware'`), so the lookup never matches and the game
  always renders word-only. Harmless today (UI degrades gracefully) but
  either wire `imageCategory` → `PHOTO_BANK.target` or drop the field.
- **photo_naming L7/L8 partial caveats** — carrier-phrase and probe-overlap
  caveats are documented in `photoNamingLevels.ts`; resolving them is
  content/protocol work for the SLP review, not engineering.
