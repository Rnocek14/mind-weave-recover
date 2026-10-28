# Staging runner repair - 2026-10-28

## What was wrong

The existing hosted verification workflow required three GitHub environment
values which were not configured by the previous setup. It was also absent
from main, so GitHub's default-branch workflow_dispatch requirement prevented
using its ordinary Run workflow button before merging the large draft PR.
The previous speech step followed browser tests in the same job: a browser or
browser-installation failure meant the Azure checks never ran at all.

## Narrow change to public client configuration policy

`tests/e2e/staging-target.public.json` deliberately records ONLY the existing
synthetic-only project's URL, ref and active modern **publishable** key. These
are public application configuration, not user authentication or administrative
credentials. The connector retrieved the active key for this exact branch.
The existing Azure key stays server-side in Supabase; it is not fetched, copied,
printed, put in GitHub, or included in this manifest.

This is a reviewed, narrow exception to the earlier instruction to keep all
E2E configuration out of source. It does NOT permit committing Azure keys,
service-role/secret keys, user access/refresh tokens, passwords or patient data.
Supabase documents publishable keys as suitable for client code and GitHub
Actions. A publishable key still requires user authentication and RLS for
protected data. The test services' real authentication is unchanged.

The new offline setup script fills the existing E2E variables from that reviewed
manifest. It reuses the original environment guard unchanged, then additionally
restricts this hosted runner to `stdiuaxigqttgdwiwbtp` only. Complete explicit
GitHub overrides remain compatible, but partial configuration, production,
other hosted projects, privileged keys and environment-file injection fail
before any test starts. Changing the staging project requires a reviewed code
change. An invalid/rotated publishable key will fail real authentication; setup
validation must not be interpreted as verification of the live key.

## Starting the run without merging PR #76

The owner can use **Ready for review** on draft PR #76. The
`pull_request: ready_for_review` event starts this workflow on the PR's exact
head commit. It only admits same-repository PRs started by the repository
owner. It does not merge, deploy, or alter production. It deliberately does
NOT run on each draft push. After a later commit, start a new reviewed run on
that revision; rerunning an old Actions run only retests its old revision.
The workflow retains `workflow_dispatch` and `workflow_call` for use after its
normal merge. Normal CI remains the mandatory deterministic regression check.

The named `neurospark-e2e` GitHub environment is retained. Any environment
reviewer or deployment-branch protections still apply and are not bypassed.
Referencing an environment is NOT evidence that approval protections were
configured. Owner-started review is a test trigger, not release approval.
No additional GitHub secret entry is necessary for the reviewed public default.
If previous partial overrides exist, correct/remove them; do not silently mix
one project's origin with another project's key.

## Evidence and boundaries

Speech and authenticated therapy now have separate jobs, so browser-installation
failure cannot hide the speech result. Both are required by the final
**Isolated therapy gate**. The speech job runs the existing bounded verifier:
two approved synthetic recordings times two endpoints, at most four checks.
It retains the verifier's real JSON report and exit status. Therapy keeps its
existing mandatory persistence journey and strict no-skip/no-retry reporting.
No test assertions or clinical rules are weakened by this setup change.

Artifacts include the exact checkout revision, offline setup status, and
sanitized result summaries. Raw authenticated browser traces/HTML reports are
not uploaded because they can contain session credentials. Synthetic users
remain in staging after sign-out; the existing verifier does not delete them.
Do not treat these artifacts as proof of whole-app coverage or clinical value.

The last observed staging speech bundle hashes corresponded to the candidate
speech source from b2f16a6d1c4b6d98dafe264026bb3686c653756b. These runner changes
do not change those functions. Hosted source parity must still be rechecked
when backend code/deployments change; an app checkout is not backend attestation.

## This repair's execution boundary

The database-driven HTTP attempt was previously blocked by this chat's tool
controls. It was not repeated or routed through another tool by this repair.
The new live workflow was NOT started from this chat. The owner must explicitly
start the prepared GitHub run. No secrets, user sessions, provider requests,
patient data, Supabase settings or deployments were changed here.

Local Node tests exercise the actual setup script, the existing environment
and browser guards, and writing to a temporary GitHub environment file.
Workflow-wiring assertions inspect the real workflow text; they do not claim to
be live GitHub execution. The ordinary CI run independently checks the changed
files and existing deterministic application suites. Actual live Azure and
hosted persistence remain NOT RUN until the owner-started workflow executes.

References:
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request
- https://supabase.com/docs/guides/getting-started/api-keys
