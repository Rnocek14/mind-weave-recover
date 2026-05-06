# Per-Game Leveling Contract (v0 — Spec Only)

**Status:** Specification. **No live wiring.** This document defines what
Level 1–10 means for every game so that a future PR can connect the mastery
shadow layer to live gameplay one game at a time, behind a flag.

`useInGameAdaptation`, `AdaptiveDifficultyController`, the mastery shadow
layer, and every game hook are unchanged by this document.

---

## 1. Universal Model

Applies to every game.

1. **Everyone starts at Level 1** for every game, regardless of overall
   skill in other games. Level is per-game, not per-account.
2. **Fast climb early.** Level 1 → 3 may move after **2–3 strong unaided
   trials** (correct + no cue + reasonable RT). Level 4+ requires
   **sustained cue-independence** (the existing cue-dependency safety gate
   in `useInGameAdaptation` still applies).
3. **Soft regression first, hard regression last.**
   - *Soft:* visible level stays the same; the system inflates support
     (more cues, longer time, fewer distractors, simpler prompts).
   - *Hard:* visible level drops by 1, and only after **≥2 sessions** of
     poor performance with low cue-independence at the current level.
4. **Never punish a single trial or a single session.** A bad day inflates
   support; it does not drop level. Fatigue ≠ capability decline.
5. **Cue-dependency gate** (`getCueDependencyScore` in
   `useInGameAdaptation`) is the source of truth for whether the user has
   *earned* an up-escalation. Mastery never overrides this gate.
6. **Mastery shadow layer remains observational** for the foreseeable
   future. This contract names the connection point but does not make it.

### Universal level bands

Reuses `LEVEL_LABELS` and `LEVEL_LEVERS` from `src/lib/gameLevels.ts`:

| L | Label | Band | Generic levers |
|---|-------|------|----------------|
| 1 | Warm-up | easy | max cues, long time, few choices, familiar items |
| 2 | Easy | easy | strong cues, long time, few choices |
| 3 | Easy+ | building | moderate cues, comfortable time |
| 4 | Building | building | light cues on demand |
| 5 | Core | core | cues only when needed |
| 6 | Core+ | core | fewer cues, more choices |
| 7 | Stretch | stretch | rare cues, tighter time, more distractors |
| 8 | Stretch+ | stretch | minimal cues, abstract items |
| 9 | Challenge | mastery | no cues, quick pace, complex items |
| 10 | Mastery | mastery | no cues, fast pace, most complex items |

---

## 2. Per-Game Contracts

For each game: difficulty drivers (what makes L↑ harder), support drivers
(what softens at the same visible level), fast-climb rule, hard-regression
rule, content readiness, wiring risk.

Content readiness is judged from the existing tier/difficulty tags in
`src/data/`:

- `twoCluesBank` — 75 tagged items (mostly L1, some L2/L3)
- `photoBank` — 124 difficulty-tagged photos
- `meaningMatchItems` — 47 tier-tagged items (L1–L3 mapped via `levelToTier`)
- `describeGuessBank` — 46 tagged items
- `minimalPairsBank` — 63 tagged pairs
- `phonologicalBank` — 38 tagged items
- `semanticFeatureBank` — 23 tagged items
- `synonymBank` — 1 tagged item (effectively untagged)
- `fixSentenceBank` — 61 tagged sentences
- `sentenceBank` — 38 tagged sentences
- `gradedSentenceBank` — graded by length/complexity (no explicit tier
  field but already L1–L10 capable)
- `narrativeRetellStimuli` — 38 tier-tagged narratives
- `multiStepPlanningStimuli` — 46 tier-tagged plans
- `abstractCompareStimuli` — 49 tagged comparisons (small bank)
- `dualLoadNamingStimuli` — 26 tagged stimuli
- `detectiveMindCases` — 47 tier-tagged cases

### 2.1 Photo Naming (`photo_naming`)
- **L↑ drivers:** word frequency (high → low), word length, phonological
  complexity, image abstractness, distractor similarity (when MC), time
  pressure.
- **Support drivers:** semantic cue → phonemic cue → first-sound cue →
  full word reveal; longer response window; reduced visual clutter.
- **Fast climb:** 3 consecutive correct unaided trials with RT < 4 s →
  L+1 (up to L4).
- **Hard regression:** 2 sessions where cue-independence < 0.4 at current
  level → L−1.
- **Content:** **ready** for L1–L7. L8–L10 needs additional
  low-frequency / abstract photos in `photoBank`.
- **Wiring risk:** **low.** Already uses `useInGameAdaptation` with
  granular difficulty tags.

### 2.2 Two Clues (`two_clues`)
- **L↑ drivers:** abstractness of target word, distance between the two
  clues' semantic field (closer clues → harder), word frequency.
- **Support drivers:** add a 3rd clue, give first letter, narrow category.
- **Fast climb:** 2 consecutive unaided correct → L+1 up to L3; then 3
  unaided + cue-independence ≥ 0.6 for L4+.
- **Hard regression:** 2 sessions cue-independence < 0.4 → L−1.
- **Content:** **ready** for L1–L6 (75 tagged items, mostly L1–L2, only a
  handful at L3). L7–L10 needs bank expansion.
- **Wiring risk:** **low.**

### 2.3 Describe & Guess (`describe_guess`)
- **L↑ drivers:** abstractness of concept, fewer concept anchors required
  for credit, tighter time per response.
- **Support drivers:** prompt with category, lower required-concept
  threshold, accept partial concepts.
- **Fast climb:** 2 unaided 3-star trials → L+1 up to L3.
- **Hard regression:** 2 sessions with avg score < 1.5 stars → L−1.
- **Content:** **ready** L1–L6. L7+ needs more abstract items.
- **Wiring risk:** **medium** (scoring is heuristic — see Describe Guess
  Scoring memory).

### 2.4 Meaning Match (`meaning_match`)
- **L↑ drivers:** tier moves L1 → L3 via `levelToTier`; semantic distance
  of distractors; abstract vs concrete relations.
- **Support drivers:** highlight target word, reduce distractor count,
  show hint.
- **Fast climb:** 3 unaided correct → L+1 up to L4 (existing tier ceiling
  is 3; mapping to L1–L10 means coarse jumps).
- **Hard regression:** 2 sessions accuracy < 0.55 → L−1.
- **Content:** **needs tier expansion.** Bank only spans L1–L3 internal
  tiers; L7+ would require new tier-4/5 items.
- **Wiring risk:** **medium** (limited content depth).

### 2.5 Minimal Pairs (`minimal_pairs`)
- **L↑ drivers:** acoustic similarity of the contrast pair, faster audio
  presentation, voice variability.
- **Support drivers:** slow audio playback, repeat audio, visual
  spelling shown.
- **Fast climb:** 4 consecutive correct → L+1 up to L4.
- **Hard regression:** 2 sessions accuracy < 0.6 → L−1.
- **Content:** **ready** L1–L5. L6+ needs more close-contrast pairs.
- **Wiring risk:** **low.**

### 2.6 Phonological (`phonological`)
- **L↑ drivers:** consonant cluster complexity, syllable count, position
  of target phoneme.
- **Support drivers:** model production, slow rate, written cue.
- **Fast climb:** 3 unaided correct → L+1 up to L3.
- **Hard regression:** 2 sessions cue-independence < 0.5 → L−1.
- **Content:** **ready** L1–L5. Beyond needs expansion.
- **Wiring risk:** **medium** (pronunciation scoring noise).

### 2.7 Semantic Feature (`semantic_feature`)
- **L↑ drivers:** number of features required, abstractness of target,
  fewer prompted feature categories.
- **Support drivers:** show feature category prompts, accept partial
  features.
- **Fast climb:** 2 trials with ≥3 features unaided → L+1 up to L3.
- **Hard regression:** 2 sessions avg features < 1.5 → L−1.
- **Content:** **needs bank expansion** (only 23 tagged items).
- **Wiring risk:** **medium.**

### 2.8 Synonym Generator (`synonym_generator`)
- **L↑ drivers:** word frequency, abstractness, number of synonyms
  required.
- **Support drivers:** show first letter, give one synonym as model.
- **Fast climb:** 2 trials with ≥2 synonyms unaided → L+1.
- **Hard regression:** 2 sessions with < 1 synonym avg → L−1.
- **Content:** **needs tier tagging.** Bank exists but is essentially
  untagged (`tier:` count = 1).
- **Wiring risk:** **high.** Stay shadow-only until tagged.

### 2.9 Fix Sentence (`fix_sentence`)
- **L↑ drivers:** sentence length, error subtlety, multiple errors per
  sentence.
- **Support drivers:** highlight error region, give hint about error
  type.
- **Fast climb:** 3 unaided correct → L+1 up to L4.
- **Hard regression:** 2 sessions accuracy < 0.55 → L−1.
- **Content:** **ready** L1–L6.
- **Wiring risk:** **low.**

### 2.10 Sentence Construction (`sentence_construction`)
- **L↑ drivers:** more words to order, less common syntactic structure,
  embedded clauses.
- **Support drivers:** show target frame, group words by role.
- **Fast climb:** 3 unaided correct → L+1 up to L4.
- **Hard regression:** 2 sessions accuracy < 0.55 → L−1.
- **Content:** **ready** L1–L7 via `sentenceBank` + `gradedSentenceBank`.
- **Wiring risk:** **low.**

### 2.11 Narrative Retell (`narrative_retell`)
- **L↑ drivers:** narrative length, number of propositions, vocabulary
  load, abstract themes.
- **Support drivers:** chunked replay, written outline, prompt for
  missed propositions.
- **Fast climb:** 2 retellings hitting ≥70% propositions unaided → L+1
  up to L4.
- **Hard regression:** 2 sessions < 40% propositions → L−1.
- **Content:** **ready** L1–L6 (38 tier-tagged narratives).
- **Wiring risk:** **medium** (scoring depends on discourse signal
  scorer).

### 2.12 Multi-Step Plan (`multi_step_plan`)
- **L↑ drivers:** number of steps, ambiguity in correct order, novelty
  of the scenario.
- **Support drivers:** show first step, group steps by phase.
- **Fast climb:** 2 unaided correct sequences → L+1 up to L4.
- **Hard regression:** 2 sessions accuracy < 0.5 → L−1.
- **Content:** **ready** L1–L6.
- **Wiring risk:** **low.**

### 2.13 Abstract Compare (`abstract_compare`)
- **L↑ drivers:** abstractness of compared concepts, semantic distance,
  number of dimensions to articulate.
- **Support drivers:** prompt for one dimension at a time.
- **Fast climb:** 2 unaided 2-dimension answers → L+1 up to L3.
- **Hard regression:** 2 sessions with < 1 dimension avg → L−1.
- **Content:** **needs bank expansion** (only 49 tagged items, ~83-line
  file). Cap at L4 in shadow until expanded.
- **Wiring risk:** **medium.**

### 2.14 Dual-Load Naming (`dual_load_naming`)
- **L↑ drivers:** naming difficulty + concurrent load (count, recall,
  category) intensity, faster pace.
- **Support drivers:** drop the secondary load, lengthen response window.
- **Fast climb:** 2 unaided correct under load → L+1 up to L3.
- **Hard regression:** 2 sessions with primary-task accuracy < 0.5 → L−1.
- **Content:** **ready** L1–L5.
- **Wiring risk:** **medium** (load calibration is sensitive).

### 2.15 Detective Mind (`detective_mind`)
- **L↑ drivers:** number of clues, inferential distance, red herrings.
- **Support drivers:** highlight key clue, eliminate one wrong suspect.
- **Fast climb:** 2 unaided correct deductions → L+1 up to L4.
- **Hard regression:** 2 sessions accuracy < 0.5 → L−1.
- **Content:** **ready** L1–L6 (47 tier-tagged cases).
- **Wiring risk:** **medium** (long trials → fewer data points per
  session).

---

## 3. Master Table

| Game | L↑ drivers | Support drivers | Fast level-up | Hard regression | Content ready? | Wiring risk | Recommendation |
|---|---|---|---|---|---|---|---|
| Photo Naming | freq, length, phon complexity, distractors, time | semantic→phonemic→full reveal, longer time | 3 unaided + RT<4s up to L4 | 2 sessions cue-indep<0.4 | L1–L7 ready | low | **First to wire** |
| Two Clues | abstractness, clue distance, freq | extra clue, first letter, category | 2 unaided up to L3, then cue-indep gated | 2 sessions cue-indep<0.4 | L1–L6 ready | low | **Wire second** |
| Fix Sentence | length, error subtlety, multi-errors | highlight region, error-type hint | 3 unaided up to L4 | 2 sessions <0.55 | L1–L6 ready | low | Wire third |
| Sentence Construction | word count, syntax, clauses | target frame, role grouping | 3 unaided up to L4 | 2 sessions <0.55 | L1–L7 ready | low | Wire third |
| Minimal Pairs | acoustic similarity, pace, voice variability | slow audio, repeat, spelling | 4 unaided up to L4 | 2 sessions <0.6 | L1–L5 ready | low | Wire fourth |
| Multi-Step Plan | step count, ambiguity, novelty | first step shown, phase groups | 2 unaided up to L4 | 2 sessions <0.5 | L1–L6 ready | low | Wire fourth |
| Describe & Guess | abstractness, anchor count, time | category prompt, partial credit | 2 unaided 3-star up to L3 | 2 sessions <1.5★ | L1–L6 ready | medium | Hold pending scorer review |
| Narrative Retell | length, propositions, vocab, theme | chunked replay, outline | 2 trials ≥70% up to L4 | 2 sessions <40% | L1–L6 ready | medium | Hold pending scorer review |
| Detective Mind | clues, inferential distance, red herrings | highlight clue, eliminate suspect | 2 unaided up to L4 | 2 sessions <0.5 | L1–L6 ready | medium | Hold (low data density) |
| Phonological | clusters, syllables, position | model, slow, written cue | 3 unaided up to L3 | 2 sessions cue-indep<0.5 | L1–L5 ready | medium | Hold pending pronunciation noise review |
| Dual-Load Naming | naming + load intensity, pace | drop load, longer window | 2 unaided up to L3 | 2 sessions primary<0.5 | L1–L5 ready | medium | Hold pending load calibration |
| Meaning Match | tier 1→3, distractor distance, abstractness | highlight target, fewer distractors, hint | 3 unaided up to L4 | 2 sessions <0.55 | L1–L3 only | medium | **Needs tier expansion** |
| Semantic Feature | features required, abstractness, fewer prompts | feature prompts, partial credit | 2 trials ≥3 feat up to L3 | 2 sessions <1.5 feat | thin (23 items) | medium | **Needs bank expansion** |
| Abstract Compare | abstractness, semantic distance, dimensions | one-dimension prompt | 2 unaided up to L3 | 2 sessions <1 dim | thin (49 items) | medium | **Needs bank expansion** |
| Synonym Generator | freq, abstractness, count required | first letter, model synonym | 2 trials ≥2 syn up to L3 | 2 sessions <1 syn | untagged | high | **Shadow-only — needs tier tagging first** |

---

## 4. Recommended wiring order (when we get there)

1. **Photo Naming** — deepest tagged content, simplest scoring.
2. **Two Clues** — tagged, simple scoring, low risk.
3. **Fix Sentence** + **Sentence Construction** — clean text scoring.
4. **Minimal Pairs** + **Multi-Step Plan** — discrete correctness.
5. Hold the rest until scoring noise / content depth is addressed.

Each wiring step should:
- Stay behind a per-game flag.
- Keep `useInGameAdaptation` as live authority; mastery only *suggests*
  the starting level for the *next* session.
- Ship with a shadow-vs-live diff in `/dev/mastery-shadow`.

---

## 5. Out of scope for this document

- Database changes.
- UI changes (patient or clinician).
- Any change to live difficulty behavior.
- Any change to mastery scoring.

This is a contract, not an implementation.
