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

export function analyzeUtterance(
  transcript: string,
  topic: string,
  topicKeywords: string[]
): CoachUtteranceAnalysis {
  const cleaned = transcript.trim().toLowerCase();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Topic relevance — keyword overlap
  const topicLower = topic.toLowerCase();
  const hasTopicOverlap = topicKeywords.some(kw => cleaned.includes(kw)) || cleaned.includes(topicLower);
  const onTopic = hasTopicOverlap || wordCount <= 2; // Very short answers are assumed on-topic

  // Semantic match — rough heuristic (keyword density)
  const matchingKeywords = topicKeywords.filter(kw => cleaned.includes(kw));
  const semanticMatch = topicKeywords.length > 0
    ? Math.min(1, matchingKeywords.length / Math.max(1, Math.min(topicKeywords.length, 3)))
    : 0.5;

  // Hesitation / pauses
  const filledPauses = (cleaned.match(FILLED_PAUSES) || []).length;
  const hesitationDetected = filledPauses >= 2 || (wordCount <= 3 && filledPauses >= 1);

  // Pause detection — true silence only (no words at all)
  const pauseDetected = wordCount === 0;

  // Circumlocution
  const circumlocution = CIRCUMLOCUTION_MARKERS.test(cleaned);

  // Incomplete thought — ends mid-sentence with trailing "..." or no final punct
  const trailingOff = transcript.trimEnd().endsWith('...');
  // Strip trailing dots for punct check (so "..." doesn't count as ending with ".")
  const cleanedNoDots = cleaned.replace(/\.{2,}/g, '');
  const incompleteThought = wordCount >= 2 && wordCount <= 8 &&
    !cleanedNoDots.endsWith('.') && !cleanedNoDots.endsWith('!') && !cleanedNoDots.endsWith('?') &&
    (trailingOff || hesitationDetected);

  // Phonological approximation — single real word (not a filler) that doesn't match topic
  const isFillerOnly = /^(um+|uh+|er+|ah+|hmm+)\.{0,3}$/i.test(cleaned);
  const phonologicalApprox = wordCount === 1 && !hasTopicOverlap && cleaned.length >= 3 && !isFillerOnly;

  // Error type classification
  let likelyErrorType: CoachUtteranceAnalysis['likelyErrorType'] = 'none';
  if (wordCount === 0) {
    likelyErrorType = 'hesitation';
  } else if (circumlocution) {
    likelyErrorType = 'circumlocution';
  } else if (phonologicalApprox) {
    likelyErrorType = 'phonological';
  } else if (incompleteThought) {
    likelyErrorType = 'incomplete';
  } else if (hesitationDetected) {
    likelyErrorType = 'hesitation';
  } else if (!onTopic && wordCount >= 3) {
    likelyErrorType = 'off_topic';
  }

  // Confidence
  const confidence = wordCount === 0 ? 0
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
    confidence,
    likelyErrorType,
  };
}
