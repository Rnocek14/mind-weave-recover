/**
 * Universal Response Validation Pipeline
 * 
 * Shared pre-scoring layer for all speech exercises.
 * Ensures invalid responses (fillers, instruction echoes, empty input)
 * never reach embeddings or exercise-specific scoring.
 * 
 * Flow: normalize → filler check → instruction echo → content richness → pass/reject
 */

import { normalizeASROutput, getContentWordCount, extractAnswerFromTranscript } from '@/lib/speechNormalizer';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type ResponseMode =
  | 'naming'
  | 'description'
  | 'category_list'
  | 'synonym'
  | 'semantic_compare'
  | 'sentence_fix'
  | 'retell'
  | 'phrase_repeat'
  | 'comprehension_choice';

export type RejectionReason =
  | 'empty'
  | 'filler'
  | 'instruction_echo'
  | 'prompt_repeat'
  | 'too_short'
  | 'non_answer';

export interface ValidationResult {
  valid: boolean;
  rejectionReason: RejectionReason | null;
  cleanedTranscript: string;
  answerOnlyText: string;
  contentWordCount: number;
  instructionEchoScore: number;
  confidence: number;
  matchedInstructionPhrases: string[];
}

export interface ValidateOptions {
  transcript: string;
  /** The exercise prompt text shown to the user (optional, for prompt-repeat detection) */
  promptText?: string;
  /** Extra instruction phrases specific to this exercise */
  instructionPhrases?: string[];
  /** Exercise response mode — determines content richness thresholds */
  expectedMode?: ResponseMode;
}

// ═══════════════════════════════════════════════════════════════
// Instruction phrase bank (shared across all exercises)
// ═══════════════════════════════════════════════════════════════

const UNIVERSAL_INSTRUCTION_PHRASES = [
  'describe what you see',
  'tell me about it',
  'describe it',
  'what do you see',
  'tell me what you see',
  'describe what i see',
  'describe the picture',
  'what is it',
  'what is this',
  'say the word',
  'say it',
  'name this',
  'name it',
  'what is the word',
  'fix the sentence',
  'finish the thought',
  'tell me the answer',
  'tell it back',
  'say what you see',
  'repeat after me',
  'can you repeat that',
  'what was it',
  'i need to describe',
  'i need to say',
  'let me think',
  'give me a second',
  'hold on',
];

// Pure filler / non-answer phrases
const NON_ANSWER_PHRASES = [
  'i dont know',
  'i don\'t know',
  'not sure',
  'no idea',
  'i forgot',
  'i forget',
  'i cant remember',
  'i can\'t remember',
  'pass',
  'skip',
  'next',
  'i give up',
];

// ═══════════════════════════════════════════════════════════════
// Mode-specific content thresholds
// ═══════════════════════════════════════════════════════════════

interface ModeConfig {
  minContentWords: number;
  allowSingleWord: boolean;
}

const MODE_CONFIGS: Record<ResponseMode, ModeConfig> = {
  naming:               { minContentWords: 1, allowSingleWord: true },
  description:          { minContentWords: 2, allowSingleWord: false },
  category_list:        { minContentWords: 1, allowSingleWord: true },
  synonym:              { minContentWords: 1, allowSingleWord: true },
  semantic_compare:     { minContentWords: 2, allowSingleWord: false },
  sentence_fix:         { minContentWords: 1, allowSingleWord: true },
  retell:               { minContentWords: 3, allowSingleWord: false },
  phrase_repeat:        { minContentWords: 1, allowSingleWord: true },
  comprehension_choice: { minContentWords: 1, allowSingleWord: true },
  // Finish-the-thought: ANY real content word is a legitimate completion
  // (e.g. "milk", "to school"). Never reject these as too_short.
  thought_continuation: { minContentWords: 1, allowSingleWord: true },
};

// ═══════════════════════════════════════════════════════════════
// Instruction echo detection (dominance-based, not exact-match)
// ═══════════════════════════════════════════════════════════════

interface EchoResult {
  isEchoDominant: boolean;
  matchedPhrases: string[];
  instructionTokenRatio: number;
  answerAfterStrip: string;
}

function detectInstructionEcho(
  normalizedText: string,
  extraPhrases: string[] = [],
): EchoResult {
  const lower = normalizedText.toLowerCase().replace(/[^a-z\s']/g, ' ').replace(/\s+/g, ' ').trim();

  if (!lower) {
    return { isEchoDominant: false, matchedPhrases: [], instructionTokenRatio: 0, answerAfterStrip: '' };
  }

  const allPhrases = [...UNIVERSAL_INSTRUCTION_PHRASES, ...extraPhrases];
  const matchedPhrases: string[] = [];
  let stripped = lower;

  // Sort phrases longest-first so we strip the most specific match first
  const sorted = [...allPhrases].sort((a, b) => b.length - a.length);

  for (const phrase of sorted) {
    const phraseLower = phrase.toLowerCase();
    if (stripped.includes(phraseLower)) {
      matchedPhrases.push(phrase);
      stripped = stripped.replace(phraseLower, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  if (matchedPhrases.length === 0) {
    return { isEchoDominant: false, matchedPhrases: [], instructionTokenRatio: 0, answerAfterStrip: lower };
  }

  // Count remaining content words after stripping instruction phrases
  const remainingWords = stripped.split(/\s+/).filter(w => w.length > 1);
  const totalWords = lower.split(/\s+/).filter(w => w.length > 1).length;
  const instructionTokenRatio = totalWords > 0 ? 1 - (remainingWords.length / totalWords) : 1;

  // Echo is dominant if there's NO meaningful content remaining after stripping instructions
  const isPureInstruction = remainingWords.length === 0;

  return {
    isEchoDominant: isPureInstruction,
    matchedPhrases,
    instructionTokenRatio,
    answerAfterStrip: stripped,
  };
}

// ═══════════════════════════════════════════════════════════════
// Non-answer detection
// ═══════════════════════════════════════════════════════════════

function isNonAnswer(normalizedText: string): boolean {
  const lower = normalizedText.toLowerCase().replace(/[^a-z\s']/g, ' ').replace(/\s+/g, ' ').trim();
  return NON_ANSWER_PHRASES.some(p => lower === p || lower.startsWith(p + ' ') || lower.endsWith(' ' + p));
}

// ═══════════════════════════════════════════════════════════════
// Prompt repetition detection
// ═══════════════════════════════════════════════════════════════

function isPromptRepeat(normalizedText: string, promptText?: string): boolean {
  if (!promptText) return false;
  const cleanPrompt = promptText.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  const cleanInput = normalizedText.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  if (!cleanPrompt || !cleanInput) return false;

  // Check if user repeated the prompt verbatim (or near-verbatim)
  // Must match ≥90% of tokens AND not have added/changed meaningful words
  const promptTokens = cleanPrompt.split(' ');
  const inputTokens = cleanInput.split(' ');
  
  // Exact or near-exact match only
  if (cleanInput === cleanPrompt) return true;
  
  // Token-level: every input token must appear in prompt, and lengths must be very close
  const promptSet = new Set(promptTokens);
  const overlapCount = inputTokens.filter(t => promptSet.has(t)).length;
  const overlapRatio = inputTokens.length > 0 ? overlapCount / inputTokens.length : 0;

  // ASR often mutates a repeated prompt by one letter ("talk" → "talkl").
  // Treat near-token repeats as prompt repeats so self-captured TTS cannot pass.
  const editDistanceOne = (a: string, b: string) => {
    if (Math.abs(a.length - b.length) > 1) return false;
    if (a === b) return true;
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      edits++;
      if (edits > 1) return false;
      if (a.length > b.length) i++;
      else if (b.length > a.length) j++;
      else { i++; j++; }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
  };

  const promptTokensUnused = [...promptTokens];
  const fuzzyOverlapCount = inputTokens.filter((token) => {
    const matchIndex = promptTokensUnused.findIndex((promptToken) => editDistanceOne(token, promptToken));
    if (matchIndex === -1) return false;
    promptTokensUnused.splice(matchIndex, 1);
    return true;
  }).length;
  const fuzzyOverlapRatio = inputTokens.length > 0 ? fuzzyOverlapCount / inputTokens.length : 0;

  return (overlapRatio >= 0.95 || fuzzyOverlapRatio >= 0.9) && Math.abs(inputTokens.length - promptTokens.length) <= 1;
}

// ═══════════════════════════════════════════════════════════════
// Main validation function
// ═══════════════════════════════════════════════════════════════

export function validateSpokenResponse(opts: ValidateOptions): ValidationResult {
  const { transcript, promptText, instructionPhrases = [], expectedMode = 'naming' } = opts;
  const modeConfig = MODE_CONFIGS[expectedMode];

  // 1. Normalize
  const cleanedTranscript = normalizeASROutput(transcript);
  const answerOnly = extractAnswerFromTranscript(transcript);
  const contentWords = getContentWordCount(cleanedTranscript);

  const base: Omit<ValidationResult, 'valid' | 'rejectionReason' | 'confidence' | 'instructionEchoScore' | 'matchedInstructionPhrases'> = {
    cleanedTranscript,
    answerOnlyText: answerOnly,
    contentWordCount: contentWords,
  };

  // 2. Empty check
  if (!cleanedTranscript || cleanedTranscript.length === 0) {
    console.log('[ResponseValidation] REJECT: empty', { transcript });
    return { ...base, valid: false, rejectionReason: 'empty', confidence: 0, instructionEchoScore: 0, matchedInstructionPhrases: [] };
  }

  // 3. Filler-only check
  if (contentWords === 0 || (answerOnly.length < 2 && contentWords <= 1)) {
    console.log('[ResponseValidation] REJECT: filler', { transcript, cleanedTranscript, answerOnly });
    return { ...base, valid: false, rejectionReason: 'filler', confidence: 0, instructionEchoScore: 0, matchedInstructionPhrases: [] };
  }

  // 4. Non-answer check
  if (isNonAnswer(cleanedTranscript)) {
    console.log('[ResponseValidation] REJECT: non_answer', { transcript, cleanedTranscript });
    return { ...base, valid: false, rejectionReason: 'non_answer', confidence: 0, instructionEchoScore: 0, matchedInstructionPhrases: [] };
  }

  // 5. Instruction echo detection (dominance-based)
  const echo = detectInstructionEcho(cleanedTranscript, instructionPhrases);
  if (echo.isEchoDominant) {
    console.log('[ResponseValidation] REJECT: instruction_echo', { transcript, cleanedTranscript, matchedPhrases: echo.matchedPhrases, answerAfterStrip: echo.answerAfterStrip });
    return { ...base, valid: false, rejectionReason: 'instruction_echo', confidence: 0, instructionEchoScore: echo.instructionTokenRatio, matchedInstructionPhrases: echo.matchedPhrases };
  }

  // 6. Prompt repetition detection
  if (isPromptRepeat(cleanedTranscript, promptText)) {
    console.log('[ResponseValidation] REJECT: prompt_repeat', { transcript, promptText });
    return { ...base, valid: false, rejectionReason: 'prompt_repeat', confidence: 0, instructionEchoScore: 0, matchedInstructionPhrases: [] };
  }

  // 7. Content richness check (mode-aware)
  if (contentWords < modeConfig.minContentWords) {
    // For single-word modes, allow if the answer itself is valid
    if (modeConfig.allowSingleWord && answerOnly.length >= 2) {
      // Pass — single meaningful word is enough for naming/synonym/etc.
    } else {
      console.log('[ResponseValidation] REJECT: too_short', { transcript, contentWords, required: modeConfig.minContentWords, mode: expectedMode });
      return { ...base, valid: false, rejectionReason: 'too_short', confidence: 0.2, instructionEchoScore: echo.instructionTokenRatio, matchedInstructionPhrases: echo.matchedPhrases };
    }
  }

  // 8. Valid — compute confidence
  const confidence = Math.min(1, 0.5 + contentWords * 0.1 + (echo.instructionTokenRatio < 0.3 ? 0.2 : 0));

  console.log('[ResponseValidation] PASS', {
    transcript,
    cleanedTranscript,
    answerOnly,
    contentWords,
    echoRatio: echo.instructionTokenRatio.toFixed(2),
    mode: expectedMode,
    confidence: confidence.toFixed(2),
  });

  return {
    ...base,
    valid: true,
    rejectionReason: null,
    confidence,
    instructionEchoScore: echo.instructionTokenRatio,
    matchedInstructionPhrases: echo.matchedPhrases,
  };
}

/**
 * Map rejection reasons to user-facing coaching messages.
 * Exercises can use these to guide users back to task.
 */
export function getRejectionCoachingText(reason: RejectionReason): string {
  switch (reason) {
    case 'empty':
    case 'filler':
      return "I didn't catch an answer — try again when you're ready.";
    case 'instruction_echo':
      return "Tell me your answer, not the instructions.";
    case 'prompt_repeat':
      return "Try to answer in your own words.";
    case 'too_short':
      return "Can you tell me a little more?";
    case 'non_answer':
      return "That's okay — take your time. Give it a try.";
  }
}
