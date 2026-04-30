## Short answer

Yes — upgrading the games we already have is the right move. It is dramatically faster than building new ones, and it takes Phase 1 coverage from **~25%** of full stroke recovery to roughly **~70%** without writing a single new game shell.

We don't need 20 more games. We need to apply the **Phase 1 honesty pattern** (engine-level mapping, no tier blending, distinctness audit, perceptual curve) to the existing exercises that already touch other recovery domains.

---

## Coverage today vs. after upgrade

### Stroke recovery domains (from the research framing)
1. Language / aphasia
2. Cognition — attention, memory, executive function
3. Comprehension (auditory + reading)
4. Visuospatial / neglect
5. Motor / coordination
6. Social-emotional

### Where each existing exercise sits

| Domain | Already in catalog | Validated adaptive (Phase 1) |
|---|---|---|
| Language — word finding | photo-naming, word-finding, two-clues, dual-load-naming, describe-guess, synonym-generator, semantic-features, meaning-match, category-fluency | describe-guess, synonym-generator |
| Language — syntax/sentence | fix-sentence, sentence-construction, sentence-game, phrase-practice | fix-sentence, phrase-practice |
| Language — discourse | thought-continuation, thought-organization, narrative-retell, conversation-coach, conversation-partner | thought-continuation |
| Phonology / speech sound | minimal-pairs, phonological-awareness | — |
| Comprehension | detective-mind, follow-directions, abstract-compare | — |
| Executive / planning | multi-step-plan, sequence-builder, detective-mind | — |
| Visuospatial / neglect | left-side-hunt, pattern-match | — |
| Motor / coordination | reach-tap | — |
| Social-emotional | none | — |

### Coverage math

- **Today (5 validated):** ~25% of true stroke-recovery breadth — strong on language, weak everywhere else.
- **After this upgrade pass (target 12–14 validated across all 6 domains):** ~70%. The only remaining real gaps are social-emotional recognition and a dedicated reading/spelling game.

That last 30% is genuine new-build territory (Phase 3+). The other 70% is already sitting in the codebase, unvalidated.

---

## Recommended upgrade plan (Phase 1.5)

Apply the same five Phase 1 standards to one exercise per domain so each recovery area has at least one game that's truly adaptive and audited.

**Standards applied to each:**
- Move content to `src/data/<name>Bank.ts`
- Add `mapEngineLevelTo<Game>Tier(level)` — strict isolation, no cumulative blending
- Build a real L1 → L10 perceptual curve specific to the domain
- Add a distinctness test in `src/data/__tests__/contentDistinctness.test.ts` (0% Jaccard between L1/L5/L10 pools)
- Wire engine signal end-to-end so adaptation is visible

**Batch order (by clinical impact + effort):**

1. **photo-naming** — language: confrontation naming. Highest-frequency clinical exercise. Tier curve: high-frequency concrete → low-frequency abstract / multi-syllabic.
2. **multi-step-plan** — executive function. Tier curve: 2-step familiar routines → 6-step novel sequences with distractors.
3. **detective-mind** — comprehension + reasoning. Tier curve: 2-clue single-inference → 5-clue multi-constraint deduction.
4. **minimal-pairs** — phonology. Tier curve: maximally contrastive pairs (p/m) → minimal place/voice contrasts in noise.
5. **left-side-hunt** — visuospatial / neglect. Tier curve: large high-contrast targets centered → small low-contrast targets in left periphery with distractors.
6. **reach-tap** — motor. Tier curve: large slow targets, long dwell → small fast targets, short dwell, dual-task overlay.
7. **narrative-retell** — discourse (already partially adaptive, just needs the audit + curve formalization).

That's 7 upgrades, each ~1 short build cycle. After them: every recovery domain has at least one validated game.

### What NOT to do in this pass

- Do not build new game shells.
- Do not start phoneme-level personalization (Phase 2).
- Do not touch the 5 already-validated games.
- Do not promise social-emotional or reading/spelling coverage — flag those as Phase 3 gaps in the docs.

---

## Deliverables

1. Code: 7 game upgrades following the Phase 1 pattern.
2. Tests: extend `contentDistinctness.test.ts` to cover all 12 validated games (target: 80+/80+ passing, 0% overlap).
3. Doc update: revise `src/docs/PHASE_1_ADAPTIVE_SYSTEM_VALIDATION.md` (or add `PHASE_1_5_DOMAIN_COVERAGE.md`) with the new coverage matrix and a one-page domain map showing 70% coverage, remaining gaps, and Phase 2/3 boundaries.
4. Refresh the stakeholder docx (`NeuroSpark_Phase1_Summary_v2.docx`) so Mercy sees the real breadth, not just the 5-game language slice.

---

## Suggested execution

Do this in two approval checkpoints, not one giant batch:

- **Batch A (language + cognition):** photo-naming, multi-step-plan, detective-mind, minimal-pairs. Approve after audit passes.
- **Batch B (visuospatial + motor + discourse):** left-side-hunt, reach-tap, narrative-retell. Approve, then refresh docs + docx.

Visuospatial and motor adaptation use different difficulty axes than language (target size, dwell time, contrast, distractor load) — worth treating those as their own mini-design conversation when we get to Batch B rather than assuming the language pattern transfers cleanly.

Approve this and I'll start with Batch A.