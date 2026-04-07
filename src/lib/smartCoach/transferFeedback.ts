/**
 * Transfer Feedback Templates
 * 
 * Rule-based Maya feedback after transfer checks.
 * Every line follows: what changed + what helped + what to do next.
 * 
 * BANNED: "Great job!", "Awesome!", "Perfect!", "You're so smart",
 *         "Keep going", "Tell me more", "Good try"
 */

import type { TransferCheckResult, TransferTarget } from './transferScoring';

export interface TransferFeedbackOutput {
  /** The feedback line Maya says */
  feedbackLine: string;
  /** The next prompt Maya gives */
  nextPrompt: string;
  /** Combined for single-turn use */
  combined: string;
}

/** Get the primary target word for display */
function primaryTarget(targets: TransferTarget[]): string {
  return targets[0]?.value || 'that word';
}

/** Get the functional context */
function context(targets: TransferTarget[]): string {
  return targets[0]?.functionalContext || 'in conversation';
}

// ═══════════════════════════════════════════════════════════════
// Feedback by transfer score
// ═══════════════════════════════════════════════════════════════

export function getTransferFeedback(
  result: TransferCheckResult,
  targets: TransferTarget[],
  cueType?: string,
): TransferFeedbackOutput {
  const target = primaryTarget(targets);
  const ctx = context(targets);
  
  switch (result.transferScore) {
    case 4:
      return spontaneousFeedback(target, ctx);
    case 3:
      return functionalFeedback(target, ctx);
    case 2:
      return supportedFeedback(target, ctx, cueType);
    case 1:
      return recognitionFeedback(target, ctx);
    default:
      return noTransferFeedback(target, ctx);
  }
}

// ─── Score 4: Spontaneous transfer ──────────────────────────

const SPONTANEOUS_TEMPLATES = [
  (t: string) => `You used "${t}" on your own.`,
  (t: string) => `"${t}" came out naturally that time.`,
  (t: string) => `You practiced "${t}", then said it in real conversation.`,
];

function spontaneousFeedback(target: string, ctx: string): TransferFeedbackOutput {
  const idx = Math.floor(Math.random() * SPONTANEOUS_TEMPLATES.length);
  const feedbackLine = SPONTANEOUS_TEMPLATES[idx](target);
  const nextPrompt = `Now say it in one more ${ctx} example.`;
  return { feedbackLine, nextPrompt, combined: `${feedbackLine} ${nextPrompt}` };
}

// ─── Score 3: Functional transfer ───────────────────────────

const FUNCTIONAL_TEMPLATES = [
  (t: string, c: string) => `You used "${t}" in the ${c} example.`,
  (t: string) => `"${t}" worked in a real situation.`,
  (t: string) => `You practiced "${t}", then used it.`,
];

function functionalFeedback(target: string, ctx: string): TransferFeedbackOutput {
  const idx = Math.floor(Math.random() * FUNCTIONAL_TEMPLATES.length);
  const feedbackLine = FUNCTIONAL_TEMPLATES[idx](target, ctx);
  const nextPrompt = `Try it again with a little more detail.`;
  return { feedbackLine, nextPrompt, combined: `${feedbackLine} ${nextPrompt}` };
}

// ─── Score 2: Supported transfer ────────────────────────────

function supportedFeedback(target: string, ctx: string, cueType?: string): TransferFeedbackOutput {
  const cueLabel = cueType === 'phonemic_hint' ? 'first sound' 
    : cueType === 'semantic_hint' ? 'category hint' 
    : 'hint';
  const feedbackLine = `The ${cueLabel} helped you use "${target}".`;
  const nextPrompt = `Let's try once more with less help.`;
  return { feedbackLine, nextPrompt, combined: `${feedbackLine} ${nextPrompt}` };
}

// ─── Score 1: Recognition only ──────────────────────────────

function recognitionFeedback(target: string, ctx: string): TransferFeedbackOutput {
  const feedbackLine = `You recognized "${target}".`;
  const nextPrompt = `Now let's turn it into words — how would you use "${target}" ${ctx}?`;
  return { feedbackLine, nextPrompt, combined: `${feedbackLine} ${nextPrompt}` };
}

// ─── Score 0: No transfer ───────────────────────────────────

function noTransferFeedback(target: string, ctx: string): TransferFeedbackOutput {
  const feedbackLine = `"${target}" still feels hard right now.`;
  const nextPrompt = `Let's make it easier — is it "${target}" or something else?`;
  return { feedbackLine, nextPrompt, combined: `${feedbackLine} ${nextPrompt}` };
}

// ═══════════════════════════════════════════════════════════════
// Session summary feedback
// ═══════════════════════════════════════════════════════════════

export interface TransferSummaryItem {
  target: string;
  label: string; // "Used on your own", "Used with help", etc.
  score: number;
}

export function buildTransferSummaryText(items: TransferSummaryItem[]): string {
  if (items.length === 0) return '';
  
  const independent = items.filter(i => i.score >= 4);
  const withHelp = items.filter(i => i.score >= 2 && i.score < 4);
  const notYet = items.filter(i => i.score < 2);
  
  const parts: string[] = [];
  
  if (independent.length > 0) {
    parts.push(`Used on your own: ${independent.map(i => `"${i.target}"`).join(', ')}`);
  }
  if (withHelp.length > 0) {
    parts.push(`Used with help: ${withHelp.map(i => `"${i.target}"`).join(', ')}`);
  }
  if (notYet.length > 0) {
    parts.push(`Still building: ${notYet.map(i => `"${i.target}"`).join(', ')}`);
  }
  
  return parts.join('\n');
}
