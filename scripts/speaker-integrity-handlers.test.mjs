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
const voiceprintJob = '99999999-9999-4999-8999-999999999999';
const identifyJob = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function compile(path) {
  const result = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  assert.equal((result.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);
  return result.outputText;
}

function memoryDb(overrides = {}, useSyntheticProvider = false) {
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
  const storageActions = [];
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
      const newItem = this.mode === 'insert'
        ? { ...this.payload, ...(this.table === 'speaker_integrity_checks' ? { id: recordId } : {}) }
        : null;
      if (newItem) list.push(newItem);
      const results = newItem ? [newItem] : selected;
      return { data: this.returnOne ? results[0] ?? null : results, error: null, count: this.wantCount ? selected.length : null };
    }
  }
  return { rows, actions, storageActions, client: {
    from(table) { return new Query(table); },
    storage: { from(bucket) {
      if (!useSyntheticProvider) throw Error('Storage access was not expected in this test');
      assert.equal(bucket, 'session-recordings');
      return {
        async download(path) {
          storageActions.push({ action: 'download', path });
          return { data: new Blob([Buffer.alloc(6000)], { type: 'audio/webm' }), error: null };
        },
        async createSignedUrl(path, ttl) {
          storageActions.push({ action: 'sign', path, ttl });
          return { data: { signedUrl: 'https://signed.synthetic.local/authorized-only' }, error: null };
        },
      };
    } },
  } };
}

function harness(t, options = {}) {
  const db = memoryDb(options.rows, !!options.syntheticProvider);
  const unexpected = [];
  let endpoint;
  const config = {
    SPEAKER_INTEGRITY_ENABLED: options.enabled === false ? 'false' : 'true',
    PYANNOTEAI_API_KEY: 'fake-provider-key',
    SPEAKER_VOICEPRINT_AES_KEY_B64: Buffer.alloc(32, 3).toString('base64'),
  };
  const context = createContext({
    Request, Response, Headers, URL, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, Blob,
    AbortSignal, crypto, atob, btoa,
    console: { log() {}, warn() {}, error() {} },
    Deno: { env: { get: (name) => config[name] } },
    fetch: async (url, init) => {
      // An allowlisted synthetic provider transport, NEVER an outbound request.
      // Exercises actual production upload, encryption, queue and poll logic.
      if (options.syntheticProvider) {
        const path = String(url);
        if (path === 'https://api.pyannote.ai/v1/media/input') {
          return new Response(JSON.stringify({ url: 'https://signed-upload.synthetic.local/one-time' }), { status: 200 });
        }
        if (path === 'https://signed-upload.synthetic.local/one-time' && init?.method === 'PUT') {
          assert.ok(init.body instanceof Uint8Array);
          return new Response(null, { status: 200 });
        }
        if (path === 'https://api.pyannote.ai/v1/voiceprint') {
          assert.equal(init.method, 'POST');
          assert.equal(JSON.parse(init.body).model, 'precision-2');
          return new Response(JSON.stringify({ jobId: voiceprintJob, status: 'created' }), { status: 200 });
        }
        if (path === 'https://api.pyannote.ai/v1/identify') {
          assert.equal(init.method, 'POST');
          const json = JSON.parse(init.body);
          assert.equal(json.voiceprints[0].label, 'patient');
          assert.equal(json.voiceprints[0].voiceprint, 'synthetic-voiceprint-never-from-a-patient');
          return new Response(JSON.stringify({ jobId: identifyJob, status: 'created' }), { status: 200 });
        }
        if (path === 'https://api.pyannote.ai/v1/jobs/' + voiceprintJob) {
          return new Response(JSON.stringify({
            status: 'succeeded', output: { voiceprint: 'synthetic-voiceprint-never-from-a-patient' },
          }), { status: 200 });
        }
        if (path === 'https://api.pyannote.ai/v1/jobs/' + identifyJob) {
          return new Response(JSON.stringify({
            status: 'succeeded',
            output: {
              diarization: [{ speaker: 'SPEAKER_00', start: 0, end: 3.2 }],
              identification: [{ speaker: 'patient', start: 0, end: 3.2, diarizationSpeaker: 'SPEAKER_00', match: 'patient' }],
              voiceprints: [{ speaker: 'SPEAKER_00', match: 'patient', confidence: { patient: 88 } }],
            },
          }), { status: 200 });
        }
      }
      unexpected.push(String(url));
      throw Error('Unexpected or outbound network destination forbidden in tests');
    },
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


test('enroll → encrypt → verify recorded attempt → human review → revoke stays SHADOW-ONLY', async t => {
  const recordingPath = owner + '/' + sessionId + '/trial-1-synthetic.webm';
  const originalClinicalRow = {
    user_id: owner, session_id: sessionId, attempt_id: attemptId,
    audio_storage_path: recordingPath, recording_duration_ms: 3500, is_correct: true,
  };
  const h = harness(t, { syntheticProvider: true, rows: {
    utterance_analyses: [originalClinicalRow],
    exercise_events: [{ id: 'synthetic-event', attempt_id: attemptId, session_id: sessionId, score: 100 }],
  } });

  const result = await h.request('enroll', {
    consent: true, mimeType: 'audio/webm',
    audioBase64: Buffer.alloc(6000, 8).toString('base64'), durationMs: 8000,
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.status, 'pending');
  assert.equal(h.db.rows.speaker_integrity_enrollments[0].voiceprint_ciphertext, null);
  assert.equal(h.db.rows.speaker_integrity_enrollments[0].provider_job_id, voiceprintJob);

  const enrolled = await h.request('poll_enrollment');
  assert.equal(enrolled.status, 200, JSON.stringify(enrolled.body));
  assert.equal(enrolled.body.status, 'ready');
  const saved = h.db.rows.speaker_integrity_enrollments[0];
  assert.equal(saved.status, 'ready');
  assert.equal(saved.provider_job_id, null);
  assert.ok(saved.voiceprint_ciphertext.length > 24);
  assert.notEqual(saved.voiceprint_ciphertext, 'synthetic-voiceprint-never-from-a-patient');
  assert.ok(saved.voiceprint_iv.length > 12);

  const queued = await h.request('queue', { attemptId });
  assert.equal(queued.status, 200, JSON.stringify(queued.body));
  assert.equal(queued.body.checkId, recordId);
  assert.equal(queued.body.status, 'pending');
  assert.deepEqual(h.db.storageActions, [{ action: 'download', path: recordingPath }]);

  const complete = await h.request('poll_check', { checkId: recordId });
  assert.equal(complete.status, 200, JSON.stringify(complete.body));
  assert.equal(complete.body.check.label, 'patient_candidate');
  assert.equal(complete.body.check.affectsScoring, false);
  assert.equal(complete.body.check.confidence, 88);
  assert.equal(JSON.stringify(complete.body).includes('synthetic-voiceprint'), false);

  const audio = await h.request('review_audio', { checkId: recordId });
  assert.equal(audio.status, 200);
  assert.equal(audio.body.signedUrl, 'https://signed.synthetic.local/authorized-only');
  assert.equal(audio.body.expiresInSeconds, 90);

  const review = await h.request('review', { checkId: recordId, label: 'mixed' });
  assert.equal(review.status, 200);
  assert.equal(review.body.affectsScoring, false);
  assert.equal(h.db.rows.speaker_integrity_checks[0].manual_review_label, 'mixed');
  assert.equal(h.db.rows.utterance_analyses[0].is_correct, true);
  assert.equal(h.db.rows.exercise_events[0].score, 100);

  const revoked = await h.request('revoke');
  assert.equal(revoked.status, 200);
  assert.equal(h.db.rows.speaker_integrity_enrollments[0].voiceprint_ciphertext, null);
  assert.equal(h.db.rows.speaker_integrity_checks.length, 0);
  assert.equal(h.db.rows.exercise_events[0].score, 100);
});
