/**
 * Smart Coach — State Factory
 * 
 * Creates and manages CoachState instances.
 * Initializes with purpose context from the topic map.
 */

import type { CoachState, TargetSkill, SeverityProfile, PrimaryDeficit, SessionMetrics } from './types';
import { getTopicPurpose } from './topicPurposeMap';

/** Create empty session metrics */
function createEmptyMetrics(): SessionMetrics {
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
  };
}

/** Build initial state for a new Smart Coach conversation */
export function createInitialCoachState(options: {
  topic: string;
  topicKeywords?: string[];
  targetSkill?: TargetSkill;
  severityProfile?: SeverityProfile;
  primaryDeficit?: PrimaryDeficit;
  readinessLevel?: number;
  strugglingPhonemes?: { phoneme: string; accuracy: number; trials: number }[];
  domainScores?: { domainSlug: string; score: number; trialCount: number }[];
  exerciseHistory?: { exerciseSlug: string; avgAccuracy: number; trialCount: number }[];
  crossSessionContext?: string;
}): CoachState {
  const purposeContext = getTopicPurpose(options.topic);
  
  // Adjust support level based on severity
  const initialSupport: 0 | 1 | 2 | 3 = 
    options.severityProfile === 'severe' ? 2 :
    options.severityProfile === 'mild' ? 0 : 0;

  return {
    topic: options.topic,
    mode: 'warmup',
    supportLevel: initialSupport,
    turnCount: 0,
    isStuck: false,
    frustrationRisk: 'low',
    targetSkill: options.targetSkill,
    topicKeywords: options.topicKeywords ?? extractKeywords(options.topic),
    establishedFacts: [],
    conversationHistory: [],
    consecutiveHesitations: 0,
    expandDimension: 0,
    purposeContext: purposeContext,
    sessionMetrics: createEmptyMetrics(),
    severityProfile: options.severityProfile ?? 'moderate',
    primaryDeficit: options.primaryDeficit ?? 'expressive',
    readinessLevel: options.readinessLevel ?? 7,
    recentHesitations: [],
    lastPurposeAnchorTurn: 0,
    interruptionContext: undefined,
    postInterventionDampening: false,
    interventionCount: 0,
    currentObjectiveIndex: 0,
    objectiveProgress: { turnsOnObjective: 0 },
    subtopicDepth: 0,
    currentSubtopic: undefined,
    consecutiveDisengagements: 0,
    recentMayaNouns: [],
    consecutiveFallbacks: 0,
    strugglingPhonemes: options.strugglingPhonemes,
    domainScores: options.domainScores,
    exerciseHistory: options.exerciseHistory,
    crossSessionContext: options.crossSessionContext,
  };
}

/** Extract simple keywords from a topic string */
function extractKeywords(topic: string): string[] {
  const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'about', 'and', 'or', 'my', 'your', 'i']);
  return topic
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
}

/** Add an established fact so it won't be re-asked */
export function addEstablishedFact(state: CoachState, fact: string): CoachState {
  return {
    ...state,
    establishedFacts: [...state.establishedFacts, fact.toLowerCase()],
  };
}

/** Record a strategy that helped */
export function recordStrategy(state: CoachState, strategy: string): CoachState {
  const existing = state.sessionMetrics.strategiesThatHelped;
  if (existing.includes(strategy)) return state;
  return {
    ...state,
    sessionMetrics: {
      ...state.sessionMetrics,
      strategiesThatHelped: [...existing, strategy],
    },
  };
}
