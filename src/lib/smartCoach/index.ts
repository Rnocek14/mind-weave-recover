/**
 * Smart Coach — Public API
 * 
 * Re-exports everything needed to use the Smart Coach system.
 */

export type {
  CoachMode,
  TargetSkill,
  CueType,
  CoachState,
  CoachUtteranceAnalysis,
  CueDecision,
  ValidationResult,
  CoachTurnLog,
  CoachTurnResult,
  SessionPhase,
  PurposeContext,
  SessionMetrics,
  SeverityProfile,
  PrimaryDeficit,
  GameTriggerEvent,
  ProgressNarrative,
  InterventionEvent,
} from './types';

export { createInitialCoachState, addEstablishedFact, recordStrategy } from './coachState';
export { runCoachTurn } from './runCoachTurn';
export { analyzeUtterance } from './utteranceAnalyzer';
export { transitionCoachState, shouldWrapUp, isEmergencySupport, hasHesitationCluster } from './coachStateMachine';
export { selectCue } from './cueSelector';
export { validateCoachLine } from './safetyValidator';
export { postProcessCoachLine } from './responsePostProcessor';
export { getFallbackLine } from './fallbackLibrary';
export { getSessionLogs, clearSessionLogs, exportLogsAsJson } from './coachLogger';
export { getTopicPurpose, getAllTopics, getTopicDefinition } from './topicPurposeMap';
export type { TopicDefinition } from './topicPurposeMap';
