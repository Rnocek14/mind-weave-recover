import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  requireHospitalStagingAttestation,
  STAGING_APPROVAL_MAX_AGE_MS,
} from './hospital-staging-attestation.mjs';
import { APPROVED_STAGING_REF } from './staging-runner-config.mjs';

const when = Date.parse('2026-11-02T19:00:00Z');
const approved = () => ({
  NEUROSPARK_STAGING_DATA_ATTESTED_REF: APPROVED_STAGING_REF,
  NEUROSPARK_STAGING_DATA_ATTESTED_AT: '2026-11-02T18:10:00Z',
  NEUROSPARK_STAGING_DATA_ATTESTED_SCOPE: 'synthetic-only-reviewed',
});

test('staging release refuses the current public project manifest alone', () => {
  assert.throws(() => requireHospitalStagingAttestation({}, when), /attestation is required/);
});

test('staging release accepts a fresh, explicit exact-project attestation only', () => {
  const outcome = requireHospitalStagingAttestation(approved(), when);
  assert.equal(outcome.status, 'operator_attestation_present');
  assert.equal(outcome.projectRef, APPROVED_STAGING_REF);
  assert.equal(outcome.authentication, 'not_run');
  assert.equal(outcome.clinicalWrites, 'not_run');
  assert.equal(outcome.evidenceScope, 'human_review_only_not_a_backend_or_data_isolation_test');
  assert.equal(
    Date.parse(outcome.expiresAt) - Date.parse(outcome.attestedAt),
    STAGING_APPROVAL_MAX_AGE_MS,
  );
});

for (const [reason, changed] of [
  ['wrong project', { NEUROSPARK_STAGING_DATA_ATTESTED_REF: 'bbbbbbbbbbbbbbbbbbbb' }],
  ['production project', { NEUROSPARK_STAGING_DATA_ATTESTED_REF: 'wjedbpjaiqdxhmjzkcxo' }],
  ['scope missing', { NEUROSPARK_STAGING_DATA_ATTESTED_SCOPE: undefined }],
  ['false scope', { NEUROSPARK_STAGING_DATA_ATTESTED_SCOPE: 'pending-review' }],
  ['old date', { NEUROSPARK_STAGING_DATA_ATTESTED_AT: '2026-11-01T18:00:00Z' }],
  ['future date', { NEUROSPARK_STAGING_DATA_ATTESTED_AT: '2026-11-03T18:00:00Z' }],
  ['no date', { NEUROSPARK_STAGING_DATA_ATTESTED_AT: undefined }],
  ['invalid date', { NEUROSPARK_STAGING_DATA_ATTESTED_AT: '2026-11-02T25:00:00Z' }],
  ['non-UTC date', { NEUROSPARK_STAGING_DATA_ATTESTED_AT: '2026-11-02 18:00:00' }],
  ['nonsensical text', { NEUROSPARK_STAGING_DATA_ATTESTED_AT: 'trust-me' }],
]) {
  test('staging approval fails closed: ' + reason, () => {
    assert.throws(() => requireHospitalStagingAttestation({ ...approved(), ...changed }, when));
  });
}

test('production and mismatched endpoints remain blocked even with fresh attestation', () => {
  assert.throws(() => requireHospitalStagingAttestation({
    ...approved(),
    E2E_SUPABASE_URL: 'https://wjedbpjaiqdxhmjzkcxo.supabase.co',
    E2E_SUPABASE_PROJECT_REF: 'wjedbpjaiqdxhmjzkcxo',
    E2E_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  }, when));
});

test('approvals expire at the precise 24-hour boundary', () => {
  const at = Date.parse(approved().NEUROSPARK_STAGING_DATA_ATTESTED_AT);
  assert.doesNotThrow(() => requireHospitalStagingAttestation(approved(), at + STAGING_APPROVAL_MAX_AGE_MS - 1));
  assert.throws(() => requireHospitalStagingAttestation(approved(), at + STAGING_APPROVAL_MAX_AGE_MS));
});

test('reviewed SQL includes server-side patient boundaries and privileged revocation', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261102195000_hospital_privileged_rpc_perimeter.sql', import.meta.url), 'utf8');
  assert.match(sql, /CREATE OR REPLACE FUNCTION private\.can_access_stroke_patient/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION private\.can_access_stroke_user_scoped/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_active_clinical_profile/);
  assert.match(sql, /private\.can_access_stroke_user_scoped\(p_user_id\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_session_summary/);
  assert.match(sql, /private\.can_access_stroke_patient\(s\.user_id,s\.profile_id,true\)/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_profile_version/);
  assert.match(sql, /COALESCE\(auth\.uid\(\), p_created_by\)/);
  assert.match(sql, /'setup_admin_user'/);
  assert.match(sql, /'claim_speech_analysis_jobs'/);
  assert.match(sql, /'submit_speech_analysis_result'/);
  assert.match(sql, /'upsert_worker_heartbeat'/);
  assert.match(sql, /REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION %s TO service_role/);
  assert.doesNotMatch(sql, /END IF;\s*BEGIN\s*(?:CASE|REFRESH|SELECT|UPDATE)/);
  // This is an offline text contract, not PostgreSQL syntax/execution proof,
  // database authorization evidence, or production deployment verification.
});
