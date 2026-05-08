/**
 * mastery-health-snapshot — daily cron consumer.
 *
 * 1. Reads the two health views (24h primary metrics + sessions cross-check).
 * 2. Inserts one snapshot row per metric into mastery_health_snapshots.
 * 3. Evaluates three thresholds against snapshot history and writes any
 *    triggered alerts into mastery_health_alerts. No external delivery.
 *
 * Thresholds (per approved spec):
 *   PAGE   — mastery_rows_24h = 0 (active from day 1; coalesces NULL → 0)
 *   NOTIFY — mastery_rows_24h < 0.5 × trailing 7-day average (active day 8+)
 *   NOTIFY — naming_unspecified_pct > 2 × trailing 7-day median (active day 8+,
 *            and only when the 24h denominator > 0)
 *
 * Invoked by pg_cron daily at 03:00 UTC.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WARMUP_DAYS = 7;

interface MetricRow {
  metric_key: string;
  metric_value: number | null;
  metadata: Record<string, unknown> | null;
}

interface AlertRow {
  alert_key: string;
  severity: 'page' | 'notify';
  metric_key: string;
  metric_value: number | null;
  threshold_value: number | null;
  context: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    // 1. Read both views.
    const [primary, crossCheck] = await Promise.all([
      supabase.from('v_mastery_health_24h').select('metric_key, metric_value, metadata'),
      supabase.from('v_sessions_logs_vs_mastery_24h').select('metric_key, metric_value, metadata'),
    ]);
    if (primary.error) throw new Error(`v_mastery_health_24h: ${primary.error.message}`);
    if (crossCheck.error) throw new Error(`v_sessions_logs_vs_mastery_24h: ${crossCheck.error.message}`);

    const metrics: MetricRow[] = [
      ...(primary.data ?? []),
      ...(crossCheck.data ?? []),
    ] as MetricRow[];

    // 2. Insert snapshot rows.
    const { error: insErr } = await supabase
      .from('mastery_health_snapshots')
      .insert(metrics.map((m) => ({
        metric_key: m.metric_key,
        metric_value: m.metric_value,
        metadata: m.metadata,
      })));
    if (insErr) throw new Error(`snapshot insert: ${insErr.message}`);

    // 3. Evaluate thresholds.
    const alerts: AlertRow[] = [];
    const byKey = Object.fromEntries(metrics.map((m) => [m.metric_key, m]));

    // 3a. PAGE — mastery_rows_24h = 0 (coalesce NULL → 0). Day 1.
    const masteryRows = byKey['mastery_rows_24h'];
    const masteryRowsValue = masteryRows?.metric_value ?? 0;
    if (masteryRowsValue === 0) {
      alerts.push({
        alert_key: 'mastery_rows_24h_zero',
        severity: 'page',
        metric_key: 'mastery_rows_24h',
        metric_value: masteryRowsValue,
        threshold_value: 0,
        context: { rule: 'absence', warmup_required: false },
      });
    }

    // Snapshot history for warmup-gated alerts.
    const sevenDayAgo = new Date(Date.now() - WARMUP_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data: history, error: histErr } = await supabase
      .from('mastery_health_snapshots')
      .select('metric_key, metric_value, captured_at')
      .gte('captured_at', sevenDayAgo)
      .in('metric_key', ['mastery_rows_24h', 'naming_unspecified_pct']);
    if (histErr) throw new Error(`history read: ${histErr.message}`);

    const histByKey: Record<string, number[]> = {};
    for (const row of history ?? []) {
      if (row.metric_value === null) continue;
      (histByKey[row.metric_key] ??= []).push(Number(row.metric_value));
    }

    // 3b. NOTIFY — mastery_rows_24h < 0.5 × trailing 7-day average.
    const masteryHist = histByKey['mastery_rows_24h'] ?? [];
    if (masteryHist.length >= WARMUP_DAYS && masteryRowsValue > 0) {
      const avg = masteryHist.reduce((a, b) => a + b, 0) / masteryHist.length;
      const threshold = avg * 0.5;
      if (masteryRowsValue < threshold) {
        alerts.push({
          alert_key: 'mastery_rows_24h_below_half_trailing_avg',
          severity: 'notify',
          metric_key: 'mastery_rows_24h',
          metric_value: masteryRowsValue,
          threshold_value: threshold,
          context: { rule: 'baseline', baseline_avg: avg, baseline_window_days: WARMUP_DAYS, samples: masteryHist.length },
        });
      }
    }

    // 3c. NOTIFY — naming_unspecified_pct > 2 × trailing 7-day median (denom > 0).
    const naming = byKey['naming_unspecified_pct'];
    const namingValue = naming?.metric_value ?? null;
    const denom = Number((naming?.metadata as { denominator?: number } | null)?.denominator ?? 0);
    const namingHist = histByKey['naming_unspecified_pct'] ?? [];
    if (namingValue !== null && denom > 0 && namingHist.length >= WARMUP_DAYS) {
      const sorted = [...namingHist].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const threshold = median * 2;
      if (namingValue > threshold) {
        alerts.push({
          alert_key: 'naming_unspecified_pct_2x_trailing_median',
          severity: 'notify',
          metric_key: 'naming_unspecified_pct',
          metric_value: namingValue,
          threshold_value: threshold,
          context: { rule: 'baseline', baseline_median: median, baseline_window_days: WARMUP_DAYS, samples: namingHist.length, denominator: denom },
        });
      }
    }

    if (alerts.length > 0) {
      const { error: alertErr } = await supabase.from('mastery_health_alerts').insert(alerts);
      if (alertErr) throw new Error(`alert insert: ${alertErr.message}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        snapshots_written: metrics.length,
        alerts_fired: alerts.length,
        alert_keys: alerts.map((a) => a.alert_key),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[mastery-health-snapshot]', msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
