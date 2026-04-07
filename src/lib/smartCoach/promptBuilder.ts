/**
 * Smart Coach — Prompt Builder (v2: Simplified)
 * 
 * REDESIGN: Collapsed from ~600 tokens to ~250.
 * One clear instruction per turn. No contradictory constraints.
 * The LLM gets: persona + topic + ONE action + key context.
 */

import type { CoachMode, CueType, SeverityProfile, PrimaryDeficit } from './types';

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

export function buildPrompt(ctx: PromptContext): string {
  const parts: string[] = [];

  // ── Core persona (fixed, short) ──
  parts.push(`You are Maya, a warm speech coach helping a stroke survivor practice. Sound like a kind, intelligent friend — not a script.`);

  // ── Hard rules (minimal, non-contradictory) ──
  parts.push(`RULES: Stay on "${ctx.topic}". Never stutter/hyphenate words. Never say "tell me more" without specifying what. Never use empty praise ("Good job!") — always say what was good. One sentence only. Speak like talking to an intelligent adult.`);

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

  // ── Action instruction (mode + cue + dimension) ──
  let modeInst = MODE_INSTRUCTIONS[ctx.mode];
  if (ctx.mode === 'expand' && ctx.expandDimension !== undefined) {
    const dimIdx = ctx.expandDimension % EXPAND_DIMENSIONS.length;
    modeInst += ` ${EXPAND_DIMENSIONS[dimIdx]}`;
  }
  parts.push(`ACTION: ${modeInst}`);
  parts.push(`CUE: ${CUE_HINTS[ctx.cueType]}`);

  // ── The trigger ──
  parts.push(`User said: "${ctx.lastUserUtterance || '(silence)'}"`);
  parts.push(`Respond:`);

  return parts.join('\n\n');
}
