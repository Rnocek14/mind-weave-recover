

# Maya Intelligence Layer — Implementation Plan

## What We're Building

A unified "recovery companion" narrative system that adds **continuity**, **interpretation**, and **anticipation** across the patient and caregiver surfaces. Maya is not a chatbot — it's a presence layer that makes the system feel like it *knows* the patient.

## Architecture

### New Files

1. **`src/lib/mayaNarrative.ts`** — Pure logic module. Takes existing data (domain scores, session history, cue efficacy, learning rates) and produces structured narratives:
   - `generateMayaInsight(domains, sessions, cueEfficacy, learningRates)` returns:
     - `continuityLine` — "Yesterday you answered 5 more on your own"
     - `interpretation` — { seeing: string[], helping: string[], workingOn: string[] }
     - `anticipation` — "Tomorrow we'll focus more on sentence building"
     - `milestone` — { type, message } | null (e.g., "You mastered 20 words!")
   - Uses existing `COGNITIVE_DOMAINS`, `getCueLabel`, `insightLanguageMap` for language
   - Deterministic, rule-based (no LLM) — consistent with clinical interpretation engine pattern

2. **`src/hooks/useMayaInsight.ts`** — Orchestrator hook that calls existing hooks (`useCognitiveState`, `useSessionHistory`, `useWordMastery`, `useErrorPatternAnalytics`, `useCaregiverDomainGuidance`) and feeds them into `mayaNarrative.ts`. Returns typed `MayaInsight` object. Memoized, staleTime-cached.

3. **`src/components/patient/MayaInterpretationCard.tsx`** — "My Progress" surface component with three sections:
   - "What I'm Seeing" (purple accent) — domain-aware observations
   - "What's Helping" (green accent) — cue strategies in plain language  
   - "What We're Working On" (amber accent) — forward-looking guidance
   - Compact card design consistent with existing PatientProgressView style

4. **`src/components/patient/MilestoneToast.tsx`** — Celebration moments triggered on milestones (20/50/100 words mastered, 7/14/30 day streak, 30% independence improvement). Uses existing toast system.

### Modified Files

5. **`src/components/PatientModeView.tsx`** — Home tab:
   - Replace static `encouragement` logic with `useMayaInsight().continuityLine`
   - Add anticipation line below encouragement ("Tomorrow we'll focus on...")
   - Add milestone celebration trigger via `useEffect`

6. **`src/components/patient/PatientProgressView.tsx`** — My Progress tab:
   - Insert `MayaInterpretationCard` between Hero Headline and Core Metrics Grid (Tier 1)
   - This becomes the anchor narrative — replaces need for separate Insights tabs

7. **`src/components/patient/PostSessionCard.tsx`** — Add anticipation line:
   - Below motivational nudge: "Next time, we'll keep building on [domain]"
   - Data from `mayaNarrative.anticipation`

8. **`src/components/caregiver/CaregiverStatusHero.tsx`** — Upgrade guidance headline:
   - Add urgency/confidence signals ("This is important to focus on now" vs "Making strong progress")
   - Use `mayaNarrative` confidence level based on score severity

## Narrative Logic (mayaNarrative.ts)

### Continuity Line (Home)
```text
Input: last session data + domain scores + previous session
Output examples:
  - "Yesterday you answered 5 more on your own — nice!"
  - "You've been improving at word finding this week"
  - "Two sessions this week — every one counts"
  - (no sessions): "Ready to pick up where you left off?"
```

### Interpretation (My Progress)
```text
"What I'm Seeing":
  - Map top improving domain → "You're getting faster at naming everyday objects"
  - Map declining domain → "Sentences are a bit harder right now — that's okay"

"What's Helping":
  - Map best cue → "Hearing the first sound helps you find the word"
  - Map consistency → "Practicing regularly is making a real difference"

"What We're Working On":
  - Map focusNext domains → "We're focusing on building sentences"
  - Map anticipation → "Next we'll challenge you with longer phrases"
```

### Milestones
```text
Triggers (checked on mount):
  - Word mastery: 10, 20, 50, 100 words → toast celebration
  - Streak: 7, 14, 30 days → toast celebration
  - Independence: cue-free accuracy crosses 50%/70% → toast celebration
  - Tracked via localStorage to avoid repeat firing
```

### Anticipation (Forward-Looking)
```text
Input: current focusNext domains + adaptation state
Output: "Tomorrow we'll keep building on [weakest domain label]"
  - If improving: "You're ready for more challenge in [domain]"
  - If steady: "We'll keep strengthening [domain]"
  - If declining: "We'll take it easier on [domain] to rebuild confidence"
```

## Data Flow

All inputs already exist — no new DB queries needed:
- `useCognitiveState` → domain scores, trends
- `useSessionHistory` → continuity data
- `useWordMastery` → milestone counts
- `useErrorPatternAnalytics` → cue efficacy
- `useCaregiverDomainGuidance` → domain struggle mapping

## Implementation Order

1. `mayaNarrative.ts` (pure logic, testable)
2. `useMayaInsight.ts` (orchestrator hook)
3. `MayaInterpretationCard.tsx` (My Progress surface)
4. Update `PatientProgressView.tsx` (insert card)
5. Update `PatientModeView.tsx` (continuity + anticipation on Home)
6. Update `PostSessionCard.tsx` (anticipation line)
7. `MilestoneToast.tsx` + milestone triggers
8. Update `CaregiverStatusHero.tsx` (urgency/confidence signals)

