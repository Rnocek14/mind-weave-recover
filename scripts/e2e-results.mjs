/** Summarize actual test attempts without turning missing/expected failures green. */
export function summarizeE2EResults({ mode, runStatus, tests, listing = false }) {
  const lastStatus = (test) => test.results.at(-1)?.status;
  const failedStatuses = ['failed', 'timedOut', 'interrupted'];
  const summary = {
    suite: mode,
    status: listing ? 'NOT RUN: discovery only' : runStatus,
    selected: tests.length,
    passed: tests.filter((test) => lastStatus(test) === 'passed').length,
    failed: tests.filter((test) => failedStatuses.includes(lastStatus(test))).length,
    skipped: tests.filter((test) => lastStatus(test) === 'skipped').length,
    notRun: tests.filter((test) => test.results.length === 0).length,
    retries: tests.reduce((total, test) => total + Math.max(0, test.results.length - 1), 0),
    flaky: tests.filter((test) => lastStatus(test) === 'passed'
      && test.results.slice(0, -1).some((attempt) => failedStatuses.includes(attempt.status))).length,
    authenticatedTherapy: listing ? 'NOT RUN: discovery only'
      : mode === 'staging' ? 'selected' : 'NOT RUN: public smoke suite only',
  };
  const hasCoreLoop = tests.some((test) => /(?:^|[/\\])core-loop\.spec\.ts$/.test(test.file));
  // Every selected browser case must pass on its first execution. Public UI
  // checks are also a required regression layer, not permission to skip cases.
  const incomplete = !listing && (
    !tests.length || summary.passed !== summary.selected || summary.retries > 0
    || (mode === 'staging' && !hasCoreLoop)
  );
  if (incomplete) summary.status = 'failed';
  return { summary, incomplete: Boolean(incomplete), finalStatus: incomplete ? 'failed' : runStatus };
}
