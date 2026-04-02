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

  // Step 4 — Select cue (now severity-aware)
  const cueDecision = selectCue(nextState, analysis);

  // Track strategy usage
  if (cueDecision.cueType !== 'expansion_prompt' && cueDecision.cueType !== 'reassurance') {
    nextState = recordStrategy(nextState, cueDecision.cueType);
  }

  // Step 5 — Build prompt (with purpose context)
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
