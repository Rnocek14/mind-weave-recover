/**
 * Mandatory release-only two-account patient evidence integrity journey.
 * Calls the real isolated Supabase REST API and checks actual saved rows.
 *
 * Prerequisites: reviewed isolated test backend, fresh staging attestation,
 * and the candidate patient evidence linkage migration applied there.
 * No physical microphones, real patient accounts or production credentials.
 */
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/integrations/supabase/types';
import { resolveE2EEnvironment } from '../../scripts/e2e-environment.mjs';
import { test, expect } from './fixtures/anonSession';

type DbClient = SupabaseClient<Database>;
type ManagedProfile = { id: string; created: boolean };

async function ensurePatientProfile(client: DbClient, userId: string): Promise<ManagedProfile> {
  const selected = await client.from('profiles')
    .select('id,user_id').eq('user_id',userId)
    .order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (selected.error) throw new Error('Isolated patient profile lookup failed');
  if (selected.data) {
    expect(selected.data.user_id).toBe(userId);
    return { id: selected.data.id, created: false };
  }
  const created = await client.from('profiles')
    .insert({ user_id: userId, profile_name: `Hospital QA ${randomUUID()}`, profile_kind: 'patient' })
    .select('id,user_id').single();
  if (created.error || !created.data || created.data.user_id !== userId) {
    throw new Error('Isolated patient profile creation failed');
  }
  return { id: created.data.id, created: true };
}

test('different authenticated patients cannot cross-link or read clinical evidence', async ({ isolatedSession }) => {
  test.slow();
  const settings = resolveE2EEnvironment();
  expect(settings.suite).toBe('staging');
  expect(settings.projectRef).not.toBe('wjedbpjaiqdxhmjzkcxo');

  const aClient = isolatedSession.client;
  const aUser = isolatedSession.session.user;
  expect(aUser.is_anonymous).toBe(true);

  const bClient = createClient<Database>(settings.supabaseURL, settings.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bSignIn = await bClient.auth.signInAnonymously();
  if (bSignIn.error || !bSignIn.data.user || !bSignIn.data.session ||
      bSignIn.data.user.is_anonymous !== true) {
    throw new Error('Required second isolated anonymous patient sign-in failed');
  }
  const bUser = bSignIn.data.user;
  expect(bUser.id).not.toBe(aUser.id);

  const cleanups: Array<{ client: DbClient; table: 'sessions' | 'exercise_events' | 'utterance_analyses' | 'profiles'; column: string; id: string }> = [];
  const remember = (client: DbClient, table: typeof cleanups[number]['table'], column: string, id: string) =>
    cleanups.push({ client, table, column, id });

  try {
    const aProfile = await ensurePatientProfile(aClient, aUser.id);
    const bProfile = await ensurePatientProfile(bClient, bUser.id);
    if (aProfile.created) remember(aClient, 'profiles', 'id', aProfile.id);
    if (bProfile.created) remember(bClient, 'profiles', 'id', bProfile.id);

    const aSession = await aClient.from('sessions')
      .insert({ user_id: aUser.id, profile_id: aProfile.id, plan: { synthetic_hospital_link_test: true } })
      .select('id,user_id,profile_id').single();
    const bSession = await bClient.from('sessions')
      .insert({ user_id: bUser.id, profile_id: bProfile.id, plan: { synthetic_hospital_link_test: true } })
      .select('id,user_id,profile_id').single();
    if (aSession.error || !aSession.data || bSession.error || !bSession.data) {
      throw new Error('Compatible isolated patient session creation failed');
    }
    remember(aClient, 'sessions', 'id', aSession.data.id);
    remember(bClient, 'sessions', 'id', bSession.data.id);
    expect(aSession.data).toMatchObject({ user_id: aUser.id, profile_id: aProfile.id });
    expect(bSession.data).toMatchObject({ user_id: bUser.id, profile_id: bProfile.id });

    // These were all accepted by the old staging schema in a rollback-only
    // reproduction. The actual deployed trigger must now reject each one.
    const crossSession = await aClient.from('sessions')
      .insert({ user_id: bUser.id, profile_id: aProfile.id, plan: {} });
    expect(crossSession.error?.code, 'Cross-user session insert must fail via the DB invariant').toBe('23514');

    const crossEvent = await aClient.from('exercise_events')
      .insert({ session_id: aSession.data.id, profile_id: bProfile.id, round: 1, counts_toward_score: false });
    expect(crossEvent.error?.code, 'Cross-profile event insert must fail via the DB invariant').toBe('23514');

    const badSpeechAttempt = randomUUID();
    const crossSpeech = await aClient.from('utterance_analyses')
      .insert({
        user_id: aUser.id, session_id: bSession.data.id, profile_id: bProfile.id,
        attempt_id: badSpeechAttempt, target_word: 'synthetic-unauthorized', counts_toward_score: false,
      });
    expect(crossSpeech.error?.code, 'Cross-user speech insert must fail via the DB invariant').toBe('23514');

    // The normal application omits profile_id on raw exercise/speech inserts.
    // The existing insert trigger must still fill it correctly before the new
    // AFTER ROW constraint checks the complete identity linkage.
    const event = await aClient.from('exercise_events')
      .insert({ session_id: aSession.data.id, round: 1, counts_toward_score: false })
      .select('id,session_id,profile_id').single();
    if (event.error || !event.data) throw new Error('Compatible raw trial could not persist');
    remember(aClient, 'exercise_events', 'id', event.data.id);
    expect(event.data).toMatchObject({ session_id: aSession.data.id, profile_id: aProfile.id });

    const speechAttempt = randomUUID();
    const speech = await aClient.from('utterance_analyses')
      .insert({
        user_id: aUser.id, session_id: aSession.data.id,
        attempt_id: speechAttempt, target_word: 'synthetic-compatible',
        counts_toward_score: false,
      })
      .select('id,user_id,session_id,profile_id,attempt_id').single();
    if (speech.error || !speech.data) throw new Error('Compatible utterance could not persist');
    remember(aClient, 'utterance_analyses', 'id', speech.data.id);
    expect(speech.data).toMatchObject({
      user_id: aUser.id, session_id: aSession.data.id, profile_id: aProfile.id,
      attempt_id: speechAttempt,
    });

    // Actual REST read-back and cross-account RLS; a mocked upsert or a
    // count from another backend would not establish this evidence.
    const [ownEvent, ownSpeech, bSessions, bEvents, bSpeech] = await Promise.all([
      aClient.from('exercise_events').select('id,profile_id').eq('id',event.data.id).single(),
      aClient.from('utterance_analyses').select('id,user_id,profile_id').eq('attempt_id',speechAttempt).single(),
      bClient.from('sessions').select('id').eq('id',aSession.data.id),
      bClient.from('exercise_events').select('id').eq('id',event.data.id),
      bClient.from('utterance_analyses').select('id').eq('attempt_id',speechAttempt),
    ]);
    for (const result of [ownEvent, ownSpeech, bSessions, bEvents, bSpeech]) {
      expect(result.error).toBeNull();
    }
    expect(ownEvent.data?.profile_id).toBe(aProfile.id);
    expect(ownSpeech.data).toMatchObject({ user_id: aUser.id, profile_id: aProfile.id });
    expect(bSessions.data).toHaveLength(0);
    expect(bEvents.data).toHaveLength(0);
    expect(bSpeech.data).toHaveLength(0);
  } finally {
    // Only synthetic rows created in this test, never project-wide cleanup.
    // Reverse insertion order honors utterance -> events -> sessions -> profile.
    let cleanupFailed = false;
    for (const item of cleanups.reverse()) {
      const res = item.table === 'sessions'
        ? await item.client.from('sessions').delete().eq(item.column, item.id)
        : item.table === 'exercise_events'
        ? await item.client.from('exercise_events').delete().eq(item.column, item.id)
        : item.table === 'utterance_analyses'
        ? await item.client.from('utterance_analyses').delete().eq(item.column, item.id)
        : await item.client.from('profiles').delete().eq(item.column, item.id);
      if (res.error) cleanupFailed = true;
    }
    const signOut = await bClient.auth.signOut({ scope: 'local' });
    if (signOut.error || cleanupFailed) {
      throw new Error('Synthetic evidence cleanup or second session sign-out failed');
    }
  }
});
