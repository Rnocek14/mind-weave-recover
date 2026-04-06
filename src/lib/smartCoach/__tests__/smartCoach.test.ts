/**
 * Smart Coach — Structured QA Tests
 * 
 * Tests all deterministic pipeline stages:
 *   utteranceAnalyzer → coachStateMachine → cueSelector → promptBuilder → safetyValidator → responsePostProcessor → fallbackLibrary
 */

import { describe, it, expect } from 'vitest';
import { analyzeUtterance } from '../utteranceAnalyzer';
import { transitionCoachState, shouldWrapUp, isEmergencySupport } from '../coachStateMachine';
import { selectCue } from '../cueSelector';
import { buildPrompt } from '../promptBuilder';
import { validateCoachLine } from '../safetyValidator';
import { postProcessCoachLine } from '../responsePostProcessor';
import { getFallbackLine } from '../fallbackLibrary';
import { createInitialCoachState, addEstablishedFact } from '../coachState';
import type { CoachState, CoachUtteranceAnalysis } from '../types';

const FOOD_KEYWORDS = ['food', 'eat', 'pizza', 'drink', 'meal', 'cook', 'pepperoni'];

function makeState(overrides: Partial<CoachState> = {}): CoachState {
  return {
    topic: 'food',
    mode: 'warmup',
    supportLevel: 0,
    turnCount: 0,
    isStuck: false,
    frustrationRisk: 'low',
    topicKeywords: FOOD_KEYWORDS,
    establishedFacts: [],
    conversationHistory: [],
    consecutiveHesitations: 0,
    expandDimension: 0,
    purposeContext: {
      goalId: 'ordering_food',
      skillTarget: 'Retrieving everyday food and kitchen words',
      transferTarget: 'ordering at a restaurant',
      rationale: 'Practice familiar food words.',
      measure: 'Independent word retrieval',
      supportMode: 'guided_retrieval',
      expectedDifficulty: 'easy',
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
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// Scenario 1 — Good User (Expansion Flow)
// ═══════════════════════════════════════════════════════════════
describe('Scenario 1: Good user expansion flow', () => {
  it('detects on-topic answer with good semantic match', () => {
    const a = analyzeUtterance('I like pepperoni pizza', 'food', FOOD_KEYWORDS);
    expect(a.onTopic).toBe(true);
    expect(a.semanticMatch).toBeGreaterThan(0.3);
    expect(a.hesitationDetected).toBe(false);
    expect(a.circumlocution).toBe(false);
    expect(a.likelyErrorType).toBe('none');
  });

  it('transitions to expand mode on strong answer', () => {
    const state = makeState({ mode: 'warmup' });
    const analysis = analyzeUtterance('I like pepperoni pizza', 'food', FOOD_KEYWORDS);
    const next = transitionCoachState(state, analysis);
    expect(next.mode).toBe('expand');
    expect(next.isStuck).toBe(false);
  });

  it('selects expansion_prompt cue for good response', () => {
    const state = makeState({ mode: 'expand' });
    const analysis = analyzeUtterance('I like pepperoni pizza', 'food', FOOD_KEYWORDS);
    const cue = selectCue(state, analysis);
    expect(cue.cueType).toBe('expansion_prompt');
  });

  it('keeps support LOW on good answers', () => {
    let state = makeState({ mode: 'warmup', supportLevel: 1 });
    const a = analyzeUtterance('I like pepperoni pizza from dominos', 'food', FOOD_KEYWORDS);
    const next = transitionCoachState(state, a);
    expect(next.supportLevel).toBeLessThanOrEqual(state.supportLevel);
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 2 — Hesitation Flow
// ═══════════════════════════════════════════════════════════════
describe('Scenario 2: Hesitation flow', () => {
  it('detects hesitation in "uh... I like..."', () => {
    const a = analyzeUtterance('uh... I like...', 'food', FOOD_KEYWORDS);
    expect(a.hesitationDetected).toBe(true);
    expect(a.confidence).toBeLessThan(0.5);
  });

  it('transitions to scaffold on hesitation', () => {
    const state = makeState({ mode: 'warmup' });
    const a = analyzeUtterance('uh... I like...', 'food', FOOD_KEYWORDS);
    const next = transitionCoachState(state, a);
    expect(next.mode).toBe('scaffold');
    expect(next.isStuck).toBe(true);
    expect(next.supportLevel).toBeGreaterThan(state.supportLevel);
  });

  it('detects silence (empty input)', () => {
    const a = analyzeUtterance('', 'food', FOOD_KEYWORDS);
    expect(a.wordCount).toBe(0);
    expect(a.likelyErrorType).toBe('hesitation');
  });

  it('transitions to support mode on silence', () => {
    const state = makeState({ mode: 'scaffold' });
    const a = analyzeUtterance('', 'food', FOOD_KEYWORDS);
    const next = transitionCoachState(state, a);
    expect(next.mode).toBe('support');
    expect(next.isStuck).toBe(true);
  });

  it('selects reassurance cue on hesitation at low support', () => {
    const state = makeState({ mode: 'scaffold', supportLevel: 0 });
    const a = analyzeUtterance('uh... I like...', 'food', FOOD_KEYWORDS);
    const cue = selectCue(state, a);
    // Should get reassurance or sentence_starter (hesitation detected + incomplete)
    expect(['reassurance', 'sentence_starter']).toContain(cue.cueType);
  });

  it('selects forced_choice at high support + hesitation', () => {
    const state = makeState({ mode: 'support', supportLevel: 2 });
    const a = analyzeUtterance('uh...', 'food', FOOD_KEYWORDS);
    const cue = selectCue(state, a);
    expect(cue.cueType).toBe('forced_choice');
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 3 — Circumlocution
// ═══════════════════════════════════════════════════════════════
describe('Scenario 3: Circumlocution', () => {
  it('detects circumlocution markers', () => {
    const a = analyzeUtterance('the thing you eat with cheese on top', 'food', FOOD_KEYWORDS);
    expect(a.circumlocution).toBe(true);
    expect(a.likelyErrorType).toBe('circumlocution');
  });

  it('transitions to scaffold with word_finding target', () => {
    const state = makeState({ mode: 'expand' });
    const a = analyzeUtterance('the thing you eat with cheese on top', 'food', FOOD_KEYWORDS);
    const next = transitionCoachState(state, a);
    expect(next.mode).toBe('scaffold');
    expect(next.targetSkill).toBe('word_finding');
  });

  it('selects semantic_hint cue for circumlocution', () => {
    const state = makeState({ mode: 'scaffold' });
    const a = analyzeUtterance('the thing you eat with cheese on top', 'food', FOOD_KEYWORDS);
    const cue = selectCue(state, a);
    expect(cue.cueType).toBe('semantic_hint');
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 4 — Incomplete Thought
// ═══════════════════════════════════════════════════════════════
describe('Scenario 4: Incomplete thought', () => {
  it('detects incomplete trailing thought', () => {
    const a = analyzeUtterance('I went to the...', 'food', FOOD_KEYWORDS);
    expect(a.incompleteThought).toBe(true);
  });

  it('transitions to scaffold on incomplete', () => {
    const state = makeState({ mode: 'expand' });
    const a = analyzeUtterance('I went to the...', 'food', FOOD_KEYWORDS);
    const next = transitionCoachState(state, a);
    expect(next.mode).toBe('scaffold');
  });

  it('selects sentence_starter for incomplete', () => {
    const state = makeState({ mode: 'scaffold' });
    const a = analyzeUtterance('I went to the...', 'food', FOOD_KEYWORDS);
    const cue = selectCue(state, a);
    expect(cue.cueType).toBe('sentence_starter');
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 5 — Off-topic Drift
// ═══════════════════════════════════════════════════════════════
describe('Scenario 5: Off-topic drift', () => {
  it('detects off-topic utterance', () => {
    const a = analyzeUtterance('my dog is really funny and cute', 'food', FOOD_KEYWORDS);
    expect(a.onTopic).toBe(false);
    expect(a.likelyErrorType).toBe('off_topic');
  });

  it('transitions to scaffold (re-anchor) on off-topic', () => {
    const state = makeState({ mode: 'expand' });
    const a = analyzeUtterance('my dog is really funny and cute', 'food', FOOD_KEYWORDS);
    const next = transitionCoachState(state, a);
    expect(next.mode).toBe('scaffold');
    expect(next.isStuck).toBe(false); // off-topic is not "stuck"
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 6 — Failure Spiral (gradual escalation)
// ═══════════════════════════════════════════════════════════════
describe('Scenario 6: Failure spiral — gradual escalation', () => {
  it('escalates support gradually, not instantly', () => {
    let state = makeState({ mode: 'warmup', supportLevel: 0 });

    // Turn 1: hesitation
    const a1 = analyzeUtterance('uh...', 'food', FOOD_KEYWORDS);
    state = transitionCoachState(state, a1);
    expect(state.supportLevel).toBe(1);

    // Turn 2: silence
    const a2 = analyzeUtterance('', 'food', FOOD_KEYWORDS);
    state = transitionCoachState(state, a2);
    expect(state.supportLevel).toBe(2);

    // Turn 3: more hesitation
    const a3 = analyzeUtterance('uh... um...', 'food', FOOD_KEYWORDS);
    state = transitionCoachState(state, a3);
    expect(state.supportLevel).toBe(3);

    // Should cap at 3
    const a4 = analyzeUtterance('', 'food', FOOD_KEYWORDS);
    state = transitionCoachState(state, a4);
    expect(state.supportLevel).toBe(3);
    expect(state.frustrationRisk).toBe('high');
  });

  it('isEmergencySupport triggers at level 3 + high frustration', () => {
    const state = makeState({ supportLevel: 3, frustrationRisk: 'high' });
    expect(isEmergencySupport(state)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Scenario 7 — Recovery After Support
// ═══════════════════════════════════════════════════════════════
describe('Scenario 7: Recovery after support', () => {
  it('decreases support on strong on-topic answer after struggle', () => {
    const state = makeState({ mode: 'support', supportLevel: 2, isStuck: true, frustrationRisk: 'medium' });
    const a = analyzeUtterance('I like pizza', 'food', FOOD_KEYWORDS);
    const next = transitionCoachState(state, a);
    expect(next.mode).toBe('expand');
    expect(next.supportLevel).toBe(1);
    expect(next.isStuck).toBe(false);
    expect(next.frustrationRisk).toBe('low');
  });
});

// ═══════════════════════════════════════════════════════════════
// Safety Validator
// ═══════════════════════════════════════════════════════════════
describe('Safety Validator', () => {
  it('rejects "let me show you" lines', () => {
    const r = validateCoachLine('Let me show you something fun!', 'food');
    expect(r.valid).toBe(false);
    expect(r.reasons.some(r => r.includes('banned_phrase'))).toBe(true);
  });

  it('rejects "as an AI" lines', () => {
    const r = validateCoachLine('As an AI, I cannot eat food.', 'food');
    expect(r.valid).toBe(false);
  });

  it('rejects vague filler like bare "keep going"', () => {
    const r = validateCoachLine('Keep going.', 'food');
    expect(r.valid).toBe(false);
    expect(r.reasons).toContain('vague_filler');
  });

  it('rejects patronizing language', () => {
    const r = validateCoachLine('Good boy! That was wonderful!', 'food');
    expect(r.valid).toBe(false);
  });

  it('rejects empty lines', () => {
    const r = validateCoachLine('', 'food');
    expect(r.valid).toBe(false);
  });

  it('rejects lines over 30 words', () => {
    const long = Array(35).fill('word').join(' ');
    const r = validateCoachLine(long, 'food');
    expect(r.valid).toBe(false);
    expect(r.reasons).toContain('too_long');
  });

  it('accepts valid coaching lines', () => {
    const r = validateCoachLine('What kind of pizza do you like?', 'food', [], { topicKeywords: ['pizza', 'pasta', 'cooking'] });
    expect(r.valid).toBe(true);
  });

  it('rejects re-asking established facts', () => {
    const r = validateCoachLine('Do you like pizza?', 'food', ['i like pizza']);
    expect(r.valid).toBe(false);
    expect(r.reasons.some(r => r.includes('re_asking_fact'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Post-Processor
// ═══════════════════════════════════════════════════════════════
describe('Post-Processor', () => {
  it('removes "Maya:" prefix', () => {
    expect(postProcessCoachLine('Maya: What kind of pizza?')).toBe('What kind of pizza?');
  });

  it('removes wrapping quotes', () => {
    expect(postProcessCoachLine('"Tell me more about that."')).toBe('Tell me more about that.');
  });

  it('truncates overly long lines', () => {
    const long = Array(30).fill('word').join(' ');
    const result = postProcessCoachLine(long);
    expect(result.split(/\s+/).length).toBeLessThanOrEqual(25);
  });

  it('normalizes whitespace', () => {
    expect(postProcessCoachLine('  hello   world  ')).toBe('hello world');
  });
});

// ═══════════════════════════════════════════════════════════════
// Fallback Library
// ═══════════════════════════════════════════════════════════════
describe('Fallback Library', () => {
  it('returns a string for every mode', () => {
    for (const mode of ['warmup', 'expand', 'scaffold', 'support', 'wrapup'] as const) {
      const line = getFallbackLine(mode);
      expect(typeof line).toBe('string');
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it('returns cue-specific fallback when available', () => {
    const line = getFallbackLine('support', 'reassurance');
    expect(typeof line).toBe('string');
    expect(line.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Prompt Builder
// ═══════════════════════════════════════════════════════════════
describe('Prompt Builder', () => {
  it('includes topic and mode', () => {
    const prompt = buildPrompt({
      topic: 'food',
      mode: 'expand',
      cueType: 'expansion_prompt',
      supportLevel: 0,
      lastUserUtterance: 'I like pizza',
    });
    expect(prompt).toContain('food');
    expect(prompt).toContain('expand');
    expect(prompt).toContain('I like pizza');
  });

  it('includes established facts as DO NOT re-ask', () => {
    const prompt = buildPrompt({
      topic: 'food',
      mode: 'expand',
      cueType: 'expansion_prompt',
      supportLevel: 0,
      establishedFacts: ['likes pepperoni'],
    });
    expect(prompt).toContain('DO NOT re-ask');
    expect(prompt).toContain('likes pepperoni');
  });

  it('includes banned phrase rules', () => {
    const prompt = buildPrompt({
      topic: 'food',
      mode: 'warmup',
      cueType: 'reassurance',
      supportLevel: 1,
    });
    expect(prompt).toContain('let me show you');
    expect(prompt).toContain('Maximum 20 words');
  });
});

// ═══════════════════════════════════════════════════════════════
// State Factory
// ═══════════════════════════════════════════════════════════════
describe('State Factory', () => {
  it('creates valid initial state', () => {
    const s = createInitialCoachState({ topic: 'food' });
    expect(s.topic).toBe('food');
    expect(s.mode).toBe('warmup');
    expect(s.supportLevel).toBe(0);
    expect(s.turnCount).toBe(0);
    expect(s.topicKeywords.length).toBeGreaterThan(0);
  });

  it('addEstablishedFact adds to array', () => {
    const s = createInitialCoachState({ topic: 'food' });
    const s2 = addEstablishedFact(s, 'Likes pizza');
    expect(s2.establishedFacts).toContain('likes pizza');
  });

  it('shouldWrapUp triggers one turn before maxTurns', () => {
    expect(shouldWrapUp(makeState({ turnCount: 8 }), 8)).toBe(true);
    expect(shouldWrapUp(makeState({ turnCount: 7 }), 8)).toBe(true);  // triggers at maxTurns-1
    expect(shouldWrapUp(makeState({ turnCount: 6 }), 8)).toBe(false);
  });
});
