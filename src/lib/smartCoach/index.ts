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
export { transitionCoachState, shouldWrapUp, isEmergencySupport, hasHesitationCluster, shouldTriggerIntervention } from './coachStateMachine';
export { selectCue } from './cueSelector';
export { validateCoachLine } from './safetyValidator';
export { postProcessCoachLine, findRepeatedNoun, updateMayaNouns } from './responsePostProcessor';
export { getFallbackLine } from './fallbackLibrary';
export { getSessionLogs, clearSessionLogs, exportLogsAsJson, getSessionFallbackRate } from './coachLogger';
export { getTopicPurpose, getAllTopics, getTopicDefinition } from './topicPurposeMap';
export type { TopicDefinition } from './topicPurposeMap';
export { detectGameTrigger, selectGame, buildInterventionFrame, buildGameReturnText, GAME_CATALOG } from './gameTrigger';
export type { GameDefinition } from './gameTrigger';
export { loadLastSessionSummary, buildProgressComparison, saveSessionSummary } from './progressNarrative';
export { adaptExerciseResult } from './interventionAdapter';
export type { InterventionResult } from './interventionAdapter';
export { getPlaybook, getPlaybookTopicIds, CLINICAL_PLAYBOOKS } from './clinicalPlaybooks';
export type { ClinicalPlaybook, TurnObjective, ObjectiveDefinition } from './clinicalPlaybooks';
export { evaluateObjectiveProgress, advanceObjective, getCurrentObjective, shouldForceTransfer, regressObjective, shouldRegressObjective } from './objectiveAdvancer';
export type { ObjectiveProgress } from './objectiveAdvancer';
export { evaluateDrillTrigger } from './drillTriggerEvaluator';
export type { DrillTriggerDecision, DrillTriggerReason } from './drillTriggerEvaluator';
export { selectDrill, selectPracticeBlock } from './drillSelector';
export type { DrillSelection } from './drillSelector';
export { createArcState, computeArcPhase, evaluateDrillSlot, hasClearBreakdown, extractGapWords, getPreDrillNarration, getPostDrillBridge, markDrillFired, recordGap, markTransferBridgeAttempted } from './sessionArc';
export type { ArcPhase, ArcState, DrillSlotDecision, GapSignals } from './sessionArc';
