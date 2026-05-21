/**
 * Telemetry Coverage Validator
 *
 * Two checks in one script:
 *
 * 1. RUNTIME (last-7-days exercise_events fan-out) — requires
 *    VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY.
 *      • error_type populated:         ≥ 95% of trials
 *      • adaptations_active populated: ≥ 80% of adaptive-game trials
 *      • adaptation_events count:      > 0
 *
 * 2. STATIC (per docs/unified-trial-contract.md "Acceptance signature") —
 *    flags any src/pages/*Exercise.tsx that lacks the Tier-A/B shape so
 *    new games can't ship invisible to the clinical stack.
 *
 * Usage:
 *   bunx tsx scripts/validateTelemetryCoverage.ts            # both checks
 *   bunx tsx scripts/validateTelemetryCoverage.ts --static   # signature only (no env)
 */

import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ─── Static signature scan ──────────────────────────────────────────────────
// Pages intentionally excluded from the Tier-A/B contract (discourse-only,
// non-trial entry points, or quarantined). Keep this list short — every
// addition is a clinical-stack opt-out.
const EXEMPT_PAGES = new Set<string>([
  'Exercise.tsx', // routing shell, not a game
  'ConversationCoachExercise.tsx', // quarantined
  'ConversationPartnerExercise.tsx', // quarantined
  // ThoughtContinuation runs discourse-only via useDiscourseAdaptation /
  // useDiscourseSignalScorer (validated below) and uses continuous-mastery.
]);

// Pages whose primary signature is discourse-scored (no trial-based engine).
// They satisfy the contract via useDiscourseAdaptation OR useDiscourseSignalScorer.
const DISCOURSE_PAGES = new Set<string>([
  'NarrativeRetellExercise.tsx',
  'CategoryFluencyExercise.tsx',
  'SynonymGeneratorExercise.tsx',
  'ThoughtContinuationExercise.tsx',
]);

interface StaticResult {
  page: string;
  status: 'ok' | 'missing' | 'discourse-missing' | 'exempt';
  reasons: string[];
}

function scanPageSignature(pagePath: string): StaticResult {
  const file = pagePath.split('/').pop()!;
  if (EXEMPT_PAGES.has(file)) {
    return { page: file, status: 'exempt', reasons: ['explicitly exempt'] };
  }
  const src = readFileSync(pagePath, 'utf8');

  // Walk the page's own component imports to catch the common pattern where
  // the *Exercise.tsx file is a thin shell that hosts a *Game.tsx component.
  const importedGameFiles = collectLocalImports(src, pagePath);
  const sources = [src, ...importedGameFiles.map((p) => readFileSync(p, 'utf8'))];

  const has = (re: RegExp) => sources.some((s) => re.test(s));

  const hasStandardFlow = has(/from\s+['"]@\/hooks\/useStandardExerciseFlow['"]/);
  const hasUnifiedSubmission = has(/from\s+['"]@\/hooks\/useTrialSubmission['"]/);
  const hasInGameAdaptation = has(/from\s+['"]@\/hooks\/useInGameAdaptation['"]/);
  const hasExerciseTelemetry = has(/from\s+['"]@\/hooks\/useExerciseTelemetry['"]/);
  const hasDiscourseAdaptation = has(/from\s+['"]@\/hooks\/useDiscourseAdaptation['"]/);
  const hasDiscourseScorer = has(/from\s+['"]@\/hooks\/useDiscourseSignalScorer['"]/);

  if (DISCOURSE_PAGES.has(file)) {
    const ok = (hasDiscourseAdaptation || hasDiscourseScorer) && hasExerciseTelemetry;
    return ok
      ? { page: file, status: 'ok', reasons: ['discourse signature satisfied'] }
      : {
          page: file,
          status: 'discourse-missing',
          reasons: [
            !hasDiscourseAdaptation && !hasDiscourseScorer
              ? 'missing useDiscourseAdaptation OR useDiscourseSignalScorer'
              : '',
            !hasExerciseTelemetry ? 'missing useExerciseTelemetry' : '',
          ].filter(Boolean),
        };
  }

  // Trial-based games: useStandardExerciseFlow OR (useTrialSubmission +
  // useInGameAdaptation) is required. useExerciseTelemetry must also be
  // wired (it's the clinician review-tab data source).
  const tierAStyle = hasUnifiedSubmission && hasInGameAdaptation;
  const tierBundle = hasStandardFlow;
  const reasons: string[] = [];
  if (!tierBundle && !tierAStyle) {
    if (!hasUnifiedSubmission) reasons.push('missing useTrialSubmission (or useStandardExerciseFlow)');
    if (!hasInGameAdaptation) reasons.push('missing useInGameAdaptation (or useStandardExerciseFlow)');
  }
  if (!hasExerciseTelemetry) reasons.push('missing useExerciseTelemetry');
  return reasons.length === 0
    ? { page: file, status: 'ok', reasons: ['Tier-A/B signature satisfied'] }
    : { page: file, status: 'missing', reasons };
}

/** Walk the @/components/* (and a few other local) imports the page declares. */
function collectLocalImports(src: string, pagePath: string): string[] {
  const out: string[] = [];
  const re = /from\s+['"](@\/[^'"]+|\.\.?\/[^'"]+)['"]/g;
  const srcDir = resolve(pagePath, '..', '..');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const spec = m[1];
    const rel = spec.startsWith('@/') ? join(srcDir, spec.slice(2)) : resolve(pagePath, '..', spec);
    for (const ext of ['.tsx', '.ts']) {
      const candidate = rel + ext;
      if (existsSync(candidate)) {
        out.push(candidate);
        break;
      }
    }
  }
  return out;
}

function runStaticScan(): boolean {
  const pagesDir = resolve(process.cwd(), 'src/pages');
  const files = readdirSync(pagesDir).filter((f) => /Exercise\.tsx$/.test(f));
  console.log(`\n🔎 Static signature scan — ${files.length} exercise pages\n`);
  console.log('page                                    status        notes');
  console.log('─'.repeat(78));
  let allPass = true;
  for (const f of files.sort()) {
    const r = scanPageSignature(join(pagesDir, f));
    const icon = r.status === 'ok' ? '✅' : r.status === 'exempt' ? '⏭️ ' : '❌';
    if (r.status === 'missing' || r.status === 'discourse-missing') allPass = false;
    console.log(`${f.padEnd(40)}${icon} ${r.status.padEnd(10)}  ${r.reasons.join(' · ')}`);
  }
  console.log('─'.repeat(78));
  console.log(allPass ? '✅ static scan PASS' : '❌ static scan FAIL — see notes');
  return allPass;
}

// ─── Runtime fan-out check (existing behaviour) ─────────────────────────────

async function runRuntimeCheck(): Promise<boolean> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.log('\n⏭️  Runtime check skipped — VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY not set\n');
    return true;
  }
  const supabase = createClient(url, key);
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();

  const { data: trials } = await supabase
    .from('exercise_events')
    .select('exercise_slug, error_type, adaptations_active')
    .gte('created_at', since);

  if (!trials || trials.length === 0) {
    console.log('\n⚠️  No trials in last 7 days\n');
    return true;
  }

  const byExercise = new Map<string, { total: number; withErr: number; withAdapt: number }>();
  for (const t of trials) {
    const slug = (t as any).exercise_slug ?? 'unknown';
    if (!byExercise.has(slug)) byExercise.set(slug, { total: 0, withErr: 0, withAdapt: 0 });
    const g = byExercise.get(slug)!;
    g.total++;
    if ((t as any).error_type) g.withErr++;
    if ((t as any).adaptations_active && Object.keys((t as any).adaptations_active as object).length > 0) g.withAdapt++;
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
  console.log(`\n${allPass && (adaptCount ?? 0) > 0 ? '✅ runtime check PASS' : '❌ runtime check FAIL'}\n`);
  return allPass && (adaptCount ?? 0) > 0;
}

async function main() {
  const staticOnly = process.argv.includes('--static');
  const staticPass = runStaticScan();
  const runtimePass = staticOnly ? true : await runRuntimeCheck();
  if (!staticPass || !runtimePass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
