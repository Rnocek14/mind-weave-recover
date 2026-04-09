
## Adaptive Session Builder v2

### What we're building
A recommendation engine that uses recent session signals to choose the best next therapy session — template, exercises, difficulty, and focus target — so Maya feels strategic, not just reflective.

### Build pieces

**1. New session templates** (`sessionFrameTemplates.ts`)
Add 3 new templates alongside existing `core_communication`:
- `expression_focused` — SFA + Synonym Generator + Category Fluency (for naming/retrieval gaps)
- `comprehension_focused` — Detective Mind + Meaning Match + Narrative Retell (for understanding gaps)
- `low_energy` — shorter blocks, easier difficulty, 2-3 exercises max (for fatigue/skip patterns)

**2. Session signal history store** (`sessionSignalStore.ts`)
- Save the reflection engine's output (strength, nextStep, per-exercise weights) to localStorage after each session
- Read last 3-5 sessions for trend detection
- Track skip count and completion rate

**3. Recommendation engine** (`sessionRecommender.ts`)
```
recommendNextSession(recentSignals, profile?) → {
  templateId, reason, focusTarget, recommendedDifficulty, blocks
}
```
Logic:
- Weak narrative + weak inference → `core_communication`
- Strong comprehension, weak retrieval/naming → `expression_focused`
- Weak clue-finding / meaning → `comprehension_focused`
- High fatigue/skips/low completion → `low_energy`
- No history / balanced → `core_communication` (default)

**4. Today page upgrade** (`Today.tsx`)
- Replace generic session button with a **recommended session card**
- Shows: template name, Maya's reason, focus target, start button
- Example: "Recommended today: Expression-Focused — to strengthen word retrieval after last session's naming gaps"

**5. Maya intro uses recommendation reason** (`MayaSessionFrame.tsx` / `LessonFlow.tsx`)
- Pass the recommendation `reason` into the session frame
- Maya's intro references *why* this session was chosen
- Example: "Last time, you caught key clues well, but holding onto the middle of the story was harder. Today we'll work on that."

### Files to create
- `src/lib/sessionSignalStore.ts` — persist/read recent session signals
- `src/lib/sessionRecommender.ts` — recommendation engine

### Files to modify
- `src/lib/sessionFrameTemplates.ts` — add 3 new templates
- `src/lib/dailyLessonEngine.ts` — add new presets for each template
- `src/pages/Today.tsx` — recommended session card
- `src/components/MayaSessionFrame.tsx` — dynamic intro from reason
- `src/components/LessonFlow.tsx` — pass recommendation context
- `src/components/SessionSummaryScreen.tsx` — save signals after session

### Not changing
- Exercise components (untouched)
- Existing preset logic (preserved, extended)
- Core LessonFlow orchestration (extended, not rewritten)
