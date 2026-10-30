import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  assessStagingRun, findExactStagingRun, waitForStagingEvidence,
  REQUIRED_PATH, REQUIRED_WORKFLOW, REQUIRED_JOBS,
} from './verify-staging-release.mjs';

const sha = 'a'.repeat(40);
const previous = 'b'.repeat(40);
const repo = 'Rnocek14/mind-weave-recover';
const headRef = 'audit/comprehensive-neurospark-2026-10-28';
const baseRun = {
  id: 40001,
  head_sha: sha,
  head_branch: headRef,
  event: 'pull_request',
  name: REQUIRED_WORKFLOW,
  path: REQUIRED_PATH,
  run_number: 17,
  status: 'completed',
  conclusion: 'success',
};
const successJobs = REQUIRED_JOBS.map((name, i) => ({
  id: 41001 + i, name, status: 'completed', conclusion: 'success',
}));
const inputs = {
  repo,
  headSha: sha,
  headRef,
  token: 'test_read_only_token',
};

function reply(payload, status = 200) {
  return { ok: status === 200, status, json: async () => payload };
}

test('only exact PR head and real authenticated staging workflow count', () => {
  const stale = { ...baseRun, head_sha: previous, run_number: 999 };
  const fromDifferentBranch = { ...baseRun, head_branch: 'main', id: 7 };
  const otherWorkflow = { ...baseRun, path: '.github/workflows/ci.yml', id: 8 };
  assert.deepEqual(findExactStagingRun([
    stale, fromDifferentBranch, otherWorkflow, baseRun,
  ], sha, headRef), baseRun);
  assert.equal(findExactStagingRun([stale], sha, headRef), null);
  assert.equal(findExactStagingRun([], sha, headRef), null);
});

test('successful workflow cannot hide a skipped or missing required clinical job', () => {
  assert.equal(assessStagingRun(baseRun, successJobs).state, 'success');
  for (const jobs of [
    [], null,
    [successJobs[0]],
    [{ ...successJobs[0], conclusion: 'skipped' }, successJobs[1]],
    [successJobs[0], { ...successJobs[1], conclusion: 'failure' }],
    [{ ...successJobs[0], status: 'in_progress' }, successJobs[1]],
    [successJobs[0], successJobs[0], successJobs[1]],
  ]) {
    assert.equal(assessStagingRun(baseRun, jobs).state, 'failed');
  }
  assert.equal(assessStagingRun({ ...baseRun, conclusion: 'failure' }, null).state, 'failed');
  assert.equal(assessStagingRun({ ...baseRun, conclusion: 'cancelled' }, null).state, 'failed');
  assert.equal(assessStagingRun(null, null).state, 'pending');
  assert.equal(assessStagingRun({ ...baseRun, status: 'in_progress' }, null).state, 'pending');
});

test('required gate waits for an actual success on the same exact commit', async () => {
  let calls = 0;
  let clock = 0;
  const urls = [];
  const result = await waitForStagingEvidence({
    ...inputs,
    maxWaitMs: 5000, intervalMs: 100,
    now: () => clock,
    sleep: async ms => { clock += ms; },
    fetchImpl: async url => {
      urls.push(url);
      if (url.includes('/jobs?')) return reply({ jobs: successJobs });
      calls++;
      const entry = calls === 1
        ? { ...baseRun, status: 'in_progress', conclusion: null }
        : baseRun;
      return reply({ workflow_runs: [entry] });
    },
  });
  assert.equal(result.state, 'success');
  assert.equal(calls, 2);
  assert.equal(clock, 100);
  assert.ok(urls.every(url => url.includes(repo)));
  assert.ok(urls[0].includes(sha));
  assert.ok(urls.some(url => url.includes('/jobs?')));
});

test('status from a stale passing revision cannot pass a new release', async () => {
  let clock = 0;
  await assert.rejects(waitForStagingEvidence({
    ...inputs,
    maxWaitMs: 200, intervalMs: 100,
    now: () => clock,
    sleep: async ms => { clock += ms; },
    fetchImpl: async () => reply({ workflow_runs: [{
      ...baseRun, head_sha: previous, run_number: 99,
    }] }),
  }), /timed out/);
});

test('failing staging stops immediately, without hiding the evidence', async () => {
  let calls = 0;
  await assert.rejects(waitForStagingEvidence({
    ...inputs,
    fetchImpl: async () => {
      calls++;
      return reply({ workflow_runs: [{ ...baseRun, conclusion: 'failure' }] });
    },
  }), /release gate blocked/);
  assert.equal(calls, 1);
});

test('GitHub API permission failure fails closed', async () => {
  await assert.rejects(waitForStagingEvidence({
    ...inputs,
    fetchImpl: async () => reply({}, 403),
  }), /HTTP 403/);
});

test('missing auth, repo or head SHA cannot cause a network call', async () => {
  let requests = 0;
  for (const broken of [
    { token: '' },
    { headSha: '' },
    { headSha: 'a'.repeat(39) },
    { repo: 'example.invalid' },
    { headRef: '' },
  ]) {
    await assert.rejects(waitForStagingEvidence({
      ...inputs,
      ...broken,
      fetchImpl: async () => { requests++; return reply({}); },
    }), /required/);
  }
  assert.equal(requests, 0);
});

test('the protected regression gate wires exact-head staging status and read-only Actions access', () => {
  const workflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /name: Regression gate/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /run: node scripts\/verify-staging-release\.mjs/);
  assert.match(workflow, /PR_HEAD_SHA:\s+\$\{\{ github\.event\.pull_request\.head\.sha \}\}/);
  assert.match(workflow, /PR_HEAD_REF:\s+\$\{\{ github\.event\.pull_request\.head\.ref \}\}/);
  assert.match(workflow, /needs\.test\.result == 'success'/);
  assert.match(workflow, /needs\.e2e\.result == 'success'/);
  assert.match(workflow, /needs\.bundle\.result == 'success'/);
  assert.doesNotMatch(workflow, /continue-on-error:\s+true/);
});

test('authenticated staging runs for every internal PR and excludes forks', () => {
  const workflow = readFileSync(new URL('../.github/workflows/neurospark-audit-staging.yml', import.meta.url), 'utf8');
  assert.match(workflow, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
  assert.doesNotMatch(workflow, /github\.event\.pull_request\.head\.ref ==/);
  assert.match(workflow, /environment: neurospark-e2e/);
  assert.match(workflow, /playwright_project: chromium-desktop/);
  assert.match(workflow, /playwright_project: mobile-safari/);
  assert.match(workflow, /fail-fast: false/);
  assert.match(workflow, /test:e2e:staging --workers=1 --retries=0 --project=/);
  assert.doesNotMatch(workflow, /continue-on-error:\s+true/);
});
