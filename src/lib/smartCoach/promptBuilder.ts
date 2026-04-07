/**
 * Smart Coach — Prompt Builder (v3: Arc-Aware)
 * 
 * Now includes arc phase context so the LLM knows WHERE in the session we are.
 * ~250 tokens. One clear instruction per turn.
 */

import type { CoachMode, CueType, SeverityProfile, PrimaryDeficit } from './types';
import type { ArcPhase } from './sessionArc';

export interface PromptContext {
  topic: string;
  subtopic?: string;
  mode: CoachMode;
  cueType: CueType;
  supportLevel: 0 | 1 | 2 | 3;
  lastUserUtterance?: string;
  targetSkill?: string;
  establishedFacts?: string[];
  topicKeywords?: string[];
  conversationHistory?: { role: 'user' | 'maya'; text: string }[];
  expandDimension?: number;
  purposeRationale?: string;
  purposeTransferTarget?: string;
  purposeSkillTarget?: string;
  severityProfile?: SeverityProfile;
  primaryDeficit?: PrimaryDeficit;
  lastSessionContext?: string;
  returningFromIntervention?: boolean;
  interventionSkill?: string;
  purposeReanchor?: boolean;
  interruptionContext?: {
    lastSubtopic: string;
    lastUserStruggle: string;
    lastPhraseAttempt: string;
  };
  postInterventionDampening?: boolean;
  objectivePrompt?: string;
  /** Arc phase for structural awareness */
  arcPhase?: ArcPhase;
  /** Words practiced in drills this session */
  drilledWords?: string[];
  /** Current turn number */
  turnNumber?: number;
  /** Total turns in session */
  totalTurns?: number;
}

const EXPAND_DIMENSIONS = [
  'Ask about a specific detail they mentioned (what kind, what color, what name).',
  'Ask about their preference or feeling about it.',
  'Ask about a personal experience connected to it.',
  'Ask about context or setting (where, when).',
  'Ask about comparison or change (has it always been that way).',
];

// Simplified mode instructions — ONE clear action per mode
const MODE_INSTRUCTIONS: Record<CoachMode, string> = {
  warmup: `Ask ONE easy question about the topic. Maximum 14 words.`,

  expand: `React to what they said, then ask ONE specific follow-up that pushes them to say more. Anchor to their words. Maximum 18 words.`,

  scaffold: `Name what's hard, then offer ONE concrete help: a forced-choice OR sentence starter. Maximum 18 words.`,

  support: `Simplify to yes/no or a binary choice. Maximum 12 words.`,

  transfer_bridge: `Ask them to USE a specific drilled word in a real-world scenario. Pattern: "[Word] — now use it. If you were [scenario], what would you say?" Maximum 18 words.`,

  wrapup: `Name 1-2 specific words they produced well (their EXACT words). Connect to real-world use. No new questions. Maximum 25 words.`,
};

// Cue hints — short, not full instruction sets
const CUE_HINTS: Record<CueType, string> = {
  semantic_hint: 'Give a category or association hint for the target word.',
  phonemic_hint: 'Give ONLY the first sound (never spell it out). Example: "It starts with \'sp...\'"',
  forced_choice: 'Give exactly two options: "Is it [A] or [B]?"',
  sentence_starter: 'Provide a sentence frame they can complete.',
  reassurance: 'Acknowledge the pause, then offer one way forward.',
  expansion_prompt: 'Ask about one specific detail they just mentioned.',
};

// Arc phase context — tells the LLM where we are in the therapy session
const ARC_PHASE_CONTEXT: Record<ArcPhase, string> = {
  orient_assess: 'SESSION PHASE: Diagnostic Assessment — You are OBSERVING, not helping yet. Ask questions that test specific vocabulary. Do NOT offer hints, cues, or corrections. Let the user struggle — you need to see what words are hard. If they circumlocute or hesitate, note it but do NOT fix it. Ask a follow-up that tests a different word.',
  practice_bridge: 'SESSION PHASE: Practice Bridge — User has done a drill. Now get them to USE those practiced words in real conversation. Be directive: ask them to put specific words into sentences.',
  generalize_close: 'SESSION PHASE: Generalization — Test if practiced words come out naturally. Ask real-world scenario questions. If they use drilled words spontaneously, acknowledge it specifically.',
};

export function buildPrompt(ctx: PromptContext): string {
  const parts: string[] = [];

  // ── Core persona (fixed, short) ──
  parts.push(`You are Maya, a warm speech coach helping a stroke survivor practice. Sound like a kind, intelligent friend — not a script. You are directing a therapy session, not having casual chat.`);

  // ── Hard rules (minimal, non-contradictory) ──
  parts.push(`RULES: Stay on "${ctx.topic}". Never stutter/hyphenate words. Never say "tell me more" without specifying what. Never use empty praise ("Good job!") — always say what was good. One sentence only. Speak like talking to an intelligent adult.`);

  // ── Session position ──
  if (ctx.turnNumber !== undefined && ctx.totalTurns !== undefined) {
    parts.push(`Turn ${ctx.turnNumber + 1} of ${ctx.totalTurns}.`);
  }

  // ── Arc phase (structural awareness) ──
  if (ctx.arcPhase) {
    parts.push(ARC_PHASE_CONTEXT[ctx.arcPhase]);
  }

  // ── Drilled words (for transfer verification) ──
  if (ctx.drilledWords && ctx.drilledWords.length > 0) {
    parts.push(`DRILLED WORDS this session: ${ctx.drilledWords.join(', ')}. Listen for these — acknowledge when used.`);
  }

  // ── Context (compact) ──
  parts.push(`Topic: ${ctx.topic}${ctx.subtopic ? ` → ${ctx.subtopic}` : ''} | Support: ${ctx.supportLevel}/3`);

  if (ctx.establishedFacts && ctx.establishedFacts.length > 0) {
    parts.push(`Already said (don't re-ask): ${ctx.establishedFacts.slice(-3).join('; ')}`);
  }

  // ── Severity (one line, only if not moderate) ──
  if (ctx.severityProfile === 'severe') {
    parts.push(`SEVERITY: Use very short sentences. Default to yes/no or choices. Max 12 words.`);
  } else if (ctx.severityProfile === 'mild') {
    parts.push(`SEVERITY: More open-ended, focus on fluency. Less scaffolding.`);
  }

  // ── Deficit (one line, only if specified) ──
  if (ctx.primaryDeficit === 'receptive') {
    parts.push(`DEFICIT: Short instructions. Verify understanding.`);
  } else if (ctx.primaryDeficit === 'expressive') {
    parts.push(`DEFICIT: Be patient with pauses. Provide word-finding support.`);
  }

  // ── Cross-session (one line) ──
  if (ctx.lastSessionContext) {
    parts.push(`Last session: ${ctx.lastSessionContext}`);
  }

  // ── Struggling phonemes (inform Maya about sound-level issues) ──
  if (ctx.strugglingPhonemes && ctx.strugglingPhonemes.length > 0) {
    const phonemeInfo = ctx.strugglingPhonemes.slice(0, 3)
      .map(p => `"${p.phoneme}" (${Math.round(p.accuracy * 100)}%)`)
      .join(', ');
    parts.push(`SPEECH DATA: User struggles with sounds: ${phonemeInfo}. Listen for these — if they mispronounce, note it specifically.`);
  }

  // ── Cross-session continuity (carried-forward goals) ──
  if (ctx.crossSessionContext) {
    parts.push(`CONTINUITY: ${ctx.crossSessionContext}`);
  }

  // ── Transfer bridge (highest priority when active) ──
  if (ctx.returningFromIntervention && ctx.interruptionContext) {
    parts.push(`TRANSFER (PRIORITY): Just finished drill. User was discussing "${ctx.interruptionContext.lastSubtopic}". Ask a real-world transfer question using a practiced word.`);
  } else if (ctx.returningFromIntervention) {
    parts.push(`TRANSFER (PRIORITY): Just finished drill. Ask a real-world scenario question using the practiced skill.`);
  }

  // ── Purpose re-anchor (when needed) ──
  if (ctx.purposeReanchor && ctx.purposeRationale) {
    parts.push(`PURPOSE: Weave in why we're practicing: ${ctx.purposeRationale}`);
  }

  // ── Clinical objective (from playbook — this is the main action) ──
  if (ctx.objectivePrompt) {
    parts.push(ctx.objectivePrompt);
  }

  // ── Action instruction (mode + cue merged when appropriate) ──
  let modeInst = MODE_INSTRUCTIONS[ctx.mode];
  if (ctx.mode === 'expand' && ctx.expandDimension !== undefined) {
    const dimIdx = ctx.expandDimension % EXPAND_DIMENSIONS.length;
    modeInst += ` ${EXPAND_DIMENSIONS[dimIdx]}`;
  }
  parts.push(`ACTION: ${modeInst}`);

  // Only include CUE instruction when in scaffold/support modes
  // In expand/warmup, the ACTION is sufficient — adding CUE creates contradiction
  if (ctx.mode === 'scaffold' || ctx.mode === 'support') {
    parts.push(`CUE STRATEGY: ${CUE_HINTS[ctx.cueType]}`);
  }

  // ── The trigger ──
  parts.push(`User said: "${ctx.lastUserUtterance || '(silence)'}"`);
  parts.push(`Respond:`);

  return parts.join('\n\n');
}
