import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  APPROVED_STAGING_REF, configureStagingRunner, githubEnvironmentLines,
  readStagingTarget, runConfigurationCLI, setupSummary,
} from './staging-runner-config.mjs';
import { resolveE2EEnvironment, isBlockedBackendRequest } from './e2e-environment.mjs';

const target = readStagingTarget();
const explicit = () => ({
  E2E_SUPABASE_URL: target.supabaseURL,
  E2E_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_rotation',
  E2E_SUPABASE_PROJECT_REF: APPROVED_STAGING_REF,
});
const jwt = claims => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;

test('baseline: the existing guard rejects absent staging configuration', () => {
  assert.throws(() => resolveE2EEnvironment({ E2E_SUITE: 'staging' }), /explicit/);
});
test('reviewed manifest supplies a complete environment accepted by the real guard', () => {
  const result = configureStagingRunner({});
  assert.equal(result.source, 'reviewed_public_manifest');
  const actual = resolveE2EEnvironment(result.variables);
  assert.equal(actual.suite, 'staging');
  assert.equal(actual.projectRef, APPROVED_STAGING_REF);
  assert.equal(actual.supabaseURL, target.supabaseURL);
});
test('empty optional GitHub secrets select the same complete manifest', () => {
  const result = configureStagingRunner({ E2E_SUPABASE_URL: '', E2E_SUPABASE_PROJECT_REF: '', E2E_SUPABASE_PUBLISHABLE_KEY: '' });
  assert.equal(result.source, 'reviewed_public_manifest');
});
test('explicit rotated publishable configuration is preserved', () => {
  const result = configureStagingRunner(explicit());
  assert.equal(result.source, 'explicit_environment');
  assert.equal(result.variables.E2E_SUPABASE_PUBLISHABLE_KEY, explicit().E2E_SUPABASE_PUBLISHABLE_KEY);
});
for (const name of Object.keys(explicit())) {
  test(`partial override ${name} fails instead of mixing environments`, () => {
    assert.throws(() => configureStagingRunner({ [name]: explicit()[name] }), /Partial/);
  });
}
for (const [name, env] of [
  ['production', { ...explicit(), E2E_SUPABASE_URL: 'https://wjedbpjaiqdxhmjzkcxo.supabase.co', E2E_SUPABASE_PROJECT_REF: 'wjedbpjaiqdxhmjzkcxo' }],
  ['another hosted project', { ...explicit(), E2E_SUPABASE_URL: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co', E2E_SUPABASE_PROJECT_REF: 'aaaaaaaaaaaaaaaaaaaa' }],
  ['local backend', { ...explicit(), E2E_SUPABASE_URL: 'http://127.0.0.1:54321', E2E_SUPABASE_PROJECT_REF: 'local' }],
  ['mismatched ref', { ...explicit(), E2E_SUPABASE_PROJECT_REF: 'bbbbbbbbbbbbbbbbbbbb' }],
  ['URL query', { ...explicit(), E2E_SUPABASE_URL: `${target.supabaseURL}?other=1` }],
  ['remote browser', { ...explicit(), PLAYWRIGHT_BASE_URL: 'https://neurospark.co' }],
  ['reused browser', { ...explicit(), PLAYWRIGHT_NO_SERVER: 'true' }],
  ['secret key', { ...explicit(), E2E_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden' }],
  ['service role', { ...explicit(), E2E_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'service_role', ref: APPROVED_STAGING_REF }) }],
  ['another anon key', { ...explicit(), E2E_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'anon', ref: 'aaaaaaaaaaaaaaaaaaaa' }) }],
  ['environment injection', { ...explicit(), E2E_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fake\nE2E_SUITE=public' }],
  ['invalid public key characters', { ...explicit(), E2E_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_bad;value' }],
  ['oversized value', { ...explicit(), E2E_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'a'.repeat(8193) }],
]) {
  test(`${name} is refused before any client or test can start`, () => {
    assert.throws(() => configureStagingRunner(env));
  });
}
test('matching legacy anon key remains compatible without service privileges', () => {
  const result = configureStagingRunner({ ...explicit(), E2E_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'anon', ref: APPROVED_STAGING_REF }) });
  assert.equal(resolveE2EEnvironment(result.variables).projectRef, APPROVED_STAGING_REF);
});
for (const [name, changed] of [
  ['purpose', { ...target, purpose: 'production' }],
  ['extra secret field', { ...target, AZURE_SPEECH_KEY: 'not-allowed' }],
  ['schema version', { ...target, schemaVersion: 2 }],
  ['project', { ...target, projectRef: 'aaaaaaaaaaaaaaaaaaaa' }],
  ['origin', { ...target, supabaseURL: 'https://example.com' }],
  ['privileged key', { ...target, publishableKey: 'sb_secret_forbidden' }],
]) {
  test(`unreviewed manifest ${name} is refused`, () => assert.throws(() => configureStagingRunner({}, changed)));
}
test('a public-suite ambient setting cannot turn hosted verification into smoke tests', () => {
  assert.equal(configureStagingRunner({ E2E_SUITE: 'public' }).variables.E2E_SUITE, 'staging');
});
test('browser transport guard continues to block production', () => {
  const settings = resolveE2EEnvironment(configureStagingRunner({}).variables);
  assert.equal(isBlockedBackendRequest('https://wjedbpjaiqdxhmjzkcxo.supabase.co/rest/v1/sessions', settings), true);
  assert.equal(isBlockedBackendRequest(`${target.supabaseURL}/rest/v1/sessions`, settings), false);
});
test('configuration report omits keys and explicitly leaves live checks unrun', () => {
  const summary = setupSummary(configureStagingRunner({}));
  assert.equal(summary.liveAzure, 'not_run');
  assert.equal(summary.liveAuthentication, 'not_run');
  assert.equal(summary.persistence, 'not_run');
  assert.equal(JSON.stringify(summary).includes(target.publishableKey), false);
});
test('GitHub environment output contains only the four expected variables', () => {
  const lines = githubEnvironmentLines(configureStagingRunner({}).variables).trim().split('\n');
  assert.equal(lines.length, 4);
  assert.deepEqual(lines.map(line => line.split('=')[0]).sort(), ['E2E_SUITE', 'E2E_SUPABASE_PROJECT_REF', 'E2E_SUPABASE_PUBLISHABLE_KEY', 'E2E_SUPABASE_URL']);
});
test('offline CLI does not need GitHub or any service authentication', () => {
  assert.equal(runConfigurationCLI(['--check'], {}).status, 'configuration_validated');
});
test('wrong CLI mode cannot silently execute a live check', () => {
  assert.throws(() => runConfigurationCLI(['--run'], {}), /Select/);
});
test('environment-writing CLI cannot run outside a GitHub job', () => {
  assert.throws(() => runConfigurationCLI(['--github-env'], {}), /GitHub Actions/);
});
test('actual environment-file write is validated, bounded and does not overwrite existing content', t => {
  const directory = mkdtempSync(join(tmpdir(), 'neurospark-staging-config-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, 'env');
  writeFileSync(path, 'EXISTING=value\n');
  const report = runConfigurationCLI(['--github-env'], { GITHUB_ACTIONS: 'true', GITHUB_ENV: path });
  const content = readFileSync(path, 'utf8');
  assert.ok(content.startsWith('EXISTING=value\n'));
  assert.ok(content.includes(`E2E_SUPABASE_PROJECT_REF=${APPROVED_STAGING_REF}\n`));
  assert.equal(report.liveAzure, 'not_run');
  const before = content;
  assert.throws(() => runConfigurationCLI(['--github-env'], { GITHUB_ACTIONS: 'true', GITHUB_ENV: path, E2E_SUPABASE_URL: target.supabaseURL }));
  assert.equal(readFileSync(path, 'utf8'), before);
});
