/**
 * Explicit, short-lived release operator attestation for the exact staging
 * project. This is a policy gate, not automated proof of synthetic-only data.
 *
 * Why it exists: the existing hosted test branch has accumulated auth users
 * and sessions despite an earlier "without data" creation event. Its public
 * manifest and project name are not sufficient authorization to create more
 * test accounts, contact real speech services, or reset clinical records.
 *
 * This file performs NO network call and handles NO authentication secrets.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { configureStagingRunner } from './staging-runner-config.mjs';

export const STAGING_APPROVAL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function requireHospitalStagingAttestation(
  env = process.env,
  nowMs = Date.now(),
) {
  // Keep the original backend/prod guards as a prerequisite.
  const configuration = configureStagingRunner(env);
  const projectRef = configuration.variables.E2E_SUPABASE_PROJECT_REF;
  const attestedRef = env.NEUROSPARK_STAGING_DATA_ATTESTED_REF;
  const attestedAt = env.NEUROSPARK_STAGING_DATA_ATTESTED_AT;
  const attestedScope = env.NEUROSPARK_STAGING_DATA_ATTESTED_SCOPE;

  if (attestedRef !== projectRef ||
      attestedScope !== 'synthetic-only-reviewed' ||
      typeof attestedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(attestedAt)) {
    throw new Error(
      'Staging clinical verification blocked: a current, project-matched ' +
      'synthetic-only data attestation is required. Inspect the actual ' +
      'auth users/sessions and data provenance before approving.',
    );
  }

  const timestamp = Date.parse(attestedAt);
  if (!Number.isFinite(timestamp) ||
      !Number.isFinite(nowMs) ||
      timestamp > nowMs ||
      nowMs - timestamp >= STAGING_APPROVAL_MAX_AGE_MS) {
    throw new Error(
      'Staging clinical verification blocked: data attestation is invalid, ' +
      'in the future, or at least 24 hours old. Reinspect the backend.',
    );
  }

  return {
    status: 'operator_attestation_present',
    projectRef,
    attestedAt,
    expiresAt: new Date(timestamp + STAGING_APPROVAL_MAX_AGE_MS).toISOString(),
    evidenceScope: 'human_review_only_not_a_backend_or_data_isolation_test',
    authentication: 'not_run',
    clinicalWrites: 'not_run',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3 || process.argv[2] !== '--check') {
      throw new Error('Use --check to verify explicit data attestation before starting therapy/speech checks.');
    }
    process.stdout.write(JSON.stringify(requireHospitalStagingAttestation()) + '\n');
  } catch (error) {
    process.stderr.write(
      (error instanceof Error ? error.message : 'Hospital staging attestation refused') + '\n',
    );
    process.exitCode = 1;
  }
}
