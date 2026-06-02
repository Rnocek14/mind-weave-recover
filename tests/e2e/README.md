# E2E tests (Playwright)

Phase 1A scaffolding. Read-only against the running app.

## Run

```bash
bunx playwright install --with-deps chromium webkit
bunx playwright test
```

## What lives here

- `smoke.spec.ts` — public-route render checks (no auth).
- `fixtures/anonSession.ts` — mints a real Supabase anonymous session and
  injects it into localStorage so specs boot signed in (no test credentials).
- `pass-b-patient-journey.spec.ts` — authenticated patient routes used by the
  stroke-archetype Pass B walkthrough; read-only (navigate + assert only).

## What does NOT live here

- Anything that mutates clinical state, progression rows, or mastery shadow
  tables. The anon fixture's only side effect is a disposable anonymous auth
  user (sanctioned by the plan); specs never submit answers or write progression.

## Roadmap (per approved plan)

1. ~~Anon-session auth fixture~~ ✅ `fixtures/anonSession.ts`
2. ~~Patient: auth → /today → exercise routes~~ ✅ `pass-b-patient-journey.spec.ts` (Guided-lesson + summary steps still to add)
3. Caregiver: photo upload journey
4. Clinician: dashboard → patient hub → add note
5. Admin: pipeline view
