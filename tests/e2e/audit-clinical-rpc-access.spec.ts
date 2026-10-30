/**
 * Real PostgREST authorization audit against the isolated staging project.
 * No admin/service-role API keys; this intentionally calls the public API
 * as an unauthenticated visitor and two unrelated anonymous-auth users.
 *
 * Synthetic rows may persist in isolated staging for audit comparison. Never
 * run this spec against a production project.
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/integrations/supabase/types';
import { resolveE2EEnvironment } from '../../scripts/e2e-environment.mjs';
import { test, expect } from './fixtures/anonSession';

function isolatedSettings() {
  const settings = resolveE2EEnvironment();
  if (settings.suite !== 'staging') throw new Error('Clinical RLS audit requires isolated staging');
  return settings;
}

test.describe('Hospital audit: actual exposed API rejects unauthorized clinical access', () => {
  test.describe.configure({ timeout: 120_000 });

  test('anonymous and signed-in non-service clients cannot execute privileged maintenance RPCs', async ({
    isolatedSession,
  }) => {
    const settings = isolatedSettings();
    const anon = createClient<Database>(settings.supabaseURL, settings.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Calls are safe ONLY because the isolated branch has already passed
    // transactional ACL checks confirming both roles lack EXECUTE.
    const publicRefresh = await anon.rpc('refresh_cluster_assignments');
    expect(publicRefresh.error, 'anon must not execute maintenance RPC').toBeTruthy();
    const loggedInRefresh = await isolatedSession.client.rpc('refresh_cluster_assignments');
    expect(loggedInRefresh.error, 'patient must not execute maintenance RPC').toBeTruthy();

    const publicRoleRead = await anon.rpc('has_role', {
      _user_id: isolatedSession.session.user.id,
      _role: 'admin',
    });
    expect(publicRoleRead.error, 'anon cannot enumerate user role membership').toBeTruthy();
  });

  test('owner reads five clinical sources; server-only writes denied; another user sees no rows', async ({
    isolatedSession,
  }) => {
    const settings = isolatedSettings();
    const { client: owner, session } = isolatedSession;
    const { data: profile, error: profileError } = await owner
      .from('profiles').select('id').eq('user_id', session.user.id)
      .eq('profile_kind', 'patient').limit(1).maybeSingle();
    expect(profileError).toBeNull();
    expect(profile?.id, 'synthetic survivor must have an RLS-accessible patient profile').toBeTruthy();
    const profileId = profile!.id;

    const rows = [
      {
        table: 'utterance_analyses' as const,
        create: () => owner.from('utterance_analyses').insert({
          attempt_id: randomUUID(),
          user_id: session.user.id,
          profile_id: profileId,
          target_word: 'isolated-synthetic-audit-word',
          transcript: null,
          is_correct: null,
          counts_toward_score: false,
        }).select('id'),
      },
      {
        table: 'adaptation_trial_logs' as const,
        create: () => owner.from('adaptation_trial_logs').insert({
          user_id: session.user.id, profile_id: profileId,
          exercise_slug: 'photo_naming', trial_index: 1, difficulty: 1,
        }).select('id'),
      },
      {
        table: 'dose_logs' as const,
        create: () => owner.from('dose_logs').insert({
          user_id: session.user.id, profile_id: profileId,
          domain_slug: 'speech', dose_value: 1,
        }).select('id'),
      },
      {
        table: 'daily_readiness' as const,
        create: () => owner.from('daily_readiness').insert({
          user_id: session.user.id, profile_id: profileId,
          fatigue_rating: 2,
        }).select('id'),
      },
      {
        table: 'physical_daily_metrics' as const,
        create: () => owner.from('physical_daily_metrics').insert({
          user_id: session.user.id, profile_id: profileId,
          metric_date: new Date().toISOString().slice(0, 10),
          steps: 10,
        }).select('id'),
      },
    ];

    for (const entry of rows) {
      const result = await entry.create();
      if (['dose_logs', 'daily_readiness', 'physical_daily_metrics'].includes(entry.table)) {
        // These are server-owned measurement tables: authenticated users
        // deliberately lack INSERT privilege even if they own the profile.
        // Our new clinician policy is SELECT-only and must not grant writes.
        expect(result.error?.code, `non-service INSERT unexpectedly allowed into ${entry.table}`)
          .toBe('42501');
      } else {
        expect(result.error, `owner cannot save synthetic ${entry.table}`).toBeNull();
        expect(result.data).toHaveLength(1);
      }
      // Confirm that every source is readable to its owner through the API,
      // regardless of whether raw measurement inserts are server-managed.
      const ownerRead = await owner.from(entry.table).select('id').eq('profile_id', profileId);
      expect(ownerRead.error, `owner cannot read ${entry.table}`).toBeNull();
    }

    const outsider = createClient<Database>(settings.supabaseURL, settings.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: otherLogin, error: otherError } = await outsider.auth.signInAnonymously();
    if (otherError || !otherLogin.session) {
      throw new Error('Required second isolated authorization test account was not available');
    }
    try {
      const read = async (table: typeof rows[number]['table']) => {
        switch (table) {
          case 'utterance_analyses':
            return outsider.from('utterance_analyses').select('id').eq('profile_id', profileId);
          case 'adaptation_trial_logs':
            return outsider.from('adaptation_trial_logs').select('id').eq('profile_id', profileId);
          case 'dose_logs':
            return outsider.from('dose_logs').select('id').eq('profile_id', profileId);
          case 'daily_readiness':
            return outsider.from('daily_readiness').select('id').eq('profile_id', profileId);
          case 'physical_daily_metrics':
            return outsider.from('physical_daily_metrics').select('id').eq('profile_id', profileId);
        }
      };
      for (const entry of rows) {
        const { data, error } = await read(entry.table);
        // A policy may deny the request or RLS may filter every row. Neither
        // response may expose the patient's evidence to the stranger.
        if (!error) expect(data).toEqual([]);
        else expect(data ?? []).toHaveLength(0);
      }
    } finally {
      await outsider.auth.signOut();
    }
  });
});
