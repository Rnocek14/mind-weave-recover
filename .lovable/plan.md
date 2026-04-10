

## Problem

When you answer wrong in Two Clues, the microphone stops and the feedback panel shows "Try Again" / "Next" buttons. The mic never auto-restarts, and no "Listening..." state is shown. The user must manually tap "Try Again" to continue speaking — adding unnecessary friction for stroke survivors.

## Current flow (wrong answer)
```text
Speech → Score → Wrong → Stop mic → Show feedback → DEAD END
                                                      ↓
                                        User must tap "Try Again"
                                                      ↓
                                              Mic restarts
```

## Proposed flow (wrong answer)
```text
Speech → Score → Wrong → Show feedback briefly (2s) → Auto-restart mic
                              ↓
                     Still show "Try Again" / "Next" / "Skip"
                     but mic auto-resumes after brief feedback
```

## Changes

### 1. Auto-restart mic after wrong answer feedback (TwoCluesGame.tsx)

In `processStableTranscript`, after the `else` branch for non-success results (lines 850-852):

- Keep `showFeedback = true` so the user sees what happened
- After a short delay (~2.5s), auto-dismiss feedback and call `beginAttempt()` to restart mic
- This mirrors the auto-advance behavior for correct answers but stays on the same puzzle

### 2. Show "Listening..." state alongside wrong-answer feedback

After auto-restart, the transcript area should reappear showing "Listening..." so the user knows they can speak again. Currently the transcript display (line 1070) is hidden when feedback is showing. The fix:

- After the auto-restart delay, clear `showFeedback` so the listening UI returns
- Keep the wrong-answer hint visible as a smaller inline message (not the full feedback card)

### 3. Preserve manual controls as fallback

- "Try Again" and "Next →" buttons remain available during the brief feedback window
- If user taps either before auto-restart fires, cancel the auto-restart timer
- "Skip" button stays accessible throughout

### Technical detail

In the `processStableTranscript` finally block for wrong answers:
```
// After showing feedback for wrong answer, auto-restart
const autoRetryTimer = setTimeout(() => {
  setShowFeedback(false);
  resetAttempt();
  setProcessingGuard(false);
  beginAttempt(currentAttemptNum + 1);
}, 2500);
```

Store timer ref so "Try Again", "Next", and "Skip" can clear it if user acts first. This keeps the pattern consistent with how correct answers auto-advance after 2s.

