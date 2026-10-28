import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  resolveE2EEnvironment,
  rewriteGeneratedSupabaseClient,
  isBlockedBackendRequest,
  PRODUCTION_PROJECT_REF,
  PUBLIC_BACKEND_URL,
} from './e2e-environment.mjs';

const testRef = 'aaaaaaaaaaaaaaaaaaaa';
const staging = {
  E2E_SUITE: 'staging',
  E2E_SUPABASE_URL: `https://${testRef}.supabase.co`,
  E2E_SUPABASE_PROJECT_REF: testRef,
  E2E_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_key',
};
const jwt = (claims) => `test.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.test`;

test('public tests ignore inherited production settings and use an inert local backend', () => {
  const settings = resolveE2EEnvironment({
    VITE_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
  });
  assert.equal(settings.suite, 'public');
  assert.equal(settings.supabaseURL, PUBLIC_BACKEND_URL);
});

for (const missing of ['E2E_SUPABASE_URL', 'E2E_SUPABASE_PROJECT_REF', 'E2E_SUPABASE_PUBLISHABLE_KEY']) {
  test(`staging fails before any client exists when ${missing} is missing`, () => {
    const env = { ...staging };
    delete env[missing];
    assert.throws(() => resolveE2EEnvironment(env), /requires explicit/);
  });
}

test('production is rejected even without the old REQUIRE_THERAPY_E2E flag', () => {
  assert.throws(() => resolveE2EEnvironment({
    ...staging,
    E2E_SUPABASE_URL: `https://${PRODUCTION_PROJECT_REF}.supabase.co`,
    E2E_SUPABASE_PROJECT_REF: PRODUCTION_PROJECT_REF,
  }), /production/);
});

for (const url of [
  'https://other-project.supabase.co',
  'https://example.com',
  `https://${testRef}.supabase.co.evil.example`,
  `http://${testRef}.supabase.co`,
  `https://${testRef}.supabase.co/rest/v1`,
  `https://user:password@${testRef}.supabase.co`,
  `https://${testRef}.supabase.co?redirect=production`,
]) {
  test(`rejects an unapproved or ambiguous backend: ${url}`, () => {
    assert.throws(() => resolveE2EEnvironment({ ...staging, E2E_SUPABASE_URL: url }));
  });
}

test('accepts the explicitly named isolated hosted project', () => {
  assert.equal(resolveE2EEnvironment(staging).supabaseURL, staging.E2E_SUPABASE_URL);
});

test('accepts local Supabase only with its explicit local designation', () => {
  const env = { ...staging, E2E_SUPABASE_URL: 'http://127.0.0.1:54321', E2E_SUPABASE_PROJECT_REF: 'local' };
  assert.equal(resolveE2EEnvironment(env).projectRef, 'local');
  assert.throws(() => resolveE2EEnvironment({ ...env, E2E_SUPABASE_PROJECT_REF: testRef }));
});

for (const key of ['sb_secret_do_not_expose', jwt({ role: 'service_role', ref: testRef }), jwt({ role: 'anon', ref: PRODUCTION_PROJECT_REF }), 'not-a-key']) {
  test('rejects a privileged, wrong-project, or malformed key', () => {
    assert.throws(() => resolveE2EEnvironment({ ...staging, E2E_SUPABASE_PUBLISHABLE_KEY: key }));
  });
}

test('accepts a legacy anon key only for the chosen hosted project', () => {
  assert.doesNotThrow(() => resolveE2EEnvironment({ ...staging, E2E_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'anon', ref: testRef }) }));
});

test('cannot bypass the freshly built local app with a remote or reused server', () => {
  assert.throws(() => resolveE2EEnvironment({ PLAYWRIGHT_BASE_URL: 'https://neurospark.co' }), /local app/);
  assert.throws(() => resolveE2EEnvironment({ PLAYWRIGHT_NO_SERVER: '1' }), /own app/);
  assert.throws(() => resolveE2EEnvironment({ PLAYWRIGHT_PORT: '4173; echo unsafe' }), /valid/);
  assert.throws(() => resolveE2EEnvironment({ E2E_SUITE: 'stagng' }), /public or staging/);
  assert.throws(() => resolveE2EEnvironment({ REQUIRE_THERAPY_E2E: 'true' }), /requires E2E_SUITE=staging/);
});

test('overrides only the two configuration literals in the actual generated client', () => {
  const source = readFileSync(new URL('../src/integrations/supabase/client.ts', import.meta.url), 'utf8');
  const settings = resolveE2EEnvironment(staging);
  const rewritten = rewriteGeneratedSupabaseClient(source, settings);
  assert.ok(rewritten.includes(JSON.stringify(settings.supabaseURL)));
  assert.ok(rewritten.includes(JSON.stringify(settings.publishableKey)));
  assert.ok(!rewritten.includes(PRODUCTION_PROJECT_REF));
  const withoutConfig = (value) => value.replace(/^const SUPABASE_(URL|PUBLISHABLE_KEY) = .*;\s*$/gm, '').trim();
  assert.equal(withoutConfig(rewritten), withoutConfig(source));
});

test('fails on generated-client source drift rather than building the live client', () => {
  const source = readFileSync(new URL('../src/integrations/supabase/client.ts', import.meta.url), 'utf8');
  assert.throws(() => rewriteGeneratedSupabaseClient(source.replace('const SUPABASE_URL', 'let SUPABASE_URL'), resolveE2EEnvironment({})), /expected exactly one/);
});

test('browser guard rejects production and other projects even after a valid staging selection', () => {
  const settings = resolveE2EEnvironment(staging);
  assert.equal(isBlockedBackendRequest(`https://${PRODUCTION_PROJECT_REF}.supabase.co/rest/v1/sessions`, settings), true);
  assert.equal(isBlockedBackendRequest('https://bbbbbbbbbbbbbbbbbbbb.supabase.co/auth/v1/signup', settings), true);
  assert.equal(isBlockedBackendRequest(`${staging.E2E_SUPABASE_URL}/rest/v1/sessions`, settings), false);
  assert.equal(isBlockedBackendRequest(`wss://${testRef}.supabase.co/realtime/v1/websocket`, settings), false);
  assert.equal(isBlockedBackendRequest(`wss://${PRODUCTION_PROJECT_REF}.supabase.co/realtime/v1/websocket`, settings), true);
  assert.equal(isBlockedBackendRequest(`${staging.E2E_SUPABASE_URL}/rest/v1/sessions`, resolveE2EEnvironment({})), true);
});
