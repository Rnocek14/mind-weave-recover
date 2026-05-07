// Telemetry anomaly detector
// Scans recent adaptation_trial_logs and writes anomalies per docs/telemetry-validation-checklist.md
//
// Invocation:
//   POST { window_hours?: number (default 24), dry_run?: boolean }
// Auth: requires admin role (or service-role bearer for cron).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CHECKLIST_VERSION, ADOPTED_SLUGS } from './rules.ts';
import { evalTrial, evalSession, evalWindow, type TrialRow, type AnomalyInsert, type SessionAggregate } from './evaluator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authorize: admin role OR service-role bearer
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    let isAuthorized = false;
    if (token && token === SERVICE_ROLE) {
      isAuthorized = true;
    } else if (token) {
      const userClient = createClient(SUPABASE_URL, ANON, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u } = await userClient.auth.getUser();
      if (u?.user) {
        const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
        const { data: hasAdmin } = await admin.rpc('has_role', { _user_id: u.user.id, _role: 'admin' });
        isAuthorized = Boolean(hasAdmin);
      }
    }
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const windowHours = Math.min(Math.max(Number(body.window_hours ?? 24), 1), 24 * 30);
    const dryRun = Boolean(body.dry_run);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: runRow, error: runErr } = await admin
      .from('adaptation_anomaly_detector_runs')
      .insert({ checklist_version: CHECKLIST_VERSION, notes: dryRun ? 'dry_run' : null })
      .select('id')
      .single();
    if (runErr || !runRow) throw runErr ?? new Error('failed to create run');
    const runId = runRow.id as string;

    const since = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();
    const { data: trials, error: trialErr } = await admin
      .from('adaptation_trial_logs')
      .select('id, session_id, user_id, exercise_slug, correct, response_text, trial_mode, graded_score, score_vector, signal_granularity, scaffold_level, dominant_axis, archetype, outputs, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(50000);
    if (trialErr) throw trialErr;

    const allTrials = (trials ?? []) as TrialRow[];
    const anomalies: AnomalyInsert[] = [];

    // Trial-level
    for (const t of allTrials) anomalies.push(...evalTrial(t, runId));

    // Session × slug grouping for distributional rules
    const groups = new Map<string, { slug: string; sessionId: string; userId: string | null; trials: TrialRow[] }>();
    for (const t of allTrials) {
      if (!t.session_id || !t.exercise_slug) continue;
      const key = `${t.session_id}::${t.exercise_slug}`;
      if (!groups.has(key)) groups.set(key, { slug: t.exercise_slug, sessionId: t.session_id, userId: t.user_id, trials: [] });
      groups.get(key)!.trials.push(t);
    }
    for (const g of groups.values()) anomalies.push(...evalSession(g.slug, g.sessionId, g.userId, g.trials, runId));

    // ---------- Cross-session trajectory (D8/D9) ----------
    // Adopted slugs only. Pulls a wider window (default 30 days) so we can
    // see ≥8 recent sessions per user×slug. Read-only: emits anomalies; no
    // gating, no enforcement.
    const trajectoryDays = Math.min(Math.max(Number(body.trajectory_days ?? 30), 7), 120);
    const trajSince = new Date(Date.now() - trajectoryDays * 86400 * 1000).toISOString();
    const adoptedList = Array.from(ADOPTED_SLUGS);
    if (adoptedList.length > 0) {
      const { data: trajTrials, error: trajErr } = await admin
        .from('adaptation_trial_logs')
        .select('id, session_id, user_id, exercise_slug, correct, trial_mode, scaffold_level, created_at')
        .in('exercise_slug', adoptedList)
        .gte('created_at', trajSince)
        .order('created_at', { ascending: true })
        .limit(100000);
      if (trajErr) throw trajErr;

      // Group by (user, slug, session) → aggregate.
      type AggKey = string;
      const aggBySession = new Map<AggKey, SessionAggregate & { user_id: string; slug: string }>();
      for (const t of (trajTrials ?? []) as Array<{
        id: string; session_id: string | null; user_id: string | null; exercise_slug: string | null;
        correct: boolean | null; trial_mode: string | null; scaffold_level: number | null; created_at: string;
      }>) {
        if (!t.session_id || !t.user_id || !t.exercise_slug) continue;
        const k = `${t.user_id}::${t.exercise_slug}::${t.session_id}`;
        let a = aggBySession.get(k);
        if (!a) {
          a = {
            user_id: t.user_id,
            slug: t.exercise_slug,
            session_id: t.session_id,
            started_at: t.created_at,
            trials_total: 0,
            production_count: 0,
            recognition_count: 0,
            scaffolded_count: 0,
            exposure_count: 0,
            scaffold_level_mean: null,
            production_correct: 0,
            production_total: 0,
          } as SessionAggregate & { user_id: string; slug: string };
          aggBySession.set(k, a);
        }
        a.trials_total++;
        if (t.created_at < a.started_at) a.started_at = t.created_at;
        switch (t.trial_mode) {
          case 'production': a.production_count++; a.production_total++; if (t.correct) a.production_correct++; break;
          case 'recognition': a.recognition_count++; break;
          case 'scaffolded': a.scaffolded_count++; break;
          case 'exposure': a.exposure_count++; break;
        }
        if (t.scaffold_level !== null) {
          // Online mean update.
          const prev = a.scaffold_level_mean;
          const prevN = (a as unknown as { _scafN?: number })._scafN ?? 0;
          const nextN = prevN + 1;
          const nextMean = prev === null ? t.scaffold_level : prev + (t.scaffold_level - prev) / nextN;
          a.scaffold_level_mean = nextMean;
          (a as unknown as { _scafN?: number })._scafN = nextN;
        }
      }

      // Group sessions by (user, slug), order chronologically, keep most recent ≤12.
      const byUserSlug = new Map<string, { user_id: string; slug: string; sessions: SessionAggregate[] }>();
      for (const a of aggBySession.values()) {
        const k = `${a.user_id}::${a.slug}`;
        let bucket = byUserSlug.get(k);
        if (!bucket) {
          bucket = { user_id: a.user_id, slug: a.slug, sessions: [] };
          byUserSlug.set(k, bucket);
        }
        const { user_id: _u, slug: _s, ...sess } = a as SessionAggregate & { user_id: string; slug: string };
        bucket.sessions.push(sess);
      }
      for (const bucket of byUserSlug.values()) {
        bucket.sessions.sort((x, y) => x.started_at.localeCompare(y.started_at));
        const recent = bucket.sessions.slice(-12);
        anomalies.push(...evalWindow({ slug: bucket.slug, userId: bucket.user_id, sessions: recent }, runId));
      }
    }

    let written = 0;
    let skipped = 0;
    if (!dryRun && anomalies.length > 0) {
      // Upsert in chunks; on conflict (rule_id, scope, scope_ref_hash) ignore
      for (let i = 0; i < anomalies.length; i += 500) {
        const chunk = anomalies.slice(i, i + 500);
        const { data: upserted, error: upErr } = await admin
          .from('adaptation_trial_log_anomalies')
          .upsert(chunk, { onConflict: 'rule_id,scope,scope_ref_hash', ignoreDuplicates: true })
          .select('id');
        if (upErr) throw upErr;
        written += upserted?.length ?? 0;
        skipped += chunk.length - (upserted?.length ?? 0);
      }
    }

    await admin
      .from('adaptation_anomaly_detector_runs')
      .update({
        finished_at: new Date().toISOString(),
        trials_scanned: allTrials.length,
        anomalies_written: written,
        anomalies_skipped_dup: skipped,
      })
      .eq('id', runId);

    return new Response(
      JSON.stringify({
        run_id: runId,
        window_hours: windowHours,
        trials_scanned: allTrials.length,
        anomalies_detected: anomalies.length,
        anomalies_written: written,
        anomalies_skipped_dup: skipped,
        dry_run: dryRun,
        checklist_version: CHECKLIST_VERSION,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('detect-telemetry-anomalies error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
