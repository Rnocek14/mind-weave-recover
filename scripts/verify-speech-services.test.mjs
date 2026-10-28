import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PRODUCTION_PROJECT_REF } from './e2e-environment.mjs';
import {
  loadSyntheticFixtures, verifySpeechServices, validateSpeechResponse, validatePronunciationResponse,
} from './verify-speech-services.mjs';

const ref = 'aaaaaaaaaaaaaaaaaaaa';
const env = {
  E2E_SUPABASE_URL: `https://${ref}.supabase.co`,
  E2E_SUPABASE_PROJECT_REF: ref,
  E2E_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_key',
};
const speech = () => ({
  transcript: 'Apple.', confidence: 0.9,
  acousticMetrics: {
    speechRateWpm: 60, totalDurationSec: 1, wordCount: 1, segmentCount: 1,
    pauseCount: 0, avgPauseDurationMs: 0, totalPauseDurationSec: 0, speechToPauseRatio: null,
  },
});
const pronunciation = requestId => ({
  ok: true, pronRequestId: requestId,
  data: {
    transcript: 'APPLE', pronunciationScore: 0, accuracyScore: 0,
    fluencyScore: 0, completenessScore: 0, prosodyScore: null, duration: 1,
    words: [{ word: 'apple', accuracyScore: 0, errorType: 'None', phonemes: [] }],
    alignmentData: { word_segments: [{ word: 'apple', start: 0.2, end: 1.2 }], phone_segments: [] },
  },
});

function transport({ invoke, authError = false, cleanupError = false } = {}) {
  const calls = { factory: 0, auth: 0, invoke: [], cleanup: 0 };
  const clientFactory = async settings => {
    calls.factory += 1;
    assert.equal(settings.suite, 'staging');
    assert.equal(settings.supabaseURL, env.E2E_SUPABASE_URL);
    return {
      auth: {
        async signInAnonymously() {
          calls.auth += 1;
          return authError ? { data: null, error: { message: 'do not print raw server details' } }
            : { data: { user: { is_anonymous: true }, session: { access_token: 'synthetic-session-token' } }, error: null };
        },
        async signOut(options) {
          calls.cleanup += 1;
          assert.deepEqual(options, { scope: 'local' });
          return { error: cleanupError ? new Error('synthetic cleanup failure') : null };
        },
      },
      functions: {
        async invoke(service, options) {
          calls.invoke.push({ service, options });
          return invoke ? invoke(service, options) : {
            data: service === 'analyze-speech' ? speech() : pronunciation(options.body.pronRequestId), error: null,
          };
        },
      },
    };
  };
  return { calls, clientFactory };
}

test('missing and production configuration fail before fixtures, clients, or authentication', async () => {
  for (const candidate of [{}, {
    ...env, E2E_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`, E2E_SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
  }]) {
    const stub = transport();
    let fixtureReads = 0;
    const report = await verifySpeechServices({ env: candidate, mode: 'run', clientFactory: stub.clientFactory,
      loadFixtures: () => { fixtureReads += 1; return loadSyntheticFixtures(); } });
    assert.equal(report.status, 'blocked');
    assert.equal(report.executed, 0);
    assert.equal(report.notRun, 4);
    assert.equal(fixtureReads, 0);
    assert.equal(stub.calls.factory, 0);
  }
});

test('the actual CLI rejects missing and production configuration without a live request', () => {
  const script = fileURLToPath(new URL('./verify-speech-services.mjs', import.meta.url));
  for (const candidate of [{}, {
    ...env, E2E_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`, E2E_SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
  }]) {
    const run = spawnSync(process.execPath, [script, '--run'], { env: candidate, encoding: 'utf8', timeout: 5000 });
    assert.ifError(run.error);
    assert.equal(run.status, 1);
    const report = JSON.parse(run.stdout);
    assert.equal(report.status, 'blocked');
    assert.equal(report.executed, 0);
    assert.equal(report.authentication, 'not_run');
  }
});

test('environment check reads and validates the real synthetic WAVs without creating a client', async () => {
  const stub = transport();
  const report = await verifySpeechServices({ env: { ...env, E2E_SUITE: 'public' }, mode: 'check-env', clientFactory: stub.clientFactory });
  assert.equal(report.status, 'not_run');
  assert.equal(report.prerequisites, 'passed');
  assert.equal(report.executed, 0);
  assert.equal(stub.calls.factory, 0);
  assert.deepEqual(loadSyntheticFixtures().map(({ id, durationMs }) => ({ id, durationMs })), [
    { id: 'clear-answer', durationMs: 3500 }, { id: 'hesitant-answer', durationMs: 4500 },
  ]);
});

test('a WAV with changed bytes fails provenance validation before authentication', async () => {
  const stub = transport();
  const report = await verifySpeechServices({ env, mode: 'run', clientFactory: stub.clientFactory,
    loadFixtures: () => loadSyntheticFixtures({ readFile: (url, encoding) => {
      const value = readFileSync(url, encoding);
      if (String(url).endsWith('.wav')) value[value.length - 1] ^= 1;
      return value;
    } }),
  });
  assert.equal(report.status, 'blocked');
  assert.match(report.failure.reason, /hash differs/);
  assert.equal(stub.calls.auth, 0);
});

test('success makes exactly four mocked provider calls and one synthetic sign-in, accepting zero scores', async () => {
  const stub = transport();
  const report = await verifySpeechServices({ env, mode: 'run', clientFactory: stub.clientFactory });
  assert.equal(report.status, 'passed');
  assert.deepEqual([report.executed, report.passed, report.failed, report.notRun], [4, 4, 0, 0]);
  assert.equal(stub.calls.auth, 1);
  assert.equal(stub.calls.cleanup, 1);
  assert.equal(report.evidence.providerAccuracy, 'not_validated');
  assert.equal(report.evidence.databasePersistence, 'not_exercised');
  for (const { service, options } of stub.calls.invoke) {
    assert.equal(options.body.mimeType, 'audio/wav');
    assert.equal(Buffer.from(options.body.audioBlob, 'base64').toString('ascii', 0, 4), 'RIFF');
    if (service === 'analyze-pronunciation') {
      assert.equal(options.body.referenceText, 'apple');
      assert.match(options.body.pronRequestId, /^[a-f0-9-]{36}$/);
    }
  }
});

test('failed authentication prevents all provider calls and does not expose raw server detail', async () => {
  const stub = transport({ authError: true });
  const report = await verifySpeechServices({ env, mode: 'run', clientFactory: stub.clientFactory });
  assert.equal(report.status, 'failed');
  assert.equal(report.failure.phase, 'authentication');
  assert.equal(report.authentication, 'failed');
  assert.equal(report.executed, 0);
  assert.equal(report.notRun, 4);
  assert.equal(stub.calls.invoke.length, 0);
  assert.ok(!JSON.stringify(report).includes('do not print raw server details'));
});

test('an HTTP/SDK transport failure stops the bounded run without retry and still signs out', async () => {
  const stub = transport({ invoke: () => ({ data: null, error: new Error('private transport details') }) });
  const report = await verifySpeechServices({ env, mode: 'run', clientFactory: stub.clientFactory });
  assert.deepEqual([report.executed, report.passed, report.failed, report.notRun], [1, 0, 1, 3]);
  assert.equal(report.evidence.contractAndSyntheticWords, 'failed');
  assert.equal(stub.calls.cleanup, 1);
  assert.ok(!JSON.stringify(report).includes('private transport details'));
});

test('false ok and mismatched request IDs cannot be counted as a passed pronunciation check', async () => {
  for (const response of [{ ok: false, error: { stage: 'parse' } }, pronunciation('another-request')]) {
    const stub = transport({ invoke: service => ({ data: service === 'analyze-speech' ? speech() : response, error: null }) });
    const report = await verifySpeechServices({ env, mode: 'run', clientFactory: stub.clientFactory });
    assert.equal(report.status, 'failed');
    assert.deepEqual([report.executed, report.passed, report.failed, report.notRun], [2, 1, 1, 2]);
    assert.equal(stub.calls.cleanup, 1);
  }
});

test('validators reject missing scores, invented pause metrics, out-of-range confidence, and wrong transcripts', () => {
  const fixture = loadSyntheticFixtures()[0];
  const missing = pronunciation('request');
  delete missing.data.accuracyScore;
  assert.throws(() => validatePronunciationResponse(missing, fixture, 'request'), /accuracyScore/);
  const fabricated = speech();
  fabricated.acousticMetrics.segmentCount = 0;
  assert.throws(() => validateSpeechResponse(fabricated, fixture), /timing segments/);
  assert.throws(() => validateSpeechResponse({ ...speech(), confidence: 1.2 }, fixture), /confidence/);
  assert.throws(() => validateSpeechResponse({ ...speech(), transcript: 'unrelated' }, fixture), /accepted words/);
});

test('unavailable provider timing and optional prosody are explicit limits, not invented zeros', () => {
  const fixture = loadSyntheticFixtures()[0];
  const response = speech();
  response.confidence = null;
  Object.assign(response.acousticMetrics, {
    segmentCount: 0, pauseCount: null, avgPauseDurationMs: null,
    totalPauseDurationSec: null, speechToPauseRatio: null,
  });
  assert.equal(validateSpeechResponse(response, fixture).timingAvailable, false);
  const pron = pronunciation('request');
  delete pron.pronRequestId;
  assert.equal(validatePronunciationResponse(pron, fixture, 'request').requestCorrelation, 'not_returned');
});

test('cleanup failure stays visible even when the four mocked provider checks passed', async () => {
  const stub = transport({ cleanupError: true });
  const report = await verifySpeechServices({ env, mode: 'run', clientFactory: stub.clientFactory });
  assert.equal(report.passed, 4);
  assert.equal(report.cleanup, 'failed');
  assert.equal(report.status, 'failed');
});
