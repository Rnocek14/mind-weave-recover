/**
 * Smart Coach — Safety Validator
 * 
 * Every coach line MUST pass through this before display/speech.
 * Incorporates:
 * - Speech Gate rules (promise ban, vague filler, patronizing)
 * - Purpose validator (blocks purposeless generic chat)
 * - Empty praise ban (requires task-specific detail)
 * - SCA compliance checks
 */

import type { ValidationResult } from './types';

// ── Banned phrases ───────────────────────────────────────────

const BANNED_PATTERNS = [
  /let me show you/i,
  /i'?ll show you/i,
  /let me pull up/i,
  /check this out/i,
  /let me try something/i,
  /what were you (saying|telling me)/i,
  /you were saying/i,
  /as an ai/i,
  /i'?m (just )?a(n)? (ai|program|bot|language model)/i,
  /i can'?t actually/i,
  /i don'?t have (access|feelings|a body)/i,
  /have a look at this/i,
  /here['—–-]\s*(have a|take a) look/i,
];

// ── Vague filler (bare, with no topic anchor) ────────────────

const VAGUE_FILLER = [
  /^keep going\.?$/i,
  /^go on\.?$/i,
  /^continue\.?$/i,
  /^go ahead\.?$/i,
  /^tell me more\.?$/i,
  /^and\??$/i,
  /^okay\.?$/i,
  /^mm-?hmm\.?$/i,
];

// ── Patronizing / baby-talk ──────────────────────────────────

const PATRONIZING = [
  /good (boy|girl)/i,
  /that'?s (so )?wonderful,? (dear|honey|sweetie)/i,
  /aren'?t you (clever|smart)/i,
  /you'?re doing amazing,? sweetie/i,
];

// ── Empty praise (identity-focused without task detail) ──────

const EMPTY_PRAISE = [
  /^good job\.?!?$/i,
  /^great job\.?!?$/i,
  /^nice work\.?!?$/i,
  /^wonderful\.?!?$/i,
  /^excellent\.?!?$/i,
  /^amazing\.?!?$/i,
  /^perfect\.?!?$/i,
  /^you should feel proud\.?!?$/i,
  /^well done\.?!?$/i,
  /^you'?re (so )?(great|amazing|wonderful)\.?!?$/i,
  /^that'?s (great|wonderful|amazing|excellent)\.?!?$/i,
];

// ── Off-topic yes/no questions ───────────────────────────────

const OFF_TOPIC_PATTERNS = [
  /is it cold outside/i,
  /did you sleep well/i,
  /did you have coffee/i,
  /did you eat breakfast/i,
  /did you go outside/i,
  /did you watch tv/i,
  /is it morning right now/i,
  /are you sitting down/i,
  /is someone else in the room/i,
  /is the tv on/i,
  /do you have water nearby/i,
  /do you like (coffee|music|sunny|dogs|ice cream|flowers)/i,
  /how was your morning/i,
  /what did you do today/i,
];

// ── Re-ask patterns ─────────────────────────────────────────

const RE_ASK_PATTERNS = [
  /what was that again/i,
  /remind me what/i,
  /what did you say it was/i,
  /tell me again/i,
  /what was it called/i,
  /what were we talking about/i,
];

export interface ValidateOptions {
  userCorrectionActive?: boolean;
}

export function validateCoachLine(
  line: string,
  topic: string,
  establishedFacts: string[] = [],
  options: ValidateOptions = {}
): ValidationResult {
  const reasons: string[] = [];
  const trimmed = line.trim();

  // Empty
  if (!trimmed) {
    reasons.push('empty');
  }

  // Too long (>30 words)
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 30) {
    reasons.push('too_long');
  }

  // Banned phrases
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(trimmed)) {
      reasons.push(`banned_phrase: ${pattern.source}`);
    }
  }

  // Vague filler
  for (const pattern of VAGUE_FILLER) {
    if (pattern.test(trimmed)) {
      reasons.push('vague_filler');
    }
  }

  // Patronizing
  for (const pattern of PATRONIZING) {
    if (pattern.test(trimmed)) {
      reasons.push('patronizing');
    }
  }

  // Empty praise (identity-focused without specifics)
  for (const pattern of EMPTY_PRAISE) {
    if (pattern.test(trimmed)) {
      reasons.push('empty_praise');
    }
  }

  // Off-topic yes/no questions when we have an active topic
  if (topic) {
    for (const pattern of OFF_TOPIC_PATTERNS) {
      if (pattern.test(trimmed)) {
        reasons.push('off_topic_question');
      }
    }
  }

  // Correction priority
  if (options.userCorrectionActive && topic) {
    if (!trimmed.toLowerCase().includes(topic.toLowerCase())) {
      reasons.push('correction_ignored');
    }
  }

  // Re-asking via generic patterns
  for (const pattern of RE_ASK_PATTERNS) {
    if (pattern.test(trimmed)) {
      reasons.push('re_ask_pattern');
    }
  }

  // Re-asking established facts
  for (const fact of establishedFacts) {
    if (!fact) continue;
    const factWords = fact.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const lineWords = trimmed.toLowerCase().split(/\s+/);
    const overlap = factWords.filter(fw => lineWords.some(lw => lw.includes(fw) || fw.includes(lw)));
    if (overlap.length >= Math.max(2, factWords.length * 0.5) && trimmed.includes('?')) {
      reasons.push(`re_asking_fact: ${fact}`);
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}
