# QA Hardening Initiative — Master Tracker

Started: 2026-06-03
Owner: Lovable + user (user drives live preview, Lovable fixes + documents)

## Guardrails (do not violate)
Clinical engine is **frozen**. No changes to scoring, progression, mastery
routing, drill selection, speech pipeline, or content banks unless a defect is
**confirmed with a clear repro**. Speculative edits to `use*Game.ts`,
`use*Progression.ts`, `responseValidation.ts`, or `*Bank.ts` are forbidden.

---

## Phase 0 — Foundation & baseline ✅

| Check | Result |
|-------|--------|
| Vitest + RTL infra | ✅ present (`vitest.config.ts`, `src/test/setup.ts`) |
| Test suite baseline | ✅ **1108 passing, 25 skipped, 74 files** (`bunx vitest run`) |
| Playwright e2e infra | ✅ present (`playwright.config.ts`, `tests/e2e/*`) |
| Guided runbook | ✅ `/dev/qa-runbook` reads `src/data/qaScenarios.ts` |
| Known flaky test | `fixSentenceRecency` — backlog `pr6-flaky-fix-sentence-recency-test.md` |

Baseline console errors (patient, anon sign-in): only expected
`NotFoundError: Requested device not found` (no microphone in headless QA
browser). No unexpected runtime errors.

---

## Phase 1 — Patient sweep (in progress)

Method: anonymous sign-in ("Start Without Account"), 390×844 mobile viewport.

| Route / flow | Status | Notes |
|--------------|--------|-------|
| `/auth` | ✅ pass | Email/pw form, "Start Without Account", no console errors |
| `/today` (home) | ✅ pass | Greeting, coaching-level selector, Start CTA, bottom tab bar |
| Practice tab | ✅ pass | Suggested + categorized games render cleanly |
| `/exercise/photo-naming` | ✅ pass | Loads, instruction banner, image preloads |
| → mic-denied fallback | ✅ pass | "Hear choices" reveals choice chips (multi-input fallback per memory) |
| → chip scoring + advance | ✅ pass | Tapping a chip scores and auto-advances to next trial |
| → stall auto-cue | ✅ pass | Stall detected → semantic cue delivered, no dead state |

| `/insights` | ✅ pass | Safe "building baseline" empty states, concern banner |
| `/history` | ✅ pass | QA session logged correctly (1 try, 0%, photo_naming) |
| `/recovery-progress` | ✅ pass | BETA, clinical-safe empty states |
| `/speech-profile` | ✅ pass | Empty state + Profile/Adaptation/Evidence tabs |
| `/photo-library` | ✅ pass | Empty state + Take Photo / Upload CTAs |

### Fixes applied (presentation-only, engine untouched)
- **Insights mobile tabs**: first-word split produced ambiguous "What's"/"What".
  Added explicit `shortLabel` (Hard / Helps / Intel) — `src/pages/Insights.tsx`.
- **Recovery Progress cards**: long patient status sentence in a `shrink-0`
  group crushed the title column on mobile; header now stacks below `sm` —
  `src/pages/RecoveryProgress.tsx`.

### Observations (polish backlog, not defects)
- During choice-audio playback the answer chips are `disabled`; tapping one is
  silently ignored with no "wait" affordance (re-enables after audio).
- Mic-denied "Could not start recording" toast re-fires every trial; candidate
  for once-per-session suppression.

### Guided lesson drive-through (live, 390px, anon) ✅
Plan → session → 3 exercises driven end-to-end with the user.

| Flow | Status | Notes |
|------|--------|-------|
| Session plan screen | ✅ pass | Clinical arc (Warm-up→Core→Stretch→Cool-down), per-block "why", ~15m/6 blocks |
| Maya intro transition | ✅ pass | "Let's warm up…" calm, no celebration |
| Category Fluency | ✅ pass | Auto typing-fallback (no mic), live word validation |
| → validation | ✅ pass | "red" accepted (✓), off-category "table" rejected (✗ strikethrough, not counted) |
| → round/category variety | ✅ pass | foods→colors→clothing, examples + countdown refresh each round |
| → "Done early" + timer | ✅ pass | Advances round; 3-2-1 countdown between rounds |
| Inter-exercise transition | ✅ pass | "That warmed up your word-finding speed…" contextual bridge |
| Describe & Guess | ✅ pass | Purpose banner, cue chips (Use/Where/Looks like), typing fallback |
| → AI guesser + scoring | ✅ pass | Maya guessed sneaker from description; star/target counters increment |
| → Skip path | ✅ pass | Skips trial cleanly through 8/8, then transitions out |
| Detective Mind | ✅ pass | Reading comp, rank progression (Rookie→Junior Detective), +pts |
| → reasoning feedback | ✅ pass | "Case solved" shows explicit why; hint option costs −5 pts |
| → auto-advance cases | ✅ pass | Case 1→2 advances without dead state |

### Fixes applied (presentation-only, engine untouched)
- **Category Fluency clothing label**: tier label `'Clothing'` produced
  ungrammatical "Name as many clothing as you can". Changed to
  `'Clothing Items'` (the `category: 'clothes'` validation key is unchanged) —
  `src/components/CategoryFluencyGame.tsx`.

### Observations (polish backlog, not defects)
- Describe & Guess cue chips vary per trial (2 vs 3 chips); confirm this is the
  intended adaptive cue-fade rather than content gaps.

### Remaining patient routes to drive (need real mic/audio)
Minimal Pairs (audio discrimination) and Narrative Retell (discourse speech) —
best driven live by the user with a real microphone/speakers to exercise the
speech + audio pipelines. Photo Naming already validated standalone.

---

## Phase 2–6
Not started. See `.lovable/plan.md` / initiative plan for scope.

## Phase 1 — Mic/Audio Exercise Sweep (driven live, mobile 390px)

### Minimal Pairs (/exercise/minimal-pairs) — PASS
- Tap-based discrimination; audio is output-only, so **no mic required** for core loop.
- Verified: intro → start, audio replay button, trial counter/progress, answer selection, auto-advance.
- Feedback timing healthy: incorrect 2.4s, correct 1.2s; optional "Say it" echo step has a 9s fallback (no dead state without a mic).

### Narrative Retell (/exercise/narrative-retell) — PASS
- Mic-unavailable path surfaces "Retry" + "Type" plus a clear toast (no dead state).
- Typing fallback: textarea + memory-hint emoji strip; "I'm done" gated until input.
- Structured scoring accurate (4/4 key events, Beginning/Middle/End structure, content checklist, next-step coaching, "You said" echo).
- Flow continuity: advances Story 1→2 of 3 with a tone-aware bridge; progress bar updates.

### Fixed
- **Dev UI Variant Picker overlapped bottom-anchored CTAs** (e.g. "Start Practice") in the fixed mobile-width app frame, blocking taps during QA. Made it a collapsible corner chip (`src/components/dev/UiVariantPicker.tsx`) so it no longer covers content. Dev/preview-only chrome; opt-in on published.

## Phase 2 — Caregiver Sweep (driven live, mobile 390px) — PASS
- `/caregiver` renders the 5 Glance Cards (Status, Practice, Listen, Progress, Game Levels) + Concerns to Review, all with safe, friendly empty states (no dead states, no false-celebration on zero data).
- "More detail" drawer expands to Session Adherence + Session History (empty state) + Quick Actions — matches the single-drawer Glance Card model.
- Quick Actions navigate correctly (verified Upload Photos → /photo-library clean empty state).
- Role switcher dropdown works.
- No real horizontal overflow at 390px (scrollbar in capture was a rendering artifact; content does not shift on horizontal scroll).
- No mic involved anywhere in the caregiver experience.

## Phase 3 — Clinician Sweep (driven live, desktop 1280px) — PASS (2 dead-states fixed)
- `/clinician` Patient Hub renders 5 Glance Cards (Triage/Status "Monitor closely", Practice/Dose 0% adherence shown neutrally, Voice Evidence "No qualifying recordings", Trajectory Plateau/"Insufficient data", Adaptation/Levels "No adaptation data") — all safe empty states, no false celebration.
- Single "Clinical Detail" drawer with 3 jobs-based tabs (Overview / Review / Plan) matches unified-hub spec. Sticky doc bar (Copy Note / Copy EHR / Print) + Documentation link present.
- **FIXED — perpetual skeletons (dead state):** When `profileId` was falsy, the data effects `return`ed early *without* clearing `loading`, so the Sessions section (Overview tab) and Session Review section (Review tab) spun grey skeletons forever.
  - `src/components/patient-hub/SessionsTab.tsx` — early return now sets `setSessions([]); setLoading(false)`. Now shows "No sessions in this time window."
  - `src/components/patient-hub/SessionReviewTab.tsx` — early return now sets `setSessions([]); setSessionsLoading(false)`. Now shows "No completed sessions yet for this patient."
- Audited all remaining patient-hub components with `useState(true)` loading (glance cards, CueResponsePanel, SessionNotesPanel, IntelligenceTab/SummaryHeader/SpeechProfile derived loading) — all already reset loading before early returns. No other dead states found.
- No mic involved anywhere in the clinician experience.

## Phase 1b — Photo Naming live entry (reported: "nothing loads") — FIXED dead state
- Root cause: `usePhotoNamingProgression` load effect did `if (!userId || !profileId) return;` WITHOUT setting `loaded=true`. When `activeProfile?.id` was unavailable (no active patient profile / reached from clinician context / profile not yet resolved), `progression.loaded` stayed false, so PhotoNamingExercise sat on the `ExerciseLoadGate` ("Loading your progress…") forever — blank/stuck screen.
- Fix (`src/hooks/usePhotoNamingProgression.ts`): when ids are absent, set `state=null; setLoaded(true)` so the gate opens with the engine default floor; reset `loaded=false` then load real state once ids resolve (no wrong-floor persistence for real patients).
- Verified other gate (`useCustomPhotoTrials`, RQ v5 `enabled:!!userId`) does NOT hang when disabled (isLoading=false). `loadProgressionState` is already error-safe (returns default). No other infinite-gate paths in this page.

---

## Phase 4 — Admin sweep (code audit) — PASS
- Audited all `Admin*`, `ClusterAnalytics`, `CohortResearchAnalytics`, `ParserAnalytics`
  pages for the dead-state pattern fixed in Phase 3 (`useState(true)` loading
  with early `return` that never resets). Admin react-query pages all use
  `data = []` defaults + `isLoading ?` branches (safe empty/loading states).
  `Admin.tsx` / `ClusterAnalytics.tsx` manual loaders navigate away on no-user
  (no dead state).
- **Hardened** `src/pages/AdminTelemetryAnomalySession.tsx`: `if (!sessionId)
  return;` now also `setLoading(false)` so a missing route param can't leave a
  perpetual skeleton (route param is effectively always present, defensive).

## Phase 5 — Cross-cutting hardening — PASS
### Audit §6 restructure items (verified current state)
- Item 1 (hide Domains tab from patient/caregiver) — **already done**, gated
  `isClinician` in `Dashboard.tsx`.
- Item 2 (gate clinician-only PlanTab components) — **already done**,
  StrokeProfileSummary / BrainMap / StandardizedAssessments all `isClinician`.
- Item 3 (recovery-progress reachable by patient) — **already done**, linked
  from ProgressTab, PatientProgressCard, AppHeader (`/recovery-progress`).
- Items 4–7 reference the **March IA** (PatientModeView, header "Insights"→
  "Outcomes"). Patient IA has since been restructured to `/today` `/practice`
  `/progress` (decision-based design) — stale items, not applied to avoid
  conflicting with current memory rules.
### Accessibility — icon-button labels
- Added `aria-label` (dynamic where stateful) to **47** icon-only buttons that
  had no accessible name, across shared, patient, coach/exercise, and
  clinician/admin surfaces (ThemeToggle + shadcn sidebar already labeled).
  Files: QuickActionFAB, UiModeToggle, AudioPlayback(+WithWaveform),
  ExerciseCarousel, TodaysActivityCard, coach/VoiceInputBar, MayaNarrationCard,
  CategoryFluencyGame, SynonymGeneratorGame, FixSentenceGame,
  ConversationCoachGame, coach probes/overlays/modal host, SessionsTab,
  SessionDetailPanel, SessionSidePanel, ClinicalReviewDashboard,
  ClinicalDocuments, and back buttons on Practice/Progress/SpeechProfile/
  PatientHub/ConversationCoachExercise/SentenceConstructionExercise/
  VoicePractice/SmartCoach/ClinicianReport/CohortResearchAnalytics/
  ProfileVersionHistory/WeeklyPatientReview.

## Phase 6 — Wrap & verify
- Full unit suite green: **1108 passing, 25 skipped, 74 files** after all
  Phase 4/5 edits.
- Engine remained frozen — only presentation/a11y + one defensive load-state fix.
