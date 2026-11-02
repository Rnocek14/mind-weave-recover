/** Offline structural gate. This does not replace rollback SQL or HTTP RLS tests. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL(
  '../supabase/migrations/20261102200000_enforce_patient_evidence_links.sql',
  import.meta.url,
), 'utf8');
const transactionTest = readFileSync(new URL(
  '../supabase/tests/hospital_patient_evidence_links.rollback.sql',
  import.meta.url,
), 'utf8');
const playwright = readFileSync(new URL('../playwright.config.ts', import.meta.url), 'utf8');
const httpTest = readFileSync(new URL('../tests/e2e/patient-evidence-linkage.spec.ts', import.meta.url), 'utf8');

test('every patient-evidence relation has a transactionally enforced constraint trigger', () => {
  const declarations = [...migration.matchAll(/CREATE CONSTRAINT TRIGGER (clinical_patient_link_\w+)/g)]
    .map((match) => match[1]);
  assert.deepEqual(declarations.sort(), [
    'clinical_patient_link_events',
    'clinical_patient_link_profiles',
    'clinical_patient_link_sessions',
    'clinical_patient_link_utterances',
  ]);
  assert.equal((migration.match(/DEFERRABLE INITIALLY IMMEDIATE/g) ?? []).length, 4);
  assert.match(migration, /AFTER INSERT OR UPDATE ON public\.exercise_events/);
  assert.match(migration, /AFTER INSERT OR UPDATE ON public\.utterance_analyses/);
  assert.match(migration, /AFTER UPDATE OF user_id ON public\.profiles/);
});

test('checks patient-to-profile, trial-to-session, and speech-to-owner relationships', () => {
  for (const signal of [
    'p.user_id=NEW.user_id',
    'e.profile_id IS DISTINCT FROM NEW.profile_id',
    'u.user_id IS DISTINCT FROM NEW.user_id',
    'u.profile_id IS DISTINCT FROM NEW.profile_id',
    'NEW.profile_id IS DISTINCT FROM linked_profile_id',
    'linked_user_id IS DISTINCT FROM NEW.user_id',
    'NEW.user_id IS DISTINCT FROM linked_user_id',
  ]) assert.ok(migration.includes(signal), `Missing ownership assertion: ${signal}`);
  assert.match(migration, /NEW\.session_id IS NOT NULL/);
  assert.match(migration, /NEW\.profile_id IS NOT NULL/);
  assert.match(migration, /FOR SHARE/);
});

test('privileged linkage checker is non-public and does not rewrite historical scores', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION private\.assert_neurospark_patient_evidence_links/);
  assert.match(migration, /SECURITY DEFINER\s+SET search_path TO ''/);
  assert.match(migration, /REVOKE ALL ON FUNCTION private\.assert_neurospark_patient_evidence_links\(\)\s+FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /Existing clinical evidence contains inconsistent patient links/);
  assert.doesNotMatch(migration, /^UPDATE\s+public\./gm);
  assert.doesNotMatch(migration, /^DELETE\s+FROM\s+public\./gm);
});

test('rollback-only regression exercises rejected inserts, parent updates and valid persistence', () => {
  assert.doesNotMatch(transactionTest, /^\s*COMMIT\s*;/gmi);
  for (const snippet of [
    'FAIL: cross-user session insert accepted',
    'FAIL: cross-patient event insert accepted',
    'FAIL: cross-patient speech insert accepted',
    'FAIL: cross-patient standalone analysis accepted',
    'FAIL: backend reassigned patient session',
    'FAIL: backend reassigned active profile owner',
    'FAIL: backend reassigned existing event',
    'FAIL: backend reassigned existing speech',
    'FAIL: event profile auto-fill changed',
    'FAIL: speech profile auto-fill changed',
  ]) assert.ok(transactionTest.includes(snippet), `Missing behavioral probe: ${snippet}`);
  assert.match(transactionTest, /SET LOCAL ROLE authenticated/);
  assert.match(transactionTest, /SET LOCAL ROLE postgres/);
});

test('mandatory staging browser journey calls real patient clients and checks saved owner/read-back', () => {
  assert.ok(playwright.includes("'**/patient-evidence-linkage.spec.ts'"));
  assert.match(httpTest, /from\('exercise_events'\)/);
  assert.match(httpTest, /from\('utterance_analyses'\)/);
  assert.match(httpTest, /auth\.signInAnonymously\(\)/);
  assert.match(httpTest, /23514/);
  assert.match(httpTest, /bClient\.from\('sessions'\)/);
  assert.match(httpTest, /bClient\.from\('exercise_events'\)/);
  assert.match(httpTest, /bClient\.from\('utterance_analyses'\)/);
  assert.doesNotMatch(httpTest, /test\.skip\(|test\.fixme\(/);
});
