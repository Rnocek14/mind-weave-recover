
# Two Clues Speech Recognition Fix

## Problem Summary

The Two Clues game is not registering speech correctly. Based on the console logs, the microphone starts and **immediately stops**:

```
🎤 Starting listening...
🎤 Manually stopping listening...
🎤 Speech recognition ended, state was: STOPPING
```

## Root Cause Analysis

I identified **3 critical bugs** in `src/components/TwoCluesGame.tsx`:

### Bug 1: Cleanup Effect Fires on Callback Changes (CRITICAL)

```typescript
// Lines 172-181 - THIS IS THE PRIMARY BUG
useEffect(() => {
  return () => {
    cancelRecording();
    stopListening();  // <-- This stops the mic!
    void finalizeAttempt('abandoned');
  };
}, [cancelRecording, stopListening, finalizeAttempt]); // <-- Dependencies cause cleanup to fire!
```

When any of these callbacks (`cancelRecording`, `stopListening`, `finalizeAttempt`) are recreated during a re-render, React runs the cleanup function, which calls `stopListening()`. This causes the mic to stop immediately after starting.

**PhotoNaming avoids this** by using `state.trialNumber` as the dependency (or empty array for true unmount-only cleanup), NOT callback functions.

### Bug 2: Separate `isListening` State vs Hook State

The component maintains its own `isListening` state:
```typescript
const [isListening, setIsListening] = useState(false);
```

But also gets `speechIsListening` from the hook:
```typescript
const { isListening: speechIsListening, ... } = useSpeechRecognition(...);
```

The UI displays based on the local `isListening` state, but the actual recognition state is `speechIsListening`. These can get out of sync.

### Bug 3: Auto-Start Effect Missing `beginAttempt` Dependency

```typescript
// Lines 160-170
useEffect(() => {
  if (!game.currentPuzzle || game.isComplete) return;
  game.startRound();
  if (!showFeedback && sessionId && userId) {
    beginAttempt(1);  // <-- Uses beginAttempt but not in deps
  }
}, [game.currentPuzzle?.id, showFeedback, sessionId, userId]);  // <-- Missing beginAttempt
```

ESLint would flag this. When `beginAttempt` changes, the effect doesn't re-run with the fresh callback.

## Solution

### Fix 1: Cleanup Effect - Use Refs for Unmount-Only Cleanup

Store the cleanup functions in refs and use an empty dependency array for true unmount-only behavior:

```typescript
// Store refs for cleanup
const stopListeningRef = useRef(stopListening);
const cancelRecordingRef = useRef(cancelRecording);
const finalizeAttemptRef = useRef(finalizeAttempt);

// Keep refs updated
useEffect(() => { stopListeningRef.current = stopListening; }, [stopListening]);
useEffect(() => { cancelRecordingRef.current = cancelRecording; }, [cancelRecording]);
useEffect(() => { finalizeAttemptRef.current = finalizeAttempt; }, [finalizeAttempt]);

// True unmount cleanup - only runs when component unmounts
useEffect(() => {
  return () => {
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    cancelRecordingRef.current();
    stopListeningRef.current();
    void finalizeAttemptRef.current('abandoned');
  };
}, []); // Empty deps = unmount only
```

### Fix 2: Synchronize Listening States

Use the hook's `speechIsListening` as the source of truth for display, or keep them synchronized:

```typescript
// Option A: Use hook's state directly for display
{speechIsListening && (
  <div className="text-center p-4 ...">
    <p>{displayTranscript || <span>Listening...</span>}</p>
  </div>
)}

// Option B: Keep local state synced
useEffect(() => {
  setIsListening(speechIsListening);
}, [speechIsListening]);
```

### Fix 3: Add Missing Dependencies to Auto-Start Effect

```typescript
useEffect(() => {
  if (!game.currentPuzzle || game.isComplete) return;
  game.startRound();
  if (!showFeedback && sessionId && userId) {
    beginAttempt(1);
  }
}, [game.currentPuzzle?.id, game.isComplete, showFeedback, sessionId, userId, beginAttempt, game.startRound]);
```

### Fix 4: Match PhotoNaming's Visual Feedback Pattern

Add the same "Heard:" display that PhotoNaming uses:

```typescript
{/* Show what was heard in real-time */}
{speechIsListening && displayTranscript && (
  <div className="text-sm text-center p-2 bg-muted rounded">
    Heard: "{displayTranscript}"
  </div>
)}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/TwoCluesGame.tsx` | Fix cleanup effect dependencies, sync listening states, add visual feedback |

## Technical Details

### Changes to TwoCluesGame.tsx

1. **Add refs for cleanup functions** (around line 54):
   ```typescript
   const stopListeningRef = useRef<() => void>(() => {});
   const cancelRecordingRef = useRef<() => void>(() => {});
   const finalizeAttemptRef = useRef<(errorType: 'cancelled' | 'skipped' | 'abandoned') => Promise<void>>(async () => {});
   ```

2. **Add sync effects for refs** (after hook declarations):
   ```typescript
   useEffect(() => { stopListeningRef.current = stopListening; }, [stopListening]);
   useEffect(() => { cancelRecordingRef.current = cancelRecording; }, [cancelRecording]);
   useEffect(() => { finalizeAttemptRef.current = finalizeAttempt; }, [finalizeAttempt]);
   ```

3. **Fix cleanup effect** (lines 172-181):
   ```typescript
   useEffect(() => {
     return () => {
       if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
       cancelRecordingRef.current();
       stopListeningRef.current();
       void finalizeAttemptRef.current('abandoned');
     };
   }, []); // Empty array - unmount only
   ```

4. **Sync listening state with hook** (add new effect):
   ```typescript
   useEffect(() => {
     setIsListening(speechIsListening);
   }, [speechIsListening]);
   ```

5. **Update UI to show transcript preview** (lines 473-482):
   ```typescript
   {/* Transcript display - matches PhotoNaming pattern */}
   {(isListening || speechIsListening) && (
     <div className="text-center p-4 bg-muted/50 rounded-lg min-h-[60px] flex items-center justify-center">
       <p className="text-lg">
         {displayTranscript ? (
           <>Heard: "{displayTranscript}"</>
         ) : (
           <span className="text-muted-foreground animate-pulse">Listening...</span>
         )}
       </p>
     </div>
   )}
   ```

6. **Add dependencies to auto-start effect** (line 170):
   ```typescript
   }, [game.currentPuzzle?.id, game.isComplete, showFeedback, sessionId, userId, beginAttempt]);
   ```

## Verification Steps

After implementing:
1. Navigate to Two Clues exercise
2. Verify microphone starts and stays active (console shows `🎤 Speech recognition started` without immediate stopping)
3. Speak a word - verify transcript appears in the "Heard:" display
4. Verify the spoken word is processed and scored after the 750ms debounce
5. Verify the game shows proper feedback for matched answers
