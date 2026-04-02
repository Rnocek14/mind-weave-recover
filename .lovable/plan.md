
# Smart Coach Revolution — Implementation Plan

## Critical Discovery
The `conversation-partner` edge function **ignores** the `smartCoachPrompt` built by `promptBuilder.ts`. It uses its own hardcoded `SYSTEM_PROMPT`. This means our entire prompt engineering pipeline is bypassed. **Fix #0.**

---

## Phase 1: Fix the Prompt Pipeline (Foundation — Do First)

### 1a. Update `conversation-partner/index.ts`
- When `smartCoachPrompt` is present in the request body, use it as the system prompt instead of the hardcoded `SYSTEM_PROMPT`
- This connects the modular engine's brain to the actual LLM call

### 1b. No other changes needed — this unlocks everything else

---

## Phase 2: Purpose Layer Engine

### 2a. New file: `src/lib/smartCoach/topicPurposeMap.ts`
Map each topic to clinical purpose:
```
food → { goalId: 'ordering_food', skillTarget: 'noun_retrieval', transferTarget: 'restaurant/home', rationale: 'Practice familiar food words for real conversations' }
family → { goalId: 'describing_people', skillTarget: 'sentence_building', ... }
```

### 2b. Update `types.ts`
Add:
- `PurposeContext` interface (goalId, skillTarget, transferTarget, rationale, measure)
- `SessionPhase` type (orientation | readiness | warmup | conversation | drill | transfer | wrapup | home_practice)
- `SessionMetrics` interface (wordsProduced, independentResponses, cueAssistedCount, longestResponse, hesitationCount, strategiesThatHelped, avgLatencyEstimate)
- `severityProfile` and `primaryDeficit` to `CoachState`

### 2c. Update `coachState.ts`
- Initialize `purposeContext` from topic via `topicPurposeMap`
- Initialize `sessionMetrics` with zeros
- Add `severityProfile` defaulting to 'moderate'

### 2d. Update `promptBuilder.ts`
- Inject purpose context (rationale, transferTarget) into every prompt
- Enforce `[Context] + [Purpose] + [Action]` structure
- Add SCA VERIFY instructions for scaffold/support modes

---

## Phase 3: Session Architecture (UI)

### 3a. Update `SmartCoach.tsx` phases
Replace current flow: `topic_select → intro → chatting → complete`
With: `topic_select → orientation → readiness → chatting → complete`

### 3b. Orientation Card (replaces current intro)
Show:
- Today's goal (participation-level, from purposeMap)
- Skill target
- Real-world transfer context
- Session arc preview (Warm up → Practice → Review)
- Time estimate (~5 min)

### 3c. Readiness Check
- Simple fatigue slider (0-10)
- Adjusts: session length, starting support level, pace
- Quick — one tap and go

### 3d. "Now working on..." persistent chip
- Visible during chat showing current skill target
- Updates as mode changes

### 3e. 3-Part Wrapup Summary
Replace generic summary with:
1. What improved (specific, from session metrics)
2. What strategy helped (from cue tracking)
3. What's next (one actionable target)

### 3f. Home Practice Card
Implementation intention: "After [trigger], I'll do [3-minute practice]"

---

## Phase 4: Prompt & Language Rewrite

### 4a. Rewrite `promptBuilder.ts` MODE_INSTRUCTIONS
- Add rationale framing to each mode
- Add SCA IN/OUT/VERIFY behaviors
- Add autonomy-supportive choice offering
- Enforce purpose-aware responses

### 4b. Add Purpose Validator to `safetyValidator.ts`
New check: reject prompts that don't reference the skill target or topic purpose
- Block generic "tell me more" without functional connection

### 4c. Add "empty praise" validator
Block: "Good job!", "Great!", "Wonderful!" in isolation
Require: task-specific detail in positive feedback

---

## Phase 5: Feedback Overhaul

### 5a. Rewrite `fallbackLibrary.ts`
Replace all identity-focused lines with task-focused feedback:
- ❌ "Good job" → ✅ "You got that word out without a hint"
- ❌ "Nice work" → ✅ "That sentence was longer than your last one"
- ❌ "You should feel proud" → ✅ "You described that clearly"

### 5b. Add strategy labeling to wrapup
Track which cue types were effective and name them:
- "The sentence starter helped you get going"
- "First-sound cues worked well for you today"

### 5c. Session Metrics Tracking in `runCoachTurn.ts`
Accumulate per turn:
- Word count, independent vs cued responses
- Longest response, hesitation count
- Which strategies helped

---

## Phase 6: Severity-Aware Behavior

### 6a. Add severity to CoachState
`severityProfile: 'mild' | 'moderate' | 'severe'`
`primaryDeficit: 'expressive' | 'receptive' | 'mixed'`

### 6b. Update `cueSelector.ts`
- Severe: default to forced_choice, shorter turns
- Mild: default to expansion_prompt, more open-ended
- Moderate: current behavior (mixed)

### 6c. Update `promptBuilder.ts`
- Severe: shorter instructions, more verification steps
- Mild: focus on speed/fluency, less scaffolding language

---

## Phase 7: Intervention Loop Design

### 7a. Update `coachStateMachine.ts`
Add trigger detection for:
- Hesitation cluster (3+ in 5 turns) → suggest drill
- Success plateau → suggest challenge
- Comprehension breakdown → suggest verification

### 7b. Add intervention framing to prompts
Every intervention must follow: Observation → Rationale → Action
- "You paused on that word. Let's narrow the choices so it's easier to find."

### 7c. (Design only) JITAI game trigger interface
Define `GameTriggerEvent` type but don't build game UI yet

---

## Phase 8: Cross-Session Progress

### 8a. Save session summary to Supabase
Use existing `coach_conversation_summaries` table
Store: metrics, strategies used, topic, support levels

### 8b. Load last session summary on orientation
Show: "Last time you practiced [topic] and improved at [skill]"
State: "Today we'll build on that"

---

## Phase 9: Edge Function Update

### 9a. Update `conversation-partner/index.ts`
- Accept and use `smartCoachPrompt` as system message
- Keep existing SYSTEM_PROMPT as fallback for non-Smart-Coach usage
- Deploy

---

## Files Changed (Summary)

| File | Action |
|------|--------|
| `supabase/functions/conversation-partner/index.ts` | Use smartCoachPrompt when provided |
| `src/lib/smartCoach/types.ts` | Add PurposeContext, SessionPhase, SessionMetrics, severity |
| `src/lib/smartCoach/topicPurposeMap.ts` | **NEW** — topic → purpose mapping |
| `src/lib/smartCoach/coachState.ts` | Initialize purpose, metrics, severity |
| `src/lib/smartCoach/promptBuilder.ts` | Major rewrite — purpose, SCA, autonomy |
| `src/lib/smartCoach/fallbackLibrary.ts` | Task-focused feedback rewrite |
| `src/lib/smartCoach/safetyValidator.ts` | Add purpose validator, empty praise ban |
| `src/lib/smartCoach/cueSelector.ts` | Severity-aware defaults |
| `src/lib/smartCoach/coachStateMachine.ts` | Intervention triggers, cluster detection |
| `src/lib/smartCoach/runCoachTurn.ts` | Session metrics accumulation |
| `src/lib/smartCoach/index.ts` | Export new types |
| `src/pages/SmartCoach.tsx` | Orientation, readiness, purpose chip, 3-part wrapup, home practice |

## What We Are NOT Doing (Yet)
- No game UI (design only)
- No speech layer
- No scoring system (after this stabilizes)
- No daily session engine changes
- No database migrations (use existing tables)

## QA Test
> Screenshot any 5 consecutive system messages. Can you explain what goal you're working on, why, and whether you're improving? If not, the system is failing.
