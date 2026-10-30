/**
 * Clinical metrics source audit: the deployed isolated compute-speech-profile
 * function uses a service-role database client. These API tests guard the
 * tenant/profile authorization boundary before any recalculation is written.
 *
 * No real patient, audio, or production endpoint is ever used. The fresh
 * synthetic patient has zero utterance history, so its response must report
 * insufficient measurements instead of inventing speech accuracy.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/integrations/supabase/types';
import { resolveE2EEnvironment } from '../../scripts/e2e-environment.mjs';
import { test, expect } from './fixtures/anonSession';

test.describe('Hospital audit: speech profile recalculation authorization and evidence scope', () => {
  test.describe.configure({ timeout: 120_000 });

  test('a patient cannot target another account or pass another clinical profile ID', async ({
    isolatedSession,
  }) => {
    const settings = resolveE2EEnvironment();
    if (settings.suite !== 'staging') {
      throw new Error('Speech profile authorization tests require the dedicated staging backend');
    }

    const { client: owner, session: ownerSession } = isolatedSession;
    const other = createClient<Database>(settings.supabaseURL, settings.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: otherAuth, error: authError } = await other.auth.signInAnonymously();
    if (authError || !otherAuth.session) {
      throw new Error('Could not create isolated second patient for auth test');
    }

    try {
      const { data: ownProfile, error: ownReadError } = await owner.from('profiles')
        .select('id').eq('user_id', ownerSession.user.id).limit(1).maybeSingle();
      const { data: otherProfile, error: otherReadError } = await other.from('profiles')
        .select('id').eq('user_id', otherAuth.session.user.id).limit(1).maybeSingle();
      expect(ownReadError).toBeNull();
      expect(otherReadError).toBeNull();
      expect(ownProfile?.id).toBeTruthy();
      expect(otherProfile?.id).toBeTruthy();
      expect(otherProfile!.id).not.toBe(ownProfile!.id);

      // A service-role endpoint must reject user_id impersonation, even with
      // a real valid JWT, before reading or writing the target's clinical data.
      const wrongOwner = await owner.functions.invoke('compute-speech-profile', {
        body: { user_id: otherAuth.session.user.id, profile_id: otherProfile!.id, force: true },
      });
      expect(wrongOwner.error).toBeTruthy();
      expect(wrongOwner.data?.profile).toBeUndefined();

      // A caller's user_id is not authorization for an arbitrary profile UUID.
      const wrongProfile = await owner.functions.invoke('compute-speech-profile', {
        body: { user_id: ownerSession.user.id, profile_id: otherProfile!.id, force: true },
      });
      expect(wrongProfile.error).toBeTruthy();
      expect(wrongProfile.data?.profile).toBeUndefined();

      // The allowed empty-profile path must not invent measurements from the
      // other subject's speech history, user role, or account metadata.
      const allowed = await owner.functions.invoke('compute-speech-profile', {
        body: { user_id: ownerSession.user.id, profile_id: ownProfile!.id, force: true },
      });
      expect(allowed.error).toBeNull();
      expect(allowed.data?.profile).toBeNull();
      expect(String(allowed.data?.message)).toMatch(/No utterance analyses/i);
    } finally {
      await other.auth.signOut();
    }
  });
});
