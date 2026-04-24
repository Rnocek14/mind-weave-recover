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

// Node shim: supabase-js touches localStorage at module load.
if (typeof (globalThis as any).localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
}

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
  shortCircuit,
  type ClinicalSignal,
  type DiscourseErrorType,
  type DiscourseAdaptationDirection,
} from "../src/lib/discourseSignalScorerCore";

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
const BASELINE_VERSION = args.baseline ?? (MODE === "llm" ? "v2" : "v1");
const CANDIDATE_VERSION = args.candidate ?? (MODE === "llm" ? "v3" : "v2");
/** Categories the calibration v3 work targets — used for promotion gating. */
const WEAK_CATEGORIES = ["circumlocution", "semantic_paraphasia", "unclear"];
/** Categories that must NOT regress when we promote. */
const PROTECTED_CATEGORIES = ["fluent_correct", "off_topic", "surrender", "no_response"];

// ---------------------------------------------------------------------------
// Score one turn under a given calibration (offline; no network)
// ---------------------------------------------------------------------------
function scoreOffline(turn: LabeledTurn, cal: ScorerCalibration): ClinicalSignal {
  // Match production order: short-circuit first, then local fallback.
  const sc = shortCircuit(turn.input, cal);
  if (sc) return sc;
  return localFallbackScore(turn.input, cal);
}

// ---------------------------------------------------------------------------
// Score one turn under a given calibration via the LIVE edge function.
// `promptVersion` selects which system prompt rubric the edge function uses.
// ---------------------------------------------------------------------------
async function scoreLLM(
  turn: LabeledTurn,
  cal: ScorerCalibration,
  promptVersion: "v2" | "v3",
): Promise<ClinicalSignal> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) throw new Error("Set SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY env vars for --mode=llm");

  // Production short-circuits run before the LLM. Mirror that here so
  // surrender / no_response / filler-only never burn an API call.
  const sc = shortCircuit(turn.input, cal);
  if (sc) return sc;

  const resp = await fetch(`${url}/functions/v1/score-discourse-turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
    body: JSON.stringify({ ...turn.input, promptVersion }),
  });
  if (!resp.ok) {
    return { ...localFallbackScore(turn.input, cal), reasoning: `LLM ${resp.status} fallback` };
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

  // Weak categories — the v3 promotion target.
  console.log(`\n  Weak categories (recall focus):`);
  let weakImproved = 0;
  let weakWorsened = 0;
  for (const label of WEAK_CATEGORIES) {
    const b = baseline.perErrorType[label] ?? { precision: 0, recall: 0, n: 0 };
    const c = candidate.perErrorType[label] ?? { precision: 0, recall: 0, n: 0 };
    const dP = c.precision - b.precision;
    const dR = c.recall - b.recall;
    if (dR > 0 || dP > 0) weakImproved++;
    if (dR < 0 || dP < 0) weakWorsened++;
    console.log(
      `    ${label.padEnd(22)} P ${pct(b.precision)}→${pct(c.precision)} (${arrow(dP)}${pct(dP)})  ` +
        `R ${pct(b.recall)}→${pct(c.recall)} (${arrow(dR)}${pct(dR)})`,
    );
  }

  // Protected categories — must NOT regress to promote.
  console.log(`\n  Protected categories (must hold):`);
  const protectedRegressions: string[] = [];
  for (const label of PROTECTED_CATEGORIES) {
    const b = baseline.perErrorType[label] ?? { precision: 0, recall: 0, n: 0 };
    const c = candidate.perErrorType[label] ?? { precision: 0, recall: 0, n: 0 };
    const dP = c.precision - b.precision;
    const dR = c.recall - b.recall;
    if (dR < 0 || dP < 0) protectedRegressions.push(label);
    console.log(
      `    ${label.padEnd(22)} P ${pct(b.precision)}→${pct(c.precision)} (${arrow(dP)}${pct(dP)})  ` +
        `R ${pct(b.recall)}→${pct(c.recall)} (${arrow(dR)}${pct(dR)})`,
    );
  }

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
    console.log(`\n  Per-case improvements (${improvements.length}):`);
    improvements.forEach((l) => console.log(l));
  }
  if (regressions.length) {
    console.log(`\n  Per-case regressions (${regressions.length}):`);
    regressions.forEach((l) => console.log(l));
  }
  if (!improvements.length && !regressions.length) {
    console.log(`\n  (no per-case changes)`);
  }

  // Promotion verdict
  console.log(`\n  Promotion verdict:`);
  const verdict: string[] = [];
  if (weakImproved === 0) verdict.push("✗ no weak categories improved");
  if (protectedRegressions.length) {
    verdict.push(`✗ protected category regression: ${protectedRegressions.join(", ")}`);
  }
  if (dOverall < 0) verdict.push(`✗ overall accuracy regressed (${pct(dOverall)})`);
  if (verdict.length === 0) {
    console.log(`    ✅ PROMOTE — weak categories improved (${weakImproved}/${WEAK_CATEGORIES.length}), no protected regressions, overall ${arrow(dOverall)} ${pct(dOverall)}`);
  } else {
    console.log(`    ⛔ DO NOT PROMOTE`);
    verdict.forEach((v) => console.log(`       ${v}`));
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (MODE === "llm") {
    console.log(`Calibration runner — mode=llm, dataset=${APHASIA_TURNS.length} turns`);
    console.log(`Comparing PROMPT versions on the ACTIVE calibration.`);
    const cal = ALL_CALIBRATIONS[ALL_CALIBRATIONS.length - 1]; // latest = ACTIVE
    const promptVersions: ("v2" | "v3")[] = ["v2", "v3"];
    const reports: VersionReport[] = [];
    for (const pv of promptVersions) {
      console.log(`\n--- Scoring with prompt ${pv} (calibration ${cal.version}) ---`);
      const cases: CaseResult[] = [];
      for (const turn of APHASIA_TURNS) {
        const signal = await scoreLLM(turn, cal, pv);
        cases.push(compareCases(turn, signal));
      }
      const report = evaluate(`prompt-${pv}`, cases);
      reports.push(report);
      printReport(report);
    }
    const baseline = reports.find((r) => r.version === `prompt-${BASELINE_VERSION}`) ?? reports[0];
    const candidate = reports.find((r) => r.version === `prompt-${CANDIDATE_VERSION}`) ?? reports[1];
    if (baseline && candidate && baseline !== candidate) printDiff(baseline, candidate);
    return;
  }

  console.log(`Calibration runner — mode=local, dataset=${APHASIA_TURNS.length} turns`);
  const reports: VersionReport[] = [];
  for (const cal of ALL_CALIBRATIONS) {
    const cases: CaseResult[] = [];
    for (const turn of APHASIA_TURNS) {
      const signal = scoreOffline(turn, cal);
      cases.push(compareCases(turn, signal));
    }
    const report = evaluate(cal.version, cases);
    reports.push(report);
    printReport(report);
  }
  const baseline = reports.find((r) => r.version === BASELINE_VERSION);
  const candidate = reports.find((r) => r.version === CANDIDATE_VERSION);
  if (baseline && candidate && baseline !== candidate) printDiff(baseline, candidate);
}

main().catch((err) => {
  console.error("calibration runner failed:", err);
  process.exit(1);
});
