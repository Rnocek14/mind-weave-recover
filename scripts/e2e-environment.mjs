/** Fail closed before an E2E build, browser, or Supabase client can use data. */
export const PRODUCTION_PROJECT_REF = 'wjedbpjaiqdxhmjzkcxo';
export const PUBLIC_BACKEND_URL = 'http://127.0.0.1:54329';

export function resolveE2EEnvironment(env = process.env) {
  const suite = env.E2E_SUITE || 'public';
  if (!['public', 'staging'].includes(suite)) {
    throw new Error('E2E_SUITE must be public or staging.');
  }
  if (env.REQUIRE_THERAPY_E2E === 'true' && suite !== 'staging') {
    throw new Error('REQUIRE_THERAPY_E2E now requires E2E_SUITE=staging; public smoke is not therapy verification.');
  }
  const port = Number(env.PLAYWRIGHT_PORT || 4173);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 54329) {
    throw new Error('PLAYWRIGHT_PORT must be a valid unprivileged app port.');
  }
  const baseURL = `http://127.0.0.1:${port}`;
  if (env.PLAYWRIGHT_BASE_URL && env.PLAYWRIGHT_BASE_URL !== baseURL) {
    throw new Error('E2E must use its freshly built local app; PLAYWRIGHT_BASE_URL cannot override it.');
  }
  if (env.PLAYWRIGHT_NO_SERVER) {
    throw new Error('PLAYWRIGHT_NO_SERVER is not supported: E2E must build and start its own app.');
  }

  if (suite === 'public') {
    return {
      suite, port, baseURL,
      supabaseURL: PUBLIC_BACKEND_URL,
      publishableKey: 'sb_publishable_public_smoke_no_backend',
      projectRef: 'public-smoke',
    };
  }

  const rawURL = env.E2E_SUPABASE_URL;
  const publishableKey = env.E2E_SUPABASE_PUBLISHABLE_KEY;
  const projectRef = env.E2E_SUPABASE_PROJECT_REF;
  if (!rawURL || !publishableKey || !projectRef) {
    throw new Error('Staging E2E requires explicit E2E_SUPABASE_URL, E2E_SUPABASE_PUBLISHABLE_KEY, and E2E_SUPABASE_PROJECT_REF for an isolated test project.');
  }
  let url;
  try { url = new URL(rawURL); } catch { throw new Error('E2E_SUPABASE_URL must be a valid isolated test origin.'); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('E2E_SUPABASE_URL must contain only the test origin, without credentials, paths, queries, or fragments.');
  }
  if (url.hostname.includes(PRODUCTION_PROJECT_REF) || projectRef === PRODUCTION_PROJECT_REF) {
    throw new Error('Refusing E2E authentication or writes against production Supabase.');
  }
  const local = ['127.0.0.1', 'localhost'].includes(url.hostname)
    && url.protocol === 'http:' && url.port === '54321' && projectRef === 'local';
  const hosted = /^[a-z0-9]{20}$/.test(projectRef)
    && url.protocol === 'https:' && !url.port
    && url.hostname === `${projectRef}.supabase.co`;
  if (!local && !hosted) {
    throw new Error('Test backend must be localhost:54321 (project ref local) or the exact HTTPS Supabase project named by E2E_SUPABASE_PROJECT_REF.');
  }
  if (publishableKey.startsWith('sb_secret_')) {
    throw new Error('E2E browser tests require a publishable/anon key, never a secret or service-role key.');
  }
  if (!publishableKey.startsWith('sb_publishable_')) {
    let claims;
    try { claims = JSON.parse(Buffer.from(publishableKey.split('.')[1], 'base64url').toString()); }
    catch { throw new Error('E2E_SUPABASE_PUBLISHABLE_KEY must be a publishable key or an anon JWT.'); }
    if (claims.role !== 'anon' || (hosted && claims.ref !== projectRef)) {
      throw new Error('The test key must be an anon key for the selected isolated project.');
    }
  }
  return { suite, port, baseURL, supabaseURL: url.origin, publishableKey, projectRef };
}

/** Preserve the generated client's real auth/storage code; replace only its configuration. */
export function rewriteGeneratedSupabaseClient(source, settings) {
  const replacements = [
    ['SUPABASE_URL', settings.supabaseURL],
    ['SUPABASE_PUBLISHABLE_KEY', settings.publishableKey],
  ];
  let rewritten = source;
  for (const [name, value] of replacements) {
    const declaration = new RegExp(`^const ${name} = (["']).*\\1;\\s*$`, 'gm');
    if ([...rewritten.matchAll(declaration)].length !== 1) {
      throw new Error(`Generated client changed: expected exactly one literal ${name} declaration. Review the E2E configuration override.`);
    }
    rewritten = rewritten.replace(declaration, () => `const ${name} = ${JSON.stringify(value)};\n`);
  }
  return rewritten;
}

/** A second boundary in the browser catches any new hardcoded backend URL. */
export function isBlockedBackendRequest(rawURL, settings) {
  const url = new URL(rawURL);
  if (url.protocol === 'wss:') url.protocol = 'https:';
  if (url.protocol === 'ws:') url.protocol = 'http:';
  if (url.hostname.includes(PRODUCTION_PROJECT_REF)) return true;
  const isSupabase = /(^|\.)supabase\.(co|in)$/.test(url.hostname);
  if (isSupabase) return settings.suite !== 'staging' || url.origin !== settings.supabaseURL;
  return false;
}
