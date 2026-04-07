
# Smart Coach Redesign: Games-First, Maya-Orchestrated

## Core Model
**Games = Treatment. Maya = Therapist brain.**
- 80% structured game practice, 20% Maya intelligence (setup, review, transfer, bridges)
- No open-ended chat. Every Maya turn has a clinical purpose.
- Session feels like: therapist explains → you practice → therapist reviews → you use it → repeat

## New Session Flow (Target: 10-15 minutes)

### Phase 1: Maya Opens (30-60 seconds, 1-2 turns max)
- Maya states today's focus based on speech profile + last session + weak domains
- Example: *"Today we're working on word finding for everyday items. Last time, naming was slow for food words — let's build on that."*
- **No topic picker UI.** System auto-selects. User sees "Change focus" option only.
- Immediately transitions to Game 1.

### Phase 2: Game 1 — Core Practice (3-5 minutes)
- Selected from: speech profile weaknesses, domain scores, exercise history
- This is the primary therapy block
- Game runs fully (not cut short)

### Phase 3: Maya Reviews Game 1 (15-30 seconds, 1 turn)
- Specific feedback referencing actual game results
- Example: *"You got 7 out of 10. 'Broccoli' and 'kitchen' were quick. 'Spatula' took longer."*
- No generic praise. Reference real words/scores.

### Phase 4: Transfer Check (1-2 turns, 30-60 seconds)
- Maya asks user to USE what was just practiced in a real-world sentence
- Example: *"Now tell me — if you're at a store, how would you ask for a spatula?"*
- This is where conversation happens, but it's SHORT and PURPOSE-DRIVEN
- Maya scores transfer (did they use the target word naturally?)

### Phase 5: Game 2 — Adaptive Practice (3-5 minutes)  
- Selected based on: Game 1 results + transfer check performance + speech profile
- If Game 1 went well → harder/different domain game
- If Game 1 showed struggle → supportive/same-domain game
- If transfer was weak → game targeting the specific gap

### Phase 6: Maya Reviews + Wraps (1 turn)
- Reviews Game 2 results
- Compares to Game 1 if relevant
- Summarizes session gains
- Example: *"Words came faster in that second round. 'Spatula' was smoother. Good session — we'll keep building on naming next time."*

## What Changes Architecturally

### Remove/Bypass
1. **Topic selector screen** — Replace with auto-selected "Today's Plan" with override option
2. **Long warm-up conversation** — Replace with 1-2 turn purposeful opener
3. **Open-ended chat between games** — Replace with structured 1-2 turn transfer checks
4. **Chat-probe system** — Games ARE the probes now
5. **Conversational assessment phase** — Game 1 IS the assessment

### Keep/Enhance
1. **Game popup system** — This is now the CORE, not a supplement
2. **Drill selector scoring** — Enhanced with domain scores + exercise history (already done)
3. **Post-game review** — Make it reference actual words/scores from the game
4. **Cross-session continuity** — Feed into opener
5. **Speech profile integration** — Drive game selection
6. **Transfer scoring** — Use existing transferScoring.ts for the bridge turns

### New Components Needed
1. **Session Plan Generator** — Auto-selects today's focus + 2 games based on profile
2. **Game-First Flow Controller** — Manages the Phase 1→6 sequence
3. **Transfer Check UI** — Short, structured 1-2 turn conversation after each game
4. **Today's Plan Card** — Replaces topic selector with "Here's what we're doing today"

## Implementation Order

1. **Build session plan generator** — Auto-select focus + game sequence from profile data
2. **Redesign Smart Coach flow** — Phase 1→6 state machine replacing current chat-first flow  
3. **Replace topic selector** — "Today's Plan" card with override
4. **Wire game results into Maya reviews** — Specific word/score references
5. **Add transfer check turns** — Short purposeful conversation after each game
6. **Update opener logic** — 1-2 turns max, then immediately launch Game 1
7. **Test + tune timing** — Ensure 10-15 min total session feel
