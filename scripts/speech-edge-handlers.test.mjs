/**
 * Credential-free contracts for the actual speech HTTP handlers.
 * Real: index.ts, request builder, response parsers, timing/score arithmetic.
 * Controlled: serve registration, authentication, rate-limit transport, Azure HTTP.
 * Not verified: live ASR, Supabase auth/RLS/persistence, microphones or clinical validity.
 * No .env file is loaded and no host fetch or provider credentials enter the VM.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, Script } from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript'); // Reuse the repository's locked compiler.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const functions = resolve(root, 'supabase/functions');
const serveImport = 'https://deno.land/std@0.168.0/http/server.ts';
const productionFiles = new Set([
  'analyze-speech/index.ts', 'analyze-speech/response.ts',
  'analyze-pronunciation/index.ts', 'analyze-pronunciation/response.ts',
  '_shared/azureSpeechRequest.ts', '_shared/azureSpeechValues.ts',
].map((path) => resolve(functions, path)));
const compiled = new Map();

function compile(path) {
  if (!compiled.has(path)) {
    const result = ts.transpileModule(readFileSync(path, 'utf8'), {
      fileName: path, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    });
    const errors = (result.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
    assert.equal(errors.length, 0, `Cannot transpile production source: ${path}`);
    compiled.set(path, result.outputText);
  }
  return compiled.get(path);
}

/** A valid synthetic PCM container; NOT a speech-accuracy fixture. */
function wav() {
  const bytes = Buffer.alloc(3244);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28);
  bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(bytes.length - 44, 40);
  return bytes;
}
const audio = wav();
const defaultBody = () => ({
  audioBlob: audio.toString('base64'), mimeType: 'audio/wav',
  referenceText: 'apple', pronRequestId: 'synthetic-contract-attempt',
});
const speechFixture = () => ({
  RecognitionStatus: 'Success', Duration: '30000000', DisplayText: 'I want more water.',
  NBest: [{ Confidence: 0.73, Display: 'I want more water.', Lexical: 'i want more water', Words: [
    { Word: 'i', Offset: '0', Duration: '3000000' },
    { Word: 'want', Offset: '5000000', Duration: '3000000' },
    { Word: 'more', Offset: '11000000', Duration: '3000000' },
    { Word: 'water', Offset: '22000000', Duration: '8000000' },
  ] }],
});
const pronunciationFixture = () => ({
  RecognitionStatus: 'Success', Duration: '30000000',
  NBest: [{ Display: 'water', PronScore: 63, AccuracyScore: 61, FluencyScore: 57, CompletenessScore: 100,
    Words: [{ Word: 'water', AccuracyScore: 61, ErrorType: 'None', Offset: '5000000', Duration: '10000000',
      Phonemes: [{ Phoneme: 'w', AccuracyScore: 0, Offset: '5000000', Duration: '2000000' }],
    }],
  }],
});

function harness(t, endpoint, options = {}) {
  let handler;
  const calls = { auth: [], rate: [], azure: [], unexpected: [] };
  // Deliberately not process.env: externally supplied secrets cannot change a test.
  const env = { AZURE_SPEECH_KEY: 'synthetic-not-a-real-key', AZURE_SPEECH_REGION: 'contract-test', ...options.env };
  const fail = (message) => { calls.unexpected.push(message); throw new Error(message); };
  const context = createContext({
    Request, Response, Headers, URL, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, DataView, Error,
    atob, btoa,
    console: { log() {}, warn() {}, error() {} },
    Deno: { env: { get: (name) => env[name] } },
    fetch: async (url, init) => {
      // There is no network fallback. Also fail teardown if a handler catches this error.
      if (String(url) !== 'https://contract-test.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed') {
        return fail(`Unexpected provider URL: ${url}`);
      }
      calls.azure.push({ url, init });
      if (options.networkFailure) throw new Error('Synthetic provider connection failure');
      const fixture = options.provider ?? (endpoint === 'analyze-speech' ? speechFixture() : pronunciationFixture());
      return new Response(options.rawProvider ?? JSON.stringify(fixture), {
        status: options.providerStatus ?? 200, headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  const modules = new Map();
  const load = (path) => {
    if (!productionFiles.has(path)) return fail(`Unexpected production import: ${path}`);
    if (modules.has(path)) return modules.get(path).exports;
    const module = { exports: {} };
    modules.set(path, module);
    const dependency = (specifier) => {
      if (specifier === serveImport) return { serve: (callback) => { assert.equal(handler, undefined); handler = callback; } };
      if (!specifier.startsWith('.')) return fail(`Unexpected external import: ${specifier}`);
      const target = resolve(dirname(path), specifier);
      if (target === resolve(functions, '_shared/auth.ts')) return {
        getAuthedUser: async (req) => { calls.auth.push(req.headers.get('Authorization')); return options.unauthorized ? null : { id: 'synthetic-user' }; },
      };
      if (target === resolve(functions, '_shared/rateLimit.ts')) return {
        checkRateLimit: async (...args) => { calls.rate.push(args); return { allowed: !options.rateLimited }; },
        rateLimitedResponse: (headers) => new Response(JSON.stringify({ error: 'RATE_LIMITED' }), { status: 429, headers }),
      };
      return load(target);
    };
    new Script(`(function(require, module, exports) {\n${compile(path)}\n})`, { filename: path })
      .runInContext(context)(dependency, module, module.exports);
    return module.exports;
  };
  load(resolve(functions, endpoint, 'index.ts'));
  assert.equal(typeof handler, 'function', 'The real production entrypoint must register a handler');
  t.after(() => assert.deepEqual(calls.unexpected, [], 'No unexpected import or network destination is permitted'));
  return {
    calls,
    async request(body = defaultBody(), method = 'POST') {
      const response = await handler(new Request(`https://local-contract.invalid/${endpoint}`, {
        method, headers: { Authorization: 'Bearer synthetic-contract-token', 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
      }));
      const raw = await response.text();
      return { status: response.status, headers: response.headers, body: raw ? JSON.parse(raw) : null };
    },
  };
}

function noMeasurements(body) {
  assert.notEqual(body?.ok, true, 'Failure must not masquerade as a successful assessment');
  assert.equal(body?.data, undefined);
  assert.ok(body?.acousticMetrics == null, 'Failure must not manufacture acoustic measurements');
  assert.equal(body?.pronunciationScore, undefined);
}

for (const endpoint of ['analyze-speech', 'analyze-pronunciation']) {
  test(`${endpoint}: preflight requires neither auth nor provider access`, async (t) => {
    const h = harness(t, endpoint);
    const result = await h.request(undefined, 'OPTIONS');
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(h.calls.auth.length + h.calls.rate.length + h.calls.azure.length, 0);
  });
  test(`${endpoint}: rejected authentication cannot spend a provider request`, async (t) => {
    const h = harness(t, endpoint, { unauthorized: true });
    const result = await h.request();
    assert.equal(result.status, 401); noMeasurements(result.body);
    assert.deepEqual(h.calls.auth, ['Bearer synthetic-contract-token']);
    assert.equal(h.calls.rate.length + h.calls.azure.length, 0);
  });
  test(`${endpoint}: denied rate check blocks analysis`, async (t) => {
    const h = harness(t, endpoint, { rateLimited: true });
    const result = await h.request();
    assert.equal(result.status, 429); noMeasurements(result.body);
    assert.deepEqual(h.calls.rate.map((args) => Array.from(args)), [['synthetic-user', 'speech_analysis', 600]]);
    assert.equal(h.calls.azure.length, 0);
  });
  test(`${endpoint}: missing credentials remain an error, not zero scores`, async (t) => {
    const h = harness(t, endpoint, { env: { AZURE_SPEECH_KEY: undefined } });
    const result = await h.request();
    assert.equal(result.status, 500); noMeasurements(result.body);
    assert.equal(h.calls.azure.length, 0);
  });
  for (const [name, overrides] of [
    ['missing audio', { audioBlob: '' }],
    ['invalid base64', { audioBlob: 'not@base64!' }],
    ['unsupported browser format', { mimeType: 'audio/webm' }],
    ['truncated PCM container', { audioBlob: audio.subarray(0, 1000).toString('base64') }],
  ]) {
    test(`${endpoint}: ${name} is rejected before provider access`, async (t) => {
      const h = harness(t, endpoint);
      const result = await h.request({ ...defaultBody(), ...overrides });
      assert.equal(result.status, 400); noMeasurements(result.body);
      assert.equal(h.calls.azure.length, 0);
    });
  }
  for (const [name, options, status] of [
    ['provider connection failure', { networkFailure: true }, 500],
    ['provider outage', { providerStatus: 503 }, 502],
    ['invalid provider JSON', { rawProvider: '{not-json' }, 502],
    ['invalid provider schema', { provider: {} }, 502],
  ]) {
    test(`${endpoint}: ${name} cannot become a successful measurement`, async (t) => {
      const h = harness(t, endpoint, options);
      const result = await h.request();
      assert.equal(result.status, status); noMeasurements(result.body);
      assert.equal(h.calls.azure.length, 1);
    });
  }
  for (const RecognitionStatus of ['NoMatch', 'InitialSilenceTimeout', 'BabbleTimeout']) {
    test(`${endpoint}: ${RecognitionStatus} is not a measured zero`, async (t) => {
      const h = harness(t, endpoint, { provider: { RecognitionStatus, Duration: '30000000' } });
      const result = await h.request();
      assert.equal(result.status, 200); noMeasurements(result.body);
      if (endpoint === 'analyze-speech') {
        assert.equal(result.body.transcript, '');
        assert.equal(result.body.confidence, null);
        assert.equal(result.body.validity.countsTowardScore, false);
      } else assert.equal(result.body.ok, false);
    });
  }
}

test('speech handler: exact WAV bytes reach the request and known timestamps produce correct metrics', async (t) => {
  const h = harness(t, 'analyze-speech');
  const result = await h.request();
  assert.equal(result.status, 200);
  assert.equal(result.body.transcript, 'I want more water.');
  assert.equal(result.body.confidence, 0.73);
  assert.deepEqual(result.body.acousticMetrics, {
    speechRateWpm: 80, totalDurationSec: 3, wordCount: 4, pauseCount: 3,
    avgPauseDurationMs: 433, totalPauseDurationSec: 1.3, speechToPauseRatio: 1.31, segmentCount: 4,
  });
  const [{ init }] = h.calls.azure;
  assert.equal(h.calls.azure.length, 1);
  assert.equal(init.method, 'POST');
  assert.deepEqual(Buffer.from(init.body), audio);
  assert.equal(new Headers(init.headers).get('Content-Type'), 'audio/wav; codecs=audio/pcm; samplerate=16000');
  assert.equal(new Headers(init.headers).get('Pronunciation-Assessment'), null);
});

test('speech handler: a real zero confidence is distinct from classifier confidence', async (t) => {
  const provider = speechFixture(); provider.NBest[0].Confidence = 0;
  const result = await harness(t, 'analyze-speech', { provider }).request();
  assert.equal(result.status, 200);
  assert.equal(result.body.confidence, 0);
  assert.equal(result.body.validity.signals.asrConfidence, 0);
  assert.notEqual(result.body.confidence, result.body.validity.confidence);
});

test('speech handler: lexical words, not display normalization, determine speaking rate', async (t) => {
  const provider = speechFixture();
  provider.NBest[0].Display = '123'; provider.NBest[0].Lexical = 'one hundred twenty three';
  const result = await harness(t, 'analyze-speech', { provider }).request();
  assert.equal(result.status, 200);
  assert.equal(result.body.transcript, '123');
  assert.equal(result.body.acousticMetrics.wordCount, 4);
  assert.equal(result.body.acousticMetrics.speechRateWpm, 80);
});

test('speech handler: unavailable timing never becomes zero pauses', async (t) => {
  const provider = speechFixture(); delete provider.NBest[0].Words;
  const result = await harness(t, 'analyze-speech', { provider }).request();
  assert.equal(result.status, 200);
  assert.equal(result.body.acousticMetrics.wordCount, 4);
  for (const key of ['pauseCount', 'avgPauseDurationMs', 'totalPauseDurationSec', 'speechToPauseRatio']) {
    assert.equal(result.body.acousticMetrics[key], null, key);
  }
});

test('pronunciation handler: target text does not replace observed speech; alignment uses seconds', async (t) => {
  const h = harness(t, 'analyze-pronunciation');
  const result = await h.request({ ...defaultBody(), referenceText: 'caf\u00e9' });
  assert.equal(result.status, 200); assert.equal(result.body.ok, true);
  const data = result.body.data;
  assert.equal(data.transcript, 'water');
  assert.equal(data.pronunciationScore, 63); assert.equal(data.accuracyScore, 61);
  assert.equal(data.fluencyScore, 57); assert.equal(data.completenessScore, 100);
  assert.equal(data.prosodyScore, null); assert.equal(data.duration, 3);
  assert.equal(data.words[0].phonemes[0].accuracyScore, 0);
  assert.equal(data.words[0].phonemes[0].duration, 0.2);
  assert.deepEqual(data.alignmentData, {
    word_segments: [{ word: 'water', start: 0.5, end: 1.5 }],
    phone_segments: [{ phone: 'w', start: 0.5, end: 0.7 }],
  });
  assert.equal(h.calls.azure.length, 1);
  const { init } = h.calls.azure[0];
  assert.deepEqual(Buffer.from(init.body), audio);
  const config = JSON.parse(Buffer.from(new Headers(init.headers).get('Pronunciation-Assessment'), 'base64').toString('utf8'));
  assert.equal(config.ReferenceText, 'caf\u00e9');
  assert.equal(config.Granularity, 'Phoneme');
  assert.equal(config.EnableMiscue, true);
});

test('pronunciation handler: measured zero scores survive JSON serialization', async (t) => {
  const provider = pronunciationFixture();
  for (const key of ['PronScore', 'AccuracyScore', 'FluencyScore', 'CompletenessScore']) provider.NBest[0][key] = 0;
  const result = await harness(t, 'analyze-pronunciation', { provider }).request();
  assert.equal(result.status, 200); assert.equal(result.body.ok, true);
  for (const key of ['pronunciationScore', 'accuracyScore', 'fluencyScore', 'completenessScore']) assert.equal(result.body.data[key], 0, key);
  assert.equal(result.body.data.prosodyScore, null);
});

for (const [name, value] of [['missing', undefined], ['out of range', 101]]) {
  test(`pronunciation handler: ${name} required score cannot become a successful assessment`, async (t) => {
    const provider = pronunciationFixture(); provider.NBest[0].AccuracyScore = value;
    const result = await harness(t, 'analyze-pronunciation', { provider }).request();
    assert.equal(result.status, 502); noMeasurements(result.body);
    assert.equal(result.body.error.stage, 'parse');
  });
}
