import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Fail closed on incomplete Vitest JSON evidence, even when success is true. */
export function verifyUnitResults(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('Unit evidence must be a report object');
  }
  const errors = [];
  const counts = ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests', 'numTodoTests'];
  for (const name of counts) {
    if (!Number.isSafeInteger(report[name]) || report[name] < 0) errors.push(`Invalid ${name}`);
  }
  if (report.success !== true) errors.push('Runner did not report success');
  if (!(report.numTotalTests > 0)) errors.push('No selected unit tests');
  if (report.numPassedTests !== report.numTotalTests) errors.push('Not every selected test passed');
  for (const name of ['numFailedTests', 'numPendingTests', 'numTodoTests']) {
    if (report[name] !== 0) errors.push(`${name} must be zero`);
  }
  if (!Array.isArray(report.testResults) || report.testResults.length === 0) {
    errors.push('Missing test-file results');
  }
  let assertions = 0;
  let passed = 0;
  const names = new Set();
  for (const file of Array.isArray(report.testResults) ? report.testResults : []) {
    if (!file || typeof file.name !== 'string' || !file.name || names.has(file.name)) {
      errors.push('Missing or duplicate test-file identity');
    }
    names.add(file?.name);
    if (file?.status !== 'passed') errors.push(`File did not pass: ${file?.name ?? 'unknown'}`);
    if (!Array.isArray(file?.assertionResults) || file.assertionResults.length === 0) {
      errors.push(`Missing assertions: ${file?.name ?? 'unknown'}`);
      continue;
    }
    for (const assertion of file.assertionResults) {
      assertions++;
      if (assertion?.status === 'passed') passed++;
      else errors.push(`NOT VERIFIED ${file.name}: ${assertion?.fullName ?? 'unknown'} (${assertion?.status ?? 'missing'})`);
      if (Array.isArray(assertion?.failureMessages) && assertion.failureMessages.length > 0) {
        errors.push(`Failure diagnostics present: ${assertion?.fullName ?? 'unknown'}`);
      }
    }
  }
  if (assertions !== report.numTotalTests || passed !== report.numPassedTests) {
    errors.push('Reported totals do not match individual assertions');
  }
  if (errors.length) throw new Error(`Incomplete unit verification:\n${errors.join('\n')}`);
  return { status: 'passed', selected: assertions, passed, failed: 0, skipped: 0, todo: 0, files: names.size };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node scripts/unit-results.mjs <report.json>');
    console.log('Unit verification:', JSON.stringify(verifyUnitResults(JSON.parse(readFileSync(process.argv[2], 'utf8')))));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
