/**
 * Scorer Calibration Runner
 *
 * Runs the labeled aphasia dataset through the discourse scorer under
 * multiple calibrations and prints a comparison report.
 *
 * Modes:
 *   --mode=local  (default) Uses localFallbackScore only. Fast, no network,
 *                  good for iterating on weights/thresholds/overrides.
 *   --mode=llm    Calls the live score-discourse-turn edge function.
 *                  Slower + costs tokens. Use to validate LLM behavior.
 *
 * Usage:
 *   bun scripts/runScorerCalibration.ts
 *   bun scripts/runScorerCalibration.ts --mode=llm
 *   bun scripts/runScorerCalibration.ts --baseline=v1 --candidate=v2
 *
 * Output:
 *   - Per-version: overall accuracy, per-error-type precision/recall,
 *     adaptation-direction agreement, success-classification accuracy,
 *     confusion matrix.
 *   - Diff: candidate vs baseline (improvements / regressions per case).
 */

import {
  ALL_CALIBRATIONS,
  applyErrorTypeCaps,
  computeSuccessScoreCalibrated,
  resolveAdaptation,
  type ScorerCalibration,
} from "../src/lib/scorerCalibration";
import { APHASIA_TURNS, type LabeledTurn } from "../src/calibration/aphasiaTurns";
import {
  localFallbackScore,
  type ClinicalSignal,
  type DiscourseErrorType,
  type DiscourseAdaptationDirection,
} from "../src/lib/discourseSignalScorer";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);
const MODE: "local" | "llm" = args.mode === "llm" ? "llm" : "local";
const BASELINE_VERSION = args.baseline ?? "v1";
const CANDIDATE_VERSION = args.candidate ?? "v2";

// ---------------------------------------------------------------------------
// Score one turn under a given calibration (offline; no network)
// ---------------------------------------------------------------------------
function scoreOffline(turn: LabeledTurn, cal: ScorerCalibration): ClinicalSignal {
  // Run the existing local fallback to get an initial signal (errorType + raw subs).
  const base = localFallbackScore(turn.input);

  // Then re-apply calibration explicitly so we can A/B different configs
  // without mutating ACTIVE_CALIBRATION.
  const sub = applyErrorTypeCaps(
    {
      onTopicScore: base.onTopicScore,
      targetAchievementScore: base.targetAchievementScore,
      responseQualityScore: base.responseQualityScore,
    },
    base.errorType,
    cal,
  );
  const successScore = computeSuccessScoreCalibrated(sub, cal);
  const recommendedAdaptation = resolveAdaptation(successScore, base.errorType, base.confidence, cal);

  return { ...base, ...sub, successScore, recommendedAdaptation };
}

// ---------------------------------------------------------------------------
// Score one turn under a given calibration via the LIVE edge function
// ---------------------------------------------------------------------------
async function scoreLLM(turn: LabeledTurn, cal: ScorerCalibration): Promise<ClinicalSignal> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) throw new Error("Set SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY env vars for --mode=llm");

  const resp = await fetch(`${url}/functions/v1/score-discourse-turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
    body: JSON.stringify(turn.input),
  });
  if (!resp.ok) {
    return { ...localFallbackScore(turn.input), reasoning: `LLM ${resp.status} fallback` };
  }
  const data = await resp.json();
  const rawSub = {
    onTopicScore: clamp01(data.onTopicScore),
    targetAchievementScore: clamp01(data.targetAchievementScore),
    responseQualityScore: clamp01(data.responseQualityScore),
  };
  const errorType = (data.errorType ?? "unclear") as DiscourseErrorType;
  const confidence = clamp01(data.confidence ?? 0.7);
  const sub = applyErrorTypeCaps(rawSub, errorType, cal);
  const successScore = computeSuccessScoreCalibrated(sub, cal);
  const recommendedAdaptation = resolveAdaptation(successScore, errorType, confidence, cal);
  return {
    ...sub,
    errorType,
    confidence,
    recommendedAdaptation,
    reasoning: data.reasoning ?? "",
    source: "llm",
    successScore,
  };
}

function clamp01(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------
interface CaseResult {
  turn: LabeledTurn;
  signal: ClinicalSignal;
  errorTypeOk: boolean;
  adaptationOk: boolean;
  successOk: boolean;
}
interface VersionReport {
  version: string;
  overallAccuracy: number;
  errorTypeAccuracy: number;
  adaptationAgreement: number;
  successAccuracy: number;
  perErrorType: Record<string, { precision: number; recall: number; n: number }>;
  confusion: Record<string, Record<string, number>>;
  cases: CaseResult[];
}

function evaluate(version: string, results: CaseResult[]): VersionReport {
  const total = results.length;
  const errorTypeAccuracy = results.filter((r) => r.errorTypeOk).length / total;
  const adaptationAgreement = results.filter((r) => r.adaptationOk).length / total;
  const successAccuracy = results.filter((r) => r.successOk).length / total;
  const overallAccuracy =
    results.filter((r) => r.errorTypeOk && r.adaptationOk && r.successOk).length / total;

  // Per-errorType precision/recall + confusion matrix
  const labels = new Set<string>();
  for (const r of results) {
    labels.add(r.turn.expected.errorType);
    labels.add(r.signal.errorType);
  }
  const confusion: Record<string, Record<string, number>> = {};
  for (const a of labels) {
    confusion[a] = {};
    for (const b of labels) confusion[a][b] = 0;
  }
  for (const r of results) {
    confusion[r.turn.expected.errorType][r.signal.errorType] += 1;
  }
  const perErrorType: VersionReport["perErrorType"] = {};
  for (const label of labels) {
    const tp = confusion[label]?.[label] ?? 0;
    const fn = Object.entries(confusion[label] ?? {})
      .filter(([k]) => k !== label)
      .reduce((s, [, v]) => s + v, 0);
    const fp = Object.entries(confusion)
      .filter(([k]) => k !== label)
      .reduce((s, [, row]) => s + (row[label] ?? 0), 0);
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    perErrorType[label] = { precision, recall, n: tp + fn };
  }

  return {
    version,
    overallAccuracy,
    errorTypeAccuracy,
    adaptationAgreement,
    successAccuracy,
    perErrorType,
    confusion,
    cases: results,
  };
}

function compareCases(turn: LabeledTurn, signal: ClinicalSignal): CaseResult {
  const expectedTypes = new Set<DiscourseErrorType>([
    turn.expected.errorType,
    ...(turn.expected.acceptableErrorTypes ?? []),
  ]);
  const errorTypeOk = expectedTypes.has(signal.errorType);
  const adaptationOk: boolean = signal.recommendedAdaptation === turn.expected.adaptation;
  const successOk = (signal.successScore >= 0.6) === turn.expected.success;
  return { turn, signal, errorTypeOk, adaptationOk, successOk };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function printReport(report: VersionReport) {
  console.log(`\n=== Calibration ${report.version} ===`);
  console.log(`Overall (errorType + adaptation + success all correct): ${pct(report.overallAccuracy)}`);
  console.log(`  errorType accuracy:     ${pct(report.errorTypeAccuracy)}`);
  console.log(`  adaptation agreement:   ${pct(report.adaptationAgreement)}`);
  console.log(`  success classification: ${pct(report.successAccuracy)}`);
  console.log(`\n  per-errorType (n = labeled count):`);
  const rows = Object.entries(report.perErrorType)
    .filter(([, v]) => v.n > 0)
    .sort((a, b) => b[1].n - a[1].n);
  for (const [label, { precision, recall, n }] of rows) {
    console.log(`    ${label.padEnd(22)} n=${String(n).padEnd(3)}  P=${pct(precision)}  R=${pct(recall)}`);
  }
}

function printDiff(baseline: VersionReport, candidate: VersionReport) {
  console.log(`\n=== Diff: ${candidate.version} vs ${baseline.version} ===`);
  const dOverall = candidate.overallAccuracy - baseline.overallAccuracy;
  const dErr = candidate.errorTypeAccuracy - baseline.errorTypeAccuracy;
  const dAdapt = candidate.adaptationAgreement - baseline.adaptationAgreement;
  const dSucc = candidate.successAccuracy - baseline.successAccuracy;
  const arrow = (n: number) => (n > 0 ? "▲" : n < 0 ? "▼" : "·");
  console.log(`  Overall    ${arrow(dOverall)} ${pct(dOverall)}`);
  console.log(`  ErrorType  ${arrow(dErr)} ${pct(dErr)}`);
  console.log(`  Adaptation ${arrow(dAdapt)} ${pct(dAdapt)}`);
  console.log(`  Success    ${arrow(dSucc)} ${pct(dSucc)}`);

  const improvements: string[] = [];
  const regressions: string[] = [];
  baseline.cases.forEach((b, i) => {
    const c = candidate.cases[i];
    const bOk = b.errorTypeOk && b.adaptationOk && b.successOk;
    const cOk = c.errorTypeOk && c.adaptationOk && c.successOk;
    if (!bOk && cOk) improvements.push(`  ✓ FIXED  [${b.turn.id}] ${b.turn.scenario}`);
    if (bOk && !cOk) {
      regressions.push(
        `  ✗ BROKE  [${b.turn.id}] ${b.turn.scenario} ` +
          `(got errorType=${c.signal.errorType}, adapt=${c.signal.recommendedAdaptation}, success=${c.signal.successScore.toFixed(2)})`,
      );
    }
  });
  if (improvements.length) {
    console.log(`\n  Improvements (${improvements.length}):`);
    improvements.forEach((l) => console.log(l));
  }
  if (regressions.length) {
    console.log(`\n  Regressions (${regressions.length}):`);
    regressions.forEach((l) => console.log(l));
  }
  if (!improvements.length && !regressions.length) {
    console.log(`\n  (no per-case changes)`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Calibration runner — mode=${MODE}, dataset=${APHASIA_TURNS.length} turns`);

  const reports: VersionReport[] = [];
  for (const cal of ALL_CALIBRATIONS) {
    const cases: CaseResult[] = [];
    for (const turn of APHASIA_TURNS) {
      const signal = MODE === "llm" ? await scoreLLM(turn, cal) : scoreOffline(turn, cal);
      cases.push(compareCases(turn, signal));
    }
    const report = evaluate(cal.version, cases);
    reports.push(report);
    printReport(report);
  }

  const baseline = reports.find((r) => r.version === BASELINE_VERSION);
  const candidate = reports.find((r) => r.version === CANDIDATE_VERSION);
  if (baseline && candidate && baseline !== candidate) {
    printDiff(baseline, candidate);
  }
}

main().catch((err) => {
  console.error("calibration runner failed:", err);
  process.exit(1);
});
