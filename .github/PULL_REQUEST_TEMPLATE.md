## Why this change is needed

## What changes for the user

## Regression risks and coverage

- Changed behavior and adjacent patient/clinician flows:
- Real production functions or journeys exercised by the new tests:
- New or changed game/input mode: start, answer, incorrect/skip, cue, completion, save and reload coverage:
- Known gaps, existing skips, and explicit requirement changes (never weaken tests just to pass):

## Verification

| Check / command | Passed | Failed | Skipped or not run | Scope / reason |
|---|---:|---:|---|---|
| | | | | |

- Baseline differences and regression reproduction:
- Mocked services versus real persistence:
- Tested Git SHA and staging function/schema revision:
- Authenticated therapy and live speech verification on this revision (required before release):
- Real-device follow-up, if speech/audio/accessibility changed:
- Release route, rollback target, and any unprotected manual deployment path:

Public browser checks alone do not verify saving therapy results. Describe any
missing prerequisites explicitly; do not call an unexecuted journey verified.
Use `bun run qa`; before release also follow
[release readiness](../docs/qa/release-readiness.md). A green Regression gate is
not evidence that every game, live service, device, or clinical outcome was tested.
