// Telemetry anomaly detector
// Scans recent adaptation_trial_logs and writes anomalies per docs/telemetry-validation-checklist.md
//
// Invocation:
//   POST { window_hours?: number (default 24), dry_run?: boolean }
// Auth: requires admin role (or service-role bearer for cron).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { CHECKLIST_VERSION } from './rules.ts';
import { evalTrial, evalSession, type TrialRow, type AnomalyInsert } from './evaluator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrialRow {
  id: string;
  session_id: string | null;
  user_id: string | null;
  exercise_slug: string | null;
  correct: boolean | null;
  response_text: string | null;
  trial_mode: string | null;
  graded_score: number | null;
  score_vector: Record<string, unknown> | null;
  signal_granularity: string | null;
  scaffold_level: number | null;
  dominant_axis: string | null;
  archetype: string | null;
  outputs: Record<string, unknown> | null;
  created_at: string;
}

interface AnomalyInsert {
  rule_id: string;
  severity: string;
  scope: string;
  trial_log_id: string | null;
  session_id: string | null;
  user_id: string | null;
  exercise_slug: string | null;
  window_label: string | null;
  scope_ref_hash: string;
  observed: Record<string, unknown>;
  expected: Record<string, unknown>;
  checklist_version: string;
  detector_run_id: string;
}

function hash(parts: (string | null | undefined)[]): string {
  return parts.map((p) => p ?? '_').join('|');
}

function evalTrial(t: TrialRow, runId: string): AnomalyInsert[] {
  const out: AnomalyInsert[] = [];
  const base = {
    trial_log_id: t.id,
    session_id: t.session_id,
    user_id: t.user_id,
    exercise_slug: t.exercise_slug,
    window_label: null,
    checklist_version: CHECKLIST_VERSION,
    detector_run_id: runId,
  };

  const push = (rid: keyof typeof RULES, observed: Record<string, unknown>, expected: Record<string, unknown>) => {
    const r = RULES[rid];
    out.push({
      ...base,
      rule_id: r.id,
      severity: r.severity,
      scope: r.scope,
      scope_ref_hash: hash([r.id, t.id]),
      observed,
      expected,
    });
  };

  // S6
  if (t.signal_granularity === 'boolean' && (t.graded_score !== null || t.score_vector !== null)) {
    push('S6', { graded_score: t.graded_score, score_vector: t.score_vector }, { graded_score: null, score_vector: null });
  }
  // S7
  if (t.signal_granularity === 'graded' && t.graded_score === null) {
    push('S7', { graded_score: null }, { graded_score: 'required' });
  }
  // S8
  if (t.signal_granularity === 'multi-dimensional' && (t.score_vector === null || typeof t.score_vector !== 'object')) {
    push('S8', { score_vector: t.score_vector }, { score_vector: 'object required' });
  }
  // S10
  const anyGranular = t.trial_mode || t.graded_score !== null || t.score_vector !== null || t.signal_granularity || t.scaffold_level !== null;
  if (anyGranular && (!t.archetype || !t.dominant_axis)) {
    push('S10', { archetype: t.archetype, dominant_axis: t.dominant_axis }, { archetype: 'required', dominant_axis: 'required' });
  }

  // C1: production + correct + empty response_text
  if (t.trial_mode === 'production' && t.correct === true && (!t.response_text || t.response_text.trim() === '')) {
    push('C1', { response_text: t.response_text }, { response_text: 'non-empty' });
  }
  // C3: scaffolded with no scaffold signal
  if (t.trial_mode === 'scaffolded') {
    const hasSignal = (t.scaffold_level !== null && t.scaffold_level > 0) ||
      Boolean((t.outputs as { caregiver_rated?: unknown })?.caregiver_rated);
    if (!hasSignal) {
      push('C3', { scaffold_level: t.scaffold_level, outputs_keys: t.outputs ? Object.keys(t.outputs) : [] }, { scaffold_signal: 'required' });
    }
  }
  // C4: exposure trial with correct flag set (judgement)
  if (t.trial_mode === 'exposure' && t.correct !== null) {
    push('C4', { correct: t.correct }, { correct: null });
  }
  // C6
  if (t.archetype && t.dominant_axis) {
    const allowed = ARCHETYPE_AXIS_ALLOWED[t.archetype];
    if (allowed && !allowed.includes(t.dominant_axis)) {
      const ruleId = t.archetype === 'performance-pressure' ? 'C7' : t.archetype === 'open-ended' ? null : 'C6';
      if (ruleId) push(ruleId as 'C6' | 'C7', { archetype: t.archetype, dominant_axis: t.dominant_axis }, { allowed_axes: allowed });
    }
  }
  // C8: open-ended with boolean
  if (t.archetype === 'open-ended' && t.signal_granularity === 'boolean') {
    push('C8', { signal_granularity: 'boolean' }, { signal_granularity: 'graded|multi-dimensional' });
  }

  return out;
}

function evalSession(slug: string, sessionId: string, userId: string | null, trials: TrialRow[], runId: string): AnomalyInsert[] {
  const out: AnomalyInsert[] = [];
  const base = {
    trial_log_id: null,
    session_id: sessionId,
    user_id: userId,
    exercise_slug: slug,
    window_label: null,
    checklist_version: CHECKLIST_VERSION,
    detector_run_id: runId,
  };
  const push = (rid: keyof typeof RULES, observed: Record<string, unknown>, expected: Record<string, unknown>) => {
    const r = RULES[rid];
    out.push({
      ...base,
      rule_id: r.id,
      severity: r.severity,
      scope: r.scope,
      scope_ref_hash: hash([r.id, sessionId, slug]),
      observed,
      expected,
    });
  };

  const total = trials.length;
  if (total === 0) return out;

  const counts = { production: 0, recognition: 0, scaffolded: 0, exposure: 0, mixed: 0, untyped: 0 };
  let prodCorrect = 0;
  let prodTotal = 0;
  for (const t of trials) {
    const m = t.trial_mode ?? 'untyped';
    if (m in counts) (counts as Record<string, number>)[m]++;
    else counts.untyped++;
    if (t.trial_mode === 'production') {
      prodTotal++;
      if (t.correct) prodCorrect++;
    }
  }

  // Only check distributional rules for adopted slugs
  if (!ADOPTED_SLUGS.has(slug)) return out;

  const scoredTotal = total - counts.untyped;
  if (scoredTotal > 0) {
    const prodShare = counts.production / scoredTotal;
    const recogShare = counts.recognition / scoredTotal;
    const scafShare = counts.scaffolded / scoredTotal;
    if (prodShare < 0.3) push('D1', { production_share: prodShare, scored: scoredTotal }, { min: 0.3 });
    if (recogShare > 0.6) push('D2', { recognition_share: recogShare, scored: scoredTotal }, { max: 0.6 });
    if (scafShare > 0.4) push('D3', { scaffolded_share: scafShare, scored: scoredTotal }, { max: 0.4 });
  }

  // D4: untyped in an adopted slug = logger gap
  if (counts.untyped > 0) {
    push('D4', { untyped: counts.untyped, total }, { untyped: 0 });
  }

  // D7: 100% production accuracy over >=10 trials
  if (prodTotal >= 10 && prodCorrect === prodTotal) {
    push('D7', { production_trials: prodTotal, accuracy: 1.0 }, { suspect: 'mislabeling' });
  }

  return out;
}

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
