/**
 * anonSession — Playwright fixture that boots the app with a real
 * Supabase anonymous session, unblocking Pass B authenticated journeys.
 *
 * Per the approved QA plan: "E2E auth: Supabase anon sign-in to avoid
 * managing test credentials." This creates a disposable anonymous auth
 * user, then injects its session into localStorage under the standard
 * supabase-js storage key so the SPA boots already signed in.
 *
 * Read-only against clinical state: we never write progression, mastery,
 * or scoring rows. The only side effect is an anonymous auth user, which
 * is exactly what the plan sanctions for E2E.
 *
 * Requires "Anonymous sign-ins" enabled in Supabase Auth. When that setting
 * is OFF the environment cannot mint a session, which says nothing about
 * whether the app works — so these specs SKIP with an actionable message
 * rather than fail. Any OTHER sign-in error (bad URL, bad key, network) is
 * still a hard failure: a misconfigured client must not silently skip the
 * entire authenticated suite.
 */
import { test as base, expect } from '@playwright/test';
import { createClient, type Session } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? 'https://wjedbpjaiqdxhmjzkcxo.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZWRicGphaXFkeGhtanprY3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NjgyNjcsImV4cCI6MjA3ODU0NDI2N30.tXfA1zdAqvCsZGKNlfn8OC48fhS4olS88kou0zyR7OA';

// supabase-js v2 localStorage key: sb-<project-ref>-auth-token
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

/** Supabase's wording when the Anonymous provider is turned off. */
function isAnonProviderDisabled(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  return text.includes('anonymous_provider_disabled') || text.includes('anonymous sign-ins are disabled');
}

/** Resolves to a session, or null when the project has the provider turned off. */
async function mintAnonSession(): Promise<Session | null> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInAnonymously();
  if (isAnonProviderDisabled(error)) return null;
  if (error || !data.session) {
    throw new Error(
      `Anonymous sign-in failed: ${error?.message ?? 'no session returned'}`
    );
  }
  return data.session;
}

type AnonFixtures = {
  /** A page that boots with a real Supabase anonymous session in localStorage. */
  anonPage: import('@playwright/test').Page;
};

export const test = base.extend<AnonFixtures>({
  anonPage: async ({ context }, use, testInfo) => {
    const session = await mintAnonSession();
    testInfo.skip(
      session === null,
      'Supabase "Anonymous sign-ins" is disabled — enable it under Auth → Sign In / Providers to run the authenticated journeys.'
    );
    // supabase-js reads the persisted session as a JSON-stringified object.
    await context.addInitScript(
      ([key, value]) => {
        try {
          localStorage.setItem(key, value);
          localStorage.removeItem('offlineMode');
        } catch {
          /* ignore */
        }
      },
      [STORAGE_KEY, JSON.stringify(session)] as const
    );
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

export { expect };
