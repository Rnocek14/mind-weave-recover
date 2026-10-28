/**
 * Offline wiring for the explicitly approved, synthetic-only hosted backend.
 * This file does NOT authenticate, call HTTP, read Azure secrets, or start tests.
 * A public Supabase key identifies the app; every real journey still signs in.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveE2EEnvironment } from './e2e-environment.mjs';

export const APPROVED_STAGING_REF = 'stdiuaxigqttgdwiwbtp';
const APPROVED_ORIGIN = `https://${APPROVED_STAGING_REF}.supabase.co`;
const TARGET_URL = new URL('../tests/e2e/staging-target.public.json', import.meta.url);
const ENV_NAMES = ['E2E_SUPABASE_URL', 'E2E_SUPABASE_PUBLISHABLE_KEY', 'E2E_SUPABASE_PROJECT_REF'];

export function readStagingTarget() {
  return JSON.parse(readFileSync(TARGET_URL, 'utf8'));
}

/** The existing public/local/general E2E guard remains unchanged. */
export function configureStagingRunner(env = {}, target = readStagingTarget()) {
  if (!target || target.schemaVersion !== 1 || target.purpose !== 'synthetic-only'
    || Object.keys(target).sort().join(',') !== 'projectRef,publishableKey,purpose,schemaVersion,supabaseURL'
    || target.projectRef !== APPROVED_STAGING_REF || target.supabaseURL !== APPROVED_ORIGIN
    || typeof target.publishableKey !== 'string'
    || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(target.publishableKey)) {
    throw new Error('Staging manifest must contain only the approved project and its public client key.');
  }
  const populated = ENV_NAMES.map(name => env[name] !== undefined && env[name] !== '');
  if (populated.some(Boolean) && !populated.every(Boolean)) {
    throw new Error('Partial staging overrides are unsafe. Supply all three E2E settings or use the reviewed public manifest.');
  }
  const useOverride = populated.every(Boolean);
  const configured = {
    ...env,
    E2E_SUITE: 'staging',
    E2E_SUPABASE_URL: useOverride ? env.E2E_SUPABASE_URL : target.supabaseURL,
    E2E_SUPABASE_PUBLISHABLE_KEY: useOverride ? env.E2E_SUPABASE_PUBLISHABLE_KEY : target.publishableKey,
    E2E_SUPABASE_PROJECT_REF: useOverride ? env.E2E_SUPABASE_PROJECT_REF : target.projectRef,
  };
  // Reject newlines before generating GITHUB_ENV; never interpolate key values in shell.
  for (const name of ENV_NAMES) {
    const value = configured[name];
    if (typeof value !== 'string' || !value || value.length > 8192 || /\s/.test(value)) {
      throw new Error('Staging configuration values must be nonempty, bounded, whitespace-free strings.');
    }
  }
  const settings = resolveE2EEnvironment(configured);
  if (settings.projectRef !== APPROVED_STAGING_REF || settings.supabaseURL !== APPROVED_ORIGIN) {
    throw new Error('This hosted runner is restricted to the approved synthetic-only staging project.');
  }
  // The general guard permits a publishable prefix. This output boundary is stricter.
  if (settings.publishableKey.startsWith('sb_publishable_')
    && !/^sb_publishable_[A-Za-z0-9_-]+$/.test(settings.publishableKey)) {
    throw new Error('Invalid publishable-key format.');
  }
  const variables = Object.fromEntries(ENV_NAMES.map(name => [name, configured[name]]));
  variables.E2E_SUITE = 'staging';
  return { variables, source: useOverride ? 'explicit_environment' : 'reviewed_public_manifest' };
}

export function githubEnvironmentLines(variables) {
  // Only known, previously validated values may enter the workflow environment file.
  const validated = configureStagingRunner(variables);
  return [...ENV_NAMES, 'E2E_SUITE'].map(name => `${name}=${validated.variables[name]}\n`).join('');
}

export function setupSummary(configuration) {
  return {
    status: 'configuration_validated',
    source: configuration.source,
    projectRef: configuration.variables.E2E_SUPABASE_PROJECT_REF,
    liveAuthentication: 'not_run',
    liveAzure: 'not_run',
    persistence: 'not_run',
    note: 'Offline configuration validation is not evidence of working credentials or services.',
  };
}

export function runConfigurationCLI(args, env = process.env) {
  if (args.length !== 1 || !['--check', '--github-env'].includes(args[0])) {
    throw new Error('Select --check (offline) or --github-env (offline GitHub job setup).');
  }
  const configuration = configureStagingRunner(env);
  if (args[0] === '--github-env') {
    if (env.GITHUB_ACTIONS !== 'true' || !env.GITHUB_ENV) {
      throw new Error('--github-env requires a GitHub Actions environment file.');
    }
    appendFileSync(env.GITHUB_ENV, githubEnvironmentLines(configuration.variables));
  }
  return setupSummary(configuration);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.stdout.write(`${JSON.stringify(runConfigurationCLI(process.argv.slice(2)), null, 2)}\n`);
  } catch (error) {
    // Our messages deliberately omit supplied values, tokens and key strings.
    process.stderr.write(`Staging runner configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  }
}
