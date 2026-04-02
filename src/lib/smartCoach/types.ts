/**
 * Smart Coach — Core Types
 * 
 * Purpose-driven clinical therapy engine.
 * Every type supports the north star: visible purpose, structured sessions,
 * adaptive intervention, and measurable progress.
 */

// ─── Coach Modes ─────────────────────────────────────────────

export type CoachMode =
  | 'warmup'
  | 'expand'
  | 'scaffold'
  | 'support'
  | 'wrapup';

// ─── Session Phases ──────────────────────────────────────────

export type SessionPhase =
  | 'orientation'
  | 'readiness'
  | 'warmup'
  | 'conversation'
  | 'drill'
  | 'transfer'
  | 'wrapup'
  | 'home_practice';

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

// ─── Severity & Deficit ─────────────────────────────────────

export type SeverityProfile = 'mild' | 'moderate' | 'severe';
export type PrimaryDeficit = 'expressive' | 'receptive' | 'mixed';

// ─── Purpose Context ─────────────────────────────────────────

export interface PurposeContext {
  goalId: string;
  skillTarget: string;
  transferTarget: string;
  rationale: string;
  measure: string;
  /** What kind of support this topic benefits from */
  supportMode: 'open_conversation' | 'structured_practice' | 'guided_retrieval';
  /** Expected difficulty for this person */
  expectedDifficulty: 'easy' | 'moderate' | 'challenging';
}

// ─── Session Metrics ─────────────────────────────────────────

export interface SessionMetrics {
  wordsProduced: number;
  independentResponses: number;
  cueAssistedCount: number;
  longestResponse: number;
  hesitationCount: number;
  semanticErrorCount: number;
  phonemicErrorCount: number;
  comprehensionBreaks: number;
  strategiesThatHelped: string[];
  /** Rough estimate from turn timing */
  avgLatencyEstimate: number;
}

// ─── Game Trigger Event (Design Only) ────────────────────────

export interface GameTriggerEvent {
  triggerType: 'hesitation_cluster' | 'semantic_error_cluster' | 'phonemic_error_cluster' | 'success_plateau' | 'comprehension_breakdown';
  confidence: number;
  observedPattern: string;
  recommendedGame: string;
  accepted: boolean;
  resultSummary?: string;
}

// ─── Progress Narrative ──────────────────────────────────────

export interface ProgressNarrative {
  lastSessionFocus?: string;
  lastSessionWin?: string;
  todayTarget: string;
  nextStep: string;
}

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
  /** Rolling conversation history for context */
  conversationHistory: { role: 'user' | 'maya'; text: string }[];
  /** Consecutive hesitation count for escalation */
  consecutiveHesitations: number;
  /** Track which expand dimension we're on to avoid loops */
  expandDimension: number;
  /** Purpose context — WHY we're doing this */
  purposeContext: PurposeContext;
  /** Session metrics accumulated during conversation */
  sessionMetrics: SessionMetrics;
  /** Severity profile for interaction format */
  severityProfile: SeverityProfile;
  /** Primary deficit type */
  primaryDeficit: PrimaryDeficit;
  /** Readiness/fatigue level 0-10 (10 = fully energized) */
  readinessLevel: number;
  /** Hesitation clusters tracking (last N turns) */
  recentHesitations: boolean[];
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
