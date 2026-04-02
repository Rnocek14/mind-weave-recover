/**
 * Smart Coach — Turn Orchestrator
 * 
 * The single entry point for processing one conversation turn.
 * Now tracks session metrics, injects purpose context, and detects interventions.
 */

import type { CoachState, CoachTurnResult, CoachTurnLog, InterventionEvent } from './types';
import { analyzeUtterance } from './utteranceAnalyzer';
import { transitionCoachState, shouldWrapUp, shouldTriggerIntervention } from './coachStateMachine';
import { selectCue } from './cueSelector';
import { buildPrompt } from './promptBuilder';
import { validateCoachLine } from './safetyValidator';
import { postProcessCoachLine } from './responsePostProcessor';
import { getFallbackLine } from './fallbackLibrary';
import { logCoachTurn } from './coachLogger';
import { addEstablishedFact, recordStrategy } from './coachState';
import { detectGameTrigger, selectGame, buildInterventionFrame } from './gameTrigger';
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
}

export async function runCoachTurn(args: RunCoachTurnArgs): Promise<CoachTurnResult> {
  const { state, userUtterance, maxTurns = 8, lastSessionContext, returningFromIntervention, interventionSkill } = args;

  // Step 1 — Analyze utterance
  const analysis = analyzeUtterance(userUtterance, state.topic, state.topicKeywords);

  // Step 2 — Check for wrapup
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

  // Step 4.5 — Check for intervention trigger
  let intervention: InterventionEvent | undefined;
  const triggerCheck = shouldTriggerIntervention(nextState);
  if (triggerCheck.shouldTrigger && triggerCheck.pattern) {
    const triggerResult = detectGameTrigger(nextState);
    if (triggerResult.triggered && triggerResult.pattern) {
      const game = selectGame(triggerResult.pattern);
      const frame = buildInterventionFrame(triggerResult, game);
      intervention = {
        observation: frame.observation,
        rationale: frame.rationale,
        action: `${frame.action} ${frame.offerText}`,
        type: 'game_offer',
        gameId: game.id,
        timestamp: Date.now(),
      };

      // Save interruption context BEFORE launching exercise
      nextState.interruptionContext = {
        lastSubtopic: nextState.subtopic || nextState.topic,
        lastUserStruggle: analysis.likelyErrorType !== 'none' ? analysis.likelyErrorType : 'word retrieval',
        lastPhraseAttempt: userUtterance.trim().slice(0, 100),
        interruptedAtTurn: state.turnCount,
      };
      nextState.interventionCount = (state.interventionCount || 0) + 1;
    }
  }

  // Step 4.6 — Purpose re-anchor check (every 8-12 turns)
  const PURPOSE_REANCHOR_INTERVAL = 10;
  const turnsSinceAnchor = (state.turnCount + 1) - (state.lastPurposeAnchorTurn || 0);
  const needsPurposeReanchor = turnsSinceAnchor >= PURPOSE_REANCHOR_INTERVAL && nextState.mode !== 'wrapup';
  if (needsPurposeReanchor) {
    nextState.lastPurposeAnchorTurn = state.turnCount + 1;
  }

  // Step 5 — Build prompt (with purpose context + cross-session + deficit)
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
  });

  // Step 6 — Generate coach line via edge function
  let rawLine: string;
  let usedFallback = false;
  let debugRawOutput: string | undefined;

  try {
    const { data, error } = await supabase.functions.invoke('conversation-partner', {
      body: {
        userTranscript: userUtterance,
        turnNumber: state.turnCount + 1,
        maxTurns,
        conversationHistory: buildHistory(state, userUtterance),
        smartCoachPrompt: prompt,
      },
    });

    if (error || !data?.response) {
      console.warn('[SmartCoach] Edge function error, using fallback:', error);
      rawLine = getFallbackLine(nextState.mode, cueDecision.cueType);
      usedFallback = true;
    } else {
      rawLine = data.response;
      debugRawOutput = data.response;
    }
  } catch (err) {
    console.warn('[SmartCoach] Failed to call edge function:', err);
    rawLine = getFallbackLine(nextState.mode, cueDecision.cueType);
    usedFallback = true;
  }

  // Step 7 — Validate
  const validation = validateCoachLine(rawLine, nextState.topic, nextState.establishedFacts);

  let finalLine: string;
  if (!validation.valid) {
    console.warn('[SmartCoach] Validation failed:', validation.reasons, '| Original:', rawLine);
    debugRawOutput = rawLine;
    finalLine = getFallbackLine(nextState.mode, cueDecision.cueType);
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
    intervention,
  };
}

/** Build conversation history for the edge function */
function buildHistory(state: CoachState, currentUtterance: string) {
  const history = (state.conversationHistory || []).map(t => ({
    role: t.role === 'maya' ? 'ai' : 'user',
    text: t.text,
  }));
  return history;
}
