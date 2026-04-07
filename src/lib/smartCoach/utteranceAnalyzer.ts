/**
 * Smart Coach — Utterance Analyzer
 * 
 * Interprets what the user said and produces structured signals
 * the coach state machine can act on.
 */

import type { CoachUtteranceAnalysis } from './types';

// Filled pause / hesitation markers
const FILLED_PAUSES = /\b(um+|uh+|er+|ah+|hmm+|you know)\b/gi;
const CIRCUMLOCUTION_MARKERS = /\b(the thing|the place|where you|the one that|you use it to|it's like)\b/i;
// Explicit "I don't know" / giving up markers
const SURRENDER_MARKERS = /^(i don'?t know|idk|no idea|i can'?t|nothing|i forget|i forgot|don'?t remember|not sure|i'?m not sure|pass|skip)\.{0,3}$/i;

// User confusion markers — they don't understand Maya's response
const CONFUSION_MARKERS = /\b(what do you mean|what does that mean|i don'?t understand|i don'?t get it|what are you (saying|talking about)|huh\??|confused|that doesn'?t make sense|what\??|i'?m confused|what are you asking)\b/i;

// User correction markers — these should NOT be treated as hesitation or struggle
const CORRECTION_MARKERS = /\b(i didn'?t|you (just )?asked|i (just )?(said|told you|meant)|that'?s not what|no[,.]?\s+(i|you|it|what)|you'?re (not|wrong)|i don'?t put|it comes with|i was saying|you got it wrong|i never said|that'?s wrong|no i wasn'?t|no i wasnt|i wasn'?t|i wasnt)\b/i;

// Disengagement markers — polite withdrawal, NOT hesitation
const DISENGAGEMENT_MARKERS = /^(okay|ok|yep|yup|ya|yeah|yes|sure|thank you|thanks|thank|alright|right|cool|fine|got it|mhm|uh huh|sounds good|i guess|whatever)\.{0,3}$/i;

// Whitelisted valid short answers — these are NOT disengagement when on-topic
const VALID_SHORT_ANSWERS = /^(yes|no|yeah|nah|nope)\.{0,3}$/i;

export function analyzeUtterance(
  transcript: string,
  topic: string,
  topicKeywords: string[]
): CoachUtteranceAnalysis {
  const cleaned = transcript.trim().toLowerCase();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // User correction detection — if user is correcting Maya, this is NOT a struggle
  const isCorrection = CORRECTION_MARKERS.test(cleaned);

  // Disengagement detection — polite fillers with no content
  const isDisengagementPhrase = DISENGAGEMENT_MARKERS.test(cleaned);
  const isValidShortAnswer = VALID_SHORT_ANSWERS.test(cleaned);

  // Topic relevance — keyword overlap
  const topicLower = topic.toLowerCase();
  const hasTopicOverlap = topicKeywords.some(kw => cleaned.includes(kw)) || cleaned.includes(topicLower);
  
  // FIX: Don't blindly mark short responses as on-topic.
  // Only corrections and actual topic-matching words count.
  const onTopic = hasTopicOverlap || isCorrection || (isValidShortAnswer && !isDisengagementPhrase);

  // Semantic match — rough heuristic (keyword density)
  const matchingKeywords = topicKeywords.filter(kw => cleaned.includes(kw));
  const semanticMatch = topicKeywords.length > 0
    ? Math.min(1, matchingKeywords.length / Math.max(1, Math.min(topicKeywords.length, 3)))
    : 0.5;

  // Hesitation / pauses
  const filledPauses = (cleaned.match(FILLED_PAUSES) || []).length;
  const isSurrenderPhrase = SURRENDER_MARKERS.test(cleaned);
  // Don't flag hesitation if user is correcting Maya or just disengaging
  const hesitationDetected = !isCorrection && !isDisengagementPhrase && 
    (isSurrenderPhrase || filledPauses >= 2 || (wordCount <= 3 && filledPauses >= 1));

  // Pause detection — true silence only (no words at all)
  const pauseDetected = wordCount === 0;

  // Circumlocution
  const circumlocution = CIRCUMLOCUTION_MARKERS.test(cleaned);

  // Incomplete thought — ends mid-sentence with trailing "..." or no final punct
  const trailingOff = transcript.trimEnd().endsWith('...');
  const cleanedNoDots = cleaned.replace(/\.{2,}/g, '');
  const incompleteThought = wordCount >= 2 && wordCount <= 8 &&
    !cleanedNoDots.endsWith('.') && !cleanedNoDots.endsWith('!') && !cleanedNoDots.endsWith('?') &&
    (trailingOff || hesitationDetected);

  // Phonological approximation — single real word (not a filler) that doesn't match topic
  const isFillerOnly = /^(um+|uh+|er+|ah+|hmm+)\.{0,3}$/i.test(cleaned);
  const phonologicalApprox = wordCount === 1 && !hasTopicOverlap && cleaned.length >= 3 && !isFillerOnly;

  // Disengagement: polite filler with no semantic content
  const disengagementDetected = isDisengagementPhrase && !isCorrection && !hasTopicOverlap;

  // Error type classification
  let likelyErrorType: CoachUtteranceAnalysis['likelyErrorType'] = 'none';
  if (wordCount === 0) {
    likelyErrorType = 'hesitation';
  } else if (disengagementDetected) {
    likelyErrorType = 'disengagement';
  } else if (isSurrenderPhrase || hesitationDetected) {
    likelyErrorType = 'hesitation';
  } else if (circumlocution) {
    likelyErrorType = 'circumlocution';
  } else if (phonologicalApprox) {
    likelyErrorType = 'phonological';
  } else if (incompleteThought) {
    likelyErrorType = 'incomplete';
  } else if (!onTopic && wordCount >= 3) {
    likelyErrorType = 'off_topic';
  }

  // Confidence
  const confidence = wordCount === 0 ? 0
    : disengagementDetected ? 0.2
    : hesitationDetected ? 0.3
    : incompleteThought ? 0.4
    : circumlocution ? 0.5
    : semanticMatch > 0.5 ? 0.8
    : 0.6;

  return {
    transcript: transcript.trim(),
    wordCount,
    onTopic,
    semanticMatch,
    phonologicalApprox,
    circumlocution,
    incompleteThought,
    pauseDetected,
    hesitationDetected,
    disengagementDetected,
    confidence,
    likelyErrorType,
  };
}
