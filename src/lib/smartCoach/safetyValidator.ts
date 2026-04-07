/**
 * Smart Coach — Safety Validator (v2: Loosened)
 * 
 * REDESIGN: Reduced from ~15 rejection categories to ~8.
 * Removed: unanchored_question (too aggressive), praise_without_specificity
 * (killed good responses), re_asking_fact (too many false positives).
 * 
 * Kept: hard safety (banned phrases, patronizing, AI identity),
 * content quality (empty, too long, vague filler).
 */

import type { ValidationResult } from './types';

// ── Hard safety — things that should NEVER appear ────────────

const BANNED_PATTERNS = [
  /let me show you/i,
  /i'?ll show you/i,
  /let me pull up/i,
  /check this out/i,
  /let me try something/i,
  /as an ai/i,
  /i'?m (just )?a(n)? (ai|program|bot|language model)/i,
  /i can'?t actually/i,
  /i don'?t have (access|feelings|a body)/i,
  /have a look at this/i,
];

// ── Bare vague filler (complete response is just filler) ─────

const VAGUE_FILLER = [
  /^keep going\.?$/i,
  /^go on\.?$/i,
  /^continue\.?$/i,
  /^go ahead\.?$/i,
  /^tell me more\.?$/i,
  /^and\??$/i,
  /^okay\.?$/i,
  /^mm-?hmm\.?$/i,
  /^interesting\.?!?$/i,
  /^cool\.?!?$/i,
  /^nice\.?!?$/i,
];

// ── Patronizing / baby-talk ──────────────────────────────────

const PATRONIZING = [
  /good (boy|girl)/i,
  /that'?s (so )?wonderful,? (dear|honey|sweetie)/i,
  /aren'?t you (clever|smart)/i,
  /you'?re doing amazing,? sweetie/i,
];

// ── Empty praise (standalone praise with zero content) ───────

const EMPTY_PRAISE = [
  /^good job\.?!?$/i,
  /^great job\.?!?$/i,
  /^nice work\.?!?$/i,
  /^wonderful\.?!?$/i,
  /^excellent\.?!?$/i,
  /^amazing\.?!?$/i,
  /^perfect\.?!?$/i,
  /^well done\.?!?$/i,
  /^you'?re (so )?(great|amazing|wonderful)\.?!?$/i,
  /^that'?s (great|wonderful|amazing|excellent)\.?!?$/i,
];

// ── Off-topic questions that ignore the session topic ─────────

const OFF_TOPIC_PATTERNS = [
  /is it cold outside/i,
  /did you sleep well/i,
  /did you have coffee/i,
  /how was your morning/i,
  /what did you do today/i,
];

// ── Re-ask / memory-loss patterns ────────────────────────────

const RE_ASK_PATTERNS = [
  /what was that again/i,
  /remind me what/i,
  /what did you say it was/i,
  /tell me again/i,
  /what were we talking about/i,
];

export interface ValidateOptions {
  userCorrectionActive?: boolean;
  lastUserUtterance?: string;
  topicKeywords?: string[];
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

  // Too long (raised from 30 → 40 words to stop killing natural responses)
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 40) {
    reasons.push('too_long');
  }

  // Hard safety: banned phrases
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(trimmed)) {
      reasons.push(`banned_phrase: ${pattern.source}`);
      break; // one is enough
    }
  }

  // Bare vague filler (entire response is filler)
  for (const pattern of VAGUE_FILLER) {
    if (pattern.test(trimmed)) {
      reasons.push('vague_filler');
      break;
    }
  }

  // Patronizing
  for (const pattern of PATRONIZING) {
    if (pattern.test(trimmed)) {
      reasons.push('patronizing');
      break;
    }
  }

  // Empty praise (standalone, no content)
  for (const pattern of EMPTY_PRAISE) {
    if (pattern.test(trimmed)) {
      reasons.push('empty_praise');
      break;
    }
  }

  // Off-topic questions
  if (topic) {
    for (const pattern of OFF_TOPIC_PATTERNS) {
      if (pattern.test(trimmed)) {
        reasons.push('off_topic_question');
        break;
      }
    }
  }

  // Re-asking patterns
  for (const pattern of RE_ASK_PATTERNS) {
    if (pattern.test(trimmed)) {
      reasons.push('re_ask_pattern');
      break;
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}
