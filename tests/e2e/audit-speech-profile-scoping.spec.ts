/**
 * Real isolated Edge Function + PostgREST test. This verifies that a
 * service-role speech-profile recomputation cannot leak measurements from a
 * different patient or a second clinical profile under the same owner.
 *
 * Runs only on an explicitly configured disposable Supabase staging branch.
 * Uses synthetic utterance evidence and never contacts live speech providers.
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/integrations/supabase/types';
import { resolveE2EEnvironment } from '../../scripts/e2e-environment.mjs';
import { test, expect } from './fixtures/anonSession';

test.describe('Clinical speech profile is restricted to the selected authorized patient', () => {
  test('profile A does not inherit eligible speech evidence from sibling profile B', async ({ isolatedSession }) => {
    test.setTimeout(90_000);
    const env = resolveE2EEnvironment();
    if (env.suite !== 'staging') throw new Error('Speech profile security verification requires isolated staging');

    const { client, session } = isolatedSession;
    const userId = session.user.id;
    const { data: active, error: profileError } = await client
      .from('profiles').select('id').eq('user_id', userId)
      .eq('profile_kind', 'patient').limit(1).single();
    expect(profileError).toBeNull();
    expect(active?.id).toBeTruthy();

    const { data: sibling, error: siblingError } = await client
      .from('profiles')
      .insert({ user_id: userId, profile_name: 'Synthetic sibling profile', is_active: false, profile_kind: 'patient' })
      .select('id').single();
    expect(siblingError, 'Cannot create second synthetic profile for isolation test').toBeNull();
    expect(sibling?.id).toBeTruthy();

    // Synthetic, controlled provenance. This is a database authorization
    // test, not evidence that a live recognition engine transcribed speech.
    const { error: utteranceError } = await client.from('utterance_analyses').insert({
      attempt_id: randomUUID(),
      user_id: userId,
      profile_id: sibling!.id,
      target_word: 'synthetic language',
      transcript: 'synthetic language',
      transcript_source: 'browser',
      counts_toward_score: true,
      is_correct: true,
      error_type: 'correct',
    });
    expect(utteranceError).toBeNull();

    // Both recomputes are made by the true owner. A service-role code path
    // must still honor profile_id when fetching the training/review evidence.
    const noEvidence = await client.functions.invoke('compute-speech-profile', {
      body: { user_id: userId, profile_id: active!.id, force: true },
    });
    expect(noEvidence.error, 'Profile A unexpectedly denied or failed').toBeNull();
    expect(noEvidence.data).toMatchObject({ profile: null });

    const withEvidence = await client.functions.invoke('compute-speech-profile', {
      body: { user_id: userId, profile_id: sibling!.id, force: true },
    });
    expect(withEvidence.error, 'Profile B recomputation failed').toBeNull();
    expect(withEvidence.data).toMatchObject({
      success: true,
      profile: { user_id: userId, profile_id: sibling!.id, trial_count_at_computation: 1 },
    });

    // Explicit user_id permission by itself must not allow a forged or
    // unrelated clinical profile ID through the elevated service client.
    const foreign = createClient<Database>(env.supabaseURL, env.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: other, error: otherLoginError } = await foreign.auth.signInAnonymously();
    if (otherLoginError || !other.session) throw new Error('Second isolated patient account not available');
    try {
      const { data: otherProfile, error: otherProfileError } = await foreign
        .from('profiles').select('id').eq('user_id', other.user.id)
        .limit(1).single();
      expect(otherProfileError).toBeNull();

      const crossProfile = await client.functions.invoke('compute-speech-profile', {
        body: { user_id: userId, profile_id: otherProfile!.id, force: true },
      });
      expect(crossProfile.error, 'A patient must not compute another patient profile').toBeTruthy();

      const impersonation = await foreign.functions.invoke('compute-speech-profile', {
        body: { user_id: userId, profile_id: sibling!.id, force: true },
      });
      expect(impersonation.error, 'An unrelated user must not compute a patient profile').toBeTruthy();
    } finally {
      await foreign.auth.signOut();
    }
  });
});
