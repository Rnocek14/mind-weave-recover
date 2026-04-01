/**
 * Smart Coach — State Factory
 * 
 * Creates and manages CoachState instances.
 */

import type { CoachState, TargetSkill } from './types';

/** Build initial state for a new Smart Coach conversation */
export function createInitialCoachState(options: {
  topic: string;
  topicKeywords?: string[];
  targetSkill?: TargetSkill;
}): CoachState {
  return {
    topic: options.topic,
    mode: 'warmup',
    supportLevel: 0,
    turnCount: 0,
    isStuck: false,
    frustrationRisk: 'low',
    targetSkill: options.targetSkill,
    topicKeywords: options.topicKeywords ?? extractKeywords(options.topic),
    establishedFacts: [],
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
