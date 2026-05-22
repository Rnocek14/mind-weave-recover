# E2E tests (Playwright)

Phase 1A scaffolding. Read-only against the running app.

## Run

```bash
bunx playwright install --with-deps chromium webkit
bunx playwright test
```

## What lives here

- `smoke.spec.ts` — public-route render checks (no auth).

## What does NOT live here

- Anything that mutates clinical state, progression rows, or mastery shadow
  tables. Add a Supabase test project + anon sign-in fixture before
  expanding into authenticated patient/caregiver/clinician journeys.

## Roadmap (per approved plan)

1. Anon-session auth fixture
2. Patient: auth → /today → start Guided lesson → summary
3. Caregiver: photo upload journey
4. Clinician: dashboard → patient hub → add note
5. Admin: pipeline view
