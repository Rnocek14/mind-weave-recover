import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyUnitResults } from './unit-results.mjs';
import { runUnitTests } from './run-unit-tests.mjs';

const good = () => ({
  success: true, numTotalTests: 1, numPassedTests: 1,
  numFailedTests: 0, numPendingTests: 0, numTodoTests: 0,
  testResults: [{ name: 'example.test.ts', status: 'passed', assertionResults: [
    { fullName: 'saves once', status: 'passed', failureMessages: [] },
  ] }],
});

test('accepts complete, individually reconciled evidence', () => {
  assert.deepEqual(verifyUnitResults(good()), {
    status: 'passed', selected: 1, passed: 1, failed: 0, skipped: 0, todo: 0, files: 1,
  });
});
for (const status of ['skipped', 'pending', 'todo', 'failed', 'running', undefined]) {
  test(`rejects individual ${status ?? 'missing'} status despite a green aggregate`, () => {
    const report = good();
    report.testResults[0].assertionResults[0].status = status;
    assert.throws(() => verifyUnitResults(report), /NOT VERIFIED/);
  });
}
for (const field of ['numFailedTests', 'numPendingTests', 'numTodoTests']) {
  test(`rejects nonzero ${field}`, () => {
    const report = good(); report[field] = 1;
    assert.throws(() => verifyUnitResults(report), /must be zero/);
  });
}
for (const value of [null, [], undefined, 'passed']) {
  test(`rejects malformed root ${JSON.stringify(value)}`, () => {
    assert.throws(() => verifyUnitResults(value), /report object/);
  });
}
test('rejects zero tests', () => {
  const report = good(); report.numTotalTests = 0; report.numPassedTests = 0; report.testResults = [];
  assert.throws(() => verifyUnitResults(report), /No selected unit tests/);
});
test('rejects false runner success', () => {
  const report = good(); report.success = false;
  assert.throws(() => verifyUnitResults(report), /did not report success/);
});
test('rejects missing count metadata', () => {
  const report = good(); delete report.numTodoTests;
  assert.throws(() => verifyUnitResults(report), /Invalid numTodoTests/);
});
test('rejects impossible count metadata', () => {
  const report = good(); report.numTotalTests = -1;
  assert.throws(() => verifyUnitResults(report), /Invalid numTotalTests/);
});
test('rejects totals that disagree with assertions', () => {
  const report = good(); report.numTotalTests = report.numPassedTests = 2;
  assert.throws(() => verifyUnitResults(report), /do not match/);
});
test('rejects a failed file even with green assertions', () => {
  const report = good(); report.testResults[0].status = 'failed';
  assert.throws(() => verifyUnitResults(report), /File did not pass/);
});
test('rejects missing assertion evidence', () => {
  const report = good(); report.testResults[0].assertionResults = [];
  assert.throws(() => verifyUnitResults(report), /Missing assertions/);
});
test('rejects duplicate file evidence', () => {
  const report = good(); report.testResults.push(structuredClone(report.testResults[0]));
  report.numTotalTests = report.numPassedTests = 2;
  assert.throws(() => verifyUnitResults(report), /duplicate test-file/);
});
test('rejects failure messages hidden under a passed status', () => {
  const report = good(); report.testResults[0].assertionResults[0].failureMessages = ['failure'];
  assert.throws(() => verifyUnitResults(report), /Failure diagnostics/);
});

function inRoot(fn) {
  const root = mkdtempSync(join(tmpdir(), 'neurospark-unit-gate-'));
  try { fn(root, join(root, 'evidence-test-results.json')); }
  finally { rmSync(root, { recursive: true, force: true }); }
}
test('runner deletes stale evidence and forwards file filters with fixed safety flags', () => inRoot((root, report) => {
  writeFileSync(report, JSON.stringify(good()));
  const summary = runUnitTests(['--', 'src/example.test.ts'], { root, execute: (_command, args) => {
    assert.equal(existsSync(report), false);
    assert.ok(args.includes('src/example.test.ts'));
    for (const flag of ['--retry=0', '--allowOnly=false', '--passWithNoTests=false']) assert.ok(args.includes(flag));
    writeFileSync(report, JSON.stringify(good()));
    return { status: 0 };
  } });
  assert.equal(summary.passed, 1);
}));
test('runner rejects a crash that leaves no fresh report', () => inRoot((root, report) => {
  writeFileSync(report, JSON.stringify(good()));
  assert.throws(() => runUnitTests([], { root, execute: () => ({ status: 0 }) }), /missing or incomplete/);
}));
test('runner rejects malformed fresh JSON', () => inRoot((root, report) => {
  assert.throws(() => runUnitTests([], { root, execute: () => {
    writeFileSync(report, '{invalid'); return { status: 0 };
  } }), /missing or incomplete/);
}));
for (const result of [{ status: 1 }, { status: null, signal: 'SIGTERM' }, { error: new Error('spawn failed') }]) {
  test(`runner rejects ${result.error?.message ?? result.signal ?? result.status} even with a complete report`, () => inRoot((root, report) => {
    assert.throws(() => runUnitTests([], { root, execute: () => {
      writeFileSync(report, JSON.stringify(good())); return result;
    } }), /Unit runner failed/);
  }));
}
test('runner rejects flags that could weaken the gate before execution', () => {
  let called = false;
  assert.throws(() => runUnitTests(['--retry=2'], { execute: () => { called = true; } }), /file filters only/);
  assert.equal(called, false);
});
