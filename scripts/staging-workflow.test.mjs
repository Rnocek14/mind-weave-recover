/** Wiring assertions only: these do not execute or validate the hosted services. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const workflow = readFileSync(new URL('../.github/workflows/therapy-e2e.yml', import.meta.url), 'utf8');
const job = name => workflow.split(`\n  ${name}:\n`)[1]?.split(/\n  [a-z]+:\n/)[0] ?? '';

test('review-ready event can start the draft-branch workflow without merging', () => {
  assert.match(workflow, /pull_request:\s+branches: \[main\]\s+types: \[ready_for_review\]/);
  assert.doesNotMatch(workflow, /pull_request_target:|\n  push:|\n  schedule:/);
});
test('both live jobs reject fork PRs and non-owner review-ready actions', () => {
  for (const name of ['speech', 'therapy']) {
    assert.match(job(name), /github.actor == 'Rnocek14'/);
    assert.match(job(name), /head.repo.full_name == github.repository/);
    assert.match(job(name), /github.event.pull_request.draft == false/);
  }
});
test('both jobs keep the named GitHub environment and pin checkout identity', () => {
  for (const name of ['speech', 'therapy']) {
    assert.match(job(name), /environment: neurospark-e2e/);
    assert.match(job(name), /ref: \$\{\{ github.event.pull_request.head.sha \|\| github.sha \}\}/);
    assert.match(job(name), /persist-credentials: false/);
    assert.match(job(name), /git rev-parse HEAD > qa-evidence\/candidate-revision.txt/);
  }
});
test('each live job configures staging before dependencies, browsers or services', () => {
  for (const name of ['speech', 'therapy']) {
    const content = job(name);
    assert.ok(content.indexOf('staging-runner-config.mjs --github-env') >= 0);
    assert.ok(content.indexOf('staging-runner-config.mjs --github-env') < content.indexOf('bun install --frozen-lockfile'));
  }
});
test('speech checks are independent of browser installation and browser outcome', () => {
  assert.doesNotMatch(job('speech'), /needs:|playwright install/);
  assert.match(job('speech'), /node scripts\/verify-speech-services.mjs --run \| tee qa-evidence\/speech-services.json/);
  assert.match(job('speech'), /set -o pipefail/);
});
test('artifact uploads exclude browser traces, session state and all-file globs', () => {
  assert.doesNotMatch(workflow, /path: \|\s+playwright-report|\n\s+test-results\s*\n|storageState|\.env|\*\*/);
  assert.match(workflow, /qa-evidence\/speech-services.json/);
  assert.match(workflow, /test-results\/e2e-summary.json/);
});
test('a real failure cannot become successful workflow completion', () => {
  assert.match(job('gate'), /if: always\(\)/);
  assert.match(job('gate'), /needs: \[speech, therapy\]/);
  assert.match(job('gate'), /node scripts\/qa-gates.mjs speech therapy/);
  assert.doesNotMatch(workflow, /continue-on-error: true|\|\| true/);
});
test('staging runs serialize without cancelling a run halfway through cleanup', () => {
  assert.match(workflow, /group: neurospark-isolated-staging-stdiuaxigqttgdwiwbtp/);
  assert.match(workflow, /cancel-in-progress: false/);
});
test('optional public-client overrides do not require copying Azure or privileged keys', () => {
  assert.match(workflow, /E2E_SUPABASE_URL:\s+required: false/);
  assert.match(workflow, /E2E_SUPABASE_PUBLISHABLE_KEY:\s+required: false/);
  assert.doesNotMatch(workflow, /secrets\.(AZURE|SUPABASE_SERVICE_ROLE|SUPABASE_ACCESS_TOKEN)/);
});
test('preflight runs in the following step, after GitHub imports GITHUB_ENV', () => {
  for (const name of ['speech', 'therapy']) {
    const configureStep = job(name).split('- name: Configure only the approved staging backend (offline)')[1]?.split('\n      - name:')[0] ?? '';
    assert.doesNotMatch(configureStep, /bun run test:/, 'GITHUB_ENV is not visible to the step that writes it');
    assert.match(job(name), /- name: Validate configured staging prerequisites\s+run: bun run test:/);
  }
});
test('candidate and setup evidence stay outside the browser-cleaned output directory', () => {
  for (const name of ['speech', 'therapy']) {
    assert.doesNotMatch(job(name), /test-results\/(candidate-revision\.txt|staging-config\.json)/);
    assert.match(job(name), /qa-evidence\/candidate-revision.txt/);
    assert.match(job(name), /qa-evidence\/staging-config.json/);
  }
});
