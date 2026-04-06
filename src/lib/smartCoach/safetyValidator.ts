/**
 * Smart Coach — Safety Validator
 * 
 * Every coach line MUST pass through this before display/speech.
 * Incorporates:
 * - Speech Gate rules (promise ban, vague filler, patronizing)
 * - Purpose validator (blocks purposeless generic chat)
 * - Empty praise ban (requires task-specific detail)
 * - SCA compliance checks
 * - Topic anchor enforcement
 * - Generic question blocker
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
  /^interesting\.?!?$/i,
  /^cool\.?!?$/i,
  /^nice\.?!?$/i,
];

// ── Unanchored follow-ups (vague questions without topic reference) ──

const UNANCHORED_FOLLOWUPS = [
  /^(so,?\s+)?what else\??$/i,
  /^what about you\??$/i,
  /^anything else\??$/i,
  /^what do you think\??$/i,
  /^how do you feel about that\??$/i,
  /^how did that make you feel\??$/i,
  /^what happened then\??$/i,
  /^and then what\??$/i,
  /^tell me more about that\.?$/i,
  /^what was that like\??$/i,
];

// ── Generic questions (questions with no topic anchor) ────────

const GENERIC_QUESTION_PATTERNS = [
  /^what'?s your favorite\s*\?$/i,
  /^do you like it\??$/i,
  /^is that right\??$/i,
  /^do you enjoy that\??$/i,
  /^what do you usually do\??$/i,
  /^how about you\??$/i,
  /^what do you like\??$/i,
  /^what'?s that like\??$/i,
  /^how was it\??$/i,
  /^was it good\??$/i,
  /^did you like it\??$/i,
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

// ── Praise-without-specificity (catches "Great!" at start of longer lines) ──
const PRAISE_STARTERS = /^(great|excellent|perfect|amazing|wonderful|good job|nice|well done|fantastic|brilliant)[.!,]?\s/i;
const TASK_REFERENCE_PATTERNS = [
  /you (said|found|used|named|retrieved|described|built|completed|got|picked)/i,
  /that word/i,
  /the (first sound|category|sentence|phrase)/i,
  /without (a cue|help|hints)/i,
  /on your own/i,
  /faster/i,
  /clearly/i,
  /that retrieval/i,
  /word.?finding/i,
  /"[^"]+"/i, // quoted word reference counts as specific
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
  /** The user's last utterance — used for anchor checking */
  lastUserUtterance?: string;
  /** Topic keywords for anchor verification */
  topicKeywords?: string[];
}

/**
 * Check if response contains at least one anchor to user context.
 * An anchor is: a user word, a topic keyword, or a quoted reference.
 */
function hasContextAnchor(
  line: string,
  topic: string,
  lastUserUtterance?: string,
  topicKeywords?: string[]
): boolean {
  const lineLower = line.toLowerCase();

  // Topic name anchor
  if (topic && lineLower.includes(topic.toLowerCase())) return true;

  // Topic keyword anchor
  if (topicKeywords?.some(kw => kw.length > 2 && lineLower.includes(kw.toLowerCase()))) return true;

  // User word anchor (check if response references any substantive user word)
  if (lastUserUtterance) {
    const stopwords = new Set(['i', 'a', 'an', 'the', 'is', 'was', 'it', 'my', 'me', 'do', 'to', 'in', 'on', 'at', 'of', 'um', 'uh', 'er', 'like', 'and', 'or', 'but', 'so', 'just', 'that', 'this', 'for', 'with', 'not', 'no', 'yes', 'yeah', 'have', 'had', 'got', 'get', 'can', 'did', 'you', 'we', 'he', 'she', 'they']);
    const userWords = lastUserUtterance.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopwords.has(w));
    if (userWords.some(w => lineLower.includes(w))) return true;
  }

  // Quoted reference anchor (e.g., "spaghetti")
  if (/["'][^"']+["']/.test(line)) return true;

  return false;
}

/**
 * Detect if the response is a question with no anchor to any context.
 * Only flags questions (lines ending in ?) that have zero connection to
 * the topic, user words, or conversation context.
 */
function isUnanchoredQuestion(
  line: string,
  topic: string,
  lastUserUtterance?: string,
  topicKeywords?: string[]
): boolean {
  if (!line.trim().endsWith('?')) return false;
  
  // If it has any context anchor, it's fine
  if (hasContextAnchor(line, topic, lastUserUtterance, topicKeywords)) return false;

  // Mode-instruction phrases are anchored by design (sentence starters, choices)
  if (/is it \w+ or \w+/i.test(line)) return false; // forced choice
  if (/start with/i.test(line)) return false; // sentence starter
  if (/try:/i.test(line)) return false; // scaffold

  return true;
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

  // Unanchored follow-ups
  for (const pattern of UNANCHORED_FOLLOWUPS) {
    if (pattern.test(trimmed)) {
      reasons.push('unanchored_followup');
    }
  }

  // Generic questions
  for (const pattern of GENERIC_QUESTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      reasons.push('generic_question');
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

  // Praise-without-specificity: starts with praise word but has no task reference
  if (PRAISE_STARTERS.test(trimmed)) {
    const hasTaskRef = TASK_REFERENCE_PATTERNS.some(p => p.test(trimmed));
    if (!hasTaskRef) {
      reasons.push('praise_without_specificity');
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

  // Unanchored question check — only flag questions with zero context connection
  if (topic && isUnanchoredQuestion(trimmed, topic, options.lastUserUtterance, options.topicKeywords)) {
    reasons.push('unanchored_question');
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
