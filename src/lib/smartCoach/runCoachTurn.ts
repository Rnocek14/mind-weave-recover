/**
 * Smart Coach — Turn Orchestrator
 * 
 * The single entry point for processing one conversation turn.
 * Now tracks session metrics, injects purpose context, detects interventions,
 * and advances clinical objectives through playbooks.
 */

import type { CoachState, CoachTurnResult, CoachTurnLog } from './types';
import { evaluateDrillTrigger, type DrillTriggerContext } from './drillTriggerEvaluator';
import { analyzeUtterance } from './utteranceAnalyzer';
import { transitionCoachState, shouldWrapUp } from './coachStateMachine';
import { selectCue } from './cueSelector';
import { buildPrompt } from './promptBuilder';
import { validateCoachLine } from './safetyValidator';
import { postProcessCoachLine } from './responsePostProcessor';
import { getFallbackLine, getConfusionRepairLine, getCorrectionRepairLine } from './fallbackLibrary';
import { logCoachTurn } from './coachLogger';
import { addEstablishedFact, recordStrategy } from './coachState';
import { getPlaybook } from './clinicalPlaybooks';
import { evaluateObjectiveProgress, advanceObjective, tickObjective, shouldForceTransfer, trackSubtopic, shouldRegressObjective, regressObjective } from './objectiveAdvancer';
import { supabase } from '@/integrations/supabase/client';

interface RunCoachTurnArgs {
  state: CoachState;
  userUtterance: string;
  maxTurns?: number;
  /** Injected cross-session context for prompts */
  lastSessionContext?: string;
  /** If returning from an intervention game */
  returningFromIntervention?: boolean;
  interventionSkill?: string;
  /** Turn when last drill completed (for cooldown) */
  lastDrillCompletedAtTurn?: number;
  /** Previous turn analysis (for consecutive signal detection) */
  prevAnalysis?: import('./types').CoachUtteranceAnalysis;
}

export async function runCoachTurn(args: RunCoachTurnArgs): Promise<CoachTurnResult> {
  const { state, userUtterance, maxTurns = 8, lastSessionContext, returningFromIntervention, interventionSkill, lastDrillCompletedAtTurn, prevAnalysis } = args;

  // Step 1 — Analyze utterance
  const analysis = analyzeUtterance(userUtterance, state.topic, state.topicKeywords);

  // Step 1.5 — Confusion/correction intercept: handle BEFORE LLM call
  // These need immediate deterministic repair, not AI-generated responses
  if (analysis.confusionDetected || analysis.correctionDetected) {
    const repairLine = analysis.confusionDetected
      ? getConfusionRepairLine()
      : getCorrectionRepairLine();
    
    const repairHistory = [
      ...state.conversationHistory,
      { role: 'user' as const, text: userUtterance },
      { role: 'maya' as const, text: repairLine },
    ].slice(-10);

    const repairCue = { cueType: 'reassurance' as const, rationale: analysis.confusionDetected ? 'User confused — repair' : 'User correcting — acknowledge' };

    logCoachTurn({
      mode: state.mode,
      supportLevel: state.supportLevel,
      userUtterance,
      analysis,
      cueDecision: repairCue,
      coachLine: repairLine,
      validationPassed: true,
      usedFallback: true,
      topic: state.topic,
      timestamp: new Date().toISOString(),
    });

    return {
      nextState: {
        ...state,
        turnCount: state.turnCount + 1,
        lastUserUtterance: userUtterance,
        lastCoachUtterance: repairLine,
        conversationHistory: repairHistory,
      },
      output: repairLine,
      analysis,
      cueDecision: repairCue,
      validation: { valid: true, reasons: [] },
      usedFallback: true,
    };
  }

  if (shouldWrapUp(state, maxTurns)) {
    const wrapState: CoachState = { ...state, mode: 'wrapup' };
    const fallback = getFallbackLine('wrapup');
    const wrapHistory = [
      ...state.conversationHistory,
      { role: 'user' as const, text: userUtterance },
      { role: 'maya' as const, text: fallback },
    ].slice(-10);
    return {
      nextState: { ...wrapState, turnCount: state.turnCount + 1, lastUserUtterance: userUtterance, lastCoachUtterance: fallback, conversationHistory: wrapHistory },
      output: fallback,
      analysis,
      cueDecision: { cueType: 'reassurance', rationale: 'Session complete' },
      validation: { valid: true, reasons: [] },
      usedFallback: true,
    };
  }

  // Step 3 — Transition state (now also tracks metrics)
  let nextState = transitionCoachState(state, analysis);

  // Step 3.5 — Post-intervention dampening: slightly elevate support after returning from drill
  if (state.postInterventionDampening) {
    nextState.supportLevel = Math.min(3, nextState.supportLevel + 1) as 0 | 1 | 2 | 3;
    // Clear dampening after one turn of use
    nextState.postInterventionDampening = false;
  }

  // Step 4 — Select cue (now severity-aware)
  const cueDecision = selectCue(nextState, analysis);

  // Track strategy usage
  if (cueDecision.cueType !== 'expansion_prompt' && cueDecision.cueType !== 'reassurance') {
    nextState = recordStrategy(nextState, cueDecision.cueType);
  }

  // Step 4.5 — (Legacy trigger path removed — sole trigger is drillTriggerEvaluator in Step 4.8)

  // Step 4.6 — Purpose re-anchor check (every 8-12 turns)
  const PURPOSE_REANCHOR_INTERVAL = 10;
  const turnsSinceAnchor = (state.turnCount + 1) - (state.lastPurposeAnchorTurn || 0);
  const needsPurposeReanchor = turnsSinceAnchor >= PURPOSE_REANCHOR_INTERVAL && nextState.mode !== 'wrapup';
  if (needsPurposeReanchor) {
    nextState.lastPurposeAnchorTurn = state.turnCount + 1;
  }

  // Step 4.7 — Clinical objective tracking via playbook
  const playbook = getPlaybook(nextState.topic);
  let objectivePrompt = '';
  if (playbook && nextState.mode !== 'wrapup') {
    // Evaluate progress on current objective
    const progress = evaluateObjectiveProgress(userUtterance, nextState, playbook);

    // Track subtopic depth
    const mainWord = userUtterance.trim().split(/\s+/)[0]?.toLowerCase() || '';
    const subtopicUpdate = trackSubtopic(nextState, mainWord);
    Object.assign(nextState, subtopicUpdate);

    // Advance if objective met or force transfer near end
    if (progress.shouldAdvance) {
      const advancement = advanceObjective(nextState, playbook);
      Object.assign(nextState, advancement);
    } else {
      // Tick turns on objective
      Object.assign(nextState, tickObjective(nextState));
      
      // Check for regression — user may have worsened mid-session
      const regressionCheck = shouldRegressObjective(nextState, playbook);
      if (regressionCheck?.shouldRegress) {
        const rollback = regressObjective(nextState, playbook, regressionCheck.reason);
        if (rollback) {
          Object.assign(nextState, rollback);
        }
      }
    }

    // Force transfer if running out of turns
    if (shouldForceTransfer(nextState, playbook, maxTurns)) {
      const transferIdx = playbook.objectives.findIndex(o => o.id === 'transfer_check');
      if (transferIdx >= 0) {
        nextState.currentObjectiveIndex = transferIdx;
        nextState.objectiveProgress = { turnsOnObjective: 0, lastObjectiveId: 'transfer_check' };
      }
    }

    // Get the objective-specific prompt injection
    const updatedProgress = evaluateObjectiveProgress(userUtterance, nextState, playbook);
    objectivePrompt = updatedProgress.objectivePrompt;
  }

  // Step 4.8 — Hybrid drill trigger evaluation
  const drillTriggerCtx: DrillTriggerContext = {
    state: nextState,
    analysis,
    prevAnalysis,
    currentObjectiveId: playbook ? playbook.objectives[nextState.currentObjectiveIndex ?? 0]?.id : undefined,
    objectiveAdvanced: playbook ? evaluateObjectiveProgress(userUtterance, nextState, playbook).shouldAdvance : false,
    lastDrillCompletedAtTurn,
    maxTurns,
  };
  const drillTrigger = evaluateDrillTrigger(drillTriggerCtx);

  // Step 5 — Build prompt (with purpose context + cross-session + deficit + objective)
  const prompt = buildPrompt({
    topic: nextState.topic,
    subtopic: nextState.subtopic,
    mode: nextState.mode,
    cueType: cueDecision.cueType,
    supportLevel: nextState.supportLevel,
    lastUserUtterance: userUtterance,
    targetSkill: nextState.targetSkill,
    establishedFacts: nextState.establishedFacts,
    topicKeywords: nextState.topicKeywords,
    conversationHistory: nextState.conversationHistory,
    expandDimension: nextState.expandDimension,
    purposeRationale: nextState.purposeContext.rationale,
    purposeTransferTarget: nextState.purposeContext.transferTarget,
    purposeSkillTarget: nextState.purposeContext.skillTarget,
    severityProfile: nextState.severityProfile,
    primaryDeficit: nextState.primaryDeficit,
    lastSessionContext,
    returningFromIntervention,
    interventionSkill,
    purposeReanchor: needsPurposeReanchor,
    interruptionContext: returningFromIntervention ? state.interruptionContext : undefined,
    postInterventionDampening: state.postInterventionDampening,
    objectivePrompt,
  });

  // Step 6 — Generate coach line via edge function
  let rawLine: string;
  let usedFallback = false;
  let debugRawOutput: string | undefined;

  try {
    const messages = buildMessagesForRelay(state, userUtterance);
    const { data, error } = await supabase.functions.invoke('smart-coach-turn', {
      body: {
        systemPrompt: prompt,
        messages,
      },
    });

    if (error || !data?.response) {
      console.warn('[SmartCoach] Relay error, using fallback:', error);
      rawLine = getFallbackLine(nextState.mode, cueDecision.cueType);
      usedFallback = true;
    } else {
      rawLine = data.response;
      debugRawOutput = data.response;
    }
  } catch (err) {
    console.warn('[SmartCoach] Failed to call relay:', err);
    rawLine = getFallbackLine(nextState.mode, cueDecision.cueType);
    usedFallback = true;
  }

  // Step 7 — Validate (with anchor context including conversation history words)
  // Build broader context from recent conversation for anchor checking
  const recentUserWords = state.conversationHistory
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => m.text)
    .join(' ');
  const broadUserContext = recentUserWords ? `${recentUserWords} ${userUtterance}` : userUtterance;
  
  const validation = validateCoachLine(rawLine, nextState.topic, nextState.establishedFacts, {
    lastUserUtterance: broadUserContext,
    topicKeywords: nextState.topicKeywords,
  });

  let finalLine: string;
  if (!validation.valid) {
    console.warn('[SmartCoach] Validation failed:', validation.reasons, '| Original:', rawLine);
    debugRawOutput = rawLine;
    // CRITICAL FIX: When validation fails, use mode-only fallback (NOT cue type).
    // Using phonemic_hint fallback when user isn't stuck creates nonsensical responses.
    // Only use cue-specific fallbacks when the user is actually struggling.
    const userIsStuck = analysis.hesitationDetected || analysis.pauseDetected || analysis.likelyErrorType === 'hesitation';
    finalLine = getFallbackLine(nextState.mode, userIsStuck ? cueDecision.cueType : undefined);
    usedFallback = true;
  } else {
    finalLine = postProcessCoachLine(rawLine);
  }

  // Step 8 — Update state
  const newHistory = [
    ...nextState.conversationHistory,
    { role: 'user' as const, text: userUtterance },
    { role: 'maya' as const, text: finalLine },
  ].slice(-10);

  const updatedState: CoachState = {
    ...nextState,
    turnCount: state.turnCount + 1,
    lastUserUtterance: userUtterance,
    lastCoachUtterance: finalLine,
    conversationHistory: newHistory,
  };

  // Track established facts
  if (analysis.onTopic && analysis.wordCount >= 3) {
    const fact = userUtterance.trim().toLowerCase().slice(0, 80);
    addEstablishedFact(updatedState, fact);
  }

  // Step 9 — Log
  const turnLog: CoachTurnLog = {
    topic: updatedState.topic,
    mode: updatedState.mode,
    supportLevel: updatedState.supportLevel,
    userUtterance,
    analysis,
    cueDecision,
    coachLine: finalLine,
    validationPassed: validation.valid,
    usedFallback,
    timestamp: new Date().toISOString(),
  };
  logCoachTurn(turnLog);

  return {
    nextState: updatedState,
    output: finalLine,
    analysis,
    cueDecision,
    validation,
    usedFallback,
    debugPrompt: prompt,
    debugRawOutput,
    intervention: undefined,
    drillRecommendation: drillTrigger.kind ? {
      kind: drillTrigger.kind,
      reason: drillTrigger.reason || 'support',
      observation: drillTrigger.observation,
      signals: drillTrigger.signals,
    } : undefined,
  };
}

/** Build messages array for the smart-coach-turn relay (OpenAI-compatible format) */
function buildMessagesForRelay(state: CoachState, currentUtterance: string): { role: 'user' | 'assistant'; content: string }[] {
  const messages: { role: 'user' | 'assistant'; content: string }[] = (state.conversationHistory || []).map(t => ({
    role: (t.role === 'maya' ? 'assistant' : 'user') as 'user' | 'assistant',
    content: t.text,
  }));
  messages.push({ role: 'user', content: currentUtterance || '(silence)' });
  return messages;
}
