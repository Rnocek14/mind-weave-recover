/**
 * Patient-reported Two Clues contract — a green bank lookup is not proof that
 * recognition, candidate extraction, or feedback worked on the device.
 *
 * Uses the real shipped puzzle bank, transcript cleaning and scoring engine.
 * The semantic provider is intentionally isolated; these are deterministic
 * local/answer-graph contracts, NOT live speech recognition tests.
 */
import { describe, expect, it, vi } from 'vitest';
import { TWO_CLUES_PUZZLES } from '@/data/twoCluesBank';
import { scoreAnswer } from '@/lib/twoCluesScorer';
import { removeClueWords, extractAnswerFromTranscript } from '@/lib/speechNormalizer';
import { validateSpokenResponse } from '@/lib/evaluation/responseValidation';

vi.mock('@/lib/semanticSimilarity', () => ({
  getSemanticSimilarity: vi.fn(async () => 0),
}));

const holdsWater = TWO_CLUES_PUZZLES.find((p) => p.id === 'tc-mid-12');
if (!holdsWater) throw new Error('Shipped holds/water puzzle is missing');

const preserveAnswerTokens = [
  ...holdsWater.anchors,
  ...Object.values(holdsWater.anchorAliases ?? {}).flat(),
  ...holdsWater.cluster,
  ...Object.values(holdsWater.clusterAliases ?? {}).flat(),
];

/** Compose the same production helpers used by TwoCluesGame. */
function extractSpokenCandidate(raw: string) {
  const withoutClues = removeClueWords(raw, holdsWater.clues, preserveAnswerTokens);
  return {
    withoutClues,
    candidate: extractAnswerFromTranscript(withoutClues),
  };
}

describe('Two Clues — reported holds / water encounter', () => {
  it('accepts "cup" as the strong answer the patient provided', async () => {
    const spoken = extractSpokenCandidate('holds water, I think cup');
    expect(spoken.candidate).toBe('cup');
    expect(validateSpokenResponse({ transcript: spoken.withoutClues, expectedMode: 'naming' }).valid).toBe(true);
    const result = await scoreAnswer(spoken.candidate, holdsWater);
    expect(result).toMatchObject({ tier: 'strong', score: 100, reachedAnchor: true });
  });

  it('accepts "bottle" as a related (not uniquely required) answer', async () => {
    const result = await scoreAnswer('bottle', holdsWater);
    expect(result).toMatchObject({ tier: 'related', score: 75 });
  });

  it('does not treat repeating the two clues as a patient answer', () => {
    const echoed = extractSpokenCandidate('holds water');
    expect(echoed.candidate).toBe('');
    expect(validateSpokenResponse({ transcript: echoed.withoutClues, expectedMode: 'naming' }).valid).toBe(false);
  });

  it('keeps an explicit answer after the repeated clues', async () => {
    const response = extractSpokenCandidate('holds water cup');
    expect(response.candidate).toBe('cup');
    expect((await scoreAnswer(response.candidate, holdsWater)).tier).toBe('strong');
  });
});
