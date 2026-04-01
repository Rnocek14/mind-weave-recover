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
} from './types';

export { createInitialCoachState, addEstablishedFact } from './coachState';
export { runCoachTurn } from './runCoachTurn';
export { analyzeUtterance } from './utteranceAnalyzer';
export { transitionCoachState, shouldWrapUp, isEmergencySupport } from './coachStateMachine';
export { selectCue } from './cueSelector';
export { validateCoachLine } from './safetyValidator';
export { postProcessCoachLine } from './responsePostProcessor';
export { getFallbackLine } from './fallbackLibrary';
export { getSessionLogs, clearSessionLogs, exportLogsAsJson } from './coachLogger';
