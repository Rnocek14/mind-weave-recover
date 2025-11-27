# Troubleshooting Guide

This guide covers common issues during therapy sessions and how to resolve them, split into three sections:

- **Section A** – Caregiver / Session Troubleshooting (no dev tools)
- **Section B** – Dev / QA Troubleshooting (you + Lovable)
- **Section C** – What to capture when something goes wrong

---

## A. Caregiver / Session Troubleshooting

> For anyone running a session (you, sibling, SLP) without needing developer tools.

### 1. The app feels "stuck" or slow

**Signs:**

* Buttons don't respond
* Screen doesn't advance to next picture
* Spinning loader that never finishes

**Try this:**

1. Tap the **Home** or **Dashboard** button (top-left arrow).
2. If that doesn't work:
   * Close the app (swipe it away)
   * Reopen it and go back to **"Start Today's Session"**.
3. If it happens again in the same place:
   * Take a screenshot
   * Note which game + which screen (e.g., "Photo Naming – picture of a phone")

---

### 2. Microphone isn't picking up speech

**Signs:**

* No microphone icon / pulsing circle on screen
* He speaks but nothing changes
* You see "Listening…" once, then it stops and doesn't come back

**Step 1 – Quick checks**

1. Make sure **volume is up** (so you can hear success/fail chimes).
2. Look for a **microphone icon** or pulsing ring:
   * If it never appears → likely permissions or mic error.
3. Try **one manual restart** of the game:
   * Back to dashboard → re-open Photo Naming or Phrase Practice.

**Step 2 – Permissions**

On the device (tablet/phone):

1. Go to system **Settings → Apps → [Your App / Browser] → Permissions**.
2. Ensure **Microphone = Allowed**.
3. If in browser:
   * Tap the lock icon in address bar
   * Ensure "Microphone: Allow".

**If still broken:**

* Switch to **"tap answer" mode** (if available) for that session.
* Note the time + what game you were in for later debugging.

---

### 3. Auto-listen doesn't start (he has to tap manually)

**Signs:**

* New picture appears
* Microphone never starts on its own (no pulsing or "listening" indicator)

**Workaround for the session:**

1. Use the **manual "Start Listening" button** (if exposed).
2. If not visible, just treat that game as **"point-and-tap only"** and move on to another exercise later (Reach & Tap, Phrase Practice, etc.).

**After session (for you as dev):**

* Note:
  * Which game (Photo Naming / Phrase Practice)
  * Approx time
  * Whether it happened on **every trial** or just some

(Dev debugging steps are in Section B.)

---

### 4. He gets frustrated by feedback

**Signs:**

* He says "I'm wrong again", "I can't do this"
* Reacts strongly to red / harsh messaging

**In-the-moment adjustments:**

1. Verbally reframe:
   * "It says you were close, not wrong. Your brain knows the idea."
   * "This is practice data for the computer, not a test."
2. If a specific photo or word is upsetting:
   * Skip to next trial if possible.
   * After session, you can mark that item as "avoid" later.

**After session:**

* Note any **phrases the app used** that felt sharp so we can soften or remove them.

---

### 5. Analytics / Progress page is empty

**Signs:**

* Speech Trends page shows no charts, or "No data yet" everywhere.

**Check:**

1. Has he **actually completed any speech games** today or this week?
   * If no → this is expected.
2. If yes (and you're sure events were logged):
   * It might be a data filter or date range issue (dev side).

For the actual session: this is **not critical**. The games will still work even if analytics are blank.

---

## B. Developer / QA Troubleshooting

> For you + Lovable. This is the "what to check in code / Supabase" side.

---

### 1. Auto-Listen Not Starting / Abort Loops

**Symptoms:**

* Console shows repeated logs like:
  * `🎤 Auto-listen timeout executed for new trial`
  * `DOMException: The request is not allowed by the user agent`
* Mic doesn't reliably start on each new trial.

**Checks:**

1. In `PhotoNamingGame.tsx`:
   * Confirm the `useEffect` that handles new trial:
     * Uses `autoListenInitiatedRef.current` to guard once per trial.
     * Dependencies **do NOT** include `errorHistory` (we removed that to stop re-runs).
2. Confirm cleanup:
   * Only clears the current trial's timeout.
3. In browser:
   * Ensure mic permissions are granted (no HTTPS / localhost issues).

If this still misbehaves, add a temporary log:

```ts
console.log('Auto-listen guard', {
  trialNumber: state.trialNumber,
  autoListenInitiated: autoListenInitiatedRef.current
});
```

You want to see only one auto-listen attempt per trial.

---

### 2. exercise_events Has No / Broken Utterance Data

**Symptoms:**

* Games "feel" like they work, but analytics are empty.
* Supabase rows missing `task_parameters.utterance_analysis`.

**Checks:**

1. In `PhotoNamingExercise.tsx` → `handleTrialComplete`:
   * Confirm `taskParameters` includes:
     * `utterance_analysis: result.utteranceAnalysis`
     * `shadow_event: result.shadowEvent`
     * `encouragement_score: result.encouragementScore`
     * `effortful_speech: result.effortfulSpeech`
2. In Supabase:
   * Open `exercise_events`
   * Filter by `created_at` last hour
   * Inspect `task_parameters` JSON:
     * Verify those fields exist and are not `null`.

If they're missing, you likely have a mismatch between what PhotoNamingGame passes and what `handleTrialComplete` expects.

---

### 3. Semantic / Phoneme Analysis Not Showing in Analytics

**Symptoms:**

* Dashboard tiles always show `0%` for:
  * Avg phoneme accuracy
  * Avg semantic match

**Checks:**

1. In `errorClassifier.ts`:
   * Confirm all relevant path returns include:
     * `phonemeAccuracy`
     * `semantic_similarity` where appropriate
2. In whatever maps UtteranceAnalysis → analytics:
   * Ensure you're reading:
     * `utterance_analysis.phonemeAccuracy`
     * `utterance_analysis.semanticSimilarity` (or however you named it)

If needed, add a dev-only log in `SpeechTrendsAnalytics.tsx` when parsing events:

```ts
console.log('UtteranceAnalysis sample', utteranceAnalysis);
```

Make sure the field names match what you aggregate.

---

### 4. Timeout / No-Response Handling Broke After Auto-Listen Changes

**Symptoms:**

* User stays silent, but:
  * No feedback appears, or
  * Game freezes instead of timing out.

**Checks:**

1. Verify the timeout logic:
   * Where you detect timeout → ensure you still:
     * Call `onTrialComplete` with `errorType: 'timeout'`
     * Generate `encouragementScore` via `calculateEncouragementScore('timeout')`
2. Confirm `feedbackData` state in PhotoNamingGame:
   * That you set `showFeedback = true` on timeout.
3. In `feedbackGenerator.ts`:
   * Ensure `timeout` maps to a gentle message:
     * "No rush! The word is …"

---

### 5. Field Name Drift: avgPauseDuration vs avgPauseDurationMs

**Symptoms:**

* Effortful speech detection not triggering
* Analytics show 0 for pause-based metrics

**Checks:**

1. Search entire repo for `avgPauseDuration`:
   * All *current* logic should use `avgPauseDurationMs`.
2. In `detectEffortfulSpeech`:
   * Confirm you destructure:
     ```ts
     const { speechRateWpm, pauseCount, avgPauseDurationMs } = metrics;
     ```
3. In wherever you store acoustic metrics from Whisper:
   * Ensure you write `avgPauseDurationMs` into `acousticMetrics` object.

---

### 6. "Harsh" Feedback Strings Still Present

**Symptoms:**

* Patient sees "Incorrect" / "Wrong answer" etc.

**Checks:**

* Search for:
  * `Incorrect!`
  * `Wrong`
  * `failed`
  * `try harder`
* In all components under:
  * `PhotoNamingGame`
  * `PhrasePracticeGame`
  * Any generic toast / alert wrappers

Replace them with neutral/gentle phrases:

* "Let's try that one again."
* "We can come back to this one."
* "You were working hard on that."

---

## C. When Something Breaks – What to Capture

So you don't have to think under stress, here's the minimal "bug report kit" you / family can gather:

For **any unexpected behavior**, try to capture:

1. **What he was doing**
   * Game name: Photo Naming / Phrase Practice / Reach & Tap
   * Approx step: "3rd picture", "near the end", "first screen after pressing Start"

2. **What went wrong**
   * One sentence in plain language (e.g., "Mic didn't start after new picture loaded")

3. **When**
   * Date & approximate time (e.g., "Nov 27, around 10:05 AM")

4. **Screenshots or short screen recording**
   * Especially of:
     * Frozen screen
     * Weird feedback message
     * Analytics page if it looks off

5. **(If you're in dev mode)**
   * Console logs (copy/paste or screenshot)
   * Any error messages in Supabase logs around that time

Drop that into Notion / GitHub and it will be enough context for you + Lovable to actually debug, not guess.

---

## Next Steps

Consider creating:

* A **"Session Runner" one-pager** for family / SLP (only the Caregiver section, simplified even more).
* A **Dev QA checklist** you can re-run after each code change (almost like automated tests, but in human steps).
