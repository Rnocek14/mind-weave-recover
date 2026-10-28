import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeE2EResults } from './e2e-results.mjs';

const completedCore = { file: '/tests/e2e/core-loop.spec.ts', results: [{ status: 'passed' }] };
const report = (tests, overrides = {}) => summarizeE2EResults({ mode: 'staging', runStatus: 'passed', tests, ...overrides });

test('a completed passing core loop can pass staging', () => {
  const result = report([completedCore]);
  assert.equal(result.finalStatus, 'passed');
  assert.equal(result.summary.passed, 1);
});

test('public smoke explicitly does not claim authenticated coverage', () => {
  const result = report([{ file: '/tests/e2e/smoke.spec.ts', results: [{ status: 'passed' }] }], { mode: 'public' });
  assert.equal(result.finalStatus, 'passed');
  assert.match(result.summary.authenticatedTherapy, /NOT RUN/);
});

test('filtered-out core loop fails a staging verification', () => {
  const result = report([{ file: '/tests/e2e/exercise-session.spec.ts', results: [{ status: 'passed' }] }]);
  assert.equal(result.finalStatus, 'failed');
});

test('skipped core loop cannot turn a staging run green', () => {
  const result = report([{ ...completedCore, results: [{ status: 'skipped' }] }]);
  assert.equal(result.finalStatus, 'failed');
  assert.equal(result.summary.skipped, 1);
});

test('a selected journey that did not run makes staging incomplete', () => {
  const result = report([completedCore, { file: '/tests/e2e/exercise-session.spec.ts', results: [] }]);
  assert.equal(result.finalStatus, 'failed');
  assert.equal(result.summary.notRun, 1);
});

test('a test marked expected-to-fail still cannot verify the critical journey', () => {
  const result = report([{ ...completedCore, expectedStatus: 'failed', results: [{ status: 'failed' }] }]);
  assert.equal(result.finalStatus, 'failed');
  assert.equal(result.summary.failed, 1);
});

test('a retry that passes reports flakiness and cannot verify staging', () => {
  const result = report([{ ...completedCore, results: [{ status: 'timedOut' }, { status: 'passed' }] }]);
  assert.equal(result.finalStatus, 'failed');
  assert.equal(result.summary.flaky, 1);
  assert.equal(result.summary.retries, 1);
});

test('discovery is explicitly not run and does not claim verification', () => {
  const result = report([{ ...completedCore, results: [] }], { listing: true });
  assert.match(result.summary.status, /NOT RUN/);
  assert.match(result.summary.authenticatedTherapy, /NOT RUN/);
  assert.equal(result.summary.notRun, 1);
  assert.equal(result.incomplete, false);
});

for (const mode of ['public', 'staging']) {
  for (const [name, results] of [
    ['skipped', [{ status: 'skipped' }]],
    ['unrun', []],
    ['expected failure', [{ status: 'failed' }]],
    ['retry recovery', [{ status: 'failed' }, { status: 'passed' }]],
    ['unclassified status', [{ status: 'unknown' }]],
    ['repeat execution', [{ status: 'passed' }, { status: 'passed' }]],
  ]) {
    test(`${mode}: ${name} cannot satisfy required browser verification`, () => {
      const result = report([{ ...completedCore, results }], { mode });
      assert.equal(result.finalStatus, 'failed');
      assert.equal(result.incomplete, true);
    });
  }
  test(`${mode}: an empty selection is not a passing suite`, () => {
    assert.equal(report([], { mode }).finalStatus, 'failed');
  });
  test(`${mode}: a runner failure cannot be hidden by passing case results`, () => {
    assert.equal(report([completedCore], { mode, runStatus: 'failed' }).finalStatus, 'failed');
  });
}
