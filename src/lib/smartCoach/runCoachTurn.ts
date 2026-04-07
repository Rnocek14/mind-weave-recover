/**
 * Smart Coach — Turn Orchestrator (v2: Simplified)
 * 
 * REDESIGN: Removed dual-progression conflict.
 * - Session arc (sessionArc.ts) is the SOLE authority for phase/drill timing
 * - Playbook objectives provide prompt injection ONLY (no separate advancement logic)
 * - Validation reasons are tracked for fallback rate diagnosis
 */

import type { CoachState, CoachTurnResult, CoachTurnLog } from './types';
import { evaluateDrillTrigger, type DrillTriggerContext } from './drillTriggerEvaluator';
import type { ArcState } from './sessionArc';
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
import { supabase } from '@/integrations/supabase/client';

interface RunCoachTurnArgs {
  state: CoachState;
  userUtterance: string;
  maxTurns?: number;
  lastSessionContext?: string;
  returningFromIntervention?: boolean;
  interventionSkill?: string;
  lastDrillCompletedAtTurn?: number;
  prevAnalysis?: import('./types').CoachUtteranceAnalysis;
  arcState?: ArcState;
}

export async function runCoachTurn(args: RunCoachTurnArgs): Promise<CoachTurnResult> {
  const { state, userUtterance, maxTurns = 8, lastSessionContext, returningFromIntervention, interventionSkill, lastDrillCompletedAtTurn, prevAnalysis, arcState } = args;

  // Step 1 — Analyze utterance
  const analysis = analyzeUtterance(userUtterance, state.topic, state.topicKeywords);

  // Step 1.5 — Confusion/correction intercept
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

  // Step 3 — Transition state
  let nextState = transitionCoachState(state, analysis);

  // Post-intervention dampening
  if (state.postInterventionDampening) {
    nextState.supportLevel = Math.min(3, nextState.supportLevel + 1) as 0 | 1 | 2 | 3;
    nextState.postInterventionDampening = false;
  }

  // Step 4 — Select cue
  const cueDecision = selectCue(nextState, analysis);

  if (cueDecision.cueType !== 'expansion_prompt' && cueDecision.cueType !== 'reassurance') {
    nextState = recordStrategy(nextState, cueDecision.cueType);
  }

  // Step 4.6 — Purpose re-anchor check
  const PURPOSE_REANCHOR_INTERVAL = 10;
  const turnsSinceAnchor = (state.turnCount + 1) - (state.lastPurposeAnchorTurn || 0);
  const needsPurposeReanchor = turnsSinceAnchor >= PURPOSE_REANCHOR_INTERVAL && nextState.mode !== 'wrapup';
  if (needsPurposeReanchor) {
    nextState.lastPurposeAnchorTurn = state.turnCount + 1;
  }

  // Step 4.7 — Get objective prompt from playbook (PROMPT INJECTION ONLY — no advancement logic)
  const playbook = getPlaybook(nextState.topic);
  let objectivePrompt = '';
  if (playbook && nextState.mode !== 'wrapup') {
    const idx = nextState.currentObjectiveIndex ?? 0;
    const objective = playbook.objectives[Math.min(idx, playbook.objectives.length - 1)];
    
    // Simple objective prompt — just tell the LLM what to focus on
    objectivePrompt = getSimpleObjectivePrompt(objective.id, playbook.topicId);
    
    // Auto-advance objective every 2 turns (simple, no dual-brain)
    const turnsOnObj = nextState.objectiveProgress?.turnsOnObjective ?? 0;
    if (turnsOnObj >= 2 && idx < playbook.objectives.length - 1) {
      nextState.currentObjectiveIndex = idx + 1;
      nextState.objectiveProgress = { turnsOnObjective: 0, lastObjectiveId: playbook.objectives[idx + 1].id };
    } else {
      nextState.objectiveProgress = {
        ...nextState.objectiveProgress,
        turnsOnObjective: turnsOnObj + 1,
      };
    }
  }

  // Step 4.8 — Drill trigger evaluation (sole authority: session arc)
  const drillTriggerCtx: DrillTriggerContext = {
    state: nextState,
    analysis,
    prevAnalysis,
    currentObjectiveId: playbook ? playbook.objectives[nextState.currentObjectiveIndex ?? 0]?.id : undefined,
    objectiveAdvanced: false,
    lastDrillCompletedAtTurn,
    maxTurns,
    arcState,
  };
  const drillTrigger = evaluateDrillTrigger(drillTriggerCtx);

  // Step 5 — Build prompt (simplified)
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

  // Step 7 — Validate (loosened)
  const validation = validateCoachLine(rawLine, nextState.topic, nextState.establishedFacts, {
    lastUserUtterance: userUtterance,
    topicKeywords: nextState.topicKeywords,
  });

  let finalLine: string;
  if (!validation.valid) {
    console.warn('[SmartCoach] Validation failed:', validation.reasons, '| Original:', rawLine);
    debugRawOutput = rawLine;
    finalLine = getFallbackLine(nextState.mode);
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
    consecutiveFallbacks: usedFallback ? (state.consecutiveFallbacks ?? 0) + 1 : 0,
  };

  // LLM failure escalation
  if (updatedState.consecutiveFallbacks >= 3) {
    console.error(`[SmartCoach] LLM failure escalation: ${updatedState.consecutiveFallbacks} consecutive fallbacks`);
    updatedState.mode = 'wrapup';
  }

  // Track established facts
  if (analysis.onTopic && analysis.wordCount >= 3) {
    const fact = userUtterance.trim().toLowerCase().slice(0, 80);
    addEstablishedFact(updatedState, fact);
  }

  // Step 9 — Log (with validation reasons for fallback diagnosis)
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
  // Attach validation reasons for diagnosis (not in the type but tracked)
  (turnLog as any).validationReasons = validation.reasons;
  (turnLog as any).rejectedLine = debugRawOutput;
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

/** Simple objective prompt — no complex evaluation, just a clear instruction */
function getSimpleObjectivePrompt(objectiveId: string, topicId: string): string {
  switch (objectiveId) {
    case 'warmup_anchor':
      return `OBJECTIVE: Get the user to name one item related to ${topicId}. Keep it easy.`;
    case 'elicit_core_content':
      return `OBJECTIVE: Expand into details — type, ingredients, people. Get 2+ content words.`;
    case 'organize_or_expand':
      return `OBJECTIVE: Move from single words to short phrases. Combine item + detail.`;
    case 'sentence_level_production':
      return `OBJECTIVE: Get a full sentence. Frame as real-world: ordering, introducing, describing.`;
    case 'transfer_check':
      return `OBJECTIVE: Test real-world transfer. "How would you say this to a waiter/friend?"`;
    case 'wrapup_reflection':
      return `OBJECTIVE: Wrap up. Name their exact words that came out well. Connect to real use.`;
    default:
      return '';
  }
}

/** Build messages array for the smart-coach-turn relay */
function buildMessagesForRelay(state: CoachState, currentUtterance: string): { role: 'user' | 'assistant'; content: string }[] {
  const messages: { role: 'user' | 'assistant'; content: string }[] = (state.conversationHistory || []).map(t => ({
    role: (t.role === 'maya' ? 'assistant' : 'user') as 'user' | 'assistant',
    content: t.text,
  }));
  messages.push({ role: 'user', content: currentUtterance || '(silence)' });
  return messages;
}
