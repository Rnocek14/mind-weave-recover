/**
 * Unified Utterance Analysis Schema
 * 
 * This interface defines the canonical structure for speech analysis across:
 * - Photo naming games
 * - Phrase practice
 * - Sentence construction
 * - Future Shadow Mode / co-pilot
 * 
 * Based on clinical linguistics research + aphasia rehabilitation best practices
 */

/**
 * Extended error classification types
 * Aligned with WAB-inspired clinical assessment
 */
export type ExtendedErrorType =
  | 'correct'
  | 'self_corrected'
  | 'attempted'              // Phonological approximation (35-60% similarity)
  | 'circumlocution'         // Multi-word description showing semantic understanding
  | 'phonemic_paraphasia'    // Sound-based error (60-80% similarity)
  | 'semantic_paraphasia'    // Semantically related word
  | 'neologism'              // Non-word or very low similarity
  | 'unrelated'              // No apparent relationship
  | 'no_response'
  | 'timeout'
  | 'uncertain';             // ASR confidence too low to judge - prompt retry

/**
 * Encouragement level for UI display
 */
export type EncouragementLevel = 'excellent' | 'good' | 'fair' | 'keep-trying';

/**
 * Core utterance analysis result
 * Captures meaning, phonology, fluency, and feedback dimensions
 */
export interface UtteranceAnalysis {
  // ===== Raw Speech / ASR =====
  transcript: string;
  asrConfidence?: number;          // 0-1, from Whisper or other ASR

  // ===== Meaning / Semantics =====
  errorType: ExtendedErrorType;
  meaningAccuracy?: number;         // 0-1, how well concept was conveyed
  semanticSimilarity?: number;      // 0-1, optional embeddings-based
  circumlocutionDetected?: boolean; // Multi-word description flag

  // ===== Phonology =====
  phonologicalSimilarity?: number;  // 0-1, current: char-level Levenshtein
  phonemeAccuracy?: number;         // 0-1, pseudo-phoneme sequence comparison
  phonemeErrors?: PhonemeError[];   // future: detailed phoneme-level breakdown

  // ===== Fluency / Acoustic =====
  speechRateWpm?: number;
  pauseCount?: number;
  avgPauseDurationMs?: number;
  totalDurationMs?: number;
  effortfulSpeech?: boolean;        // Derived flag: slow rate OR long pauses OR many pauses

  // ===== Azure Pronunciation Assessment =====
  pronunciationScore?: number;       // 0-100, overall pronunciation quality
  accuracyScore?: number;            // 0-100, phoneme-level accuracy
  fluencyScore?: number;             // 0-100, speech flow and rhythm
  completenessScore?: number;        // 0-100, how much of the target was spoken
  prosodyScore?: number;             // 0-100, intonation and stress patterns

  // ===== Scoring / Feedback =====
  encouragementScore: number;        // 0-100, WAB-inspired partial credit
  encouragementLevel?: EncouragementLevel; // excellent/good/fair/keep-trying

  // ===== Meta / Review =====
  reasoning?: string;                // Short classifier explanation
  needsReview?: boolean;             // Flag for clinician review
  classificationConfidence?: number; // 0-1, confidence in errorType classification
}

/**
 * Future: detailed phoneme-level error breakdown
 */
export interface PhonemeError {
  position: number;
  expected: string;
  actual: string;
  errorType: 'substitution' | 'deletion' | 'addition' | 'distortion';
}

/**
 * Context for where/how the utterance occurred
 */
export interface UtteranceContext {
  taskType: 'photo_naming' | 'phrase_practice' | 'sentence_construction' | 'conversation' | 'other';
  domain?: 'meds' | 'food' | 'bathroom' | 'people' | 'places' | 'activities' | 'general';
  environment?: 'home_quiet' | 'home_noisy' | 'public' | 'clinic' | 'unknown';
  interactionMode?: 'independent' | 'caregiver_assisted';
  difficultyLevel?: number;
  cueLevel?: number;
  
  // Task-specific
  targetWord?: string;         // For naming tasks
  targetPhrase?: string;       // For phrase practice
  targetIntent?: string;       // Future: for routines/shadow mode
  category?: string;           // Semantic category (tools, food, etc)
}

/**
 * Shadow Event: wrapper for logging utterances in real-world contexts
 * 
 * This is the data structure for Shadow Mode / co-pilot research:
 * - Games log ShadowEvents with known targets
 * - Future: real conversations log ShadowEvents with inferred targets
 * - Clinician/caregiver reviews can mark systemGuess accuracy
 */
export interface ShadowEvent {
  id?: string;
  userId: string;
  sessionId?: string;
  createdAt: string;

  // Context
  context: UtteranceContext;

  // Analysis
  analysis: UtteranceAnalysis;

  // Co-pilot / Shadow Mode fields (future)
  systemGuess?: string;             // What the model would have suggested
  systemGuessConfidence?: number;   // 0-1
  systemGuessWasCorrect?: boolean;  // Filled by caregiver/SLP review
  systemAction?: 'silent' | 'observe' | 'cue' | 'suggest';

  // Audio
  audioStoragePath?: string;
  audioMimeType?: string;
  recordingDurationMs?: number;
}

/**
 * Helper to convert legacy error classification to UtteranceAnalysis
 */
export function toUtteranceAnalysis(
  transcript: string,
  errorClassification: any,
  encouragementScore: number,
  acousticMetrics?: any
): UtteranceAnalysis {
  const utteranceAnalysis: UtteranceAnalysis = {
    transcript,
    asrConfidence: errorClassification.confidence,
    errorType: errorClassification.errorType,
    meaningAccuracy: errorClassification.meaningAccuracy,
    semanticSimilarity: errorClassification.semantic_similarity,
    circumlocutionDetected: errorClassification.circumlocutionDetected,
    phonologicalSimilarity: errorClassification.phonological_similarity,
    phonemeAccuracy: errorClassification.phonemeAccuracy,
    speechRateWpm: acousticMetrics?.speechRateWpm,
    pauseCount: acousticMetrics?.pauseCount,
    avgPauseDurationMs: acousticMetrics?.avgPauseDurationMs,
    totalDurationMs: acousticMetrics?.totalDurationMs,
    effortfulSpeech: errorClassification.fluencyMetrics?.effortfulSpeech,
    encouragementScore,
    reasoning: errorClassification.reasoning,
    needsReview: errorClassification.needs_review,
    classificationConfidence: errorClassification.confidence,
  };
  
  return utteranceAnalysis;
}

/**
 * Helper to build ShadowEvent from game trial
 */
export function buildShadowEvent(
  userId: string,
  sessionId: string | null,
  context: UtteranceContext,
  analysis: UtteranceAnalysis,
  audioData?: {
    storagePath?: string;
    mimeType?: string;
    durationMs?: number;
  }
): ShadowEvent {
  return {
    userId,
    sessionId: sessionId || undefined,
    createdAt: new Date().toISOString(),
    context,
    analysis,
    audioStoragePath: audioData?.storagePath,
    audioMimeType: audioData?.mimeType,
    recordingDurationMs: audioData?.durationMs,
  };
}
