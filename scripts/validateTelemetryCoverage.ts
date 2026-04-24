/**
 * Telemetry Coverage Validator
 *
 * Run after deploying telemetry fixes to confirm error_type and adaptations_active
 * are populated across all high-volume exercises.
 *
 * Usage: bunx tsx scripts/validateTelemetryCoverage.ts
 *
 * Pass criteria (last 7 days):
 *   - error_type populated:        ≥ 95% of trials
 *   - adaptations_active populated: ≥ 80% of adaptive-game trials
 *   - adaptation_events count:      > 0
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL!;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const supabase = createClient(url, key);

async function main() {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();

  const { data: trials } = await supabase
    .from('exercise_events')
    .select('exercise_slug, error_type, adaptations_active')
    .gte('created_at', since);

  if (!trials || trials.length === 0) {
    console.log('⚠️  No trials in last 7 days');
    return;
  }

  const byExercise = new Map<string, { total: number; withErr: number; withAdapt: number }>();
  for (const t of trials) {
    const slug = t.exercise_slug ?? 'unknown';
    if (!byExercise.has(slug)) byExercise.set(slug, { total: 0, withErr: 0, withAdapt: 0 });
    const g = byExercise.get(slug)!;
    g.total++;
    if (t.error_type) g.withErr++;
    if (t.adaptations_active && Object.keys(t.adaptations_active as object).length > 0) g.withAdapt++;
  }

  const { count: adaptCount } = await supabase
    .from('adaptation_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since);

  console.log(`\n📊 Telemetry Coverage — last 7 days (${trials.length} trials)\n`);
  console.log('exercise                    trials  error_type%  adaptations%  status');
  console.log('─'.repeat(78));

  let allPass = true;
  const rows = Array.from(byExercise.entries()).sort((a, b) => b[1].total - a[1].total);
  for (const [slug, g] of rows) {
    const errPct = Math.round((g.withErr / g.total) * 100);
    const adaptPct = Math.round((g.withAdapt / g.total) * 100);
    const pass = errPct >= 95 && adaptPct >= 80;
    if (!pass) allPass = false;
    const status = pass ? '✅' : errPct < 95 ? '❌ low error_type' : '⚠️  low adaptations';
    console.log(`${slug.padEnd(28)}${String(g.total).padStart(6)}  ${String(errPct).padStart(10)}%  ${String(adaptPct).padStart(11)}%  ${status}`);
  }

  console.log('─'.repeat(78));
  console.log(`\nadaptation_events (7d): ${adaptCount ?? 0} ${(adaptCount ?? 0) > 0 ? '✅' : '❌'}`);
  console.log(`\n${allPass && (adaptCount ?? 0) > 0 ? '✅ PASS — telemetry pipeline healthy' : '❌ FAIL — fixes still needed'}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
