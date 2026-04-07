/**
 * 100-Conversation Stress Test
 * 
 * Validates the full Smart Coach pipeline across diverse clinical scenarios:
 * - Utterance analysis
 * - State machine transitions
 * - Drill trigger evaluation (sole path — legacy removed)
 * - Drill selection
 * - Transfer scoring
 * - Return text quality
 * - Post-processing & safety validation
 * - Cross-session retention
 * - Cue fade detection
 * - Session arc integrity
 */

import { describe, it, expect } from 'vitest';
import { analyzeUtterance } from '../utteranceAnalyzer';
import { transitionCoachState, shouldWrapUp } from '../coachStateMachine';
import { evaluateDrillTrigger, type DrillTriggerContext } from '../drillTriggerEvaluator';
import { selectDrill, selectPracticeBlock } from '../drillSelector';
import { scoreTransfer, type TransferCheckInput } from '../transferScoring';
import { buildGameReturnText, GAME_CATALOG } from '../gameTrigger';
import { postProcessCoachLine } from '../responsePostProcessor';
import { validateCoachLine } from '../safetyValidator';
import type { CoachState, CoachUtteranceAnalysis, SessionMetrics } from '../types';

// ─── Helpers ─────────────────────────────────────────────────

function makeState(overrides: Partial<CoachState> = {}): CoachState {
  return {
    topic: 'food',
    mode: 'expand',
    supportLevel: 0,
    turnCount: 0,
    isStuck: false,
    frustrationRisk: 'low',
    topicKeywords: ['food', 'eat', 'cook', 'meal', 'dinner', 'lunch', 'breakfast', 'chicken', 'salad', 'rice'],
    establishedFacts: [],
    conversationHistory: [],
    consecutiveHesitations: 0,
    expandDimension: 0,
    purposeContext: {
      goalId: 'food_retrieval',
      skillTarget: 'noun retrieval',
      transferTarget: 'ordering at a restaurant',
      rationale: 'practice naming foods',
      measure: 'word count',
      supportMode: 'open_conversation',
      expectedDifficulty: 'moderate',
    },
    sessionMetrics: makeMetrics(),
    severityProfile: 'moderate',
    primaryDeficit: 'expressive',
    readinessLevel: 7,
    recentHesitations: [],
    lastPurposeAnchorTurn: 0,
    postInterventionDampening: false,
    interventionCount: 0,
    currentObjectiveIndex: 0,
    objectiveProgress: { turnsOnObjective: 0 },
    subtopicDepth: 0,
    consecutiveDisengagements: 0,
    recentMayaNouns: [],
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<SessionMetrics> = {}): SessionMetrics {
  return {
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
    ...overrides,
  };
}

function makeDrillCtx(state: CoachState, analysis: CoachUtteranceAnalysis, overrides: Partial<DrillTriggerContext> = {}): DrillTriggerContext {
  return {
    state,
    analysis,
    maxTurns: 12,
    ...overrides,
  };
}

function simulateSession(utterances: string[], topic = 'food', severity: CoachState['severityProfile'] = 'moderate'): {
  states: CoachState[];
  analyses: CoachUtteranceAnalysis[];
  drillsFired: number;
  modesVisited: Set<string>;
  finalMode: string;
} {
  const keywords = topic === 'food'
    ? ['food', 'eat', 'cook', 'meal', 'dinner', 'lunch', 'breakfast', 'chicken', 'salad', 'rice']
    : topic === 'family'
    ? ['family', 'mom', 'dad', 'brother', 'sister', 'son', 'daughter', 'wife', 'husband']
    : ['morning', 'routine', 'wake', 'shower', 'dress', 'brush', 'coffee', 'work'];

  let state = makeState({ topic, topicKeywords: keywords, severityProfile: severity });
  const states: CoachState[] = [state];
  const analyses: CoachUtteranceAnalysis[] = [];
  const modesVisited = new Set<string>([state.mode]);
  let drillsFired = 0;
  let lastDrillTurn: number | undefined;

  for (let i = 0; i < utterances.length; i++) {
    const analysis = analyzeUtterance(utterances[i], topic, keywords);
    analyses.push(analysis);

    if (shouldWrapUp(state, 12)) {
      state = { ...state, mode: 'wrapup' };
      modesVisited.add('wrapup');
      states.push(state);
      continue;
    }

    const nextState = transitionCoachState(state, analysis);
    modesVisited.add(nextState.mode);

    // Check drill trigger
    const drillCtx = makeDrillCtx(nextState, analysis, { lastDrillCompletedAtTurn: lastDrillTurn });
    const drillResult = evaluateDrillTrigger(drillCtx);
    if (drillResult.kind) {
      drillsFired++;
      lastDrillTurn = nextState.turnCount;
    }

    state = { ...nextState, turnCount: nextState.turnCount + 1 };
    states.push(state);
  }

  return { states, analyses, drillsFired, modesVisited, finalMode: state.mode };
}

// ═════════════════════════════════════════════════════════════
// SCENARIO A: Mild Expressive Aphasia — Strong Progress (15 conversations)
// ═════════════════════════════════════════════════════════════

describe('Scenario A: Mild Expressive — Strong Progress', () => {
  // A1-A5: Basic strong sessions
  it('A1: fluent food naming session', () => {
    const r = simulateSession([
      'I like chicken', 'yes I eat it for dinner', 'I cook it with rice',
      'my wife makes it', 'we eat salad too', 'broccoli and tomato',
      'yes I like Italian food', 'pasta with sauce',
    ], 'food', 'mild');
    expect(r.modesVisited.has('expand')).toBe(true);
    expect(r.analyses.every(a => !a.hesitationDetected)).toBe(true);
  });

  it('A2: strong family conversation', () => {
    const r = simulateSession([
      'my daughter is Sarah', 'she is a teacher', 'yes she lives nearby',
      'I see her on weekends', 'we go to the park', 'my son works in the city',
      'he calls me every day',
    ], 'family', 'mild');
    expect(r.analyses.filter(a => a.onTopic).length).toBeGreaterThanOrEqual(5);
  });

  it('A3: challenge drill fires for strong user', () => {
    const state = makeState({
      turnCount: 4, mode: 'expand', supportLevel: 0, severityProfile: 'mild',
      sessionMetrics: makeMetrics({ independentResponses: 5 }),
      recentHesitations: [false, false, false, false, false],
    });
    const analysis = analyzeUtterance('I love cooking chicken with special spices', 'food', state.topicKeywords);
    const drillCtx = makeDrillCtx(state, analysis, { objectiveAdvanced: true });
    const result = evaluateDrillTrigger(drillCtx);
    expect(result.kind).toBe('micro_drill');
    expect(result.reason).toBe('challenge');
  });

  it('A4: sentence_construction selected for challenge', () => {
    const state = makeState({ turnCount: 4, supportLevel: 0 });
    const selection = selectDrill({
      state, reason: 'challenge', signals: ['objective_advanced', 'strong_independent_response', 'no_recent_hesitation', 'low_support_level'],
      usedGameIds: [], kind: 'micro_drill',
    });
    expect(['sentence_construction', 'category_fluency']).toContain(selection.drill.id);
  });

  it('A5: category_fluency NOT selected for support', () => {
    const state = makeState({ turnCount: 4, supportLevel: 2 });
    const selection = selectDrill({
      state, reason: 'support', signals: ['hesitation_cluster', 'consecutive_hesitation'],
      usedGameIds: [], kind: 'micro_drill',
    });
    expect(selection.drill.id).not.toBe('category_fluency');
  });

  // A6-A10: Transfer scoring after strong drills
  it('A6: exact word transfer scores 4', () => {
    const result = scoreTransfer({
      targets: [{ value: 'broccoli', type: 'word', functionalContext: 'ordering food' }],
      userResponse: 'I would like broccoli in my salad please',
      cueLevelNeeded: 0, latencyMs: 1500, baselineLatencyMs: 2000,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    expect(result.transferScore).toBe(4);
    expect(result.label).toBe('used_independently');
  });

  it('A7: multiple targets partial transfer', () => {
    const result = scoreTransfer({
      targets: [
        { value: 'broccoli', type: 'word', functionalContext: 'ordering' },
        { value: 'tomato', type: 'word', functionalContext: 'ordering' },
      ],
      userResponse: 'I want broccoli in the thing',
      cueLevelNeeded: 1, latencyMs: 3000, baselineLatencyMs: 2000,
      breakdownSignals: { longPause: false, fillerCount: 1, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    expect(result.transferScore).toBeGreaterThanOrEqual(2);
    expect(result.transferScore).toBeLessThanOrEqual(3);
  });

  it('A8: word boundary prevents false match', () => {
    const result = scoreTransfer({
      targets: [{ value: 'cat', type: 'word', functionalContext: 'pets' }],
      userResponse: 'I saw a caterpillar in the garden',
      cueLevelNeeded: 0, latencyMs: null, baselineLatencyMs: null,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    expect(result.targetResults[0].found).toBe(false);
  });

  it('A9: return text is speech-appropriate for photo naming', () => {
    const text = buildGameReturnText(
      GAME_CATALOG['photo_naming'],
      { score: 0.8, summary: '4 out of 5 correct' },
      'food',
      { lastSubtopic: 'vegetables', lastUserStruggle: 'broccoli', lastPhraseAttempt: 'the green thing' },
    );
    expect(text).toContain('the green thing');
    expect(text).toContain('real life');
  });

  it('A10: return text is comprehension-appropriate for yes/no', () => {
    const text = buildGameReturnText(
      GAME_CATALOG['yes_no_comprehension'],
      { score: 0.8, summary: '4 out of 5 correct' },
      'food',
    );
    expect(text).not.toContain('those words');
    expect(text).toContain('confidence');
  });

  // A11-A15: Post-processing and safety
  it('A11: long response gets trimmed', () => {
    const long = Array(50).fill('word').join(' ');
    const processed = postProcessCoachLine(long);
    expect(processed.split(/\s+/).length).toBeLessThanOrEqual(42);
  });

  it('A12: safety validates topic-anchored line', () => {
    const result = validateCoachLine("Great - you mentioned chicken. What do you usually cook it with?", 'food', ['chicken'], {
      lastUserUtterance: 'chicken', topicKeywords: ['food', 'chicken', 'cook'],
    });
    expect(result.valid).toBe(true);
  });

  it('A13: safety rejects completely unanchored line', () => {
    const result = validateCoachLine("Tell me more about that.", 'food', [], {
      lastUserUtterance: 'chicken', topicKeywords: ['food', 'chicken'],
    });
    expect(result.valid).toBe(false);
  });

  it('A14: practice block selected for strong user', () => {
    const state = makeState({
      turnCount: 9, supportLevel: 0,
      sessionMetrics: makeMetrics({ independentResponses: 5 }),
    });
    const block = selectPracticeBlock({
      state, reason: 'support', signals: ['session_late_phase'],
      usedGameIds: [],
    });
    expect(block.length).toBeGreaterThanOrEqual(1);
    expect(block.length).toBeLessThanOrEqual(2);
  });

  it('A15: drill not triggered during warmup', () => {
    const state = makeState({ turnCount: 3, mode: 'warmup' });
    const analysis = analyzeUtterance('um... uh...', 'food', state.topicKeywords);
    const result = evaluateDrillTrigger(makeDrillCtx(state, analysis));
    expect(result.kind).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════
// SCENARIO B: Moderate Aphasia — Needs Support (15 conversations)
// ═════════════════════════════════════════════════════════════

describe('Scenario B: Moderate Aphasia — Needs Support', () => {
  it('B1: hesitation triggers scaffold after 2 consecutive', () => {
    let state = makeState({ turnCount: 2, mode: 'expand' });
    const a1 = analyzeUtterance('um... the thing...', 'food', state.topicKeywords);
    state = transitionCoachState(state, a1);
    expect(state.consecutiveHesitations).toBe(1);
    // Still expand after 1
    const a2 = analyzeUtterance('uh... I forget', 'food', state.topicKeywords);
    state = transitionCoachState(state, a2);
    expect(state.mode).toBe('scaffold');
  });

  it('B2: 3 hesitations triggers support mode', () => {
    let state = makeState({ turnCount: 2, consecutiveHesitations: 2 });
    const a = analyzeUtterance('I dont know', 'food', state.topicKeywords);
    state = transitionCoachState(state, a);
    expect(state.mode).toBe('support');
    expect(state.supportLevel).toBeGreaterThanOrEqual(1);
  });

  it('B3: circumlocution detected and handled', () => {
    const a = analyzeUtterance('the thing where you cook the food', 'food', ['food', 'cook']);
    expect(a.circumlocution).toBe(true);
    let state = makeState({ turnCount: 3, mode: 'expand' });
    state = transitionCoachState(state, a);
    expect(state.mode).toBe('scaffold');
    expect(state.targetSkill).toBe('word_finding');
  });

  it('B4: support drill triggers on compound signals', () => {
    const state = makeState({
      turnCount: 4, mode: 'scaffold', supportLevel: 2,
      recentHesitations: [true, false, true, true],
      consecutiveDisengagements: 0,
    });
    const analysis = analyzeUtterance('um the place where...', 'food', state.topicKeywords);
    const result = evaluateDrillTrigger(makeDrillCtx(state, analysis, { objectiveAdvanced: false }));
    expect(result.kind).toBe('micro_drill');
    expect(result.reason).toBe('support');
  });

  it('B5: photo_naming selected for hesitation support', () => {
    const state = makeState({ turnCount: 4, supportLevel: 2, primaryDeficit: 'expressive' });
    const selection = selectDrill({
      state, reason: 'support', signals: ['hesitation_cluster', 'elevated_support_objective_unmet'],
      usedGameIds: [], kind: 'micro_drill',
    });
    expect(selection.drill.id).toBe('photo_naming');
  });

  it('B6: semantic_features selected for circumlocution', () => {
    const state = makeState({ turnCount: 4, supportLevel: 1 });
    const selection = selectDrill({
      state, reason: 'support', signals: ['circumlocution'],
      usedGameIds: [], kind: 'micro_drill',
    });
    expect(selection.drill.id).toBe('semantic_features');
  });

  it('B7: transfer "with help" when cue needed', () => {
    const result = scoreTransfer({
      targets: [{ value: 'chicken', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'I want... chicken',
      cueLevelNeeded: 2, latencyMs: 5000, baselineLatencyMs: 2000,
      breakdownSignals: { longPause: true, fillerCount: 1, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    expect(result.transferScore).toBeGreaterThanOrEqual(1);
    expect(result.transferScore).toBeLessThanOrEqual(3);
  });

  it('B8: difficulty lowered with weak retention hint', () => {
    const state = makeState({ turnCount: 4, supportLevel: 2 });
    const selection = selectDrill({
      state, reason: 'support', signals: ['hesitation_cluster'],
      usedGameIds: [], kind: 'micro_drill',
      retentionHint: { difficultyDelta: -1, retainedWords: [], weakWords: ['chicken'] },
    });
    expect(selection.configOverrides.difficultyTier).toBeLessThanOrEqual(1);
    expect(selection.configOverrides.cueLevel).toBeGreaterThanOrEqual(1);
  });

  it('B9: max 1 micro-drill per session', () => {
    const state = makeState({ turnCount: 5, mode: 'expand', interventionCount: 1 });
    const analysis = analyzeUtterance('um... uh...', 'food', state.topicKeywords);
    const result = evaluateDrillTrigger(makeDrillCtx(state, analysis));
    expect(result.kind).toBeNull();
  });

  it('B10: cooldown prevents back-to-back drills', () => {
    const state = makeState({ turnCount: 5, mode: 'expand', interventionCount: 0 });
    const analysis = analyzeUtterance('um... uh...', 'food', state.topicKeywords);
    const result = evaluateDrillTrigger(makeDrillCtx(state, analysis, { lastDrillCompletedAtTurn: 4 }));
    expect(result.kind).toBeNull();
  });

  it('B11: silence triggers support mode', () => {
    const a = analyzeUtterance('', 'food', ['food']);
    expect(a.pauseDetected).toBe(true);
    const state = makeState({ turnCount: 3 });
    const next = transitionCoachState(state, a);
    expect(next.mode).toBe('support');
    expect(next.isStuck).toBe(true);
  });

  it('B12: surrender phrase detected as hesitation', () => {
    const a = analyzeUtterance('I dont know', 'food', ['food']);
    expect(a.hesitationDetected).toBe(true);
    expect(a.likelyErrorType).toBe('hesitation');
  });

  it('B13: incomplete thought detected', () => {
    const a = analyzeUtterance('I want the...', 'food', ['food']);
    expect(a.incompleteThought).toBe(true);
    const state = makeState({ turnCount: 3 });
    const next = transitionCoachState(state, a);
    expect(next.mode).toBe('scaffold');
  });

  it('B14: meaning_match deprioritized for expressive deficit', () => {
    const state = makeState({ primaryDeficit: 'expressive', supportLevel: 1 });
    const selection = selectDrill({
      state, reason: 'support', signals: ['hesitation_cluster'],
      usedGameIds: ['photo_naming'], kind: 'micro_drill',
    });
    // Should prefer semantic_features over meaning_match
    expect(selection.drill.id).not.toBe('meaning_match');
  });

  it('B15: return text for meaning match is comprehension-style', () => {
    const text = buildGameReturnText(
      GAME_CATALOG['meaning_match'],
      { score: 0.6, summary: '3 out of 5 matched' },
      'food',
    );
    expect(text).not.toContain('those words');
    expect(text).not.toContain('use those');
  });
});

// ═════════════════════════════════════════════════════════════
// SCENARIO C: Severe Aphasia — Fatigue & Minimal Output (15 conversations)
// ═════════════════════════════════════════════════════════════

describe('Scenario C: Severe Aphasia — Fatigue & Minimal Output', () => {
  it('C1: yes/no selected for comprehension breakdown', () => {
    const state = makeState({
      turnCount: 4, severityProfile: 'severe', primaryDeficit: 'receptive',
      sessionMetrics: makeMetrics({ comprehensionBreaks: 2 }),
    });
    const selection = selectDrill({
      state, reason: 'support', signals: ['low_content_response'],
      usedGameIds: [], kind: 'micro_drill',
    });
    expect(selection.drill.id).toBe('yes_no_comprehension');
  });

  it('C2: severe profile prefers simpler games', () => {
    const state = makeState({ severityProfile: 'severe', primaryDeficit: 'expressive' });
    const selection = selectDrill({
      state, reason: 'support', signals: ['hesitation_cluster'],
      usedGameIds: [], kind: 'micro_drill',
    });
    expect(['photo_naming', 'yes_no_comprehension']).toContain(selection.drill.id);
  });

  it('C3: empty response scores transfer at 0', () => {
    const result = scoreTransfer({
      targets: [{ value: 'chicken', type: 'word', functionalContext: 'ordering' }],
      userResponse: '',
      cueLevelNeeded: 4, latencyMs: null, baselineLatencyMs: null,
      breakdownSignals: { longPause: true, fillerCount: 0, restart: false, abandonment: true },
      usedAfterModel: false,
    });
    expect(result.transferScore).toBe(0);
    expect(result.rawScore).toBe(0);
  });

  it('C4: abandonment scores transfer at 0', () => {
    const result = scoreTransfer({
      targets: [{ value: 'salad', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'I... um... never mind',
      cueLevelNeeded: 3, latencyMs: 10000, baselineLatencyMs: 2000,
      breakdownSignals: { longPause: true, fillerCount: 2, restart: true, abandonment: true },
      usedAfterModel: false,
    });
    expect(result.transferScore).toBe(0);
  });

  it('C5: fatigue session avoids escalation', () => {
    const r = simulateSession([
      'yes', 'okay', 'um', '', 'I dont know', 'okay', 'um...', 'fine',
    ], 'food', 'severe');
    // Should not reach high support too fast
    const maxSupport = Math.max(...r.states.map(s => s.supportLevel));
    expect(maxSupport).toBeLessThanOrEqual(3);
  });

  it('C6: disengagement cluster triggers scaffold', () => {
    let state = makeState({ turnCount: 3, mode: 'expand', consecutiveDisengagements: 1 });
    const a = analyzeUtterance('okay', 'food', state.topicKeywords);
    expect(a.disengagementDetected).toBe(true);
    state = transitionCoachState(state, a);
    expect(state.mode).toBe('scaffold');
    expect(state.consecutiveDisengagements).toBe(2);
  });

  it('C7: 3+ disengagements trigger repair drill', () => {
    const state = makeState({
      turnCount: 4, mode: 'scaffold',
      consecutiveDisengagements: 3, interventionCount: 0,
    });
    const analysis = analyzeUtterance('yep', 'food', state.topicKeywords);
    const result = evaluateDrillTrigger(makeDrillCtx(state, analysis));
    expect(result.kind).toBe('micro_drill');
    expect(result.reason).toBe('repair');
  });

  it('C8: fatigue gate blocks targeted practice after micro-drill', () => {
    // This tests the logic in SmartCoach.tsx conceptually:
    // if alreadyHadDrill && (readinessLevel <= 4 || hesitationCount >= 4 || frustrationRisk === 'high')
    // → skip targeted practice
    const state = makeState({
      turnCount: 9, readinessLevel: 3, interventionCount: 1,
      sessionMetrics: makeMetrics({ hesitationCount: 5 }),
      frustrationRisk: 'high',
    });
    // The drillTriggerEvaluator would still fire targeted_practice at turn 9
    const analysis = analyzeUtterance('okay', 'food', state.topicKeywords);
    const result = evaluateDrillTrigger(makeDrillCtx(state, analysis));
    // The evaluator fires it — the GATE is in the UI layer
    // We verify the evaluator still fires (correct) — the gate is separate
    expect(result.kind).toBe('targeted_practice');
    
    // Fatigue check (mirrors SmartCoach.tsx logic)
    const userFatigued = state.readinessLevel <= 4 || state.sessionMetrics.hesitationCount >= 4 || state.frustrationRisk === 'high';
    const alreadyHadDrill = state.interventionCount > 0;
    expect(userFatigued && alreadyHadDrill).toBe(true); // gate would block
  });

  it('C9: wrapup triggers correctly at max turns', () => {
    const state = makeState({ turnCount: 11 });
    expect(shouldWrapUp(state, 12)).toBe(true);
  });

  it('C10: wrapup does NOT trigger too early', () => {
    const state = makeState({ turnCount: 8 });
    expect(shouldWrapUp(state, 12)).toBe(false);
  });

  it('C11: phonological approximation detected', () => {
    const a = analyzeUtterance('brocli', 'food', ['broccoli', 'food']);
    expect(a.phonologicalApprox).toBe(true);
  });

  it('C12: very short severe session still works', () => {
    const r = simulateSession(['yes', 'no', '', 'okay'], 'food', 'severe');
    expect(r.states.length).toBeGreaterThan(0);
    // Should not crash
  });

  it('C13: correction is not treated as hesitation', () => {
    const a = analyzeUtterance("I didn't say that", 'food', ['food']);
    expect(a.hesitationDetected).toBe(false);
    expect(a.disengagementDetected).toBe(false);
  });

  it('C14: micro-drill config reduced for micro kind', () => {
    const state = makeState({ severityProfile: 'severe' });
    const selection = selectDrill({
      state, reason: 'support', signals: ['hesitation_cluster'],
      usedGameIds: [], kind: 'micro_drill',
    });
    expect(selection.configOverrides.totalTrials).toBeLessThanOrEqual(4);
  });

  it('C15: targeted practice config NOT reduced', () => {
    const state = makeState();
    const selection = selectDrill({
      state, reason: 'support', signals: ['session_late_phase'],
      usedGameIds: [], kind: 'targeted_practice',
    });
    expect(selection.configOverrides.totalTrials).toBeGreaterThanOrEqual(3);
  });
});

// ═════════════════════════════════════════════════════════════
// SCENARIO D: Recovery & Cue Fade (15 conversations)
// ═════════════════════════════════════════════════════════════

describe('Scenario D: Recovery & Cue Fade', () => {
  it('D1: improving user gets lower support over turns', () => {
    const r = simulateSession([
      'um...', 'chicken', 'I like chicken and rice', 'yes we eat it every day',
      'my wife cooks chicken with spices', 'we also eat fish sometimes',
      'salmon is my favorite', 'I cook it on the grill',
    ], 'food', 'moderate');
    // Support should decrease as user improves
    const lastState = r.states[r.states.length - 1];
    expect(lastState.supportLevel).toBeLessThanOrEqual(1);
  });

  it('D2: transfer score improves with less cueing', () => {
    const withCue = scoreTransfer({
      targets: [{ value: 'chicken', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'I want chicken please',
      cueLevelNeeded: 2, latencyMs: 3000, baselineLatencyMs: 2000,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    const withoutCue = scoreTransfer({
      targets: [{ value: 'chicken', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'I want chicken please',
      cueLevelNeeded: 0, latencyMs: 1500, baselineLatencyMs: 2000,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    expect(withoutCue.rawScore).toBeGreaterThan(withCue.rawScore);
    expect(withoutCue.transferScore).toBeGreaterThanOrEqual(withCue.transferScore);
  });

  it('D3: faster latency improves score', () => {
    const slow = scoreTransfer({
      targets: [{ value: 'rice', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'rice with vegetables',
      cueLevelNeeded: 0, latencyMs: 6000, baselineLatencyMs: 2000,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    const fast = scoreTransfer({
      targets: [{ value: 'rice', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'rice with vegetables',
      cueLevelNeeded: 0, latencyMs: 1500, baselineLatencyMs: 2000,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    expect(fast.rawScore).toBeGreaterThan(slow.rawScore);
  });

  it('D4: model usage caps score', () => {
    const independent = scoreTransfer({
      targets: [{ value: 'salad', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'I want a salad',
      cueLevelNeeded: 0, latencyMs: null, baselineLatencyMs: null,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    const afterModel = scoreTransfer({
      targets: [{ value: 'salad', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'I want a salad',
      cueLevelNeeded: 0, latencyMs: null, baselineLatencyMs: null,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: true,
    });
    expect(independent.rawScore).toBeGreaterThan(afterModel.rawScore);
  });

  it('D5: difficulty raised with strong retention', () => {
    const state = makeState({ supportLevel: 0 });
    const selection = selectDrill({
      state, reason: 'challenge', signals: ['objective_advanced'],
      usedGameIds: [], kind: 'micro_drill',
      retentionHint: { difficultyDelta: 1, retainedWords: ['chicken', 'rice'], weakWords: [] },
    });
    expect(selection.configOverrides.difficultyTier).toBeGreaterThanOrEqual(2);
  });

  it('D6: difficulty lowered with weak retention', () => {
    const state = makeState({ supportLevel: 2 });
    const selection = selectDrill({
      state, reason: 'support', signals: ['hesitation_cluster'],
      usedGameIds: [], kind: 'micro_drill',
      retentionHint: { difficultyDelta: -1, retainedWords: [], weakWords: ['chicken'] },
    });
    expect(selection.configOverrides.difficultyTier).toBeLessThanOrEqual(1);
  });

  it('D7: recovery from stuck → expand in same session', () => {
    const r = simulateSession([
      'um...', 'I dont know', 'um the thing...', 'chicken', 'yes I like chicken',
      'I eat it with rice', 'my family eats it together',
    ], 'food', 'moderate');
    expect(r.modesVisited.has('scaffold')).toBe(true);
    expect(r.modesVisited.has('expand')).toBe(true);
  });

  it('D8: consecutive hesitations reset on good response', () => {
    let state = makeState({ turnCount: 3, consecutiveHesitations: 2 });
    const a = analyzeUtterance('I really love eating chicken with my family', 'food', state.topicKeywords);
    state = transitionCoachState(state, a);
    expect(state.consecutiveHesitations).toBe(0);
    expect(state.mode).toBe('expand');
  });

  it('D9: disengagement resets on real content', () => {
    let state = makeState({ turnCount: 4, consecutiveDisengagements: 2 });
    const a = analyzeUtterance('I love cooking dinner for my family', 'food', state.topicKeywords);
    state = transitionCoachState(state, a);
    expect(state.consecutiveDisengagements).toBe(0);
  });

  it('D10: long sentence gets high semantic match', () => {
    const a = analyzeUtterance('I like to cook chicken and rice with my family for dinner every night', 'food', 
      ['food', 'cook', 'chicken', 'rice', 'dinner', 'family']);
    expect(a.semanticMatch).toBeGreaterThan(0.5);
    expect(a.onTopic).toBe(true);
    expect(a.wordCount).toBeGreaterThanOrEqual(10);
  });

  it('D11: functional fit higher for full sentences', () => {
    const short = scoreTransfer({
      targets: [{ value: 'chicken', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'chicken',
      cueLevelNeeded: 0, latencyMs: null, baselineLatencyMs: null,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    const full = scoreTransfer({
      targets: [{ value: 'chicken', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'I would like the grilled chicken with a side salad please',
      cueLevelNeeded: 0, latencyMs: null, baselineLatencyMs: null,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    expect(full.rawScore).toBeGreaterThan(short.rawScore);
  });

  it('D12: phonemic approximation found', () => {
    const result = scoreTransfer({
      targets: [{ value: 'broccoli', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'I want brocco please',
      cueLevelNeeded: 1, latencyMs: null, baselineLatencyMs: null,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    expect(result.targetResults[0].found).toBe(true);
    expect(result.targetResults[0].approximation).toBe('phonemic');
  });

  it('D13: drill not triggered during wrapup', () => {
    const state = makeState({ turnCount: 10, mode: 'wrapup' });
    const analysis = analyzeUtterance('um... uh...', 'food', state.topicKeywords);
    const result = evaluateDrillTrigger(makeDrillCtx(state, analysis));
    expect(result.kind).toBeNull();
  });

  it('D14: topic switch keeps system stable', () => {
    const r1 = simulateSession(['chicken', 'rice', 'salad'], 'food', 'mild');
    const r2 = simulateSession(['my mom', 'my brother', 'my sister'], 'family', 'mild');
    expect(r1.states.length).toBeGreaterThan(0);
    expect(r2.states.length).toBeGreaterThan(0);
  });

  it('D15: off-topic response triggers scaffold', () => {
    const a = analyzeUtterance('the weather is nice today', 'food', ['food', 'chicken', 'cook']);
    expect(a.onTopic).toBe(false);
    const state = makeState({ turnCount: 4 });
    const next = transitionCoachState(state, a);
    expect(next.mode).toBe('scaffold');
  });
});

// ═════════════════════════════════════════════════════════════
// SCENARIO E: Edge Cases & Adversarial Input (20 conversations)
// ═════════════════════════════════════════════════════════════

describe('Scenario E: Edge Cases & Adversarial', () => {
  it('E1: empty string analyzed safely', () => {
    const a = analyzeUtterance('', 'food', ['food']);
    expect(a.wordCount).toBe(0);
    expect(a.pauseDetected).toBe(true);
  });

  it('E2: very long input handled', () => {
    const long = Array(200).fill('chicken').join(' ');
    const a = analyzeUtterance(long, 'food', ['food', 'chicken']);
    expect(a.wordCount).toBe(200);
    expect(a.onTopic).toBe(true);
  });

  it('E3: special characters handled', () => {
    const a = analyzeUtterance('I like 🍗 chicken!!! @#$', 'food', ['food', 'chicken']);
    expect(a.onTopic).toBe(true);
  });

  it('E4: all filler words detected as hesitation', () => {
    const a = analyzeUtterance('um uh er', 'food', ['food']);
    expect(a.hesitationDetected).toBe(true);
  });

  it('E5: single word "yes" not treated as disengagement when on-topic', () => {
    const a = analyzeUtterance('yes', 'food', ['yes', 'food']);
    // "yes" matches VALID_SHORT_ANSWERS and topic keywords include it
    expect(a.disengagementDetected).toBe(false);
  });

  it('E6: "okay" IS disengagement', () => {
    const a = analyzeUtterance('okay', 'food', ['food', 'chicken']);
    expect(a.disengagementDetected).toBe(true);
  });

  it('E7: no games available - fallback works', () => {
    const state = makeState();
    const selection = selectDrill({
      state, reason: 'support', signals: ['hesitation_cluster'],
      usedGameIds: Object.keys(GAME_CATALOG), kind: 'micro_drill',
    });
    expect(selection.drill).toBeDefined();
    expect(selection.drill.id).toBe('photo_naming'); // fallback
  });

  it('E8: transfer with no targets returns score 0', () => {
    const result = scoreTransfer({
      targets: [],
      userResponse: 'I like chicken',
      cueLevelNeeded: 0, latencyMs: null, baselineLatencyMs: null,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    expect(result.transferScore).toBe(0);
  });

  it('E9: target not found caps at bucket 0', () => {
    const result = scoreTransfer({
      targets: [{ value: 'broccoli', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'I like pasta with sauce',
      cueLevelNeeded: 0, latencyMs: null, baselineLatencyMs: null,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: false,
    });
    expect(result.transferScore).toBe(0);
    expect(result.rawScore).toBeLessThanOrEqual(19);
  });

  it('E10: all breakdown signals present', () => {
    const result = scoreTransfer({
      targets: [{ value: 'chicken', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'I um... chicken... no wait...',
      cueLevelNeeded: 3, latencyMs: 12000, baselineLatencyMs: 2000,
      breakdownSignals: { longPause: true, fillerCount: 3, restart: true, abandonment: false },
      usedAfterModel: true,
    });
    expect(result.transferScore).toBeLessThanOrEqual(2);
  });

  it('E11: targeted practice fires at turn 8', () => {
    const state = makeState({ turnCount: 8, mode: 'expand', interventionCount: 0 });
    const analysis = analyzeUtterance('I like chicken', 'food', state.topicKeywords);
    const result = evaluateDrillTrigger(makeDrillCtx(state, analysis));
    expect(result.kind).toBe('targeted_practice');
  });

  it('E12: targeted practice fires even with high support', () => {
    const state = makeState({ turnCount: 9, mode: 'support', supportLevel: 3 });
    const analysis = analyzeUtterance('um...', 'food', state.topicKeywords);
    const result = evaluateDrillTrigger(makeDrillCtx(state, analysis));
    expect(result.kind).toBe('targeted_practice');
  });

  it('E13: repair trigger on deep tangent', () => {
    const state = makeState({
      turnCount: 5, mode: 'expand', subtopicDepth: 3, interventionCount: 0,
    });
    const analysis = analyzeUtterance('the weather is nice', 'food', state.topicKeywords);
    const result = evaluateDrillTrigger(makeDrillCtx(state, analysis));
    expect(result.kind).toBe('micro_drill');
    expect(result.reason).toBe('repair');
  });

  it('E14: repair on consecutive off-topic', () => {
    const state = makeState({ turnCount: 5, mode: 'expand', interventionCount: 0 });
    const prevAnalysis = analyzeUtterance('the sky is blue', 'food', state.topicKeywords);
    const analysis = analyzeUtterance('my car is red', 'food', state.topicKeywords);
    const result = evaluateDrillTrigger(makeDrillCtx(state, analysis, { prevAnalysis }));
    expect(result.kind).toBe('micro_drill');
    expect(result.reason).toBe('repair');
  });

  it('E15: no drill before turn 3', () => {
    const state = makeState({ turnCount: 1, mode: 'expand' });
    const analysis = analyzeUtterance('um... uh...', 'food', state.topicKeywords);
    const result = evaluateDrillTrigger(makeDrillCtx(state, analysis));
    expect(result.kind).toBeNull();
  });

  it('E16: no drill after turn 6 (micro window)', () => {
    const state = makeState({ turnCount: 7, mode: 'expand', interventionCount: 0 });
    const analysis = analyzeUtterance('um... uh...', 'food', state.topicKeywords);
    const result = evaluateDrillTrigger(makeDrillCtx(state, analysis));
    // Turn 7 is before targeted practice (turn 8) but after micro window (turn 6)
    expect(result.kind).toBeNull();
  });

  it('E17: post-processing removes multiple questions', () => {
    const line = "That's great! What did you eat? Where did you go? How was it? Tell me more?";
    const processed = postProcessCoachLine(line);
    const questionMarks = (processed.match(/\?/g) || []).length;
    expect(questionMarks).toBeLessThanOrEqual(2);
  });

  it('E18: 12-turn session ends in wrapup', () => {
    const r = simulateSession([
      'chicken', 'rice', 'salad', 'yes', 'I cook it',
      'with spices', 'my wife helps', 'we eat together',
      'every night', 'fish sometimes', 'salmon', 'done',
    ], 'food', 'mild');
    expect(r.modesVisited.has('wrapup')).toBe(true);
  });

  it('E19: mixed session (good then bad) handles transitions', () => {
    const r = simulateSession([
      'I like chicken', 'yes with rice', 'um...', 'I dont know', 'um the thing',
      'chicken! yes chicken', 'I cook it for dinner',
    ], 'food', 'moderate');
    expect(r.modesVisited.has('expand')).toBe(true);
    expect(r.modesVisited.has('scaffold')).toBe(true);
  });

  it('E20: receptive deficit gets comprehension games', () => {
    const state = makeState({ primaryDeficit: 'receptive', severityProfile: 'severe' });
    const selection = selectDrill({
      state, reason: 'support', signals: ['low_content_response'],
      usedGameIds: [], kind: 'micro_drill',
    });
    expect(['yes_no_comprehension', 'meaning_match', 'photo_naming']).toContain(selection.drill.id);
  });
});

// ═════════════════════════════════════════════════════════════
// SCENARIO F: Full Session Simulations (20 conversations)
// ═════════════════════════════════════════════════════════════

describe('Scenario F: Full Session Simulations', () => {
  it('F1: perfect mild session — no drills, high independence', () => {
    const r = simulateSession([
      'I love pasta with tomato sauce', 'yes I cook it myself',
      'I add garlic and basil', 'my wife prefers chicken',
      'we eat together every evening', 'salmon on Fridays',
      'I like grilling it outside', 'with lemon and herbs',
      'sometimes we go to restaurants', 'Italian is our favorite',
    ], 'food', 'mild');
    const independentCount = r.states[r.states.length - 1].sessionMetrics.independentResponses;
    expect(independentCount).toBeGreaterThanOrEqual(8);
  });

  it('F2: struggling moderate session — drill fires correctly', () => {
    const r = simulateSession([
      'um', 'the thing... you know', 'I dont know', 'um... food',
      'chicken maybe', 'yes', 'okay',
    ], 'food', 'moderate');
    expect(r.drillsFired).toBeGreaterThanOrEqual(1);
    expect(r.modesVisited.has('scaffold')).toBe(true);
  });

  it('F3: severe session — max support reached', () => {
    const r = simulateSession([
      '', 'um', '', 'I dont know', '', 'no', '', 'okay',
    ], 'food', 'severe');
    const maxSupport = Math.max(...r.states.map(s => s.supportLevel));
    expect(maxSupport).toBeGreaterThanOrEqual(2);
  });

  it('F4: recovery arc — starts bad, ends good', () => {
    const r = simulateSession([
      'um...', 'I dont know', 'um the thing', 'chicken?',
      'yes chicken', 'I like chicken and rice', 'with salad too',
      'my family eats dinner together every night',
    ], 'food', 'moderate');
    const first = r.states[2]; // after struggles
    const last = r.states[r.states.length - 1];
    expect(last.supportLevel).toBeLessThanOrEqual(first.supportLevel);
  });

  it('F5: disengagement recovery — fillers then real content', () => {
    const r = simulateSession([
      'okay', 'yep', 'sure', 'I actually really like cooking chicken',
      'with lots of spices and garlic', 'my mom taught me',
    ], 'food', 'moderate');
    const last = r.states[r.states.length - 1];
    expect(last.consecutiveDisengagements).toBe(0);
  });

  it('F6: family topic session works end-to-end', () => {
    const r = simulateSession([
      'my daughter', 'Sarah', 'she is a teacher', 'yes nearby',
      'we see her on weekends', 'my son too', 'he lives in the city',
    ], 'family', 'mild');
    expect(r.analyses.filter(a => a.onTopic).length).toBeGreaterThanOrEqual(3);
  });

  it('F7: daily routine topic works', () => {
    const r = simulateSession([
      'I wake up early', 'coffee first', 'then shower', 'I get dressed',
      'breakfast with my wife', 'then work', 'I drive',
    ], 'daily_routine', 'mild');
    expect(r.states.length).toBe(8); // initial + 7 turns
  });

  it('F8: all topics produce valid analyses', () => {
    const topics = ['food', 'family', 'daily_routine'];
    for (const topic of topics) {
      const r = simulateSession(['I like this topic', 'yes', 'tell me more'], topic, 'moderate');
      expect(r.states.length).toBeGreaterThan(0);
    }
  });

  it('F9: transfer labels are all valid', () => {
    const labels = ['not_yet', 'recognized', 'with_help', 'used_it', 'used_independently'];
    for (let cue = 0; cue <= 4; cue++) {
      const result = scoreTransfer({
        targets: [{ value: 'chicken', type: 'word', functionalContext: 'ordering' }],
        userResponse: cue <= 2 ? 'I want chicken' : 'I want the thing',
        cueLevelNeeded: cue, latencyMs: null, baselineLatencyMs: null,
        breakdownSignals: { longPause: cue >= 3, fillerCount: cue, restart: false, abandonment: false },
        usedAfterModel: false,
      });
      expect(labels).toContain(result.label);
    }
  });

  it('F10: all game return texts are coherent', () => {
    for (const [id, game] of Object.entries(GAME_CATALOG)) {
      const text = buildGameReturnText(game, { score: 0.8, summary: 'Good job' }, 'food');
      expect(text.length).toBeGreaterThan(10);
      expect(text).not.toContain('undefined');
      expect(text).not.toContain('null');
    }
  });

  it('F11: all game return texts with interruption context', () => {
    const ctx = { lastSubtopic: 'vegetables', lastUserStruggle: 'broccoli', lastPhraseAttempt: 'the green one' };
    for (const [id, game] of Object.entries(GAME_CATALOG)) {
      const text = buildGameReturnText(game, { score: 0.5, summary: 'Okay' }, 'food', ctx);
      expect(text.length).toBeGreaterThan(10);
    }
  });

  it('F12: no game selection crashes with any combination', () => {
    const reasons: Array<'support' | 'challenge' | 'repair'> = ['support', 'challenge', 'repair'];
    const severities: Array<CoachState['severityProfile']> = ['mild', 'moderate', 'severe'];
    const deficits: Array<CoachState['primaryDeficit']> = ['expressive', 'receptive', 'mixed'];

    for (const reason of reasons) {
      for (const sev of severities) {
        for (const deficit of deficits) {
          const state = makeState({ severityProfile: sev, primaryDeficit: deficit });
          const selection = selectDrill({
            state, reason, signals: ['hesitation_cluster'],
            usedGameIds: [], kind: 'micro_drill',
          });
          expect(selection.drill).toBeDefined();
          expect(selection.drill.exerciseSlug).toBeTruthy();
        }
      }
    }
  });

  it('F13: practice block never returns empty', () => {
    const state = makeState({ turnCount: 9, supportLevel: 0, sessionMetrics: makeMetrics({ independentResponses: 5 }) });
    const block = selectPracticeBlock({
      state, reason: 'support', signals: ['session_late_phase'], usedGameIds: [],
    });
    expect(block.length).toBeGreaterThanOrEqual(1);
  });

  it('F14: all cue levels produce valid transfer scores', () => {
    for (let cue = 0; cue <= 4; cue++) {
      const result = scoreTransfer({
        targets: [{ value: 'salad', type: 'word', functionalContext: 'ordering' }],
        userResponse: 'I want a salad',
        cueLevelNeeded: cue, latencyMs: null, baselineLatencyMs: null,
        breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
        usedAfterModel: false,
      });
      expect(result.transferScore).toBeGreaterThanOrEqual(0);
      expect(result.transferScore).toBeLessThanOrEqual(4);
    }
  });

  it('F15: session metrics accumulate correctly', () => {
    const r = simulateSession([
      'chicken', 'rice and salad', 'I like to cook dinner',
      'um...', 'I dont know', 'pasta with sauce', 'yes very good',
    ], 'food', 'moderate');
    const metrics = r.states[r.states.length - 1].sessionMetrics;
    expect(metrics.wordsProduced).toBeGreaterThan(0);
    expect(metrics.independentResponses).toBeGreaterThanOrEqual(3);
    expect(metrics.hesitationCount).toBeGreaterThanOrEqual(1);
  });

  it('F16: validation accepts diverse valid lines', () => {
    const validLines = [
      "You mentioned chicken — what do you usually cook it with?",
      "Nice — chicken and rice is a great combo. Does your family like it too?",
      "Good work finding that word. Now tell me: if you were at a restaurant, how would you order chicken?",
    ];
    for (const line of validLines) {
      const result = validateCoachLine(line, 'food', ['chicken'], {
        lastUserUtterance: 'chicken', topicKeywords: ['food', 'chicken', 'cook'],
      });
      expect(result.valid).toBe(true);
    }
  });

  it('F17: validation rejects lazy follow-ups', () => {
    const lazyLines = [
      "Tell me more about that.",
      "What else?",
      "How do you feel about that?",
    ];
    for (const line of lazyLines) {
      const result = validateCoachLine(line, 'food', [], {
        lastUserUtterance: 'chicken', topicKeywords: ['food', 'chicken'],
      });
      expect(result.valid).toBe(false);
    }
  });

  it('F18: post-processor handles edge cases', () => {
    expect(postProcessCoachLine('')).toBe('');
    expect(postProcessCoachLine('   ')).toBe('');
    expect(postProcessCoachLine('Good!')).toBe('Good!');
  });

  it('F19: state machine handles 20-turn session without crash', () => {
    const utterances = Array(20).fill(null).map((_, i) =>
      i % 3 === 0 ? 'um...' : i % 3 === 1 ? 'chicken' : 'I like food'
    );
    const r = simulateSession(utterances, 'food', 'moderate');
    expect(r.states.length).toBe(21);
    expect(r.modesVisited.has('wrapup')).toBe(true);
  });

  it('F20: transfer scoring is deterministic', () => {
    const input: TransferCheckInput = {
      targets: [{ value: 'chicken', type: 'word', functionalContext: 'ordering' }],
      userResponse: 'I want chicken please',
      cueLevelNeeded: 1, latencyMs: 2000, baselineLatencyMs: 2000,
      breakdownSignals: { longPause: false, fillerCount: 0, restart: false, abandonment: false },
      usedAfterModel: false,
    };
    const r1 = scoreTransfer(input);
    const r2 = scoreTransfer(input);
    expect(r1.rawScore).toBe(r2.rawScore);
    expect(r1.transferScore).toBe(r2.transferScore);
    expect(r1.label).toBe(r2.label);
  });
});
