/**
 * Real RPC metrics and identity proof against the dedicated synthetic-only
 * staging Supabase branch. No production data, no service-role API key.
 *
 * A passing unit test of the browser's number parser cannot verify the SQL:
 * this test writes the patient's exercise_events and calls the actual
 * get_session_summary RPC through two authenticated PostgREST identities.
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/integrations/supabase/types';
import { reduceAccuracy } from '../../supabase/functions/_shared/sessionAccuracySummary';
import { resolveE2EEnvironment } from '../../scripts/e2e-environment.mjs';
import { test, expect } from './fixtures/anonSession';

const projectRef = 'stdiuaxigqttgdwiwbtp';
const noImplicitProduction = () => {
  const settings = resolveE2EEnvironment();
  if (settings.suite !== 'staging' || settings.projectRef !== projectRef ||
      settings.supabaseURL !== `https://${projectRef}.supabase.co`) {
    throw new Error('Clinical RPC write tests require the exact isolated NeuroSpark staging branch');
  }
  return settings;
};

test.describe('Hospital gate: persisted SQL session summary agrees with canonical scoring', () => {
  test.describe.configure({ timeout: 120_000 });
  test.beforeAll(() => { noImplicitProduction(); });

  test('graded score, manual/invalid and conversation exclusions, cues, timings, levels and outsider denial', async ({
    isolatedSession,
  }) => {
    const settings = noImplicitProduction();
    const { client: owner, session } = isolatedSession;
    const { data: profile, error: profileError } = await owner
      .from('profiles').select('id')
      .eq('user_id', session.user.id).eq('profile_kind', 'patient')
      .limit(1).maybeSingle();
    expect(profileError).toBeNull();
    expect(profile?.id).toBeTruthy();

    const { data: ownSession, error: sessionError } = await owner.from('sessions')
      .insert({
        user_id: session.user.id,
        profile_id: profile!.id,
        started_at: new Date().toISOString(),
        summary: { mode: 'audit_rpc_synthetic' },
      }).select('id').single();
    expect(sessionError).toBeNull();
    expect(ownSession?.id).toBeTruthy();

    const trialFixture = [
      {
        exercise_slug: 'meaning_match', score: 50, cue_level: 0,
        reaction_time_ms: 0, error_type: null,
        counts_toward_score: true, validity_label: null,
        task_parameters: { trial_mode: 'recognition', difficulty_level: 4 },
        inputs: { task_params: { difficulty_level: 9 } },
      },
      {
        exercise_slug: 'meaning_match', score: 0, cue_level: 1,
        reaction_time_ms: 2000, error_type: 'semantic_related',
        counts_toward_score: true, validity_label: null,
        task_parameters: { trial_mode: 'recognition', difficulty_level: 6 },
      },
      {
        exercise_slug: 'photo_naming', score: 100, cue_level: 2,
        reaction_time_ms: 4000, error_type: null,
        counts_toward_score: false, validity_label: 'manual_confirmed',
        task_parameters: { trial_mode: 'scaffolded', difficulty_level: 9 },
      },
      {
        exercise_slug: 'photo_naming', score: 100, cue_level: 0,
        reaction_time_ms: 5000, error_type: null,
        counts_toward_score: false, validity_label: 'background_noise',
        task_parameters: { trial_mode: 'production', difficulty_level: 10 },
      },
      {
        exercise_slug: 'conversation_partner', score: 100, cue_level: 0,
        reaction_time_ms: 6000, error_type: null,
        counts_toward_score: true, validity_label: null,
        task_parameters: { difficulty_level: 8 },
      },
      {
        exercise_slug: 'photo_naming', score: null, cue_level: 0,
        reaction_time_ms: null, error_type: null,
        counts_toward_score: false, validity_label: 'no_response',
        task_parameters: {},
      },
    ] as const;

    const dataRows = trialFixture.map((row, index) => ({
      ...row,
      session_id: ownSession!.id,
      profile_id: profile!.id,
      round: index + 1,
      trial_index: index + 1,
      attempt_id: randomUUID(),
      created_at: new Date(Date.now() + index * 1000).toISOString(),
    }));
    const { data: written, error: trialError } = await owner
      .from('exercise_events').insert(dataRows as never)
      .select('id, session_id, score, cue_level, counts_toward_score, validity_label, exercise_slug, task_parameters, engagement_flags, whisper_transcript, browser_transcript');
    expect(trialError).toBeNull();
    expect(written).toHaveLength(trialFixture.length);
    expect(new Set(written!.map(row => row.id)).size).toBe(trialFixture.length);

    // The same saved evidence is reduced by the production TS reducer and
    // by the database RPC: a graded 50/100 answer is NOT a binary 100%.
    const recordedJson = (value: unknown): Record<string, unknown> | null => {
      if (value === null) return null;
      if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Persisted clinical metadata is not an object');
      }
      return value as Record<string, unknown>;
    };
    const expected = reduceAccuracy(written!.map(row => ({
      score: row.score,
      cue_level: row.cue_level,
      counts_toward_score: row.counts_toward_score,
      validity_label: row.validity_label,
      exercise_slug: row.exercise_slug,
      task_parameters: recordedJson(row.task_parameters),
      engagement_flags: recordedJson(row.engagement_flags),
      whisper_transcript: row.whisper_transcript,
      browser_transcript: row.browser_transcript,
    })));
    expect(expected.accuracy).toBe(25);
    expect(expected.scored_trials).toBe(2);
    const { data: response, error: rpcError } = await owner.rpc('get_session_summary', {
      p_session_id: ownSession!.id,
    });
    expect(rpcError).toBeNull();
    expect(response).toHaveLength(1);
    const metrics = response![0];
    expect(Number(metrics.accuracy)).toBeCloseTo(expected.accuracy! / 100, 8);
    expect(Number(metrics.total_trials)).toBe(6);
    expect(Number(metrics.valid_trials)).toBe(expected.scored_trials);
    expect(Number(metrics.avg_rt_ms)).toBe(1000); // actual 0ms remains measured
    expect(Number(metrics.median_rt_ms)).toBe(1000);
    expect(Number(metrics.avg_cue_level)).toBeCloseTo(0.5);
    expect(Number(metrics.cue_reduction)).toBeCloseTo(-1); // support increased
    expect(metrics.start_difficulty).toBe(4);
    expect(metrics.end_difficulty).toBe(6);
    expect(metrics.error_breakdown).toMatchObject({ semantic_related: 1, timeout: 0 });

    // The stored events and metrics survive a second database read.
    const reload = await owner.rpc('get_session_summary', { p_session_id: ownSession!.id });
    expect(reload.error).toBeNull();
    expect(reload.data).toEqual(response);

    const outsider = createClient<Database>(settings.supabaseURL, settings.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: secondLogin, error: loginError } = await outsider.auth.signInAnonymously();
    if (loginError || !secondLogin.session) throw new Error('Second isolated auth user unavailable');
    try {
      const forbidden = await outsider.rpc('get_session_summary', { p_session_id: ownSession!.id });
      expect(forbidden.error, 'another account must not read the clinical session RPC').toBeTruthy();
      expect(forbidden.data).toBeNull();
    } finally {
      await outsider.auth.signOut();
    }
  });

  test('unscorable and empty sessions stay unknown while a measured zero stays zero', async ({
    isolatedSession,
  }) => {
    noImplicitProduction();
    const { client, session } = isolatedSession;
    const { data: profile, error: profileError } = await client.from('profiles').select('id')
      .eq('user_id', session.user.id).eq('profile_kind', 'patient').limit(1).maybeSingle();
    expect(profileError).toBeNull();
    expect(profile?.id).toBeTruthy();

    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { data, error } = await client.from('sessions')
        .insert({ user_id: session.user.id, profile_id: profile!.id,
          summary: { mode: 'audit_rpc_synthetic' } })
        .select('id').single();
      expect(error).toBeNull();
      ids.push(data!.id);
    }
    const { error: eventError } = await client.from('exercise_events').insert([
      { session_id: ids[0], profile_id: profile!.id, round: 1,
        exercise_slug: 'photo_naming', score: 0, cue_level: null,
        reaction_time_ms: null, counts_toward_score: false,
        validity_label: 'no_response', task_parameters: { difficulty_level: 7 } },
      { session_id: ids[1], profile_id: profile!.id, round: 1,
        exercise_slug: 'meaning_match', score: 0, cue_level: 0,
        reaction_time_ms: 0, counts_toward_score: true,
        task_parameters: { difficulty_level: 3 } },
    ]).select('id');
    expect(eventError).toBeNull();
    const read = async (id: string) => {
      const result = await client.rpc('get_session_summary', { p_session_id: id });
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      return result.data![0];
    };
    const noResponse = await read(ids[0]);
    expect(noResponse.total_trials).toBe(1);
    expect(noResponse.valid_trials).toBe(0);
    expect(noResponse.accuracy).toBeNull();
    expect(noResponse.avg_rt_ms).toBeNull();
    expect(noResponse.median_rt_ms).toBeNull();
    expect(noResponse.avg_cue_level).toBeNull();
    expect(noResponse.cue_reduction).toBeNull();
    expect(noResponse.start_difficulty).toBeNull();
    expect(noResponse.end_difficulty).toBeNull();
    expect(noResponse.no_response_count).toBe(1);

    const measuredZero = await read(ids[1]);
    expect(Number(measuredZero.accuracy)).toBe(0);
    expect(measuredZero.avg_rt_ms).toBe(0);
    expect(Number(measuredZero.avg_cue_level)).toBe(0);
    expect(measuredZero.start_difficulty).toBe(3);
    expect(measuredZero.end_difficulty).toBe(3);
    expect(measuredZero.valid_trials).toBe(1);

    const empty = await read(ids[2]);
    expect(empty.total_trials).toBe(0);
    expect(empty.valid_trials).toBe(0);
    expect(empty.accuracy).toBeNull();
    expect(empty.avg_rt_ms).toBeNull();
    expect(empty.avg_cue_level).toBeNull();
    expect(empty.start_difficulty).toBeNull();
    expect(empty.end_difficulty).toBeNull();
  });
});
