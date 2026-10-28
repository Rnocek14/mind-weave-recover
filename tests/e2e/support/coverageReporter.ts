import { mkdirSync, writeFileSync } from 'node:fs';
import type { FullResult, Reporter, Suite } from '@playwright/test/reporter';
import { summarizeE2EResults } from '../../../scripts/e2e-results.mjs';

/** Explicitly distinguish a public smoke run from a complete staging check. */
export default class CoverageReporter implements Reporter {
  private suite?: Suite;

  onBegin(_config: unknown, suite: Suite) { this.suite = suite; }

  async onEnd(result: FullResult) {
    const mode = process.env.E2E_SUITE || 'public';
    const listing = process.argv.includes('--list');
    const tests = (this.suite?.allTests() ?? []).map((test) => ({ file: test.location.file, results: test.results }));
    const { summary, incomplete, finalStatus } = summarizeE2EResults({ mode, runStatus: result.status, tests, listing });
    if (incomplete) {
      console.error('Staging verification is incomplete: the core loop must be selected, and every selected test must pass without skips, missing runs, or flaky retries.');
    }
    // Discovery must not overwrite evidence from the last actual execution.
    if (!listing) {
      mkdirSync('test-results', { recursive: true });
      writeFileSync('test-results/e2e-summary.json', JSON.stringify(summary, null, 2));
    }
    console.log(`E2E verification: ${JSON.stringify(summary)}`);
    return { status: finalStatus as FullResult['status'] };
  }
}
