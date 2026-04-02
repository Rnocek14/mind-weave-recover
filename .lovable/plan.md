
# Smart Coach Phase 2 — Post-Acceptance Punch List

## Priority 1: Explicit Intervention Loop (Highest Impact)
**Goal**: Make conversation → detect → explain → intervene → return visible in UX, not just state logic.

### Changes:
- **`runCoachTurn.ts`**: When state machine detects intervention trigger (hesitation cluster, semantic error cluster), emit an `InterventionEvent` with `observation`, `rationale`, and `action`
- **`SmartCoach.tsx`**: Render intervention explanation as a distinct UI message type (not just another chat bubble) — e.g., a card that says: "You had the idea but the word didn't come out. I'm narrowing the choices."
- **`coachStateMachine.ts`**: Add explicit `intervention_active` state with entry/exit tracking
- **`promptBuilder.ts`**: When returning FROM intervention, inject transfer prompt: "Let's use that same strategy back in the conversation"

## Priority 2: Embedded Game Triggers (First 2–3 Games)
**Goal**: Games appear inside conversation when clinically triggered, with entry/exit scripts.

### Changes:
- **New: `src/lib/smartCoach/gameTrigger.ts`**: Maps trigger patterns → game type (e.g., hesitation cluster → rapid naming sprint, semantic errors → semantic matching)
- **`SmartCoach.tsx`**: Add focused game overlay state (chat dims, center panel shows game with goal label + timer)
- **Game lifecycle**: Entry (observation + rationale + choice to accept), Active (focused UI), Exit (result + strategy label + return bridge)
- **Initial games**: Rapid naming sprint, yes/no comprehension check, sentence completion
- **`runCoachTurn.ts`**: After game completes, inject transfer prompt connecting drill result back to conversation

## Priority 3: Cross-Session Progress Narrative
**Goal**: Users feel ongoing recovery across sessions.

### Changes:
- **`coachState.ts`**: On session init, load last `coach_conversation_summaries` entry for this user/profile
- **Orientation card update**: Show "Last time: [focus]. You improved at [skill]. Today we build on that."
- **`promptBuilder.ts`**: Inject last-session context into system prompt so AI can reference prior progress
- **Wrap-up enhancement**: Compare today's metrics to last session ("You named 4 items without cues vs 2 last time")
- **New: `src/lib/smartCoach/progressNarrative.ts`**: Generates cross-session comparison text from summaries

## Priority 4: Deeper Severity/Deficit Adaptation
**Goal**: Receptive vs expressive differences drive meaningfully different experiences.

### Changes:
- **`types.ts`**: Add `primaryDeficit: 'expressive' | 'receptive' | 'mixed'` and `cognitiveLoadTolerance`
- **`promptBuilder.ts`**: 
  - Receptive: shorter instructions, keywords, more verify steps
  - Expressive: word retrieval focus, phonemic cueing, sentence starters
  - Severe: yes/no scaffolds, forced choices, explicit purpose display
- **`cueSelector.ts`**: Deficit-aware cue paths (phonemic-first for expressive, comprehension-check-first for receptive)
- **`coachStateMachine.ts`**: Adjust turn length expectations and struggle thresholds by severity

## Files Changed

| File | Action |
|------|--------|
| `src/lib/smartCoach/runCoachTurn.ts` | Intervention event emission, game result handling |
| `src/lib/smartCoach/coachStateMachine.ts` | intervention_active state, deficit-aware thresholds |
| `src/lib/smartCoach/gameTrigger.ts` | **NEW** — trigger pattern → game mapping |
| `src/lib/smartCoach/progressNarrative.ts` | **NEW** — cross-session comparison |
| `src/lib/smartCoach/promptBuilder.ts` | Transfer prompts, last-session context, deficit-aware language |
| `src/lib/smartCoach/coachState.ts` | Load last session summary on init |
| `src/lib/smartCoach/types.ts` | InterventionEvent, primaryDeficit, GameTriggerEvent |
| `src/lib/smartCoach/cueSelector.ts` | Deficit-aware cue paths |
| `src/pages/SmartCoach.tsx` | Intervention cards, game overlay, cross-session orientation |

## Implementation Order
1. Intervention loop (unlocks everything else)
2. Cross-session progress (quick win, uses existing data)
3. Game triggers (builds on intervention loop)
4. Deeper severity adaptation (polish pass)
