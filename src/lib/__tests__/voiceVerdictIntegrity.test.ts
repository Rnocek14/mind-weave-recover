/**
 * The clinical record must say what the patient did — not what the transport
 * layer managed. Four ways it did not, each found by driving the real code:
 *
 *  1. A correctly heard target with ASR confidence < 0.4 was classified
 *     'uncertain' before the exact-match check ran: "Correct" on screen,
 *     score 0 / 'uncertain' in the record.
 *  2. "dog" for "cat" — the textbook semantic paraphasia — was recorded as
 *     'unrelated' whenever embeddings were unavailable, because the noise cap
 *     (0.45) sat exactly on the classifier's > 0.45 threshold and was applied
 *     to the deliberate rule-based same-category score as well.
 *  3. A transcribed word with NO recorder duration (the recorder starts ~900 ms
 *     into a trial and only with a session, user and MediaRecorder) was treated
 *     as a 0 ms recording, labelled no_response and dropped from accuracy.
 *  4. The clinician's Speech Profile tab filtered phoneme accuracy as 0–1 while
 *     the writer stores 0–100: its focus list was always empty.
 */
import { describe, it, expect } from 'vitest';
import { classifySpeechError } from '@/lib/errorClassifier';
import { classifyUtteranceValidity } from '@/lib/clinical/classifyUtteranceValidity';
import { selectFocusPhonemes } from '@/components/patient-hub/SpeechProfileTab';

const ctx = (category: string) =>
  ({ trialNumber: 1, previousErrors: [], category, features: undefined }) as Parameters<typeof classifySpeechError>[3];

describe('voice verdict integrity', () => {
  it('an exact match is correct however unsure the recognizer was — flagged, not failed', async () => {
    const r = await classifySpeechError('cat', 'cat', 0.3, ctx('animals'));
    expect(r.errorType).toBe('correct');
    expect(r.needs_review).toBe(true);
    expect(r.reasoning).toMatch(/flagged for review/i);

    const zero = await classifySpeechError('cat', 'cat', 0, ctx('animals'));
    expect(zero.errorType).toBe('correct');

    // The gate still does its job for anything that is NOT the target.
    const unsure = await classifySpeechError('cap', 'cat', 0.3, ctx('animals'));
    expect(unsure.errorType).toBe('uncertain');
  });

  it('a same-category substitution is a semantic paraphasia without an embedding service', async () => {
    // jsdom has no network: get-embedding fails, embeddings disable themselves
    // for the run, and the rule-based scorer is what production falls back to.
    const r = await classifySpeechError('dog', 'cat', 0.9, ctx('animals'));
    expect(r.errorType).toBe('semantic_paraphasia');
    expect(r.semantic_similarity ?? 0).toBeGreaterThan(0.45);
  });

  it('a transcribed word with no recording at all is a response, not silence', () => {
    const r = classifyUtteranceValidity({ transcript: 'cat', asrConfidence: 0.9, recordingDurationMs: null });
    expect(r.validity).toBe('valid_attempt');
    expect(r.countsTowardScore).toBe(true);
    // A MEASURED recording too short to hold a word stays no_response (locked
    // policy — see classifyUtteranceValidity.test.ts), and silence is silence.
    expect(classifyUtteranceValidity({ transcript: 'cat', recordingDurationMs: 250 }).validity).toBe('no_response');
    expect(classifyUtteranceValidity({ transcript: '', recordingDurationMs: 0 }).validity).toBe('no_response');
    expect(classifyUtteranceValidity({ transcript: 'um', recordingDurationMs: null }).validity).toBe('filler_only');
  });

  it("the clinician's focus-phoneme list reads the writer's 0–100 scale", () => {
    const map = {
      k: { accuracy: 65, trials: 4 },
      s: { accuracy: 92, trials: 6 },
      t: { accuracy: 40, trials: 2 }, // too few trials
      r: { accuracy: 55, trials: 3 },
    };
    const focus = selectFocusPhonemes(map);
    expect(focus.map(([p]) => p)).toEqual(['r', 'k']);
    expect(focus[0][1].accuracy).toBe(55);
  });
});
