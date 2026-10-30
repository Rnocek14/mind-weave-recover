/**
 * Credential-free security/contract checks against the actual Edge handler.
 * Uses the repo's pinned TypeScript transpiler; Supabase auth/DB, provider
 * calls, bytes, and encryption are controlled. There is no live network.
 * Clinical effectiveness, physical devices and hosted RLS remain unverified.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, Script } from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fnRoot = resolve(root, 'supabase/functions');
const handlerPath = resolve(fnRoot, 'speaker-integrity/index.ts');
const parserPath = resolve(fnRoot, '_shared/speakerIntegrity.ts');
const serveImport = 'https://deno.land/std@0.168.0/http/server.ts';
const owner = '11111111-1111-4111-8111-111111111111';
const profile = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const otherProfile = '44444444-4444-4444-8444-444444444444';
const sessionId = '55555555-5555-4555-8555-555555555555';
const wrongSession = '66666666-6666-4666-8666-666666666666';
const attemptId = '77777777-7777-4777-8777-777777777777';
const recordId = '88888888-8888-4888-8888-888888888888';

function compile(path) {
  const result = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  assert.equal((result.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);
  return result.outputText;
}

function memoryDb(overrides = {}) {
  const rows = {
    profiles: [
      { id: profile, user_id: owner, profile_kind: 'patient' },
      { id: otherProfile, user_id: other, profile_kind: 'patient' },
    ],
    speaker_integrity_enrollments: [],
    speaker_integrity_checks: [],
    utterance_analyses: [],
    exercise_events: [],
    sessions: [{ id: sessionId, user_id: owner, profile_id: profile }],
    ...overrides,
  };
  const actions = [];
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.mode = 'select'; this.payload = null; this.returnOne = false; this.wantCount = false; }
    select(_columns, opts) { this.wantCount = !!opts?.count; return this; }
    eq(field, value) { this.filters.push([field, value]); return this; }
    in(field, values) { this.filters.push([field, values, 'in']); return this; }
    order() { return this; }
    gte() { return this; }
    not() { return this; }
    limit() { return this; }
    update(payload) { this.mode = 'update'; this.payload = payload; return this; }
    insert(payload) { this.mode = 'insert'; this.payload = payload; return this; }
    delete() { this.mode = 'delete'; return this; }
    upsert(payload) { this.mode = 'insert'; this.payload = payload; return this; }
    single() { this.returnOne = true; return this._eval(); }
    maybeSingle() { this.returnOne = true; return this._eval(); }
    then(resolve, reject) { return Promise.resolve(this._eval()).then(resolve, reject); }
    _eval() {
      actions.push({ table: this.table, mode: this.mode });
      const list = rows[this.table] ?? [];
      const selected = list.filter(row => this.filters.every(([key, val, mode]) => mode === 'in' ? val.includes(row[key]) : row[key] === val));
      if (this.mode === 'update') selected.forEach(row => Object.assign(row, this.payload));
      if (this.mode === 'delete') for (const item of selected) list.splice(list.indexOf(item), 1);
      if (this.mode === 'insert') list.push({ ...this.payload });
      const results = this.mode === 'insert' ? [{ ...this.payload }] : selected;
      return { data: this.returnOne ? results[0] ?? null : results, error: null, count: this.wantCount ? selected.length : null };
    }
  }
  return { rows, actions, client: {
    from(table) { return new Query(table); },
    storage: { from() { throw Error('Storage access was not expected in this test'); } },
  } };
}

function harness(t, options = {}) {
  const db = memoryDb(options.rows);
  const unexpected = [];
  let endpoint;
  const config = {
    SPEAKER_INTEGRITY_ENABLED: options.enabled === false ? 'false' : 'true',
    PYANNOTEAI_API_KEY: 'fake-provider-key',
    SPEAKER_VOICEPRINT_AES_KEY_B64: Buffer.alloc(32, 3).toString('base64'),
  };
  const context = createContext({
    Request, Response, Headers, URL, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer,
    AbortSignal, crypto, atob, btoa,
    console: { log() {}, warn() {}, error() {} },
    Deno: { env: { get: (name) => config[name] } },
    fetch: async (url) => { unexpected.push(String(url)); throw Error('Outbound network forbidden in tests'); },
  });
  const loaded = new Map();
  const load = (path) => {
    if (path !== handlerPath && path !== parserPath) throw Error('Unexpected production file: ' + path);
    if (loaded.has(path)) return loaded.get(path).exports;
    const module = { exports: {} };
    loaded.set(path, module);
    const dependency = (specifier) => {
      if (specifier === serveImport) return { serve: (fn) => { endpoint = fn; } };
      const dep = resolve(dirname(path), specifier);
      if (dep.endsWith('/_shared/auth.ts')) return {
        getAuthedUser: async () => options.authDenied ? null : { id: owner },
        adminClient: () => db.client,
        jsonResponse: (body, status = 200) => new Response(JSON.stringify(body), {
          status, headers: { 'Content-Type': 'application/json' },
        }),
        corsHeaders: { 'Access-Control-Allow-Origin': '*' },
      };
      return load(dep);
    };
    new Script('(function(require, module, exports) {\n' + compile(path) + '\n})', { filename: path })
      .runInContext(context)(dependency, module, module.exports);
    return module.exports;
  };
  load(handlerPath);
  assert.equal(typeof endpoint, 'function');
  t.after(() => assert.deepEqual(unexpected, [], 'No external network calls allowed'));
  return {
    db,
    unexpected,
    request: async (action, extras = {}, id = profile) => {
      const response = await endpoint(new Request('https://local.example/speaker-integrity', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer synthetic-test-token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, profileId: id, ...extras }),
      }));
      return { status: response.status, body: await response.json() };
    },
  };
}

test('unauthorized requests never reach privileged tables or provider', async t => {
  const h = harness(t, { authDenied: true });
  const result = await h.request('status');
  assert.equal(result.status, 401);
  assert.deepEqual(h.db.actions, []);
});

test('speaker pilot disabled by default on server and cannot send biometric audio', async t => {
  const h = harness(t, { enabled: false });
  assert.deepEqual(await h.request('status'), { status: 200, body: { enabled: false, status: 'unavailable' } });
  const enroll = await h.request('enroll', { consent: true, audioBase64: 'AQID', durationMs: 8000, mimeType: 'audio/webm' });
  assert.equal(enroll.status, 503);
  assert.equal(h.db.actions.some(x => x.table === 'speaker_integrity_enrollments'), false);
});

test('wrong profile owner denied before enrollment/history/recording access', async t => {
  const h = harness(t);
  for (const action of ['status', 'history', 'revoke', 'queue', 'review_audio', 'review', 'poll_check']) {
    const response = await h.request(action, { checkId: recordId, attemptId }, otherProfile);
    assert.equal(response.status, 403, action);
  }
  assert.equal(h.db.actions.filter(x => x.table !== 'profiles').length, 0);
});

test('no implicit consent; bad audio and unknown media types never upload', async t => {
  const h = harness(t);
  for (const obj of [
    { consent: false, durationMs: 8000, mimeType: 'audio/webm', audioBase64: 'AAAA' },
    { consent: true, durationMs: 8000, mimeType: 'image/png', audioBase64: 'AAAA' },
    { consent: true, durationMs: 250, mimeType: 'audio/webm', audioBase64: 'AAAA' },
    { consent: true, durationMs: 8000, mimeType: 'audio/webm', audioBase64: '../../etc/passwd' },
  ]) {
    const response = await h.request('enroll', obj);
    assert.equal(response.status, 400, JSON.stringify(obj));
  }
  assert.equal(h.db.actions.some(x => x.table === 'speaker_integrity_enrollments'), false);
});

test('queue refuses missing, revoked, or incomplete enrollment without touching recordings', async t => {
  const h = harness(t);
  const response = await h.request('queue', { attemptId });
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'Patient has no active consented voiceprint');
});

test('attempt attributed to wrong session cannot be processed as the current patient', async t => {
  const h = harness(t, { rows: {
    speaker_integrity_enrollments: [{
      profile_id: profile, user_id: owner, status: 'ready',
      voiceprint_ciphertext: 'synthetic', voiceprint_iv: 'synthetic', updated_at: '2030-01-01',
    }],
    utterance_analyses: [{
      user_id: owner, attempt_id: attemptId, session_id: wrongSession,
      audio_storage_path: owner + '/' + wrongSession + '/file.webm',
    }],
  } });
  const response = await h.request('queue', { attemptId });
  assert.equal(response.status, 403);
  assert.equal(h.db.actions.some(x => x.table === 'speaker_integrity_checks'), false);
});

test('arbitrary audio path in an otherwise owned session is rejected', async t => {
  const h = harness(t, { rows: {
    speaker_integrity_enrollments: [{
      profile_id: profile, user_id: owner, status: 'ready',
      voiceprint_ciphertext: 'synthetic', voiceprint_iv: 'synthetic', updated_at: '2030-01-01',
    }],
    utterance_analyses: [{
      user_id: owner, attempt_id: attemptId, session_id: sessionId,
      audio_storage_path: other + '/' + sessionId + '/foreign.webm',
    }],
  } });
  const response = await h.request('queue', { attemptId });
  assert.equal(response.status, 403);
});

test('history exposes only shadow summaries, not voiceprints or provider jobs', async t => {
  const h = harness(t, { rows: {
    speaker_integrity_checks: [{
      id: recordId, attempt_id: attemptId, profile_id: profile, user_id: owner,
      status: 'complete', label: 'mixed_speakers', reason: 'multiple_speakers_detected',
      provider_job_id: 'secret-job-id', match_confidence: 82,
      manual_review_label: 'mixed', created_at: '2030-01-01',
    }],
  } });
  const r = await h.request('history');
  assert.equal(r.status, 200);
  assert.equal(r.body.checks[0].label, 'mixed_speakers');
  assert.equal(r.body.checks[0].manualReviewLabel, 'mixed');
  assert.equal(r.body.checks[0].affectsScoring, false);
  assert.equal(JSON.stringify(r.body).includes('secret-job-id'), false);
});

test('revoke clears enrollment material and human-reviewed shadow evidence, not clinical events', async t => {
  const h = harness(t, { rows: {
    speaker_integrity_enrollments: [{
      profile_id: profile, user_id: owner, status: 'ready',
      voiceprint_ciphertext: 'secret', voiceprint_iv: 'secret',
    }],
    speaker_integrity_checks: [{ id: recordId, profile_id: profile, user_id: owner }],
    exercise_events: [{ attempt_id: attemptId, session_id: sessionId, score: 100 }],
  } });
  const r = await h.request('revoke');
  assert.equal(r.status, 200);
  assert.equal(h.db.rows.speaker_integrity_enrollments[0].voiceprint_ciphertext, null);
  assert.deepEqual(h.db.rows.speaker_integrity_checks, []);
  assert.equal(h.db.rows.exercise_events[0].score, 100);
});
