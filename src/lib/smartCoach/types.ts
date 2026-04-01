/**
 * Smart Coach — Core Types
 * 
 * Isolated conversation therapy system.
 * Separate from the daily session engine.
 */

// ─── Coach Modes ─────────────────────────────────────────────

export type CoachMode =
  | 'warmup'
  | 'expand'
  | 'scaffold'
  | 'support'
  | 'wrapup';

// ─── Target Skills ───────────────────────────────────────────

export type TargetSkill =
  | 'word_finding'
  | 'sentence_expansion'
  | 'semantic_precision'
  | 'fluency';

// ─── Cue Types ───────────────────────────────────────────────

export type CueType =
  | 'semantic_hint'
  | 'phonemic_hint'
  | 'forced_choice'
  | 'sentence_starter'
  | 'reassurance'
  | 'expansion_prompt';

// ─── Coach State ─────────────────────────────────────────────

export interface CoachState {
  topic: string;
  subtopic?: string;
  mode: CoachMode;
  supportLevel: 0 | 1 | 2 | 3;
  turnCount: number;
  lastUserUtterance?: string;
  lastCoachUtterance?: string;
  isStuck: boolean;
  frustrationRisk: 'low' | 'medium' | 'high';
  targetSkill?: TargetSkill;
  /** Keywords that keep the conversation anchored */
  topicKeywords: string[];
  /** Facts already established — don't re-ask */
  establishedFacts: string[];
}

// ─── Utterance Analysis ──────────────────────────────────────

export interface CoachUtteranceAnalysis {
  transcript: string;
  wordCount: number;
  onTopic: boolean;
  semanticMatch: number; // 0–1
  phonologicalApprox: boolean;
  circumlocution: boolean;
  incompleteThought: boolean;
  pauseDetected: boolean;
  hesitationDetected: boolean;
  confidence: number; // 0–1
  likelyErrorType:
    | 'none'
    | 'semantic'
    | 'phonological'
    | 'circumlocution'
    | 'off_topic'
    | 'hesitation'
    | 'incomplete';
}

// ─── Cue Decision ────────────────────────────────────────────

export interface CueDecision {
  cueType: CueType;
  rationale: string;
}

// ─── Validation ──────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  reasons: string[];
}

// ─── Turn Log ────────────────────────────────────────────────

export interface CoachTurnLog {
  topic: string;
  mode: CoachMode;
  supportLevel: number;
  userUtterance: string;
  analysis: CoachUtteranceAnalysis;
  cueDecision: CueDecision;
  coachLine: string;
  validationPassed: boolean;
  usedFallback: boolean;
  timestamp: string;
}

// ─── Turn Result ─────────────────────────────────────────────

export interface CoachTurnResult {
  nextState: CoachState;
  output: string;
  analysis: CoachUtteranceAnalysis;
  cueDecision: CueDecision;
  validation: ValidationResult;
  usedFallback: boolean;
  /** Debug: the prompt sent to the model */
  debugPrompt?: string;
  /** Debug: raw model output before validation/post-processing */
  debugRawOutput?: string;
}
