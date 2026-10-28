import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/integrations/supabase/types';
import { resolveE2EEnvironment } from '../../../scripts/e2e-environment.mjs';
import { test as base, expect } from './safeTest';

type IsolatedSession = { session: Session; client: SupabaseClient<Database> };

// Anonymous sign-in creates a real auth user. It has the same isolated-backend
// requirement as exercise writes, even for a test that only navigates afterward.
async function mintAnonSession(): Promise<IsolatedSession> {
  const settings = resolveE2EEnvironment();
  if (settings.suite !== 'staging') {
    throw new Error('Authenticated journeys require E2E_SUITE=staging and an isolated test backend.');
  }
  const client = createClient<Database>(settings.supabaseURL, settings.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session) {
    throw new Error(`Required E2E sign-in failed: ${error?.message ?? 'no session returned'}. Configure anonymous sign-in on the isolated test project; this journey cannot be skipped.`);
  }
  return { session: data.session, client };
}

type AnonFixtures = {
  isolatedSession: IsolatedSession;
  anonPage: import('@playwright/test').Page;
};

export const test = base.extend<AnonFixtures>({
  isolatedSession: async ({ context }, runTest) => {
    const minted = await mintAnonSession();
    const settings = resolveE2EEnvironment();
    // Match supabase-js's default storage key, including its localhost form.
    const storageKey = `sb-${new URL(settings.supabaseURL).hostname.split('.')[0]}-auth-token`;
    await context.addInitScript(([key, value]) => {
      localStorage.setItem(key, value);
      localStorage.removeItem('offlineMode');
    }, [storageKey, JSON.stringify(minted.session)] as const);
    try {
      await runTest(minted);
    } finally {
      await minted.client.auth.signOut();
    }
  },
  anonPage: async ({ context, isolatedSession: _isolatedSession }, runTest) => {
    const page = await context.newPage();
    await runTest(page);
    await page.close();
  },
});

export { expect };
