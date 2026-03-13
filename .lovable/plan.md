

## Live Analysis Panel -- Data Gap Assessment & Fix Plan

### Current State

Based on the console logs and code review, here is what is working and what is not:

**Working (populated after each trial):**
- `errorType` -- correct, phonemic_paraphasia, etc.
- `targetWord` -- the current target
- `asrConfidence` -- from whisper/ASR
- `currentDomain`, `difficultyTier`, `cueType`, `cueLevel`
- `focusPhonemes`, `scheduledRepetitionWords`, `adaptationReasons`, `profileConfidence`
- `encouragementScore`, `reasoning`, `classificationConfidence`
- Decision Chain card and Audit Trail events

**Not populated (always null/undefined):**

| Field | Why | Fix |
|-------|-----|-----|
| `transcript` | Logged as `""` -- the whisperTranscript is empty on direct matches because scoring short-circuits before ASR returns full text | Use the matched word as transcript fallback |
| `micState` | Only set to `'idle'` on mount; never updated to `'listening'`/`'processing'` during recording lifecycle | Push micState from PhotoNamingGame's recording state changes |
| `latencyMs` | Never computed or pushed | Measure time from mic-start to stable-transcript |
| `trialTotal` | Never pushed (only `trialIndex`) | Pass total trial count from game config |
| `recentAccuracies` | Never pushed | Build from adaptation hook's recent trial history |
| `consecutiveErrors` | Available from adaptation hook but not pushed | Add to snapshot from `adaptation.consecutiveErrors` |
| `frustrationLevel` | Available from adaptation hook but not pushed | Add to snapshot |
| `fatigueFlag` | Never computed | Derive from session duration or consecutive errors |
| `completenessScore`, `prosodyScore` | Available from Azure PA but not mapped through | Thread through utterance analysis pipeline |
| `pronunciationScore`, `accuracyScore`, `fluencyScore` | Defined on snapshot but Azure PA data not reaching the panel | Same -- thread from utterance analysis |

### Plan

#### 1. Fix empty transcript on direct matches
In `PhotoNamingExercise.tsx` `handleTrialComplete`, change the transcript line:
```
transcript: result.whisperTranscript || ua?.transcript || trial.target,
```
This ensures the panel always shows what word was matched.

#### 2. Push micState transitions from PhotoNamingGame
In `PhotoNamingGame.tsx`, where recording starts/stops (`🎙️ Recording started`, `🎤 Speech recognition started`, `Manually stopping listening`), call `setLiveSnapshot({ micState: 'listening' })` / `{ micState: 'processing' }` / `{ micState: 'idle' }`. This requires passing `setLiveSnapshot` down or using `useLiveAnalysis()` directly in the game component.

#### 3. Fill session state fields in the snapshot push
In the `setLiveSnapshot` call at line 488, add:
- `trialTotal` from the game's total trial count
- `recentAccuracies` from the adaptation hook's history
- `consecutiveErrors` from `adaptation.consecutiveErrors`
- `frustrationLevel` from the adaptation hook's frustration state
- `micState: 'processing'` (since we just finished scoring)

#### 4. Compute and push latencyMs
Capture `Date.now()` when recording starts (mic goes live), store in a ref, then compute `latencyMs: Date.now() - recordingStartTime` when the trial completes. Push it in the snapshot.

#### 5. Thread Azure PA scores when available
If `ua?.pronunciationScore`, `ua?.completenessScore`, `ua?.prosodyScore` exist (from Azure PA pipeline), they are already being pushed for pronunciation/accuracy/fluency but the upstream analysis may not be populating them. This is gated by the `fluencyUnavailableReason: "not_authed"` log -- meaning Azure PA isn't configured. No code fix needed; these will auto-populate once Azure PA is connected.

### Files to Edit
- `src/pages/PhotoNamingExercise.tsx` -- enrich the `setLiveSnapshot` call with missing fields, fix transcript fallback
- `src/components/PhotoNamingGame.tsx` -- push `micState` transitions via `useLiveAnalysis()` hook, capture recording start timestamp for latency

### What This Unblocks
After these changes, all sections of the Live Analysis Panel will populate with real data during gameplay: mic state will pulse live, session progress will show trial X/Y with accuracy dots, consecutive errors and frustration flags will appear when relevant, and the transcript will never be empty.

