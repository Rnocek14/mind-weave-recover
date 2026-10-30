import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessStagingRun, findExactStagingRun, waitForStagingEvidence,
  REQUIRED_PATH, REQUIRED_WORKFLOW, REQUIRED_JOB,
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
const successJob = { id: 41001, name: REQUIRED_JOB, status: 'completed', conclusion: 'success' };
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
  assert.equal(assessStagingRun(baseRun, [successJob]).state, 'success');
  for (const jobs of [[], null, [{ ...successJob, conclusion: 'skipped' }],
    [{ ...successJob, conclusion: 'failure' }], [{ ...successJob, status: 'in_progress' }],
    [successJob, successJob]]) {
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
      if (url.includes('/jobs?')) return reply({ jobs: [successJob] });
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
