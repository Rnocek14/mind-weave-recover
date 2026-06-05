// ============================================================================
// compute-adaptation-profile
// Builds/refreshes a single user_adaptation_profiles row per profile.
// Reads from exercise_events + learning_rates over the last 14-30 days.
// Idempotent. Safe to call after every session OR on a nightly cron.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ErrorBucket = 'semantic' | 'phonemic' | 'no_response' | 'other';

interface ProfileRow {
  user_id: string;
  profile_id: string;
  dominant_error_type: string | null;
  error_type_distribution: Record<string, number>;
  recommended_cue_bias: string | null;
  cue_dependency_score: number | null;
  cue_dependency_trend: 'fading' | 'stable' | 'increasing' | 'unknown';
  avg_response_latency_ms: number | null;
  latency_trend_pct: number | null;
  engagement_baseline: Record<string, unknown>;
  plateau_flag: boolean;
  plateau_domains: string[];
  trial_count_window: number;
  data_confidence: 'low' | 'medium' | 'high';
  version: number;
  last_computed_at: string;
}

function bucketError(errorType: string | null | undefined): ErrorBucket {
  if (!errorType) return 'other';
  const e = errorType.toLowerCase();
  if (e.includes('semantic')) return 'semantic';
  if (e.includes('phon')) return 'phonemic';
  if (e === 'no_response' || e === 'timeout' || e === 'no_verbal_output') return 'no_response';
  return 'other';
}

function computeDistribution(buckets: ErrorBucket[]): Record<string, number> {
  if (buckets.length === 0) return {};
  const counts: Record<string, number> = {};
  for (const b of buckets) counts[b] = (counts[b] || 0) + 1;
  const total = buckets.length;
  const dist: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) dist[k] = +(v / total).toFixed(3);
  return dist;
}

function dominantFromDistribution(dist: Record<string, number>): string | null {
  const entries = Object.entries(dist).filter(([k]) => k !== 'other');
  if (entries.length === 0) return null;
  const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  // 'mixed' if no error type owns >40% of errors
  if (top[1] < 0.4) return 'mixed';
  return top[0];
}

function cueBiasFromDominant(dominant: string | null): string | null {
  if (!dominant) return null;
  if (dominant === 'semantic') return 'phonemic';   // they have meaning, need form
  if (dominant === 'phonemic') return 'semantic';   // they have form, lock meaning
  if (dominant === 'no_response') return 'mixed';
  return 'mixed';
}

function computeCueTrend(
  recentAvg: number | null,
  priorAvg: number | null
): 'fading' | 'stable' | 'increasing' | 'unknown' {
  if (recentAvg === null || priorAvg === null) return 'unknown';
  const delta = recentAvg - priorAvg;
  if (delta < -0.15) return 'fading';      // less help needed
  if (delta > 0.15) return 'increasing';   // more help needed
  return 'stable';
}

function confidenceFromTrials(n: number): 'low' | 'medium' | 'high' {
  if (n >= 60) return 'high';
  if (n >= 20) return 'medium';
  return 'low';
}

async function buildProfileForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  profileId: string
): Promise<ProfileRow | null> {
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Pull recent trials with errors + cue level + reaction time
  const { data: events, error: eventsErr } = await supabase
    .from('exercise_events')
    .select('error_type, cue_level, reaction_time_ms, score, created_at, session_id, sessions!inner(profile_id)')
    .gte('created_at', fourteenDaysAgo.toISOString())
    .eq('sessions.profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (eventsErr) {
    console.error('events fetch failed', eventsErr);
    return null;
  }

  const trials = events ?? [];
  if (trials.length === 0) return null;

  // Error distribution (incorrect trials only)
  const errorBuckets = trials
    .filter((t: any) => t.score !== null && t.score < 50 && t.error_type)
    .map((t: any) => bucketError(t.error_type));
  const distribution = computeDistribution(errorBuckets as ErrorBucket[]);
  const dominant = dominantFromDistribution(distribution);
  const cueBias = cueBiasFromDominant(dominant);

  // Cue dependency: weighted avg cue level over recent vs prior window
  const cueLevels = trials
    .filter((t: any) => t.cue_level !== null && t.cue_level !== undefined)
    .map((t: any) => ({ level: Number(t.cue_level), at: new Date(t.created_at) }));
  const recentCues = cueLevels.filter((c) => c.at >= sevenDaysAgo);
  const priorCues = cueLevels.filter((c) => c.at < sevenDaysAgo);
  const recentAvgCue = recentCues.length
    ? recentCues.reduce((s, c) => s + c.level, 0) / recentCues.length
    : null;
  const priorAvgCue = priorCues.length
    ? priorCues.reduce((s, c) => s + c.level, 0) / priorCues.length
    : null;
  const MAX_CUE = 3;
  const cueDependencyScore = recentAvgCue !== null
    ? +(recentAvgCue / MAX_CUE).toFixed(3)
    : null;
  const cueTrend = computeCueTrend(recentAvgCue, priorAvgCue);

  // Latency trend
  const latencies = trials
    .filter((t: any) => t.reaction_time_ms && t.reaction_time_ms > 0)
    .map((t: any) => ({ rt: Number(t.reaction_time_ms), at: new Date(t.created_at) }));
  const recentLat = latencies.filter((l) => l.at >= sevenDaysAgo);
  const priorLat = latencies.filter((l) => l.at < sevenDaysAgo);
  const avgRecent = recentLat.length
    ? Math.round(recentLat.reduce((s, l) => s + l.rt, 0) / recentLat.length)
    : null;
  const avgPrior = priorLat.length
    ? Math.round(priorLat.reduce((s, l) => s + l.rt, 0) / priorLat.length)
    : null;
  const latencyTrendPct = avgRecent && avgPrior
    ? +(((avgRecent - avgPrior) / avgPrior) * 100).toFixed(1)
    : null;

  // Engagement baseline
  const totalTrials = trials.length;
  const totalErrors = trials.filter((t: any) => t.score !== null && t.score < 50).length;
  const engagementBaseline = {
    typical_error_rate: +(totalErrors / totalTrials).toFixed(3),
    sessions_in_window: new Set(trials.map((t: any) => t.session_id)).size,
  };

  // Plateau detection from learning_rates: any domain with |slope| < 0.005 over last 14d
  const { data: rates } = await supabase
    .from('learning_rates')
    .select('domain, accuracy_slope, calculated_at')
    .eq('profile_id', profileId)
    .gte('calculated_at', fourteenDaysAgo.toISOString())
    .order('calculated_at', { ascending: false });

  const plateauDomains: string[] = [];
  const seenDomains = new Set<string>();
  for (const r of rates ?? []) {
    if (seenDomains.has(r.domain)) continue;
    seenDomains.add(r.domain);
    if (r.accuracy_slope !== null && Math.abs(Number(r.accuracy_slope)) < 0.005) {
      plateauDomains.push(r.domain);
    }
  }

  return {
    user_id: userId,
    profile_id: profileId,
    dominant_error_type: dominant,
    error_type_distribution: distribution,
    recommended_cue_bias: cueBias,
    cue_dependency_score: cueDependencyScore,
    cue_dependency_trend: cueTrend,
    avg_response_latency_ms: avgRecent,
    latency_trend_pct: latencyTrendPct,
    engagement_baseline: engagementBaseline,
    plateau_flag: plateauDomains.length > 0,
    plateau_domains: plateauDomains,
    trial_count_window: totalTrials,
    data_confidence: confidenceFromTrials(totalTrials),
    version: 1,
    last_computed_at: now.toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json().catch(() => ({}));
    const { profileId, userId, allActive } = body as {
      profileId?: string;
      userId?: string;
      allActive?: boolean;
    };

    // Authorization: require a valid session. Cross-user / all-active recomputes
    // require admin; single-user/profile recomputes require ownership or admin.
    const caller = await getAuthedUser(req);
    if (!caller) return jsonResponse({ error: "Unauthorized" }, 401);
    const callerIsAdmin = await userHasAnyRole(supabase, caller.id, ["admin"]);
    if (allActive) {
      if (!callerIsAdmin) return jsonResponse({ error: "Forbidden: admin required" }, 403);
    } else if (!callerIsAdmin) {
      let ownerId = userId;
      if (!ownerId && profileId) {
        const { data: prof } = await supabase
          .from("profiles").select("user_id").eq("id", profileId).maybeSingle();
        ownerId = prof?.user_id;
      }
      if (!ownerId || ownerId !== caller.id) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }
    }

    let targets: Array<{ user_id: string; profile_id: string }> = [];

    if (profileId) {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('id', profileId)
        .single();
      if (data) targets.push({ user_id: data.user_id, profile_id: data.id });
    } else if (userId) {
      const { data } = await supabase
        .from('profiles')
        .select('id, user_id')
        .eq('user_id', userId)
        .eq('is_active', true);
      targets = (data ?? []).map((p: any) => ({ user_id: p.user_id, profile_id: p.id }));
    } else if (allActive) {
      // Profiles touched in last 7 days
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: sessions } = await supabase
        .from('sessions')
        .select('profile_id, user_id')
        .gte('started_at', since)
        .not('profile_id', 'is', null);
      const seen = new Set<string>();
      for (const s of sessions ?? []) {
        if (s.profile_id && !seen.has(s.profile_id)) {
          seen.add(s.profile_id);
          targets.push({ user_id: s.user_id, profile_id: s.profile_id });
        }
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Provide profileId, userId, or allActive=true' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ profile_id: string; status: string }> = [];
    for (const t of targets) {
      const row = await buildProfileForUser(supabase, t.user_id, t.profile_id);
      if (!row) {
        results.push({ profile_id: t.profile_id, status: 'no_data' });
        continue;
      }
      const { error: upsertErr } = await supabase
        .from('user_adaptation_profiles')
        .upsert(row, { onConflict: 'profile_id' });
      results.push({
        profile_id: t.profile_id,
        status: upsertErr ? `error: ${upsertErr.message}` : 'ok',
      });
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('compute-adaptation-profile error', err);
    return new Response(
      JSON.stringify({ error: err?.message ?? 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
