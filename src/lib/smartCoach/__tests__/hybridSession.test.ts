/**
 * Hybrid Session QA Test Matrix
 *
 * 4 clinical paths:
 *   1. Strong user — challenge drill fires, feels earned
 *   2. Struggling user — support drill fires, not punitive
 *   3. Repair path — off-topic reset via repair drill
 *   4. Daily Routine — no cereal tunnel, proper redirects
 *
 * Plus: guard rails, cooldowns, window gating, drill selection.
 */

import { describe, it, expect } from 'vitest';
import { evaluateDrillTrigger, type DrillTriggerContext } from '../drillTriggerEvaluator';
import { selectDrill, selectPracticeBlock, type DrillSelectionContext } from '../drillSelector';
import { analyzeUtterance } from '../utteranceAnalyzer';
import type { CoachState, CoachUtteranceAnalysis } from '../types';

// ─── Helpers ────────────────────────────────────────────────

function makeState(overrides: Partial<CoachState> = {}): CoachState {
  return {
    topic: 'food',
    mode: 'expand',
    supportLevel: 1,
    turnCount: 4,
    isStuck: false,
    frustrationRisk: 'low',
    topicKeywords: ['breakfast', 'lunch', 'dinner', 'eat', 'cook', 'food'],
    establishedFacts: [],
    conversationHistory: [],
    consecutiveHesitations: 0,
    expandDimension: 0,
    recentHesitations: [],
    lastPurposeAnchorTurn: 0,
    postInterventionDampening: false,
    interventionCount: 0,
    currentObjectiveIndex: 0,
    objectiveProgress: { turnsOnObjective: 0 },
    subtopicDepth: 0,
    consecutiveDisengagements: 0,
    recentMayaNouns: [],
    readinessLevel: 7,
    severityProfile: 'moderate',
    primaryDeficit: 'expressive',
    purposeContext: {
      goalId: 'g1',
      skillTarget: 'word_finding',
      transferTarget: 'ordering food',
      rationale: 'Practice food vocabulary',
      measure: 'independent retrieval',
      supportMode: 'guided_retrieval',
      expectedDifficulty: 'moderate',
    },
    sessionMetrics: {
      wordsProduced: 0,
      independentResponses: 0,
      cueAssistedCount: 0,
      longestResponse: 0,
      hesitationCount: 0,
      semanticErrorCount: 0,
      phonemicErrorCount: 0,
      comprehensionBreaks: 0,
      strategiesThatHelped: [],
      avgLatencyEstimate: 0,
    },
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<CoachUtteranceAnalysis> = {}): CoachUtteranceAnalysis {
  return {
    transcript: 'test',
    wordCount: 3,
    onTopic: true,
    semanticMatch: 0.5,
    phonologicalApprox: false,
    circumlocution: false,
    incompleteThought: false,
    pauseDetected: false,
    hesitationDetected: false,
    disengagementDetected: false,
    confusionDetected: false,
    correctionDetected: false,
    confidence: 0.7,
    likelyErrorType: 'none',
    ...overrides,
  };
}

function makeTriggerCtx(overrides: Partial<DrillTriggerContext> = {}): DrillTriggerContext {
  return {
    state: makeState(),
    analysis: makeAnalysis(),
    maxTurns: 10,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// PATH 1: STRONG USER — Challenge drill fires, feels earned
// ═══════════════════════════════════════════════════════════════

describe('Path 1: Strong User', () => {
  it('fires challenge micro-drill when all conditions met', () => {
    const ctx = makeTriggerCtx({
      state: makeState({
        turnCount: 4,
        supportLevel: 0,
        recentHesitations: [false, false],
        interventionCount: 0,
      }),
      analysis: makeAnalysis({
        wordCount: 5,
        hesitationDetected: false,
        semanticMatch: 0.8,
        onTopic: true,
      }),
      objectiveAdvanced: true,
    });

    const result = evaluateDrillTrigger(ctx);
    expect(result.kind).toBe('micro_drill');
    expect(result.reason).toBe('challenge');
    expect(result.signals).toContain('objective_advanced');
    expect(result.signals).toContain('strong_independent_response');
  });

  it('does NOT fire challenge if objective not advanced', () => {
    const ctx = makeTriggerCtx({
      state: makeState({
        turnCount: 4,
        supportLevel: 0,
        recentHesitations: [false, false],
      }),
      analysis: makeAnalysis({ wordCount: 5, hesitationDetected: false }),
      objectiveAdvanced: false,
    });

    const result = evaluateDrillTrigger(ctx);
    // Should not be challenge
    expect(result.reason).not.toBe('challenge');
  });

  it('does NOT fire challenge if recent hesitation exists', () => {
    const ctx = makeTriggerCtx({
      state: makeState({
        turnCount: 4,
        supportLevel: 0,
        recentHesitations: [true, false],
      }),
      analysis: makeAnalysis({ wordCount: 5, hesitationDetected: false }),
      objectiveAdvanced: true,
    });

    const result = evaluateDrillTrigger(ctx);
    expect(result.reason).not.toBe('challenge');
  });

  it('does NOT fire challenge if support level elevated', () => {
    const ctx = makeTriggerCtx({
      state: makeState({
        turnCount: 4,
        supportLevel: 2,
        recentHesitations: [false, false],
      }),
      analysis: makeAnalysis({ wordCount: 5, hesitationDetected: false }),
      objectiveAdvanced: true,
    });

    const result = evaluateDrillTrigger(ctx);
    expect(result.reason).not.toBe('challenge');
  });

  it('selects harder games for challenge drills', () => {
    const sel = selectDrill({
      state: makeState({ supportLevel: 0, primaryDeficit: 'expressive' }),
      reason: 'challenge',
      signals: ['objective_advanced', 'strong_independent_response'],
      usedGameIds: [],
      kind: 'micro_drill',
    });

    // Challenge should prefer sentence_construction or category_fluency
    expect(['sentence_construction', 'category_fluency']).toContain(sel.drill.id);
    expect(sel.configOverrides.totalTrials).toBeLessThanOrEqual(4);
  });
});

// ═══════════════════════════════════════════════════════════════
// PATH 2: STRUGGLING USER — Support drill fires, not punitive
// ═══════════════════════════════════════════════════════════════

describe('Path 2: Struggling User', () => {
  it('fires support micro-drill on hesitation cluster + circumlocution', () => {
    const ctx = makeTriggerCtx({
      state: makeState({
        turnCount: 4,
        recentHesitations: [true, true, false],
        supportLevel: 2,
      }),
      analysis: makeAnalysis({
        circumlocution: true,
        hesitationDetected: true,
      }),
      objectiveAdvanced: false,
    });

    const result = evaluateDrillTrigger(ctx);
    expect(result.kind).toBe('micro_drill');
    expect(result.reason).toBe('support');
    expect(result.signals).toContain('hesitation_cluster');
    expect(result.signals).toContain('circumlocution');
  });

  it('fires support on consecutive hesitation + elevated support', () => {
    const prevAnalysis = makeAnalysis({ hesitationDetected: true });
    const ctx = makeTriggerCtx({
      state: makeState({
        turnCount: 5,
        supportLevel: 2,
        recentHesitations: [true, true],
      }),
      analysis: makeAnalysis({ hesitationDetected: true, wordCount: 2 }),
      prevAnalysis,
      objectiveAdvanced: false,
    });

    const result = evaluateDrillTrigger(ctx);
    expect(result.kind).toBe('micro_drill');
    expect(result.reason).toBe('support');
  });

  it('does NOT fire support when user is just giving short valid answers', () => {
    const ctx = makeTriggerCtx({
      state: makeState({
        turnCount: 4,
        recentHesitations: [false, false],
        supportLevel: 0,
      }),
      analysis: makeAnalysis({
        wordCount: 1,
        onTopic: true, // valid short answer
        hesitationDetected: false,
      }),
    });

    const result = evaluateDrillTrigger(ctx);
    expect(result.kind).toBeNull();
  });

  it('does NOT misfire support when user is correcting Maya', () => {
    // Corrections are analyzed differently
    const analysis = analyzeUtterance(
      "No, I didn't say that. I said eggs.",
      'food',
      ['breakfast', 'eggs', 'cook']
    );
    expect(analysis.hesitationDetected).toBe(false);
    expect(analysis.onTopic).toBe(true);

    const ctx = makeTriggerCtx({
      state: makeState({ turnCount: 4 }),
      analysis,
    });

    const result = evaluateDrillTrigger(ctx);
    expect(result.reason).not.toBe('support');
  });

  it('selects accessible games for support drills', () => {
    const sel = selectDrill({
      state: makeState({ supportLevel: 2, severityProfile: 'severe' }),
      reason: 'support',
      signals: ['hesitation_cluster', 'circumlocution'],
      usedGameIds: [],
      kind: 'micro_drill',
    });

    // Support + severe should prefer photo_naming or yes_no
    expect(['photo_naming', 'yes_no_comprehension']).toContain(sel.drill.id);
    // Cue level should be elevated for support
    expect(sel.configOverrides.cueLevel).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// PATH 3: REPAIR — Off-topic reset
// ═══════════════════════════════════════════════════════════════

describe('Path 3: Repair', () => {
  it('fires repair drill on deep tangent', () => {
    const ctx = makeTriggerCtx({
      state: makeState({
        turnCount: 5,
        subtopicDepth: 3,
        interventionCount: 0,
      }),
      analysis: makeAnalysis({ onTopic: false }),
    });

    const result = evaluateDrillTrigger(ctx);
    expect(result.kind).toBe('micro_drill');
    expect(result.reason).toBe('repair');
    expect(result.signals).toContain('deep_tangent');
  });

  it('fires repair drill on consecutive off-topic turns', () => {
    const prevAnalysis = makeAnalysis({ onTopic: false });
    const ctx = makeTriggerCtx({
      state: makeState({ turnCount: 4, interventionCount: 0 }),
      analysis: makeAnalysis({ onTopic: false }),
      prevAnalysis,
    });

    const result = evaluateDrillTrigger(ctx);
    expect(result.kind).toBe('micro_drill');
    expect(result.reason).toBe('repair');
    expect(result.signals).toContain('consecutive_off_topic');
  });

  it('does NOT fire repair on single off-topic turn', () => {
    const ctx = makeTriggerCtx({
      state: makeState({ turnCount: 4, subtopicDepth: 1, interventionCount: 0 }),
      analysis: makeAnalysis({ onTopic: false }),
      // No prevAnalysis or prevAnalysis on-topic
    });

    const result = evaluateDrillTrigger(ctx);
    // Single off-topic with low tangent depth should not trigger
    expect(result.reason).not.toBe('repair');
  });
});

// ═══════════════════════════════════════════════════════════════
// PATH 4: DAILY ROUTINE — No cereal tunnel
// ═══════════════════════════════════════════════════════════════

describe('Path 4: Daily Routine', () => {
  it('detects when user is tunneling on one subtopic', () => {
    // Simulates: "cereal" → "Captain Crunch" → "milk" (all breakfast sub-items)
    // subtopicDepth should be high, triggering repair or redirect
    const ctx = makeTriggerCtx({
      state: makeState({
        topic: 'daily_routine',
        topicKeywords: ['morning', 'routine', 'shower', 'breakfast', 'work', 'lunch'],
        turnCount: 5,
        subtopicDepth: 3,
        currentSubtopic: 'cereal',
        interventionCount: 0,
      }),
      analysis: analyzeUtterance('captain crunch', 'daily_routine', ['morning', 'routine', 'shower', 'breakfast']),
    });

    const result = evaluateDrillTrigger(ctx);
    expect(result.kind).toBe('micro_drill');
    expect(result.reason).toBe('repair');
  });

  it('selects sentence_construction for daily routine topic', () => {
    const sel = selectDrill({
      state: makeState({ topic: 'daily_routine' }),
      reason: 'support',
      signals: ['hesitation_cluster'],
      usedGameIds: [],
      kind: 'micro_drill',
    });

    // daily_routine should prefer sentence_construction or category_fluency
    expect(['sentence_construction', 'category_fluency', 'photo_naming']).toContain(sel.drill.id);
  });

  it('targeted practice at turn 8+ fires for daily routine', () => {
    const ctx = makeTriggerCtx({
      state: makeState({
        topic: 'daily_routine',
        turnCount: 8,
      }),
      analysis: makeAnalysis(),
    });

    const result = evaluateDrillTrigger(ctx);
    expect(result.kind).toBe('targeted_practice');
  });
});

// ═══════════════════════════════════════════════════════════════
// GUARD RAILS — Window gating, cooldowns, mode restrictions
// ═══════════════════════════════════════════════════════════════

describe('Guard Rails', () => {
  it('never triggers during warmup', () => {
    const ctx = makeTriggerCtx({
      state: makeState({ mode: 'warmup', turnCount: 4 }),
      analysis: makeAnalysis({ hesitationDetected: true, circumlocution: true }),
    });

    expect(evaluateDrillTrigger(ctx).kind).toBeNull();
  });

  it('never triggers during wrapup', () => {
    const ctx = makeTriggerCtx({
      state: makeState({ mode: 'wrapup', turnCount: 9 }),
    });

    expect(evaluateDrillTrigger(ctx).kind).toBeNull();
  });

  it('never triggers micro-drill before turn 3', () => {
    const ctx = makeTriggerCtx({
      state: makeState({ turnCount: 2, recentHesitations: [true, true, true] }),
      analysis: makeAnalysis({ hesitationDetected: true, circumlocution: true }),
    });

    const result = evaluateDrillTrigger(ctx);
    // Should not be micro_drill (may be null or targeted_practice but not at turn 2)
    expect(result.kind).not.toBe('micro_drill');
  });

  it('never triggers micro-drill after turn 6 (before turn 8)', () => {
    const ctx = makeTriggerCtx({
      state: makeState({ turnCount: 7, recentHesitations: [true, true, true] }),
      analysis: makeAnalysis({ hesitationDetected: true, circumlocution: true }),
    });

    const result = evaluateDrillTrigger(ctx);
    expect(result.kind).toBeNull();
  });

  it('respects 2-turn cooldown after drill', () => {
    const ctx = makeTriggerCtx({
      state: makeState({
        turnCount: 5,
        recentHesitations: [true, true, true],
      }),
      analysis: makeAnalysis({ hesitationDetected: true, circumlocution: true }),
      lastDrillCompletedAtTurn: 4, // just did one
    });

    expect(evaluateDrillTrigger(ctx).kind).toBeNull();
  });

  it('allows drill after cooldown expires', () => {
    const ctx = makeTriggerCtx({
      state: makeState({
        turnCount: 6,
        recentHesitations: [true, true, true],
      }),
      analysis: makeAnalysis({ hesitationDetected: true, circumlocution: true }),
      lastDrillCompletedAtTurn: 3, // 3 turns ago
    });

    // Should be able to trigger (6 - 3 = 3 >= 2)
    const result = evaluateDrillTrigger(ctx);
    expect(result.kind).not.toBeNull();
  });

  it('only allows one micro-drill per session', () => {
    const ctx = makeTriggerCtx({
      state: makeState({
        turnCount: 5,
        interventionCount: 1, // already had one
        recentHesitations: [true, true, true],
      }),
      analysis: makeAnalysis({ hesitationDetected: true, circumlocution: true }),
    });

    expect(evaluateDrillTrigger(ctx).kind).toBeNull();
  });

  it('targeted practice fires at transfer_check objective', () => {
    const ctx = makeTriggerCtx({
      state: makeState({ turnCount: 5 }), // before turn 8 normally
      currentObjectiveId: 'transfer_check',
      analysis: makeAnalysis(),
    });

    const result = evaluateDrillTrigger(ctx);
    expect(result.kind).toBe('targeted_practice');
  });
});

// ═══════════════════════════════════════════════════════════════
// DRILL SELECTION — No repeats, correct weighting
// ═══════════════════════════════════════════════════════════════

describe('Drill Selection', () => {
  it('never repeats a game already used this session', () => {
    const sel = selectDrill({
      state: makeState(),
      reason: 'support',
      signals: ['hesitation_cluster'],
      usedGameIds: ['photo_naming'],
      kind: 'micro_drill',
    });

    expect(sel.drill.id).not.toBe('photo_naming');
  });

  it('selects practice block with 1-2 games', () => {
    const block = selectPracticeBlock({
      state: makeState({
        supportLevel: 0,
        sessionMetrics: {
          ...makeState().sessionMetrics,
          independentResponses: 5,
        },
      }),
      reason: 'support',
      signals: ['session_late_phase'],
      usedGameIds: [],
    });

    expect(block.length).toBeGreaterThanOrEqual(1);
    expect(block.length).toBeLessThanOrEqual(2);

    // If 2 games, they should be different
    if (block.length === 2) {
      expect(block[0].drill.id).not.toBe(block[1].drill.id);
    }
  });

  it('micro-drill config limits to 4 trials max', () => {
    const sel = selectDrill({
      state: makeState(),
      reason: 'support',
      signals: ['hesitation_cluster'],
      usedGameIds: [],
      kind: 'micro_drill',
    });

    expect(sel.configOverrides.totalTrials).toBeLessThanOrEqual(4);
  });

  it('targeted practice uses full trial count', () => {
    const sel = selectDrill({
      state: makeState(),
      reason: 'support',
      signals: ['session_late_phase'],
      usedGameIds: [],
      kind: 'targeted_practice',
    });

    // Should NOT be capped to 4
    expect(sel.configOverrides.totalTrials).toBeGreaterThanOrEqual(4);
  });
});

// ═══════════════════════════════════════════════════════════════
// UTTERANCE ANALYSIS — Edge cases that caused bugs
// ═══════════════════════════════════════════════════════════════

describe('Utterance Analysis Edge Cases', () => {
  it('does not flag correction as hesitation', () => {
    const a = analyzeUtterance("That's not what I said", 'food', ['breakfast']);
    expect(a.hesitationDetected).toBe(false);
  });

  it('does not flag correction as off-topic', () => {
    const a = analyzeUtterance("You're wrong, I said pizza", 'food', ['pizza']);
    expect(a.onTopic).toBe(true);
  });

  it('detects circumlocution properly', () => {
    const a = analyzeUtterance("the thing you use to cook", 'food', ['cook', 'pan']);
    expect(a.circumlocution).toBe(true);
    expect(a.likelyErrorType).toBe('circumlocution');
  });

  it('detects surrender phrase', () => {
    const a = analyzeUtterance("I don't know", 'food', ['breakfast']);
    expect(a.hesitationDetected).toBe(true);
    expect(a.likelyErrorType).toBe('hesitation');
  });

  it('handles empty input (silence)', () => {
    const a = analyzeUtterance('', 'food', ['breakfast']);
    expect(a.wordCount).toBe(0);
    expect(a.pauseDetected).toBe(true);
  });

  it('handles single filler word', () => {
    const a = analyzeUtterance('um', 'food', ['breakfast']);
    expect(a.hesitationDetected).toBe(true);
    expect(a.wordCount).toBe(1);
  });

  it('correctly identifies on-topic multi-word response', () => {
    const a = analyzeUtterance('I had eggs and toast for breakfast', 'food', ['eggs', 'toast', 'breakfast']);
    expect(a.onTopic).toBe(true);
    expect(a.semanticMatch).toBeGreaterThan(0.5);
    expect(a.hesitationDetected).toBe(false);
    expect(a.likelyErrorType).toBe('none');
  });
});
