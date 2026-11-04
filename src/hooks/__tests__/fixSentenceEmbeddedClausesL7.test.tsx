import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIX_SENTENCE_EMBEDDED_CLAUSE_BANK } from '@/data/fixSentenceEmbeddedClauseBank';
import {
  selectFixSentencePool, selectEmbeddedClauseCandidates,
} from '@/lib/progression/fixSentenceContentSelector';
import {
  FIX_SENTENCE_LEVELS, evidenceMetForFixSentenceLevel,
  highestImplementedFixSentenceLevel,
} from '@/lib/progression/fixSentenceLevels';
import { useFixSentenceGame } from '@/hooks/useFixSentenceGame';

vi.mock('@/hooks/useGameSounds', () => ({
  useGameSounds: () => ({ playSuccess: vi.fn(), playError: vi.fn() }),
}));

// A grammar connector should never be accepted by a semantic near-neighbor
// score; intentionally fail if production tries to call this fallback.
vi.mock('@/lib/semanticSimilarity', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/semanticSimilarity')>();
  return {
    ...actual,
    getSemanticSimilarity: vi.fn(async () => {
      throw new Error('strict embedded grammar must not use semantic similarity');
    }),
  };
});

function mount(level: number = 7) {
  return renderHook(() => useFixSentenceGame({
    trialCount: 5,
    difficulty: 3,
    clinicalLevel: level,
  }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('Fix Sentence L7: real adult embedded relative/complement clauses', () => {
  it('has 24 unique clinical sentences with exactly one repairable wrong connector', () => {
    expect(FIX_SENTENCE_EMBEDDED_CLAUSE_BANK).toHaveLength(24);
    expect(new Set(FIX_SENTENCE_EMBEDDED_CLAUSE_BANK.map(t => t.id)).size).toBe(24);
    const types = new Set<string>();
    for (const trial of FIX_SENTENCE_EMBEDDED_CLAUSE_BANK) {
      expect(trial.embeddedClause, trial.id).toBeDefined();
      expect(trial.secondError, trial.id).toBeUndefined();
      expect(trial.morphology, trial.id).toBeUndefined();
      expect(trial.difficulty, trial.id).toBe(3);
      expect(trial.acceptedFixes.length, trial.id).toBeGreaterThan(0);
      const words = trial.sentence.split(/\s+/).map(w => w.toLowerCase().replace(/[^a-z]/g, ''));
      expect(words[trial.wrongWordIndex - 1], trial.id).toBe(trial.wrongWord);
      expect(words.filter(w => w === trial.wrongWord), trial.id).toHaveLength(1);
      const corrected = trial.sentence.split(/\s+/);
      corrected[trial.wrongWordIndex - 1] =
        corrected[trial.wrongWordIndex - 1].replace(new RegExp(trial.wrongWord, 'i'), trial.acceptedFixes[0]);
      expect(corrected.join(' '), trial.id).toBe(trial.embeddedClause!.correctedSentence);
      types.add(trial.embeddedClause!.construction);
    }
    expect(types).toEqual(new Set(['relative_subject', 'relative_object', 'complement_clause']));
  });

  it('serves the tagged clinical L7 cohort with a real L7 ceiling, not baseline L4 or L6', () => {
    expect(selectEmbeddedClauseCandidates()).toHaveLength(24);
    expect(selectFixSentencePool(7)).toMatchObject({
      tier: 'L7', reason: 'embedded_clauses', fallback: null,
    });
    expect(highestImplementedFixSentenceLevel()).toBe(7);
    expect(FIX_SENTENCE_LEVELS[7].contentSelector?.implemented).toBe(true);
    expect(FIX_SENTENCE_LEVELS[8].contentSelector?.implemented).toBe(false);
    expect(selectFixSentencePool(8).fallback?.skipped).toBe(true);
    const { result } = mount();
    expect(result.current.totalTrials).toBe(5);
    expect(result.current.currentTrial?.embeddedClause).toBeDefined();
  });

  it('scores a spoken exact connector without calling the semantic scorer', async () => {
    const { result } = mount();
    const trial = result.current.currentTrial!;
    await act(async () => {
      const evaluation = await result.current.scoreAnswer(trial.acceptedFixes[0]);
      expect(evaluation?.isCorrect).toBe(true);
      expect(evaluation?.matchedFix).toBe(trial.acceptedFixes[0]);
      expect(evaluation?.support).toBe('open_response');
    });
  });

  it('accepts a fully corrected sentence as spoken repair, but never an echo of the WRONG sentence', async () => {
    const { result } = mount();
    const trial = result.current.currentTrial!;
    await act(async () => {
      const answer = await result.current.scoreAnswer(trial.embeddedClause!.correctedSentence);
      expect(answer?.isCorrect).toBe(true);
      const echo = await result.current.scoreAnswer(trial.sentence);
      expect(echo?.isCorrect).toBe(false);
      expect(echo?.isPartialCredit).toBe(false);
      expect(echo?.semanticSimilarity).toBeNull();
    });
  });

  it('wrong pronouns, plural approximations and unrelated utterances never earn credit', async () => {
    const { result } = mount();
    const trial = result.current.currentTrial!;
    await act(async () => {
      for (const attempt of [trial.wrongWord, 'where', 'banana xylophone']) {
        // Some trials intentionally have "where" as the wrong word.
        // None of these tokens is a valid accepted fix in the bank.
        const scored = await result.current.scoreAnswer(attempt);
        expect(scored?.isCorrect, `${trial.id}: ${attempt}`).toBe(false);
        expect(scored?.isPartialCredit).toBe(false);
        expect(scored?.semanticSimilarity).toBeNull();
      }
    });
  });

  it.each([1, 10])('engine level %i cannot replace upcoming L7 questions with baseline items', engineLevel => {
    const { result } = mount();
    const firstId = result.current.currentTrial!.id;
    act(() => result.current.setActiveDifficulty(engineLevel));
    expect(result.current.currentTrial?.id).toBe(firstId);
    expect(result.current.totalTrials).toBe(5);
    const seen = new Set<string>([firstId]);
    for (let n = 1; n < result.current.totalTrials; n++) {
      act(() => result.current.nextTrial());
      const trial = result.current.currentTrial!;
      expect(trial.embeddedClause, `engine ${engineLevel}, trial ${n}`).toBeDefined();
      expect(trial.id).toMatch(/^fse_/);
      seen.add(trial.id);
    }
    expect(seen.size).toBe(result.current.totalTrials);
  });

  it.each([4, 5, 6])('in-session adaptation also preserves real L%i clinical cohort', level => {
    const { result } = mount(level);
    const before = selectFixSentencePool(level);
    expect(before.fallback).toBeNull();
    const allowed = new Set(before.pool.map(t => t.id));
    const firstId = result.current.currentTrial!.id;
    act(() => result.current.setActiveDifficulty(1));
    expect(result.current.currentTrial?.id).toBe(firstId);
    for (let n = 0; n < result.current.totalTrials; n++) {
      expect(allowed.has(result.current.currentTrial!.id), `L${level} trial ${n}`).toBe(true);
      if (n + 1 < result.current.totalTrials) {
        act(() => result.current.nextTrial());
      }
    }
  });

  it('requires six open repairs at L7; assisted choice-only work cannot advance', () => {
    const sixIndependent = Array.from({ length: 6 }, () => ({
      correct: true, support: 'open_response' as const,
    }));
    expect(evidenceMetForFixSentenceLevel(sixIndependent, 7)).toBe(true);
    expect(evidenceMetForFixSentenceLevel(sixIndependent.slice(0, 5), 7)).toBe(false);
    expect(evidenceMetForFixSentenceLevel(
      sixIndependent.map(t => ({ ...t, support: 'choice_based' as const })), 7,
    )).toBe(false);
  });
});
