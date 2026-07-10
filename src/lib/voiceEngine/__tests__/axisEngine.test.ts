import { describe, it, expect } from 'vitest';
import {
  computeAttemptVerdict,
  reconcileSignals,
  shadowAgreesWithV1,
  type AxisEngineInput,
} from '@/lib/voiceEngine/axisEngine';

/**
 * Voice Engine v2 Phase 2 — axis engine.
 *
 * These lock in the clinical mapping and, most importantly, the invariant that
 * makes the whole model defensible: Communication Success is driven by MEANING
 * and can never be pulled down by pronunciation or fluency (spec principle 1).
 */

const base: AxisEngineInput = {
  v1Correct: true,
  hasTranscript: true,
  classificationConfidence: 0.9,
  countsTowardScore: true,
};

describe('computeAttemptVerdict — always-on axes', () => {
  it('clean independent naming → all axes maxed, spontaneous, success', () => {
    const v = computeAttemptVerdict({ ...base, errorType: 'correct', cueLevel: 0 });
    expect(v.axes.wordRetrieval.value).toBe(1.0);
    expect(v.axes.communicationSuccess.value).toBe(1.0);
    expect(v.axes.independence.value).toBe(1.0);
    expect(v.strategyUsed).toBe('spontaneous');
    expect(v.primary).toBe('success');
  });

  it('correct after a semantic cue → retrieval banded down, independence 0.7, cue_dependent', () => {
    const v = computeAttemptVerdict({
      ...base,
      errorType: 'correct',
      cueLevel: 1,
      cueKind: 'semantic',
    });
    expect(v.axes.independence.value).toBe(0.7);
    expect(v.axes.wordRetrieval.value).toBeCloseTo(0.6, 5);
    expect(v.axes.communicationSuccess.value).toBe(1.0); // still fully conveyed
    expect(v.strategyUsed).toBe('cue_dependent');
  });

  it('self-correction → retrieval 0.85, strategy self_correction, still success', () => {
    const v = computeAttemptVerdict({ ...base, errorType: 'self_corrected' });
    expect(v.axes.wordRetrieval.value).toBe(0.85);
    expect(v.axes.communicationSuccess.value).toBe(1.0);
    expect(v.strategyUsed).toBe('self_correction');
    expect(v.reason).toMatch(/self-corrected|self-monitoring/i);
  });

  it('manual-confirmed → independence 0.6 flagged', () => {
    const v = computeAttemptVerdict({
      ...base,
      errorType: 'correct',
      manualConfirmed: true,
    });
    expect(v.axes.independence.value).toBe(0.6);
    expect(v.axes.independence.evidence.join(' ')).toMatch(/manually confirmed/i);
  });
});

describe('Communication Success invariant — meaning only, never pronunciation/fluency', () => {
  it('effortful, low-fluency but correct production is still fully conveyed', () => {
    const v = computeAttemptVerdict({
      ...base,
      errorType: 'correct',
      effortfulSpeech: true, // fluency is bad…
      cueLevel: 0,
    });
    // …but communication success is unaffected.
    expect(v.axes.communicationSuccess.value).toBe(1.0);
    expect(v.primary).toBe('success');
    // strategy reflects the effort though.
    expect(v.strategyUsed).toBe('effortful_search');
  });

  it('phonemic paraphasia with high phon-sim → recognizable, comm 1.0', () => {
    const v = computeAttemptVerdict({
      ...base,
      v1Correct: false,
      errorType: 'phonemic_paraphasia',
      phonologicalSimilarity: 0.82,
    });
    expect(v.axes.communicationSuccess.value).toBe(1.0);
    expect(v.axes.wordRetrieval.value).toBe(0.4);
    expect(v.strategyUsed).toBe('self_cued');
  });

  it('phonemic paraphasia with low phon-sim → gist only, comm 0.75', () => {
    const v = computeAttemptVerdict({
      ...base,
      v1Correct: false,
      errorType: 'phonemic_paraphasia',
      phonologicalSimilarity: 0.62,
    });
    expect(v.axes.communicationSuccess.value).toBe(0.75);
    expect(v.primary).toBe('success'); // 0.75 ⇒ success band
  });
});

describe('circumlocution — communication-success pathway, retrieval failed', () => {
  it('retrieval 0 but partial communication, strategy circumlocution', () => {
    const v = computeAttemptVerdict({
      ...base,
      v1Correct: false,
      errorType: 'circumlocution',
    });
    expect(v.axes.wordRetrieval.value).toBe(0.0);
    expect(v.axes.communicationSuccess.value).toBe(0.5); // conservative in Phase 2
    expect(v.strategyUsed).toBe('circumlocution');
    expect(v.axes.communicationSuccess.evidence.join(' ')).toMatch(/concept attributes/i);
  });
});

describe('errors', () => {
  it('semantic paraphasia → retrieval 0, category conveyed (comm 0.5), partial', () => {
    const v = computeAttemptVerdict({
      ...base,
      v1Correct: false,
      errorType: 'semantic_paraphasia',
      semanticSimilarity: 0.6,
    });
    expect(v.axes.wordRetrieval.value).toBe(0.0);
    expect(v.axes.communicationSuccess.value).toBe(0.5);
    expect(v.primary).toBe('partial');
    expect(v.strategyUsed).toBe('abandoned');
  });

  it('unrelated → comm 0, retry', () => {
    const v = computeAttemptVerdict({ ...base, v1Correct: false, errorType: 'unrelated' });
    expect(v.axes.communicationSuccess.value).toBe(0.0);
    expect(v.primary).toBe('retry');
  });

  it('no_response → strategy none, comm 0, retry', () => {
    const v = computeAttemptVerdict({
      ...base,
      v1Correct: false,
      errorType: 'no_response',
      hasTranscript: false,
    });
    expect(v.strategyUsed).toBe('none');
    expect(v.primary).toBe('retry');
  });
});

describe('validity gate + measurement confidence', () => {
  it('countsTowardScore=false → no_score regardless of content', () => {
    const v = computeAttemptVerdict({
      ...base,
      errorType: 'correct',
      countsTowardScore: false,
    });
    expect(v.primary).toBe('no_score');
    expect(v.measurementConfidence).toBe('low');
    expect(v.reason).toMatch(/could not measure/i);
  });

  it('low_confidence validity label → no_score even if v1 called it correct', () => {
    const v = computeAttemptVerdict({
      ...base,
      errorType: 'correct',
      validityLabel: 'low_confidence',
    });
    expect(v.measurementConfidence).toBe('low');
    expect(v.primary).toBe('no_score');
  });

  it('strong fused confidence + agreement → high measurement confidence', () => {
    const v = computeAttemptVerdict({
      ...base,
      errorType: 'correct',
      reconciliation: { chosenSource: 'azure', fusedConfidence: 0.92, sourcesAgreed: true },
    });
    expect(v.measurementConfidence).toBe('high');
  });

  it('very low fused confidence → low measurement confidence → no_score', () => {
    const v = computeAttemptVerdict({
      ...base,
      errorType: 'correct',
      reconciliation: { chosenSource: 'browser', fusedConfidence: 0.2, sourcesAgreed: null },
    });
    expect(v.measurementConfidence).toBe('low');
    expect(v.primary).toBe('no_score');
  });
});

describe('reconcileSignals', () => {
  const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');

  it('manual confirmation wins content and is fully trusted', () => {
    const r = reconcileSignals(
      { manualConfirmed: true, azureTranscript: 'knife', azureConfidence: 0.4 },
      norm,
    );
    expect(r.chosenSource).toBe('manual');
    expect(r.fusedConfidence).toBe(1.0);
  });

  it('azure preferred over browser; agreement bumps confidence', () => {
    const r = reconcileSignals(
      {
        azureTranscript: 'knife',
        azureConfidence: 0.8,
        browserTranscript: 'knife',
        browserConfidence: 0.5,
      },
      norm,
    );
    expect(r.chosenSource).toBe('azure');
    expect(r.sourcesAgreed).toBe(true);
    expect(r.fusedConfidence).toBeCloseTo(0.9, 5);
  });

  it('disagreement lowers fused confidence', () => {
    const r = reconcileSignals(
      {
        azureTranscript: 'knife',
        azureConfidence: 0.8,
        browserTranscript: 'life',
      },
      norm,
    );
    expect(r.sourcesAgreed).toBe(false);
    expect(r.fusedConfidence).toBeCloseTo(0.7, 5);
  });

  it('browser-only is down-weighted', () => {
    const r = reconcileSignals({ browserTranscript: 'knife', browserConfidence: 1.0 }, norm);
    expect(r.chosenSource).toBe('browser');
    expect(r.fusedConfidence).toBeCloseTo(0.8, 5);
  });

  it('no signal at all → null everything', () => {
    const r = reconcileSignals({}, norm);
    expect(r.chosenSource).toBeNull();
    expect(r.fusedConfidence).toBeNull();
  });
});

describe('shadowAgreesWithV1', () => {
  it('v1 correct ↔ v2 success agree', () => {
    expect(shadowAgreesWithV1(true, 'success')).toBe(true);
    expect(shadowAgreesWithV1(false, 'retry')).toBe(true);
    expect(shadowAgreesWithV1(false, 'partial')).toBe(true);
  });
  it('v1 correct but v2 not success → disagree', () => {
    expect(shadowAgreesWithV1(true, 'partial')).toBe(false);
    expect(shadowAgreesWithV1(true, 'retry')).toBe(false);
  });
  it('no_score is not comparable → null', () => {
    expect(shadowAgreesWithV1(true, 'no_score')).toBeNull();
    expect(shadowAgreesWithV1(false, 'no_score')).toBeNull();
  });
});
