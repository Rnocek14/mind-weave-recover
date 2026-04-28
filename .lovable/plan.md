# Adaptive Daily Session — Full Remediation Plan

Goal: turn a 80%-built / 20%-miswired adaptive engine into a system that is **safe, visibly adaptive, and consistent across all 17 games**.

Order is mandatory. Phase 0 ships before anything else — these are patient-safety bugs.

---

## Evidence summary (verified in code, not assumed)

| Claim | File / line | Verified? |
|---|---|---|
| Typing fallback in Describe & Guess is a fake pill, not a button | `src/components/DescribeGuessGame.tsx` L894–901 (`<div>` not `<Button>`) | YES |
| Category Fluency silently advances on 0-word round | `CategoryFluencyGame.tsx` `finishRound` L307–391 — no repair branch, `RoundDoneAutoAdvance` auto-advances | YES |
| Category Fluency *praises* a 0-word round | `CategoryFluencyGame.tsx` L388 `"Good — you named ${validWords.length} ${label}"` fires even when count = 0 | YES |
| Adaptation banner hidden on mobile | `ExerciseAdaptationBanner.tsx` L23 `className="hidden sm:flex …"` | YES |
| `useInGameAdaptation` windowSize default = 5 (too large for 3-round games) | `useInGameAdaptation.ts` L135 | YES |
| Phonological / Synonym / Reach&Tap / PatternMatch still on legacy `useAdaptiveDifficulty` | grep: 4 components import the legacy hook | YES |
| `PhrasePracticeGame` IS wired to `useInGameAdaptation` and calls `recordAdaptiveTrial` on success (L556) and fail (L741) | `PhrasePracticeGame.tsx` | YES — earlier audit was wrong on this; remaining issues are slug/narration, not wiring |
| MicFailureRecovery component already exists and is used in DescribeGuess | `DescribeGuessGame.tsx` L862 | YES |
| Maya narrative file contains unconditional praise lines | `src/lib/mayaNarrative.ts` L120, L301 | YES |

---

## PHASE 0 — Patient-safety fixes (P0, ship first, no exceptions)

### 0.1 Fix the dead-end typing fallback in Describe & Guess

`src/components/DescribeGuessGame.tsx`

- Add `const [useTyping, setUseTyping] = useState(false);`
- Replace the `<div>` status pill at L894–901 with two states:
  - When `speechError` → render a real `<Button>` "Use typing instead" that flips `useTyping=true`.
  - When `isListening` → keep the listening pill (visual only, not a button).
- When `useTyping === true`, render a `<Textarea>` above the controls bound to `displayTranscript`/local state, plus disable speech listening and clear `speechError`.
- Auto-flip to `useTyping=true` after **2** consecutive `speechError` events or after a single permission-denied error (mirror the pattern already in `CategoryFluencyGame.tsx` L300–305).
- Persist preference to `sessionStorage.preferTypingInput` so it sticks across trials and games (matches existing `Input Mode Persistence Standard` memory).

### 0.2 Stop praising failure (universal scrub)

- `src/components/CategoryFluencyGame.tsx` L386–390: gate the spoken line on `validWords.length >= 2`. For 0–1 words speak the repair script instead (see 0.3).
- `src/lib/mayaNarrative.ts` L120, L234, L301 and any helper that emits "great", "nice", "awesome", "warmed up", "you're getting": wrap each in a score check. Add a single helper `pickEncouragement(score: number)` that returns:
  - `score === 0` → neutral repair (e.g. "That one was tough. Let's try a smaller step.")
  - `0 < score < 0.4` → supportive but not celebratory ("Good effort — let's try one more.")
  - `0.4–0.7` → mild positive
  - `> 0.7` → genuine praise
- Run `rg -n "great|nice|awesome|warmed|well done|good job"` across `src/components`, `src/lib`, `src/hooks` and route every match through `pickEncouragement` or remove.
- Add a unit-style guard in `src/lib/feedbackGenerator.ts` so any praise string is a no-op when `successScore < 0.4`.

### 0.3 Handle empty / silent responses (Maya repair, never silent advance)

`src/components/CategoryFluencyGame.tsx` `finishRound`:

- After computing `validWords`, if `validWords.length === 0`:
  - Skip the auto-advance (`RoundDoneAutoAdvance`) on this round — render a `<RepairCard>` instead.
  - Speak (`vg.speakIfVoiceLed`) the repair: "That one was tough. Want to try an easier category, or get an example to start?"
  - Show three buttons: **Get an example**, **Try an easier category**, **Skip this round**.
  - Down-step difficulty via `adaptation.recordTrial({correct:false})` (already there) AND force a `setCurrentDifficulty(prev => Math.max(prev-1, bounds.min))` for the next round.
- Apply the same repair pattern to all timer-driven games (`MultiStepPlanningGame`, `NarrativeRetellGame`, `Detective`, `DualLoadNaming`) — extract a shared `<EmptyResponseRepair>` component in `src/components/EmptyResponseRepair.tsx`.

### 0.4 Mic-failure recovery everywhere (not just DescribeGuess)

- The reusable `MicFailureRecovery` exists. Drop it into every game that uses `useSpeechRecognition`: PhotoNaming, TwoClues, NarrativeRetell, MultiStepPlanning, PhrasePractice, Phonological, SynonymGenerator, SemanticFeature, Detective, FixSentence.
- Add a single 3-strike rule in a new `src/hooks/useSpeechFailureGuard.ts`:
  - On 3 consecutive speech errors OR ≥2 silent stalls → auto-show typing input + persist `preferTypingInput=true`.
- Wire it via a one-line call in each game's `useSpeechRecognition` block.

**Phase 0 acceptance:**
- 0-word round never auto-advances and never produces a "Good …" line.
- "Use typing instead" is a real, clickable control on every speech game.
- Mic-denied users complete every game without being stuck.

---

## PHASE 1 — Force adaptation to actually trigger in short sessions

### 1.1 Lower the rolling window and tighten thresholds

`src/hooks/useInGameAdaptation.ts`

- Change default `windowSize` from `5` → `4` (L135).
- Add a new option `shortSessionMode?: boolean` that, when true, sets effective `windowSize = 3` and `adjustmentThreshold = 0.15` so 3-round games (CategoryFluency, NarrativeRetell, MultiStepPlanning) can still adapt within a single session.
- Pass `shortSessionMode: true` from those three games.

### 1.2 Audit `recordTrial` is firing per-trial in every game

- For each adaptive game, confirm `adaptation.recordTrial` is called exactly once per trial and BEFORE auto-advance, not at game-end.
- Verified callers: PhotoNaming, TwoClues, Detective, DualLoadNaming, NarrativeRetell (×2 paths), MultiStepPlanning, MinimalPairs, AbstractCompare, MeaningMatch, SemanticFeature, FixSentence, PhrasePractice, CategoryFluency.
- Action: write a runtime assert in `useInGameAdaptation` that warns once per game-mount if `recordTrial` has not been called within 90 s of mount in `active` phase. Console-only, dev-only.

### 1.3 Always pass `getCueDependencyScore`

- Every game already calls `useEngagementMonitor`. Pipe `engagement.getCueDependencyScore` into `useInGameAdaptation({ getCueDependencyScore })` for the games that currently omit it (PhrasePractice L209–222 omits it; DualLoadNaming, MultiStepPlanning, NarrativeRetell — verify each).
- Without this, the cue-dependency safety gate silently no-ops, which masks bugs in either direction.

### 1.4 Remove gates that block early adaptation

- `cueDependencyEscalationThreshold = 0.5` and `minTrialsAtLevelForEscalation = 8` are too strict for short games. Add a new effective default: `minTrialsAtLevelForEscalation = shortSessionMode ? 4 : 8`.
- Down-escalations are already ungated — keep that.

**Phase 1 acceptance:**
- A 3-round game adapts visibly within rounds 2–3 if performance crosses thresholds.
- `adaptation_events` rows appear for all 17 games in a 30-day window (current: 4/17).

---

## PHASE 2 — Make adaptation visible and explained

### 2.1 Show the adaptation banner on mobile

`src/components/ExerciseAdaptationBanner.tsx` L23

- Replace `className="hidden sm:flex …"` with `className="flex …"` (or `block sm:flex` if layout requires). The banner already has compact spacing.

### 2.2 Maya explains every difficulty / cue change

- Centralise the narration in `src/lib/adaptationNarrator.ts` (already exists). Ensure each game's `onDifficultyChange` produces a one-line, score-aware message routed through Maya:
  - up: "You're getting these quickly — making it a bit harder."
  - down: "That one was tough — I'll help more."
  - cue-dependency hold: "Let's stay here and lean less on hints."
  - escalation blocked: same as hold.
- Render via `<AdaptationNarrationCard>` which already exists and is used in CategoryFluency. Add it to the round-done / between-trial cards of: PhotoNaming, TwoClues, MultiStepPlanning, NarrativeRetell, Detective, AbstractCompare, MeaningMatch, SemanticFeature, MinimalPairs, FixSentence, DualLoadNaming, PhrasePractice.

### 2.3 Always render the `AdaptationBadge` when difficulty changes

- The badge component exists (`src/components/AdaptationBadge.tsx`) and is used in CategoryFluency. Add it to the same set of games as 2.2 — one place per game, near the trial counter / progress indicator.

### 2.4 Surface the reason in the StructuredFeedbackSummary

- Add a new prop `adaptationTrace?: { from: number; to: number; reason: string }[]` and render a small "Today's adjustments" block in the summary screens.

**Phase 2 acceptance:**
- Every visible level change is accompanied by a one-line Maya explanation and a badge, on mobile and desktop.

---

## PHASE 3 — Engine consistency

### 3.1 Migrate the 4 legacy games

Migrate from `useAdaptiveDifficulty` → `useInGameAdaptation`:

- `src/components/PhonologicalGame.tsx`
- `src/components/SynonymGeneratorGame.tsx`
- `src/components/ReachTapGame.tsx`
- `src/components/PatternMatchGame.tsx`

For each:
- Replace the hook block (mirror PhrasePractice L202–222).
- Add `shortSessionMode: true` if game has ≤4 trials per session.
- Wire `engagement.getCueDependencyScore` into `getCueDependencyScore`.
- Add `<AdaptationBadge>` and `<AdaptationNarrationCard>` per Phase 2.

### 3.2 Standardise slugs

- All games must pass `CANONICAL_SLUGS.X` (underscore form) into `useInGameAdaptation` and to `recordTrial` / `useEngagementMonitor`. Audit with `rg -n "exerciseSlug:" src/components`.

### 3.3 Remove `useAdaptiveDifficulty` once unused

- Once 3.1 is done, mark `src/hooks/useAdaptiveDifficulty.ts` as `@deprecated`. Don't delete yet — it's still imported by the engagement monitor's internal state.

**Phase 3 acceptance:**
- All 17 games import `useInGameAdaptation` (zero imports of `useAdaptiveDifficulty` outside `useEngagementMonitor`).
- `adaptation_trial_logs` shows rows for every game after one Daily Session run.

---

## File-by-file change list

```text
PHASE 0
  src/components/DescribeGuessGame.tsx           — typing fallback button + textarea + auto-flip
  src/components/CategoryFluencyGame.tsx         — empty-round repair branch, gated praise line
  src/components/EmptyResponseRepair.tsx         — NEW shared repair card
  src/lib/mayaNarrative.ts                       — score-gated phrasing
  src/lib/feedbackGenerator.ts                   — pickEncouragement(score) helper
  src/hooks/useSpeechFailureGuard.ts             — NEW 3-strike auto-flip
  src/components/MultiStepPlanningGame.tsx       — wire EmptyResponseRepair + failure guard
  src/components/NarrativeRetellGame.tsx         — wire EmptyResponseRepair + failure guard
  src/components/DetectiveMindGame.tsx           — wire failure guard
  src/components/DualLoadNamingGame.tsx          — wire failure guard
  src/components/PhotoNamingGame.tsx             — wire failure guard
  src/components/TwoCluesGame.tsx                — wire failure guard
  src/components/PhrasePracticeGame.tsx          — wire failure guard
  src/components/PhonologicalGame.tsx            — wire failure guard
  src/components/SynonymGeneratorGame.tsx        — wire failure guard
  src/components/SemanticFeatureGame.tsx         — wire failure guard
  src/components/FixSentenceGame.tsx             — wire failure guard

PHASE 1
  src/hooks/useInGameAdaptation.ts               — windowSize default 4, shortSessionMode option, dev assert
  src/components/CategoryFluencyGame.tsx         — pass shortSessionMode + getCueDependencyScore
  src/components/NarrativeRetellGame.tsx         — pass shortSessionMode + getCueDependencyScore
  src/components/MultiStepPlanningGame.tsx       — pass shortSessionMode + getCueDependencyScore
  src/components/PhrasePracticeGame.tsx          — pass getCueDependencyScore
  src/components/DualLoadNamingGame.tsx          — pass getCueDependencyScore (verify)

PHASE 2
  src/components/ExerciseAdaptationBanner.tsx    — remove `hidden sm:flex`
  src/lib/adaptationNarrator.ts                  — ensure all 4 reasons covered
  src/components/PhotoNamingGame.tsx             — render AdaptationBadge + NarrationCard
  src/components/TwoCluesGame.tsx                — same
  src/components/MultiStepPlanningGame.tsx       — same
  src/components/NarrativeRetellGame.tsx         — same
  src/components/DetectiveMindGame.tsx           — same
  src/components/AbstractCompareGame.tsx         — same
  src/components/MeaningMatchGame.tsx            — same
  src/components/SemanticFeatureGame.tsx         — same
  src/components/MinimalPairsGame.tsx            — same
  src/components/FixSentenceGame.tsx             — same
  src/components/DualLoadNamingGame.tsx          — same
  src/components/PhrasePracticeGame.tsx          — same
  src/components/StructuredFeedbackSummary.tsx   — adaptationTrace prop + render

PHASE 3
  src/components/PhonologicalGame.tsx            — migrate to useInGameAdaptation
  src/components/SynonymGeneratorGame.tsx        — migrate
  src/components/ReachTapGame.tsx                — migrate
  src/components/PatternMatchGame.tsx            — migrate
  src/hooks/useAdaptiveDifficulty.ts             — mark @deprecated
```

---

## Testing checklist (run after each phase)

1. Daily Session → CategoryFluency → stay silent for full timer → expect: repair card, no praise, difficulty steps down on next round, no auto-advance.
2. Daily Session → DescribeGuess → deny mic permission → expect: Textarea appears, can submit answer.
3. Daily Session → any game → answer all correct → expect: AdaptationBadge "harder" + Maya line within window.
4. Daily Session → any game → answer all wrong → expect: Badge "easier" + Maya supportive line, no praise.
5. Mobile viewport → ExerciseAdaptationBanner visible.
6. After full session, query `adaptation_trial_logs` and `adaptation_events` — every game played should have rows.

---

## What this gets you

- **Phase 0** alone removes the three "this feels broken" moments (silent advance, false praise, dead-end mic).
- **Phase 1** closes the gap between "engine works" and "engine fires in real sessions".
- **Phase 2** makes the adaptation legible to patient and clinician.
- **Phase 3** eliminates the legacy split and gives clean telemetry across all 17 games.

After Phase 0+1 the system will *feel* adaptive in a single Mercy demo. Phase 2+3 is what makes it clinically defensible.
