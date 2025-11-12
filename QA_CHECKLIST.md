# NeuroRecover Pre-Flight QA Checklist

**Date:** __________ | **Tester:** __________ | **Device:** __________

## Pre-Flight Setup (✓ before testing)

### Database
- [ ] Exercises seeded (`photo-naming`, `reach-tap`)
- [ ] `profiles` table has: `goals`, `daily_goal_minutes`, `consent_version`, `hand_bias`
- [ ] `photos` storage bucket is **PRIVATE**
- [ ] Storage RLS policies check `auth.uid()::text = split_part(name,'/',1)`

### Test Accounts
- [ ] Created test email account: __________
- [ ] Tested anonymous sign-in flow
- [ ] Verified upgrade from anonymous → full account

### Environment
- [ ] App loads without console errors
- [ ] Image compression tested (5MB → <400KB)
- [ ] PWA installable (if testing on device)

---

## Core Flow Testing (✓ as completed)

### 1. Authentication (5 min)
- [ ] Sign up with email/password
- [ ] Sign in with existing account
- [ ] Anonymous sign-in works
- [ ] No redirect loops
- [ ] Dashboard loads after auth

**Notes:** ___________________________________________________

### 2. Onboarding (3 min)
- [ ] Can select goals (motor/speech/cognition)
- [ ] Font size adjustment visible
- [ ] High contrast toggle works
- [ ] Left/right hand bias setting saves
- [ ] Goals saved to database

**Notes:** ___________________________________________________

### 3. Photo Upload - Caregiver Mode (5 min)
- [ ] Upload 8-10 photos successfully
- [ ] Photos compress properly (<400KB each)
- [ ] Can add labels to photos
- [ ] Photos display in grid with signed URLs
- [ ] Delete photo works (removes from storage + DB)
- [ ] No broken images after upload

**Photos uploaded:** _____ | **Failed:** _____

**Notes:** ___________________________________________________

### 4. Exercise Session (15 min)
#### Name That Photo
- [ ] Loads user's photos (not emojis)
- [ ] "I Said It" button works
- [ ] Score increments correctly
- [ ] Round counter advances
- [ ] Signed URLs don't break mid-session

#### Reach & Tap
- [ ] Targets appear and are tappable (60px min)
- [ ] Timing tracked accurately
- [ ] Can tap with left OR right hand

#### Safety Controls
- [ ] **Pause** button always visible (bottom fixed)
- [ ] **End Session** button always visible
- [ ] Buttons are 60px+ and thumb-reachable
- [ ] Rest prompt appears at 10 min
- [ ] Can continue or end from rest prompt

**Session duration:** _____ min | **Rounds completed:** _____

**Notes:** ___________________________________________________

### 5. Dashboard & Progress (5 min)
- [ ] Streak shows correctly (UTC-safe)
- [ ] Total reps accurate
- [ ] Today's progress % updates
- [ ] Achievements awarded (First Session, etc.)
- [ ] Can navigate to History

**Streak:** _____ | **Total Reps:** _____ | **Achievements:** _____

**Notes:** ___________________________________________________

---

## Accessibility Check (2 min)
- [ ] Text readable (font size appropriate)
- [ ] High contrast mode works
- [ ] Touch targets 60px+ (easy to tap)
- [ ] No confusing language/jargon
- [ ] Pause/End always findable

**Notes:** ___________________________________________________

---

## Known Issues / Bugs Found

| # | Page | Issue | Severity (High/Med/Low) | Screenshot? |
|---|------|-------|------------------------|-------------|
| 1 |      |       |                        |             |
| 2 |      |       |                        |             |
| 3 |      |       |                        |             |

---

## User Feedback (Dad's comments)

**What worked well:**
_________________________________________________________________

**What was confusing:**
_________________________________________________________________

**Pain points / fatigue:**
_________________________________________________________________

**Feature requests:**
_________________________________________________________________

---

## Post-Test Actions

- [ ] Review console logs for errors
- [ ] Check Supabase tables for data integrity
- [ ] Export session data for review
- [ ] Prioritize bug fixes (Highs first)
- [ ] Update roadmap based on feedback

---

## Sign-Off

**Ready for daily use?** ☐ YES ☐ NO (fix issues first)

**Tester Signature:** _________________ **Date:** __________
