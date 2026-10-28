# Isolated database verification

## Status — 2026-10-28

A disposable native Supabase instance now contains all **171 repository
migrations**. Eight historical data backfills were guarded so a fresh database
does not need copies of pre-existing named users or profiles. The remaining
163 migration files are unchanged. The database migration history contains all
171 expected versions; a separate SHA-256 manifest identifies the exact
reviewed source files that were replayed.

The final authenticated browser run passed **all 14 cases**, with zero failures,
skips, unrun cases, retries, or flaky results. Both browsers verified real
database persistence and reload of each accepted chip answer's timing and
ownership. The first run's two onboarding-fixture failures and the correction
are retained below; schema replay alone is not counted as application-level
persistence verification. The named local stack was stopped after its final
safety audit, with its disposable state and evidence preserved.

This work used local repository schema and synthetic/demo fixtures only. It did
not connect to a hosted database, copy patient data, create a hosted project,
deploy functions, or change production migration history. It extends the
evidence in [response-time verification](./response-time-verification.md) and
[speech analysis verification](./speech-analysis-verification.md).

## Native runtime and isolation

Docker was unavailable in this environment. The official Supabase CLI's
experimental native runtime was used for one disposable local project. The
CLI archive's published SHA-256 was verified, and the foreground install
downloaded and verified all 12 pinned service archives.

| Component | Observed version |
|---|---|
| Supabase CLI | 2.122.0 |
| PostgreSQL | 17.11; service artifact `17.11.0.006-r0` |
| Auth | 2.197.0 |
| PostgREST | 16.5 |
| Storage | 1.84.19 |

All instance state is under the task-specific
`SUPABASE_HOME=/tmp/neurospark-local-test-backend/home`. The existing `vscode`
account, UID/GID 1000, runs PostgreSQL; the pinned CLI rejects `nobody`. No OS
account was created. Native sockets use `/tmp/supabase-0`.

The API and database listeners were verified on `127.0.0.1:54321` and
`127.0.0.1:54322`. Auth, anonymous sign-in, PostgREST, and Storage are enabled.
Realtime, Functions, Studio, mail, analytics, and the pooler are excluded.
Automatic migration and seed execution were disabled during initial startup
so the SQL could be inspected and replayed only after the cron safety check.
No Azure configuration was provided.

The bootstrap wrapper keeps only normal runtime/proxy/certificate environment
variables and sets the isolated runtime settings. It does not inherit the
application's Supabase or Azure credentials. Generated local connection values
are kept in a mode-0600 `runtime.env`; their contents are not part of this
report or source control.

Native processes share host resources and do not provide container network
isolation. These observations apply to this verified local instance, not to a
hosted branch or another machine. The runtime remains experimental; refer to
the [official native-runtime guide](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes)
when reproducing the setup with another CLI version.

## Why the historical guards were necessary

The original replay stopped after 53 committed migrations because an admin
backfill unconditionally referenced an auth UUID absent from the empty local
database. Three direct executions of the original admin statements produced
the expected foreign-key failures. The same three statements with presence
guards succeeded and created zero auth users and zero role grants.

The resumed replay then stopped after 78 committed migrations at a historical
achievement INSERT that also assumed a named profile existed. Five further
guards addressed that dependency class. The final replay applied all 171
migrations; none was skipped, and no replacement user or profile was inserted
to satisfy a foreign key.

### Eight reviewed changes

| Migration prefix | Guard and preserved behavior |
|---|---|
| `20251217163505` | Insert the original admin role only if its exact original auth UUID exists. Retain the original lack of `ON CONFLICT`. |
| `20260225170256` | Run the original achievements INSERT only when the exact original auth account owns the exact original profile. Preserve its values and conflict clause. |
| `20260322042831` | Guard the four original daily-readiness, dose-log, alert, and cognitive-score INSERTs with the same exact account/profile ownership check. Both clinical UPDATEs remain unchanged. |
| `20260409220521` | Guard each original profile's four recovery snapshots and two goals independently. Retain all 12 snapshot tuples and six goal tuples, their order and values, all clinical UPDATEs, and the original lack of `ON CONFLICT`. |
| `20260601220542` | Insert the original admin role only if its original auth UUID exists; retain `ON CONFLICT (user_id, role) DO NOTHING`. |
| `20260601221442` | Guard only the original admin INSERT. Preserve the entire `handle_new_user()` function and the INSERT's conflict clause. |
| `20260917210840` | Insert the original admin role only if its original auth UUID exists; retain its conflict clause. |
| `20261006150703` | Insert the original admin role only if its original auth UUID exists; retain its conflict clause. |

When an original account/profile pair is present with the expected ownership,
its original inserted values and conflict behavior remain unchanged. April's
independent guards allow an existing original profile to receive its own rows
even if the other two original profiles are absent. Missing accounts, missing
profiles, or mismatched ownership do not select substitutes. The original
assignment migration was not changed.

An independent source-and-diff review confirmed these invariants. The positive
named-account and partial-profile cases were **not executed**: no named users
were fabricated to make those cases pass. The executable evidence consists of
three original failures, three corrected successes, the achievement replay
failure, and the complete corrected replay with the named prerequisites absent.
Do not describe static ownership review as a database test of every ownership
permutation.

## Scheduler and data safety

One repository migration schedules a request to a hard-coded hosted function
URL. Before any repository SQL was replayed, the empty local database was
verified to have zero public tables and zero auth users. Using only its local
administrative connection, the setup disabled cron execution:

```sql
ALTER SYSTEM SET cron.launch_active_jobs = 'off';
SELECT pg_reload_conf();
```

A fresh connection confirmed the effective value was `off`, from the
configuration file, with no pending restart. This gate was rechecked before
each replay. After the final replay, both scheduled jobs were explicitly
deactivated. The local prevention setting must be retained; resetting or
recreating the database would require this safety sequence again.

The final **pre-authentication** audit recorded:

| Observation | Count/state |
|---|---|
| Applied repository migrations | 171 |
| Existing repository demo seed users | 2, non-anonymous |
| Profiles and role grants created by those seeds | 2 profiles; 2 role grants; 0 admin grants |
| Anonymous E2E users | 0 |
| Named historical backfill data | 0 achievements, readiness rows, dose logs, alerts, cognitive scores, recovery snapshots, goals, or assignments |
| Therapy records | 0 sessions, exercise events, or utterance rows |
| Scheduled jobs | 2 total; 0 active |
| Cron execution | Off; 0 job executions; 0 job workers; no pending restart |
| Outbound HTTP queue/history | 0 queued requests; 0 responses |

The two demo accounts came from the repository's existing migrations, not from
newly invented replacements for the named historical accounts. Their identities
and credentials are deliberately omitted. Fresh anonymous users created by
the browser suite must be counted separately from those two seed accounts.

## Commands and evidence

The following records the commands used with this task's temporary wrapper;
these wrapper files are local evidence, not installed repository commands or
a portable bootstrap script:

```bash
python3 /tmp/neurospark-local-test-backend/run-supabase.py stack install --runtime native
python3 /tmp/neurospark-local-test-backend/run-supabase.py stack start --runtime native --stack neurospark-empty --exclude realtime,functions,studio,mail,analytics,pooler --preparation on-demand --eager
python3 /tmp/neurospark-local-test-backend/run-supabase.py migration up --db-url "$LOCAL_DATABASE_URL"
python3 /tmp/neurospark-local-test-backend/preflight-local-backend.py
```

`LOCAL_DATABASE_URL` refers only to the verified local `postgres` migration
role. Its value is omitted. The local `supabase_admin` role was used separately
for the cron setting and audits. The wrapper runs from an empty temporary
project containing the copied migration files and isolated config, not the
repository's production configuration. Replay uses the official migration
command, applies migrations transactionally, and stops on errors.

The authenticated runner parses `runtime.env` as data, selects only the local
API URL and publishable key, clears inherited E2E/Supabase/Azure settings,
requires the exact loopback origin, and sets `REQUIRE_THERAPY_E2E=true`.
The browser suite uses the local publishable key and each anonymous user's
session, not the local administrative connection or a service-role key.

Both the local database safety preflight and the repository's
`test:e2e:check-env` passed before the selected run:

```bash
python3 /tmp/run-neurospark-isolated-tests.py test:e2e:check-env
python3 /tmp/run-neurospark-isolated-tests.py test:e2e:staging --workers=2 --retries=0
```

The corresponding durable repository commands are `bun run test:e2e:check-env`
and `bun run test:e2e:staging --workers=2 --retries=0`, after supplying the
explicit isolated `E2E_SUPABASE_URL`, `E2E_SUPABASE_PUBLISHABLE_KEY`, and
`E2E_SUPABASE_PROJECT_REF` settings. The origin/project/key guards, fresh app
build, production-reference bundle check, and browser request guards remain
enabled. See [browser testing instructions](../../tests/e2e/README.md).

Sanitized setup evidence is in `/tmp/neurospark-local-test-backend/`:

- `native-setup-record.md` and `local-listener-auth-audit.json` record the
  pinned setup and loopback/auth checks.
- `named-account-backfill-regression.json` records the six direct SQL cases.
- `additional-backfill-guard-invariants.json` records the preserved SQL
  invariants; it is source-review evidence.
- `applied-migration-manifest-final.json` records the 171 replayed source files
  and their reviewed hashes; the database history independently confirms the
  expected applied versions.
- `migration-final-preflight.json` and `migration-final-postflight.json`
  record the scheduler and database audit.

These task-local files are transient. The eight reviewed SQL changes and this
report are the durable repository record. The initial authenticated-run log is
`/tmp/neurospark-local-authenticated-e2e.log`; the final run is retained in
`/tmp/neurospark-local-authenticated-e2e-final.log`. The selected suite also
writes `test-results/e2e-summary.json` and `playwright-report/`.

## Authenticated browser outcome and remaining boundaries

The first complete run selected 14 cases across Chromium desktop and mobile
WebKit, with two workers and retries disabled. It finished in 42.1 seconds:

| First authenticated run | Result |
|---|---|
| Passed | 12 |
| Failed | 2 |
| Skipped / not run | 0 / 0 |
| Retries / flaky results | 0 / 0 |

The three-trial ownership/persistence/reload core loop passed in both browsers,
as did the pause/resume and four exercise-route cases. Both failures were the
fresh-user `/today` case: a new anonymous user correctly reached `/welcome`,
but the test assumed onboarding was already complete. The test was corrected
to use the actual Welcome screen's **Skip for now** action and then
require the exact `/today` route and home content. Completing onboarding writes
the normal synthetic profile state; this is not a read-only navigation check.
The correction changes no product route or database policy and does not bypass
onboarding through direct database writes.

The retained first-run summary is
`/tmp/neurospark-authenticated-before-onboarding-fix/e2e-summary.json`.
The initial two failures remain part of the record even though the persistence
cases passed independently.

The read-only audit after that first run counted 14 anonymous test users in
addition to the two unchanged repository seed users, 10 sessions, six exercise
events, and six utterance-analysis rows. All six utterance rows had the exact
response-timing version/basis and a finite nonnegative numeric duration; none
had missing or invalid metadata. This was an aggregate observation, not yet
a browser assertion matching each utterance to its accepted answer. The audit
selected no row identifiers, transcripts, timing values, or credentials.
Cron remained off; both jobs were inactive, and job executions, job workers,
HTTP queued requests/responses, and admin grants remained zero. The sanitized
record is `postflight-initial-e2e.json` in the task evidence directory.

### Final complete run

The same complete 14-case suite then passed in **38.8 seconds**, with two
workers and retries disabled:

| Final authenticated run | Result |
|---|---|
| Passed | 14 |
| Failed | 0 |
| Skipped / not run | 0 / 0 |
| Retries / flaky results | 0 / 0 |
| E2E type check | Passed |

The final core-loop cases also strengthened the actual database read-back.
For each fresh user, the browser answers three Photo Naming trials through
the real chip UI and requires exactly three distinct exercise events and
three utterance-analysis rows. Every utterance must match its event's attempt,
trial, session, and user ownership. Its `audio_meta.responseTiming` must contain
literal version `1`, basis `trial_start_to_answer_acceptance`, and a finite
nonnegative `elapsedMs` equal to that event's `reaction_time_ms`. The same
selected fields must remain unchanged after reload. Both Chromium desktop
and mobile WebKit passed these assertions.

### Final safety audit and shutdown

Across the initial and final runs combined, the local database contained
28 anonymous test users plus the two unchanged repository seed accounts,
20 sessions, 12 exercise events, and 12 utterance-analysis rows. All 12 Photo
Naming utterances had valid response-timing metadata; none had missing or
invalid metadata. These are cumulative database totals, not additional browser
test cases.

The final audit still found 171 applied migrations, zero admin grants, cron
execution disabled, two inactive jobs, and zero job executions, job workers,
HTTP queued requests, or HTTP responses. The named instance was then stopped:

```bash
python3 /tmp/neurospark-local-test-backend/run-supabase.py stack stop --stack neurospark-empty
```

Shutdown succeeded, and ports 54321 and 54322 were verified to have no listeners.
No database reset or destruction was performed; the isolated synthetic state
and evidence were preserved. `postflight-final-e2e.json` and
`local-stack-stop-audit.json` retain these sanitized observations in the task
evidence directory. Restarting the instance for another run requires checking
its loopback listeners and scheduler safety again.

### What the completed run proves

The suite therefore verifies real anonymous sign-in, authenticated patient
routes, the actual pause/resume control, and persistence/reload of the tested
accepted-tap timing contract and ownership. Its transport uses the local
Auth/PostgREST/PostgreSQL services. This is separate from browser tests that
supply controlled HTTP responses. It does not establish persistence of speech
provider measurements or every possible game/input path.

This passing run does not verify Azure speech services, physical microphones,
native speech-recognition accuracy, clinician authorization coverage, all RLS
policies, or clinical efficacy. Functions are disabled in this local setup and
Azure credentials are unavailable. The four bounded deployed speech checks
remain **not run**. The verified timing is the application's accepted-answer
interval, not acoustic onset, physiological reaction time, or a clinical
recovery measurement.
