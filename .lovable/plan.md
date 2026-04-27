## In-Game Adaptation Audit — what's real, what's fake, what to fix

I went through every exercise. Here's the honest answer to "how does each game actually get harder?"

---

### How adaptation is *supposed* to work (the architecture)

There are two layers:

1. **Generic engine** (`useInGameAdaptation`): every game feeds it `recordTrial({ correct })`. After a 5-trial rolling window, if success rate >90% → level up; <70% → level down; 4 errors in a row → emergency step-down. This part works.
2. **Game-specific consumer**: each game must take that level change and *actually swap content* (longer story, more distractors, harder words, faster timer). **This is where most games fail silently.** The engine fires `onDifficultyChange`, but if the game ignores it, the level number changes and nothing else does.

---

### Per-exercise scorecard

| Exercise | Adapts mid-session? | What the level changes | Verdict |
|---|---|---|---|
| **Sentence Construction** | Yes | Adds words, compound sentences | Working |
| **Narrative Retell** (the real one in `/today`) | Yes | Tier 1 (3-sent) → Tier 2 (4-5 sent) → Tier 3 (5-6 sent + abstract themes). `setActiveTier` reshuffles the queue mid-session | Working |
| **Detective Mind** | Yes | Story length + literal → inferential → predictive questions, 3 → 4 options | Working |
| **Multi-Step Planning** | Yes | More steps, less obvious order | Working |
| **Abstract Compare** | Yes | Concrete → moderate → abstract (Dog/Cat → River/Time) | Working |
| **Dual-Load Naming** | Yes | More cognitive load | Working |
| **Meaning Match** | Yes | Tier-based item swap | Working |
| **Pattern Match** | Yes | Pattern size + option count + display time scale with level | Working |
| **Synonym Generator** | Partial | Timer + success threshold scale; word list rotates by level | Working |
| **Category Fluency** | Partial | Timer scales; category bank rotates by level | Working |
| **Two Clues** | Partial | Difficulty 1-3 mapped from level; AdaptationBadge shown | Working |
| **Fix the Sentence** | Partial | Difficulty 1-3 mapped from level | Working |
| **Describe & Guess** | Partial | Difficulty 1-3 mapped from level | Working |
| **Photo Naming** | Partial | Hard mode unlocks at level 8, manual hints at 6 — but image bank itself doesn't tier | **Gap: word frequency/length doesn't scale** |
| **Semantic Feature** | Partial | Level shown in badge, fed to hook, but `usePhonoGame`-style content pick by tier is not visible | **Needs verification — likely flat content** |
| **Phonological** | Partial | Same — level shown, fed to hook | **Needs verification — likely flat content** |
| **Minimal Pairs** | **No** | `recordTrial` fires but `onDifficultyChange` does nothing — pairs don't get harder | **Broken** |
| **Story Retell Probe** (`coach/StoryRetellProbe.tsx`, used in Smart Coach) | **No** | Picks ONE story at random from 4, ignores level entirely, no `useInGameAdaptation` at all | **Broken — this is likely what you experienced** |
| **Conversation Coach / Partner** | N/A | Adapts via Smart Coach turn engine, not the difficulty controller | Different system |
| **Thought Continuation** | **No** | Discourse-mode, no level concept | Acceptable (open-ended) |

---

### The real problem you felt on your phone

When you ran a daily session, the **Story Retell Probe** (the modal version inside Smart Coach) is the one that "didn't recognize someone told the story." Two separate bugs were stacked:

1. **Speech wasn't captured** — already fixed in the last pass (transcript now wired into `logTrial`).
2. **It never adapts.** Even if you nail it, the next probe picks another random 3-sentence story. There is no progression. That's why it feels stuck.

The `/today` Narrative Retell *is* adaptive. The Smart-Coach embedded probe is not. Two different components, only one is wired up.

---

### What "harder" should mean for each unfixed game

**Story Retell Probe** — same model as Narrative Retell:
- Tier 1: 3 sentences, ~20 words, concrete actors
- Tier 2: 4-5 sentences, sequence/causality
- Tier 3: 5-6 sentences, time jumps, inference required
- Shift tier when 2 consecutive retells hit ≥60% idea-unit recall

**Minimal Pairs** — the controller already runs, but no content swap:
- Tier 1: maximally distinct pairs (bat/dog)
- Tier 2: single-feature contrasts (bat/pat, voicing)
- Tier 3: subtle contrasts in noise / longer words (battle/paddle)

**Photo Naming** — image bank should tier by:
- Tier 1: high-frequency, 1-2 syllable nouns (cup, dog)
- Tier 2: medium frequency, 2-3 syllables (umbrella, bicycle)
- Tier 3: low frequency / multi-syllable / abstract (microscope, calendar)

**Semantic Feature & Phonological** — verify the existing tier function in their hooks actually filters by `currentDifficulty`. If not, wire it the same way Narrative Retell does (hook exposes `setActiveTier`, game calls it from `onDifficultyChange`).

---

### Plan

Three focused fixes, in priority order:

**1. Fix Story Retell Probe (Smart Coach)** — the one you actually hit
- Add `useInGameAdaptation` to `StoryRetellProbe.tsx`
- Add a `tier` field to the 4 stories (and add 6 more so each tier has 3+ options)
- `onDifficultyChange` reshuffles the next probe to the new tier
- Score the retell against the probe's idea units (already there) and feed `recordTrial({ correct: recallAccuracy >= 0.6 })`

**2. Wire Minimal Pairs content tier**
- Confirm `minimalPairsBank` has a tier field (add if missing — 3 tiers × 8 pairs each is enough)
- Hook exposes `setActiveTier`; component shifts on `onDifficultyChange`
- Show AdaptationBadge so the user sees it

**3. Audit + wire Semantic Feature, Phonological, Photo Naming content tiers**
- Read each hook (`useSemanticFeatureGame`, `usePhonoGame`, `usePhotoNamingGame`) and confirm whether they already filter the bank by `currentDifficulty`. If yes, ship a one-line AdaptationBadge so it's visible. If no, add `setActiveTier` and a tiered bank.
- For Photo Naming specifically, tag the existing photo bank by syllable count + frequency so we don't have to add new images.

**4. Add a "Did this game adapt?" telemetry signal**
- For each completed exercise, log `{ level_started, level_ended, content_tier_shifts }` to `exercise_events`
- Surface on the Telemetry dashboard as a column: games where `level_started === level_ended` for >80% of sessions = suspect (either content is wrong or controller never fires)
- This is the durable fix — even if I miss a game today, the dashboard will flag it

**5. Document it in one place**
- Add `src/docs/EXERCISE_ADAPTATION_GUIDE.md` with the table above kept current. New members + future you can read one file and know which games adapt and how.

---

### Files I'll touch

- `src/components/coach/StoryRetellProbe.tsx` (rewrite)
- `src/components/MinimalPairsGame.tsx` + `src/data/minimalPairsBank.ts` (add tiers)
- `src/components/PhotoNamingGame.tsx` + photo bank metadata (tag tiers)
- `src/components/SemanticFeatureGame.tsx`, `src/components/PhonologicalGame.tsx` (verify + wire if needed)
- `src/hooks/useExerciseTelemetry.ts` (log level_started/ended/tier_shifts)
- `src/pages/ClinicianTelemetry.tsx` (new "Adaptation Active?" column)
- `src/docs/EXERCISE_ADAPTATION_GUIDE.md` (new)

No DB migration needed — `level_started/ended` go into the existing `inputs` jsonb on `exercise_events`.

Approve and I'll start with #1 (Story Retell Probe — the bug you actually felt), then #2-3 in one pass, then #4-5.
