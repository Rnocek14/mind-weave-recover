# NeuroSpark whole-app patient, clinician and visual acceptance matrix

**Status:** Working hospital-readiness audit checklist, not a certification.
**Audit branch:** `audit/comprehensive-neurospark-2026-10-28` (draft PR #77).
**Rule:** No merge, publishing, clinical sign-off or real patient testing based only on a green CI run.

## Evidence labels

Use one status per journey: **PASS** (executed on exact revision + named
backend/device), **FAIL** (repro with test artifact), **BLOCKED** (prerequisite
unavailable), **NOT RUN** (no evidence), or **SOURCE REVIEW** (code inspected,
not proven in a running system). Never turn source review or a page-load smoke
test into "full game passed."

## Release-blocking patient journeys

| Surface | Required actual journey | Minimum saved evidence | Audit status |
|---|---|---|---|
| New patient / anonymous auth | Sign in, choose patient, enter Today, begin practice, resume after interruption | Correct user and profile id, no accidental duplicate session | **NOT RUN end-to-end across devices** |
| Guided/coach mode | Plan -> Maya prompt -> exercise -> recap -> next block -> finished lesson | One verified trial per attempt, session id continuity, parent receives completion once | **NOT RUN full lesson** |
| Photo Naming | Independent, cue, wrong, skip, no voice, interrupted voice, completion | Scorable validity, accurate mode/cue, stable attempt id, summary and clinician row | **NOT RUN full mode matrix** |
| Phrase Practice | Speech success/uncertain/ASR error, replay and retry | Transcript provenance, measured pauses, response-mode and no fabricated ASR score | **NOT RUN full mode matrix** |
| Two Clues | Voice failure, hints, anchor, final trial, save fail/retry, guided lesson | Exact session/profile, unique attempts, raw recovery and verified close | **SOURCE REVIEW + component tests; full isolated game not run** |
| Fix the Sentence | Partial credit, recognized whole sentence, false negative, cue, save fail/retry | Original response, validity, progression, session close, review/summary | **NOT RUN full completion flow** |
| Minimal Pairs | Listening choices, false choice, cue, completion, retry, lesson | Recognition-only mode, no ASR invented, saved result and closing summary | **NOT RUN full completion flow** |
| Meaning Match | Correct, wrong, hint, finish, ambiguous lost ACK, retry, reload, cross-user API rejection | Two real events, unique IDs, cue, 50% summary, no duplicate on retry | **PASS isolated staging on PR #77 prior revision; revalidate on candidate** |
| Category Fluency | Voice-on/off, words/timing, zero-word round, final save failure | Each round once, lexical axis, proper unique-word count, coach recap only after save | **SOURCE REVIEW + component tests; full isolated game not run** |
| Synonym Generator | Correct/incorrect/no response, round rollover, save fail/retry | One row per round, valid score, no duplicate progression | **SOURCE REVIEW + component tests; full isolated game not run** |
| Detective Mind | Read/listen/explain, option feedback, hint, offline, final save fail | Recognition mode, no pseudo ASR, offline explicitly unsaved, closure verified | **SOURCE REVIEW + component tests; full isolated game not run** |
| Describe & Guess | Meaning vs word wins, hints/prompts, mic denial, save fail/retry | Cue provenance, both win axes, trial identity and close | **SOURCE REVIEW + component tests; full isolated game not run** |
| Narrative Retell | Story playback, response, silence, cue, completion | Original transcript and per-trial measures, no false success | **NOT RUN full completion flow** |
| Phonological | Sound discrimination/production, model, replay, completion | Distinct listening/production modes, cue and accuracy provenance | **NOT RUN full completion flow** |
| Abstract Compare | Speech/no-response, hints and final session | Per-trial validity and save confirmation | **NOT RUN full completion flow** |
| Dual Load Naming | Concurrent cognitive/motor load, timeouts, finish | Actual load and latency attribution, saved progression | **NOT RUN full completion flow** |
| Multi-Step Plan | Correct/wrong/skip and sequenced completion | Step order, response mode, verified close | **NOT RUN full completion flow** |
| Thought Continuation | Open-ended speech, pauses, off-topic, finish | Actual language, measured timing, no fabricated classification | **NOT RUN full completion flow** |
| Conversation Partner / Coach | Guided dialogue, pauses, safety fallback, finish | Turn-level evidence separate from accuracy denominator | **NOT RUN full completion flow** |

Also review currently enabled Feed the Monster, Functional Scenes, Pattern Match,
Semantic Features, Sentence Construction and other catalog entries; routing and
implementation registry must be inventoried before claiming 100% game coverage.

## Clinical evidence trail: one attempt must reconcile everywhere

1. **Capture:** the patient actually spoke/tapped/typed/skipped; permissions,
   silence, background speech, interruption and audio-source state recorded.
2. **Interpretation:** ASR transcript, task classification, selected answer,
   cues, validity label, and reaction time retain their original source/mode.
3. **Persistence:** `exercise_events.attempt_id` stable and unique; exactly one
   row in the authorized session/profile, read back under the patient identity.
   Lost acknowledgements must reconcile before retry and not duplicate rows.
4. **Progression/mastery:** only valid eligible modes feed their respective
   ladders, exactly once, after confirmed raw events; no cross-axis contamination.
5. **Session summary:** `scored_trials`, `accuracy`,
   `independent_accuracy`, `cue_assisted_accuracy`, `practice_accuracy`,
   `asr_accuracy`, `asr_scored_trials` reconcile with the canonical reducer.
   **ASR accuracy is task correctness of ASR-evidenced attempts, not WER.**
   A missing measurement is null/unknown, never silently 0.
6. **Patient/caregiver/clinician:** history, trend, caseload, report, CSV/print
   present matching date windows, denominators, clinical modes, cue provenance,
   response times and missing-evidence warnings. No silent truncated queries.
7. **Permissions:** wrong patient, unassigned clinician/caregiver, signed-out,
   audio URL and cross-user REST access are denied by RLS and server controls;
   UI mode toggles are not authorization.
8. **Longitudinal review:** after logout, reload, reauthentication and a new
   session, no duplicate or cross-patient results; historical limitations noted.

## Clinician metric definition and visual requirements

- **Task accuracy:** mean of canonically scorable persisted exercise scores,
  shown with eligible attempt count; **not speech recognition quality**.
- **Independent vs cue-assisted accuracy:** separate denominators and true
  `cue_level` evidence, not inferred from a generic positive score.
- **ASR-scored task accuracy:** only valid speech with actual transcript and
  ASR eligibility; distinguish missing audio, denied mic, noise, and manual
  confirmation. Never label it WER or phoneme-recognition precision.
- **Trend:** compare observed comparable practice periods with actual trial
  counts; empty days are not 0%-accuracy days. Insufficient comparison yields
  "Building baseline", not improving/declining.
- **Dose/adherence:** unique actual practice days and duration from verified
  sessions or dose logs, with timezone and row-cap checks; no made-up minutes.
- **Clinical report:** selected patient visibly identified, 7-day window and
  generated time correct, source and denominators transparent; 0% is displayed
  as **0%** while unmeasured is **—**. Printed/exported values must match UI.
- **Caseload:** loading/error/empty states distinct; failed or incomplete
  queries cannot display stale or default-zero patient metrics. Review alert
  ordering, assignment access, search/filter correctness and list performance.
- **Trend/accuracy/clinical predictions:** any recommendation or flag must have
  traceable evidence and must state uncertainty and limitations. Clinical
  thresholds and classifications require explicit SLP review.

## Visual, accessibility and usability acceptance

For each primary patient, caregiver, clinician and admin route capture a
**mobile ~390 x 844** and **desktop ~1280 x 800** screenshot and check:

- Readable at 200% zoom; no horizontal overflow, clipped CTAs, overlapping
  panels, broken scroll containers, tiny chart labels or obstructed controls.
- One visually dominant primary action per patient task; buttons at least
  **56px** high for critical start/retry/continue actions when practical.
  Therapy instructions playable aloud with few words and no required reading
  for severe aphasia; do not make a patient debug the app.
- Touch, focus, screen reader labels, live save status and error alert; no
  misleading "complete" animations before verified persistence.
- Safe no-mic, no-audio, browser permission denied, offline, app background,
  device lock, Bluetooth changes, interruption, reload and lost-ACK handling.
- Clinician charts: clear units, sample size, legend, evidence period, null vs
  zero states, accessible table/CSV alternative and mobile card layout.
- Patient/clinician content: no internal debug indicators, fabricated scores,
  ambiguous modality badges, stale patient names or leaked identifiers.
- Physical **iPhone Safari**, Android Chrome, and desktop mic/headset tests
  required in addition to synthetic Playwright WAV input.

## Verification and gate policy

- Baseline and focused tests: `bun run test -- <test-file>`; broader checks:
  `bun run qa`. Build/type/lint and public/synthetic-microphone coverage
  must succeed on the candidate revision with 0 skipped/failed/retried cases.
- Isolated persistence: `bun run test:e2e:staging` with explicit guarded
  `E2E_SUPABASE_*` settings; separate *completed-game* tests per enabled mode,
  not only signed-in route entry. Read-back, reload and wrong-user rejection.
- Live speech/handler checks: use only dedicated nonproduction keys, synthetic
  audio, exact function version; physical device and SLP validation remain
  separate. Respect consent and patient data retention.
- Security: issue #80, privileged functions, RLS, role assignment, audio URLs.
- Deployment: main ruleset, GitHub Pages, Lovable/manual publish and Supabase
  function paths must each have effective gates, tested rollback and postdeploy
  synthetic smoke. Document who can bypass and verify deny-by-default.

## Priority backlog and ownership

- **P0:** False completion, unconfirmed raw data, unauthorized access, cross-
  profile data, fabricated clinical metrics, offline uploads, unsafe speech
  classification and release bypass.
- **P1:** Broken full-session navigation, mic/voice fallback, clinician report
  reconciliation, failure recovery, inaccessible primary control, stale data.
- **P2:** Mobile overflow, visual hierarchy, spacing, polish, nonessential
  animations and wording.

Record each test's exact PR SHA, command, fixture, backend, device, screenshots,
logs, count, limitations, reviewer and status. A status remains **NOT RUN**
until the actual journey is executed. Whole-app and clinical sign-off is blocked
until every P0/P1 path has appropriate executed evidence and reviewed gaps.
