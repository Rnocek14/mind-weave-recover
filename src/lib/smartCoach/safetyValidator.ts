/**
 * Smart Coach — Safety Validator
 * 
 * Every coach line MUST pass through this before display/speech.
 * Rejects broken, off-topic, or trust-damaging lines.
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

export function validateCoachLine(
  line: string,
  topic: string,
  establishedFacts: string[] = []
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

  // Re-asking established facts
  for (const fact of establishedFacts) {
    if (fact && trimmed.toLowerCase().includes(fact.toLowerCase())) {
      // Check if it's a question about the fact
      if (trimmed.includes('?')) {
        reasons.push(`re_asking_fact: ${fact}`);
      }
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}
