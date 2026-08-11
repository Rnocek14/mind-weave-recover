/**
 * Core loop — the one test that actually completes therapy trials.
 *
 * Every other e2e spec is deliberately read-only ("renders without
 * crashing"), which left the product's central loop — answer → score →
 * advance → SAVE — unverified by automation. This spec plays Photo Naming
 * via the tap-to-answer choice chips (no mic required) and then asserts
 * the ground truth: exercise_events rows exist for this user.
 *
 * SELF-ARMING: while "Anonymous sign-ins" is disabled in Supabase Auth,
 * minting fails and the test SKIPS with a clear reason instead of failing
 * (unlike the shared fixture, which fails loudly — that behavior is kept
 * on the read-only suite as the visible reminder to flip the toggle).
 * The moment the toggle is enabled, this test runs for real.
 */
import { test, expect } from '@playwright/test';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? 'https://wjedbpjaiqdxhmjzkcxo.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZWRicGphaXFkeGhtanprY3hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NjgyNjcsImV4cCI6MjA3ODU0NDI2N30.tXfA1zdAqvCsZGKNlfn8OC48fhS4olS88kou0zyR7OA';

const PROJECT_REF = new URL(SUPABASE_URL).hostname.split('.')[0];
const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;

async function tryMintAnonSession(): Promise<{ session: Session; client: SupabaseClient } | null> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session) return null;
  await client.auth.setSession(data.session);
  return { session: data.session, client };
}

test.describe('Core loop — Photo Naming trials persist', () => {
  test('answer trials by chip tap and verify exercise_events are written', async ({ context }) => {
    test.slow(); // real backend round-trips

    const minted = await tryMintAnonSession();
    test.skip(
      !minted,
      'Anonymous sign-ins disabled in Supabase Auth — enable to arm this test'
    );
    const { session, client } = minted!;

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
    const startedAt = new Date().toISOString();

    await page.goto('/exercise/photo-naming');
    await page.waitForLoadState('networkidle');
    expect(new URL(page.url()).pathname).not.toBe('/auth');

    // Some variants show a start screen before the first trial.
    const startButton = page.getByRole('button', { name: /start|begin|let'?s go/i }).first();
    if (await startButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startButton.click();
    }

    // A trial is ready when the choice chips render. Each chip sits in a
    // .group wrapper alongside a speaker button labeled "Hear <word>".
    const speakerButtons = page.locator('button[aria-label^="Hear "]');
    await expect(speakerButtons.first()).toBeVisible({ timeout: 20_000 });

    // Answer up to 3 trials by tapping the first chip of each. Correctness
    // doesn't matter — a scored wrong answer exercises the same loop.
    for (let trial = 0; trial < 3; trial++) {
      const ready = await speakerButtons
        .first()
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      if (!ready) break; // summary screen or trial-cap reached — fine

      const chip = page
        .locator('div.group', { has: page.locator('button[aria-label^="Hear "]') })
        .first()
        .locator('button')
        .first();
      await chip.click();

      // Give feedback + auto-advance time to run.
      await page.waitForTimeout(2500);
    }

    // Ground truth: the loop persisted clinical rows for this user.
    await expect
      .poll(
        async () => {
          const { count } = await client
            .from('exercise_events')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', session.user.id)
            .gte('created_at', startedAt);
          return count ?? 0;
        },
        { timeout: 20_000, message: 'no exercise_events written by the core loop' }
      )
      .toBeGreaterThan(0);

    await page.close();
  });
});
