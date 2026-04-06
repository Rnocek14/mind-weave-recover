

# Plan: Simplify to Core Patient Journey + Add Adherence Loop

## What exists today
- `/welcome` — 2-step first-time onboarding → launches `/smart-coach`
- `/today` — daily launcher with last-session context → launches `/smart-coach`
- `/smart-coach` — full 8-turn session engine with voice, exercises, wrapup
- `/recovery-progress` — 553-line longitudinal progress page (linked from `/today`)
- Post-session complete screen with 3-part summary + home practice idea
- 65+ routes, most irrelevant to patients

## What's missing for real-user readiness
1. **Route gating** — patients can stumble into admin/clinician/legacy pages
2. **Adherence loop** — no "come back tomorrow" mechanism whatsoever (no notifications, no streak on `/today`, no session count)
3. **Post-session → `/today` flow** — session complete sends users to "Back to Dashboard" (old route), not `/today`
4. **Progress page too complex** — 553 lines of clinician-grade metrics, not patient-friendly
5. **No first-visit detection** — returning users see `/` (marketing page) instead of `/today`

## Changes (5 items)

### 1. Lock patient journey to 4 screens
Hide all non-core routes behind auth + role checks. For the patient path, the only navigable screens are:
- `/` or `/today` — daily launcher (auto-redirect authenticated users from `/` to `/today`)
- `/welcome` — first-time only
- `/smart-coach` — session
- `/progress` — simplified progress

**In `Index.tsx`**: Add auth check — if logged in, redirect to `/today` immediately.

**In `SmartCoach.tsx` session complete screen**: Change "Back to Dashboard" button to go to `/today` instead of `/dashboard`.

### 2. Add streak + session count to `/today`
Query `coach_conversation_summaries` for this user to show:
- **Session count** ("Session #12")
- **Current streak** (consecutive days with a session)
- **Last session date** (already partially exists)

This is lightweight — no new tables, just a query + 3 lines of UI on the existing `/today` page.

### 3. Add simple "come back tomorrow" to session complete
On the SmartCoach complete screen, replace the generic home practice card with a stronger return hook:
- "See you tomorrow" message with tomorrow's suggested topic
- Change "Practice Again" to "Done for today" (navigates to `/today`)
- Keep "Practice Again" as secondary option

### 4. Create simplified `/progress` page
Create a new lightweight progress page at `/progress` that shows patient-friendly data only:
- Total sessions completed
- Current streak (days)
- Words practiced (cumulative)
- Simple week-view calendar (reuse `SessionAdherenceTracker` component, already built)
- One-line trend ("Getting stronger" / "Keep going")

Link this from `/today` instead of `/recovery-progress`.

### 5. Auto-route returning users
In `Index.tsx`, check if user is authenticated:
- Yes → redirect to `/today`
- No → show landing page

This ensures returning users never see the marketing page again.

## What we are NOT doing
- No push notifications (requires service worker + platform permissions — premature)
- No new exercises
- No new admin tools
- No new AI features
- No monetization work

## Technical details
- **Files modified**: `Index.tsx`, `Today.tsx`, `SmartCoach.tsx`, `App.tsx`
- **Files created**: `src/pages/Progress.tsx` (simplified progress view)
- **Database**: No new tables. Queries existing `coach_conversation_summaries` for streak/count.
- **Components reused**: `SessionAdherenceTracker` for the week calendar on progress page

