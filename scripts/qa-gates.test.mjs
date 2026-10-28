import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertJobsPassed } from './qa-gates.mjs';

const required = ['test', 'e2e', 'bundle'];
const complete = () => Object.fromEntries(required.map((id) => [id, { result: 'success' }]));

test('only all explicitly required successful jobs pass', () => {
  assert.deepEqual(assertJobsPassed(complete(), required), { passed: true, required });
});
for (const result of ['failure', 'cancelled', 'skipped', 'pending', 'neutral', 'timed_out', '']) {
  test(`a ${result || 'blank'} job cannot be hidden by a successful build`, () => {
    const needs = complete(); needs.e2e.result = result;
    assert.throws(() => assertJobsPassed(needs, required), /blocked: e2e/);
  });
}
test('a missing required job is blocked even if other jobs succeeded', () => {
  const needs = complete(); delete needs.e2e;
  assert.throws(() => assertJobsPassed(needs, required), /blocked: e2e/);
});
test('an unrelated success cannot replace a missing therapy check', () => {
  assert.throws(() => assertJobsPassed(complete(), ['test', 'therapy']), /blocked: therapy/);
});
test('job outputs claiming success cannot override the actual job result', () => {
  const needs = complete(); needs.test = { result: 'failure', outputs: { result: 'success' } };
  assert.throws(() => assertJobsPassed(needs, required), /blocked: test/);
});
test('inherited properties cannot stand in for actual job results', () => {
  assert.throws(() => assertJobsPassed(Object.create(complete()), required), /blocked/);
});
for (const names of [[], ['test', 'test'], [''], ['--allow-skip']]) {
  test(`invalid requirement list ${JSON.stringify(names)} fails closed`, () => {
    assert.throws(() => assertJobsPassed(complete(), names), /explicit, unique/);
  });
}
for (const value of [null, [], 'success']) {
  test(`invalid results ${JSON.stringify(value)} fail closed`, () => {
    assert.throws(() => assertJobsPassed(value, required), /job-results object/);
  });
}
const cli = (value, names = required) => spawnSync(process.execPath, [
  fileURLToPath(new URL('./qa-gates.mjs', import.meta.url)), ...names,
], { encoding: 'utf8', env: { QA_JOB_RESULTS: value } });
test('CLI exits successfully for the verified required results', () => {
  assert.equal(cli(JSON.stringify(complete())).status, 0);
});
test('CLI fails on invalid JSON without printing supplied context', () => {
  const result = cli('not-json-sensitive-canary');
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stderr, /sensitive-canary/);
});
test('CLI fails rather than treating an empty environment as success', () => {
  assert.equal(cli('').status, 1);
});
test('CLI exits nonzero when an isolated release prerequisite was skipped', () => {
  assert.equal(cli(JSON.stringify({ build: { result: 'success' }, therapy: { result: 'skipped' } }), ['build', 'therapy']).status, 1);
});
