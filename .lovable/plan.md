
## Goal

Make the clinician experience match how clinicians actually think (Triage → Review → Decide), and stop leaking dev/admin surface area into the product feel.

Two changes, both surgical, no clinical engine touched.

---

## Part 1 — Clinician Patient Hub: 5 inner tabs → 3 jobs

### Current (Patient Hub "Clinical Detail" drawer)

```text
Sessions | Review | Speech | Patient | Intel
```

Five tabs = analysis-organized, not job-organized.

### New structure (jobs-to-be-done)

```text
Overview  |  Review  |  Plan
```

| Tab | Clinician's Job | What lives here (consolidated from existing components) |
|---|---|---|
| **Overview** | "Should I worry? What's the picture?" | `SessionsTab` (recent session timeline + accuracy trend) + `IntelligenceTab` summary cards (learning rates, cohort comparison, predictions). Intel becomes a section inside Overview, not a separate tab. |
| **Review** | "What actually happened? What does it sound like?" | `SessionReviewTab` (summary strip, voice clips, error breakdown, cue response) + `SpeechProfileTab` (pronunciation patterns, struggling phonemes, fade trajectory). Same mental task: listen to the patient, look at errors. |
| **Plan** | "What do I do next?" | `PatientInfoTab` (profile, goals, deficits) + clinical notes + functional check-ins + recovery alerts to acknowledge. The "decision" surface. |

The 5 Glance Cards above the drawer stay exactly as they are — they already serve the triage job at the top of the page. Sticky documentation bar (Copy Note / EHR / Print) stays.

### Files touched

- `src/pages/PatientHub.tsx` — replace the 5-tab `TabsList` with 3 tabs; render existing tab components inside sections of the new tabs (no component rewrites). Update `defaultValue` and `activeTab` mapping (e.g. when `ProfileCompletenessBanner` calls `setActiveTab("patient")`, route it to the new "plan" tab id).

No new components. No data hooks rewritten. Existing tab components (`SessionsTab`, `IntelligenceTab`, `SessionReviewTab`, `SpeechProfileTab`, `PatientInfoTab`) are composed into the 3 new tabs as stacked sections with light section headers.

### Memory updates

- Update `mem://architecture/unified-patient-hub` from "4-tab clinician architecture" to "3-tab jobs-based architecture (Overview / Review / Plan)".
- Add a new memory `mem://design/clinician-jobs-based-tabs` describing the rule: never reorganize clinician tabs by data-source again; always by clinician job.

---

## Part 2 — Hide dev/admin routes behind a single gated shell

### The problem

These routes currently sit at the top level alongside product routes, and `/admin/cohort-research` is even linked from the Patient Hub header:

```text
/admin, /admin/pipeline, /admin/analytics, /admin/research-export,
/admin/outcomes-validation, /admin/engine-simulation, /admin/alerts,
/admin/overrides, /admin/adaptations, /admin/success-band,
/admin/voice-analytics, /admin/cohort-research, /admin/shadow-analytics,
/analytics/cluster, /clinician/telemetry,
/dev/adaptation-sim, /dev/session-replay, /dev/signal-harness,
/smart-coach-lab
```

Even though most are gated by `AdminProtectedRoute`, they pollute the navigation surface and the product's mental model.

### Fix

1. **Single index page** at `/admin` becomes the only admin entry point — a categorized hub:
   - **Clinical Ops** — Cohort Research, Alerts Rollup, Override Audit, Outcomes Validation
   - **Engine & QA** — Engine Simulation, Adaptation Stream, Success Band, Shadow Analytics, Adaptation Sim, Session Replay, Signal Harness
   - **Voice & Analytics** — Voice Analytics, Parser Analytics, Cluster Analytics, Smart Coach Lab
   - **Data** — Research Export, Pipeline, Telemetry

2. **Routes stay where they are** (no broken bookmarks) but every admin/dev route gets wrapped in `AdminProtectedRoute` (a few currently aren't — `/admin/cohort-research`, `/admin/pipeline`, `/dev/*`, `/smart-coach-lab`). This closes the leak in one pass.

3. **Remove the inline "Cohort" button** from `PatientHub.tsx` header. Clinicians who need cohort go through `/admin`. (Or keep it but only render it when `useUserPermissions().isAdmin` is true — preferred, since power-users do use it daily.)

4. **No URL changes** — preserves any existing links/bookmarks.

### Files touched

- `src/pages/Admin.tsx` — redesign as a categorized launcher page (cards grouped by section, links to each subroute).
- `src/App.tsx` — wrap currently-unwrapped admin/dev routes in `AdminProtectedRoute`. No path changes.
- `src/pages/PatientHub.tsx` — gate the "Cohort" header button on admin role (or remove it).

---

## Out of scope (explicitly)

- No changes to Patient/Caregiver navigation — patient side is the right floor (per the design read).
- No clinical engine, scorer, adaptation, or speech changes.
- No new tabs, no 6th glance card, no marketing/landing changes.
- No "signature wow moment" yet — deferred per your choice.
- No URL renames or redirects beyond what already exists.

## Risk

Very low. This is a UI restructuring + a security tightening (wrapping unprotected admin routes). Existing tab components are reused as-is. If anything breaks, it'd be the deep-link `setActiveTab("patient")` from `ProfileCompletenessBanner`, which the plan explicitly remaps.

## Definition of done

- Patient Hub drawer shows exactly 3 tabs: Overview, Review, Plan.
- All existing data still reachable, just regrouped.
- `/admin` is a clean categorized hub; every admin/dev route is gated.
- No admin/dev links visible to non-admin clinicians anywhere in the product UI.
- Memory updated to reflect 3-tab jobs-based model.
