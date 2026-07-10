/**
 * Voice Engine v2 — Axis Engine (V2.1 Phase 2)
 *
 * A PURE, framework-free re-expression of the evidence v1 already produces
 * (error type, phonological / semantic similarity, cue level, validity gate,
 * self-correction) onto the v2 clinical axis model
 * (docs/voice-engine-v2-spec.md §1, §2).
 *
 * This module DECIDES NOTHING NEW. It does not re-run matching or re-classify
 * speech — it maps existing signals onto axes so the axis engine can run in
 * SHADOW MODE alongside the live v1 scoring, be compared, and be trusted before
 * it ever gates progression (the flip happens in Phase 5). Nothing here reads
 * pronunciation or fluency: by construction those cannot influence Communication
 * Success (spec principle 1).
 *
 * No React, no Supabase, no I/O — so it is fully unit-testable and reusable when
 * Phase 5 promotes it to the authoritative scorer.
 */

// ── Vocabulary (mirrors errorClassifier + telemetry, kept local so this module
//    has no runtime dependency on them) ──
export type ErrorType =
  | 'correct'
  | 'semantic_paraphasia'
  | 'phonemic_paraphasia'
  | 'neologism'
  | 'unrelated'
  | 'no_response'
  | 'self_corrected'
  | 'attempted'
  | 'circumlocution'
  | 'uncertain';

export type CueKind = 'none' | 'semantic' | 'phonemic' | 'full_word';

/**
 * Cognitive Strategy — a categorical retrieval pathway, not a magnitude
 * (spec §1.3). `self_cued` is the deliberate collapse of phonemic_search +
 * semantic_search proposed in open question #5: we cannot yet distinguish them
 * reliably, so per the honesty principle we assert the umbrella label only.
 * `abandoned` here means "an attempt was made but the target was not reached
 * and no successful recovery strategy was observed."
 */
export type StrategyUsed =
  | 'spontaneous'
  | 'effortful_search'
  | 'self_correction'
  | 'circumlocution'
  | 'self_cued'
  | 'cue_dependent'
  | 'abandoned'
  | 'none';

export type MeasurementConfidence = 'high' | 'medium' | 'low';
export type VerdictPrimary = 'success' | 'partial' | 'retry' | 'no_score';

export interface AxisScore {
  /** Axis-specific value (see spec §1 for each axis's range). */
  value: number;
  /** How much we trust this value, 0–1. */
  confidence: number;
  /** Human-readable evidence lines — every score is a traceable claim. */
  evidence: string[];
  /** Provisional axes render but never gate. Always-on axes omit this. */
  advisory?: boolean;
}

export interface AttemptVerdict {
  primary: VerdictPrimary;
  measurementConfidence: MeasurementConfidence;
  strategyUsed: StrategyUsed;
  errorType: ErrorType;
  countsTowardScore: boolean;
  axes: {
    wordRetrieval: AxisScore;
    communicationSuccess: AxisScore;
    independence: AxisScore;
    // Provisional axes (pronunciation, semanticContent, fluency) are wired in
    // Phase 3; deliberately absent here so no advisory value can leak into a
    // gate before it is calibrated.
  };
  reason: string;
  /** Marks this as a shadow (non-authoritative) computation. */
  engineVersion: 'v2-shadow';
}

export interface AxisEngineInput {
  errorType?: ErrorType;
  /** v1's live correctness truth — used only for the shadow comparison. */
  v1Correct: boolean;
  phonologicalSimilarity?: number;
  semanticSimilarity?: number;
  classificationConfidence?: number;
  /** 0 = none, 1 = semantic, 2 = phonemic, 3 = full-word. */
  cueLevel?: number;
  cueKind?: CueKind;
  manualConfirmed?: boolean;
  /** Validity gate outcome — false ⇒ not a scorable attempt. */
  countsTowardScore?: boolean;
  validityLabel?: string | null;
  effortfulSpeech?: boolean;
  /** From the Phase 1 cleaning events — a repaired false start was detected. */
  selfCorrection?: boolean;
  circumlocutionDetected?: boolean;
  reconciliation?: {
    chosenSource: 'azure' | 'browser' | 'manual' | null;
    fusedConfidence: number | null;
    sourcesAgreed: boolean | null;
  };
  hasTranscript: boolean;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const fmt = (n: number | undefined): string =>
  typeof n === 'number' ? n.toFixed(2) : 'n/a';

/** Clamp a confidence-ish number into [0,1], defaulting to a cautious 0.5. */
const clampConf = (n: number | undefined): number => {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
};

const isCued = (input: AxisEngineInput): boolean =>
  (input.cueLevel ?? 0) > 0 || (!!input.cueKind && input.cueKind !== 'none');

// ── Axis C: Independence (spec §1.1) — directly observed from cue/manual ──
function scoreIndependence(input: AxisEngineInput): AxisScore {
  if (input.manualConfirmed) {
    return {
      value: 0.6,
      confidence: 0.9,
      evidence: [
        'clinician manually confirmed the production (excluded from ASR/independent accuracy)',
      ],
    };
  }
  const kind = input.cueKind ?? 'none';
  const level = input.cueLevel ?? 0;
  if (!isCued(input)) {
    return { value: 1.0, confidence: 0.95, evidence: ['no cue delivered — independent'] };
  }
  if (kind === 'semantic' || level === 1) {
    return { value: 0.7, confidence: 0.9, evidence: ['semantic cue delivered before success'] };
  }
  if (kind === 'phonemic' || level === 2) {
    return { value: 0.5, confidence: 0.9, evidence: ['phonemic cue delivered before success'] };
  }
  return {
    value: 0.3,
    confidence: 0.9,
    evidence: ['heavy scaffolding (full-word / multiple cues)'],
  };
}

// ── Axis A: Word Retrieval (spec §1.1) — banded from error type + cue ──
function scoreWordRetrieval(input: AxisEngineInput): AxisScore {
  const et = input.errorType;
  const conf = clampConf(input.classificationConfidence);
  const phon = input.phonologicalSimilarity;

  if (et === 'correct') {
    if (isCued(input)) {
      const kind = input.cueKind ?? 'none';
      const decay = kind === 'semantic' ? 1.0 : kind === 'phonemic' ? 0.75 : 0.5;
      return {
        value: round2(0.6 * decay),
        confidence: conf,
        evidence: [`target retrieved, but only after a ${kind} cue`],
      };
    }
    return { value: 1.0, confidence: conf, evidence: ['target lemma retrieved cleanly'] };
  }
  if (et === 'self_corrected') {
    return {
      value: 0.85,
      confidence: conf,
      evidence: ['target retrieved after a self-repaired false start'],
    };
  }
  if (et === 'phonemic_paraphasia') {
    return {
      value: 0.4,
      confidence: conf,
      evidence: [`phonemic approximation of the target (phon sim ${fmt(phon)})`],
    };
  }
  if (et === 'attempted') {
    return {
      value: 0.4,
      confidence: Math.min(conf, 0.6),
      evidence: ['effortful partial attempt at the target form'],
    };
  }
  if (et === 'semantic_paraphasia') {
    return {
      value: 0.0,
      confidence: conf,
      evidence: ['a different (semantically related) word — target lemma not retrieved'],
    };
  }
  if (et === 'circumlocution') {
    return {
      value: 0.0,
      confidence: conf,
      evidence: ['described rather than named — target lemma not retrieved'],
    };
  }
  if (et === 'no_response') {
    return { value: 0.0, confidence: 0.9, evidence: ['no response'] };
  }
  if (et === 'uncertain') {
    return { value: 0.0, confidence: 0.3, evidence: ['classification uncertain'] };
  }
  // neologism, unrelated
  return { value: 0.0, confidence: conf, evidence: ['target not retrieved'] };
}

// ── Axis B: Communication Success (spec §1.1) — 5 named states.
//    NEVER reads pronunciation or fluency (principle 1). ──
function scoreCommunicationSuccess(
  input: AxisEngineInput,
  countsTowardScore: boolean,
): AxisScore {
  if (!countsTowardScore) {
    return {
      value: 0.0,
      confidence: 0.9,
      evidence: ['not a scorable attempt (validity gate) — no recoverable meaning'],
    };
  }
  const et = input.errorType;
  const conf = clampConf(input.classificationConfidence);
  const phon = input.phonologicalSimilarity ?? 0;

  if (et === 'correct' || et === 'self_corrected') {
    return { value: 1.0, confidence: conf, evidence: ['target fully conveyed'] };
  }
  if (et === 'phonemic_paraphasia') {
    if (phon >= 0.75) {
      return {
        value: 1.0,
        confidence: conf,
        evidence: ['recognizable production — a listener would gloss it to the target'],
      };
    }
    return {
      value: 0.75,
      confidence: conf,
      evidence: ['gist conveyed; production imperfect but on-target'],
    };
  }
  if (et === 'circumlocution') {
    // Phase 2 limitation: per-item concept attributes are not authored yet
    // (open question #1), so we cannot verify that the description UNIQUELY
    // identifies the target. Credit function-level conveyance conservatively
    // and flag low confidence rather than over-crediting in shadow.
    return {
      value: 0.5,
      confidence: Math.min(conf, 0.5),
      evidence: [
        'described the target; unique identification not verifiable until concept attributes are authored (spec §6)',
      ],
    };
  }
  if (et === 'semantic_paraphasia') {
    return {
      value: 0.5,
      confidence: conf,
      evidence: ['in-category substitution — listener gets the category, not the item'],
    };
  }
  if (et === 'attempted') {
    return {
      value: 0.5,
      confidence: Math.min(conf, 0.6),
      evidence: ['partial / effortful attempt — some information conveyed'],
    };
  }
  if (et === 'uncertain') {
    return { value: 0.25, confidence: 0.3, evidence: ['fragmentary / uncertain'] };
  }
  if (et === 'neologism') {
    return {
      value: phon >= 0.4 ? 0.25 : 0.0,
      confidence: conf,
      evidence: ['neologism — little recoverable meaning'],
    };
  }
  if (et === 'no_response') {
    return { value: 0.0, confidence: 0.9, evidence: ['no response'] };
  }
  return { value: 0.0, confidence: conf, evidence: ['unrelated — meaning not conveyed'] };
}

// ── Cognitive Strategy (spec §1.3) ──
function classifyStrategy(input: AxisEngineInput): StrategyUsed {
  const et = input.errorType;
  if (!input.hasTranscript || et === 'no_response') return 'none';
  if (et === 'self_corrected' || input.selfCorrection) return 'self_correction';
  if (et === 'circumlocution' || input.circumlocutionDetected) return 'circumlocution';
  if (et === 'correct') {
    if (isCued(input)) return 'cue_dependent';
    if (input.effortfulSpeech) return 'effortful_search';
    return 'spontaneous';
  }
  if (et === 'phonemic_paraphasia' || et === 'attempted') return 'self_cued';
  // semantic_paraphasia, neologism, unrelated, uncertain
  return 'abandoned';
}

// ── Measurement Confidence rollup (spec §8) ──
function rollupMeasurementConfidence(
  input: AxisEngineInput,
  axes: AttemptVerdict['axes'],
  countsTowardScore: boolean,
): MeasurementConfidence {
  if (!countsTowardScore) return 'low';
  if (input.validityLabel === 'low_confidence') return 'low';

  const fused = input.reconciliation?.fusedConfidence;
  const classConf = clampConf(input.classificationConfidence);
  const minAxisConf = Math.min(
    axes.wordRetrieval.confidence,
    axes.communicationSuccess.confidence,
    axes.independence.confidence,
  );

  if (typeof fused === 'number' && fused < 0.4) return 'low';
  if (minAxisConf < 0.4) return 'low';

  const agreed = input.reconciliation?.sourcesAgreed;
  const strongSignal = typeof fused === 'number' ? fused >= 0.75 : classConf >= 0.75;
  if (strongSignal && minAxisConf >= 0.7 && agreed !== false) return 'high';
  return 'medium';
}

function decidePrimary(
  commSuccess: number,
  measurementConfidence: MeasurementConfidence,
  countsTowardScore: boolean,
): VerdictPrimary {
  if (!countsTowardScore || measurementConfidence === 'low') return 'no_score';
  if (commSuccess >= 0.75) return 'success';
  if (commSuccess >= 0.25) return 'partial';
  return 'retry';
}

function buildReason(
  input: AxisEngineInput,
  verdict: Omit<AttemptVerdict, 'reason'>,
): string {
  const { axes, strategyUsed, primary } = verdict;
  const retrieved = axes.wordRetrieval.value;
  const comm = axes.communicationSuccess.value;

  if (primary === 'no_score') {
    return 'Could not measure this attempt confidently — not counted.';
  }
  if (strategyUsed === 'self_correction') {
    return 'Reached the target after a self-corrected false start — self-monitoring intact.';
  }
  if (strategyUsed === 'circumlocution') {
    return comm >= 0.75
      ? 'Described the target successfully without naming it — communication succeeded, word retrieval did not.'
      : 'Described around the target — meaning partly conveyed; word retrieval did not succeed.';
  }
  if (input.errorType === 'semantic_paraphasia') {
    return 'In-category substitution — the listener gets the category, not the specific item.';
  }
  if (input.errorType === 'phonemic_paraphasia') {
    return comm >= 1.0
      ? 'Recognizable attempt — pronunciation was off but the word was clear.'
      : 'Close phonemic attempt — the gist came through.';
  }
  if (primary === 'success' && retrieved >= 1.0) {
    return isCued(input) ? 'Named it with a cue.' : 'Named it independently.';
  }
  if (primary === 'success') {
    return 'Communicated the target successfully.';
  }
  if (primary === 'partial') {
    return 'Partial success — some information reached the listener.';
  }
  return 'Target not reached on this attempt.';
}

/**
 * Compute the shadow AttemptVerdict for a single attempt. Pure.
 */
export function computeAttemptVerdict(input: AxisEngineInput): AttemptVerdict {
  const countsTowardScore = input.countsTowardScore ?? true;
  const errorType: ErrorType = input.errorType ?? 'uncertain';

  const axes: AttemptVerdict['axes'] = {
    wordRetrieval: scoreWordRetrieval(input),
    communicationSuccess: scoreCommunicationSuccess(input, countsTowardScore),
    independence: scoreIndependence(input),
  };

  const measurementConfidence = rollupMeasurementConfidence(input, axes, countsTowardScore);
  const strategyUsed = classifyStrategy(input);
  const primary = decidePrimary(
    axes.communicationSuccess.value,
    measurementConfidence,
    countsTowardScore,
  );

  const partial: Omit<AttemptVerdict, 'reason'> = {
    primary,
    measurementConfidence,
    strategyUsed,
    errorType,
    countsTowardScore,
    axes,
    engineVersion: 'v2-shadow',
  };

  return { ...partial, reason: buildReason(input, partial) };
}

// ── Signal reconciliation (spec §4) ──
export interface ReconcileParams {
  manualConfirmed?: boolean;
  azureTranscript?: string | null;
  azureConfidence?: number | null;
  browserTranscript?: string | null;
  browserConfidence?: number | null;
}

export interface ReconcileResult {
  chosenSource: 'azure' | 'browser' | 'manual' | null;
  chosenTranscript: string | null;
  fusedConfidence: number | null;
  sourcesAgreed: boolean | null;
}

/**
 * Reconcile the browser / Azure / manual ASR signals into one chosen transcript
 * and one fused confidence (spec §4). Content precedence: manual → azure →
 * browser. When both ASR sources produced the same normalized content the fused
 * confidence gets a small agreement bonus; disagreement lowers it. Browser
 * confidence is down-weighted (it is unreliable) and never gates on its own.
 *
 * `normalizeContent` is injected so this stays dependency-free and testable; the
 * caller passes speechNormalizer.normalizeASROutput.
 */
export function reconcileSignals(
  params: ReconcileParams,
  normalizeContent: (s: string) => string,
): ReconcileResult {
  const azure = params.azureTranscript?.trim() || null;
  const browser = params.browserTranscript?.trim() || null;

  let sourcesAgreed: boolean | null = null;
  if (azure && browser) {
    sourcesAgreed = normalizeContent(azure) === normalizeContent(browser);
  }

  // Manual confirmation wins content and is fully trusted for validity.
  if (params.manualConfirmed) {
    return {
      chosenSource: 'manual',
      chosenTranscript: azure || browser,
      fusedConfidence: 1.0,
      sourcesAgreed,
    };
  }

  if (azure) {
    let fused = typeof params.azureConfidence === 'number' ? params.azureConfidence : null;
    if (fused !== null && sourcesAgreed === true) fused = Math.min(1, fused + 0.1);
    if (fused !== null && sourcesAgreed === false) fused = Math.max(0, fused - 0.1);
    return { chosenSource: 'azure', chosenTranscript: azure, fusedConfidence: fused, sourcesAgreed };
  }

  if (browser) {
    const BROWSER_TRUST_FACTOR = 0.8;
    const fused =
      typeof params.browserConfidence === 'number'
        ? Math.max(0, Math.min(1, params.browserConfidence * BROWSER_TRUST_FACTOR))
        : null;
    return { chosenSource: 'browser', chosenTranscript: browser, fusedConfidence: fused, sourcesAgreed };
  }

  return { chosenSource: null, chosenTranscript: null, fusedConfidence: null, sourcesAgreed };
}

/**
 * Shadow comparison against v1's live verdict. Returns null when the two are not
 * comparable (v2 abstained with no_score).
 */
export function shadowAgreesWithV1(v1Correct: boolean, primary: VerdictPrimary): boolean | null {
  if (primary === 'no_score') return null;
  return v1Correct === (primary === 'success');
}
