import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { FullResult, Reporter, Suite } from '@playwright/test/reporter';
import { summarizeE2EResults } from '../../../../scripts/e2e-results.mjs';

/** Required selected speech cases cannot pass as skipped, expected failures, or flaky retries. */
export default class SpeechReporter implements Reporter {
  private suite?: Suite;
  onBegin(_config: unknown, suite: Suite) { this.suite = suite; }
  async onEnd(result: FullResult) {
    const listing = process.argv.includes('--list');
    const tests = (this.suite?.allTests() ?? []).map((test) => ({ file: test.location.file, results: test.results }));
    const { summary } = summarizeE2EResults({ mode: 'public', runStatus: result.status, tests, listing });
    const incomplete = !listing && (!summary.selected || summary.failed || summary.skipped || summary.notRun || summary.retries);
    const status = incomplete ? 'failed' : result.status;
    const evidence = {
      ...summary, suite: 'speech-local', status: listing ? 'NOT RUN: discovery only' : status,
      nativeAudioCapture: listing ? 'NOT RUN' : 'real Chromium getUserMedia/MediaRecorder with synthetic WAV input',
      nativeSpeechRecognition: 'NOT RUN: controlled browser API events',
      speechServices: 'NOT RUN: controlled HTTP responses',
      authenticatedPersistence: 'NOT RUN: synthetic cached session and intercepted writes',
      physicalDevices: 'NOT RUN',
    };
    if (!listing) {
      const directory = fileURLToPath(new URL('../../../../test-results/', import.meta.url));
      mkdirSync(directory, { recursive: true });
      writeFileSync(`${directory}speech-summary.json`, JSON.stringify(evidence, null, 2) + '\n');
    }
    if (incomplete) console.error('Speech verification is incomplete: every selected case must execute and pass without retries.');
    console.log(`Speech verification: ${JSON.stringify(evidence)}`);
    return { status: status as FullResult['status'] };
  }
}
