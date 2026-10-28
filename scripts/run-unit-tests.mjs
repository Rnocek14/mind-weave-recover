import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { verifyUnitResults } from './unit-results.mjs';

/** The gate permits file filters, not flags that weaken execution/reporting. */
export function runUnitTests(args = [], { root = dirname(dirname(fileURLToPath(import.meta.url))), execute = spawnSync } = {}) {
  const filters = args[0] === '--' ? args.slice(1) : args;
  if (filters.some(value => typeof value !== 'string' || !value || value.startsWith('-'))) {
    throw new Error('The unit gate accepts file filters only. Use test:watch for exploratory runs.');
  }
  const reportPath = join(root, 'evidence-test-results.json');
  // A crashed runner must never inherit an earlier successful report.
  rmSync(reportPath, { force: true });
  const result = execute(process.execPath, [
    join(root, 'node_modules/vitest/vitest.mjs'), 'run', ...filters,
    '--config', join(root, 'vitest.config.ts'),
    '--retry=0', '--allowOnly=false', '--passWithNoTests=false',
    '--reporter=default', '--reporter=json', `--outputFile=${reportPath}`,
  ], { cwd: root, stdio: 'inherit', env: process.env });
  let summary;
  try {
    summary = verifyUnitResults(JSON.parse(readFileSync(reportPath, 'utf8')));
  } catch (error) {
    throw new Error(`Unit results missing or incomplete: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (result.error || result.signal || result.status !== 0) {
    throw new Error(`Unit runner failed (${result.error?.message ?? result.signal ?? result.status ?? 'no exit status'})`);
  }
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log('Unit verification:', JSON.stringify(runUnitTests(process.argv.slice(2))));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
