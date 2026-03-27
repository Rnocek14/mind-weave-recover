/**
 * Therapy Strategy Engine
 * 
 * The missing layer between "detect patterns" and "execute behavior."
 * 
 * Pattern detection (patientIntelligence) answers: "What's happening?"
 * Strategy selection answers: "What should we DO about it?"
 * 
 * Each strategy is a named therapeutic approach with explicit behavioral
 * directives: session goal, exercise preferences, cue approach, difficulty
 * bias, pacing rules, and Maya persona guidance.
 * 
 * Input:  PatientIntelligenceProfile + TodayFocus + session signals
 * Output: A single TherapyStrategy that the orchestrator + AI prompt consume
 */

import type { PatientIntelligenceProfile } from './patientIntelligence';
import type { TodayFocus } from './adaptiveDecisionEngine';
import type { SessionIntelligenceSnapshot } from './sessionIntelligence';

// ═══════════════════════════════════════════════════════════════
// Strategy Types
// ═══════════════════════════════════════════════════════════════

export type StrategyId =
  | 'semantic_retrieval_support'   // High circumlocution + slow retrieval
  | 'phonological_training'        // Persistent phoneme confusion
  | 'spaced_reinforcement'         // Recovering words need consolidation
  | 'confidence_building'          // Declining success / high frustration
  | 'fluency_promotion'            // Good accuracy but slow RT
  | 'balanced_maintenance';        // No strong signal — maintain + observe

export interface ExercisePreference {
  slug: string;
  weight: number;       // 0-1, higher = prefer more
  difficultyHint: 'easier' | 'same' | 'harder';
}

export interface TherapyStrategy {
  id: StrategyId;
  label: string;
  
  /** One-sentence session goal Maya can reference naturally */
  sessionGoal: string;
  
  /** What exercises to prefer and how to configure them */
  exercisePreferences: ExercisePreference[];
  
  /** Cue approach */
  cueApproach: {
    preferredType: 'semantic' | 'phonemic' | 'full_word' | 'auto';
    aggressiveness: 'early' | 'standard' | 'delayed';
    rationale: string;
  };
  
  /** Difficulty bias relative to detected level */
  difficultyBias: 'easier' | 'same' | 'harder';
  
  /** Pacing directives */
  pacing: {
    silenceToleranceMs: number;    // How long to wait before nudging
    maxExercisesPerSession: number;
    conversationToTaskRatio: number; // 0.3 = 30% conversation, 0.7 = 70% conversation
  };
  
  /** Persona hints for Maya's tone */
  mayaPersona: {
    tone: 'warm_supportive' | 'gently_challenging' | 'celebratory' | 'patient_steady';
    /** Specific things Maya should say or reference */
    talkingPoints: string[];
    /** Things Maya should avoid */
    avoid: string[];
  };
  
  /** Why this strategy was selected — for clinician review */
  reasoning: string[];
  
  /** Confidence in strategy selection */
  confidence: 'high' | 'medium' | 'low';
  
  /** Priority of detected patterns that drove this selection */
  drivingPatterns: string[];
}

// ═══════════════════════════════════════════════════════════════
// Strategy Definitions
// ═══════════════════════════════════════════════════════════════

function buildSemanticRetrievalStrategy(
  profile: PatientIntelligenceProfile,
  retryWords: string[],
): TherapyStrategy {
  return {
    id: 'semantic_retrieval_support',
    label: 'Semantic Retrieval Support',
    sessionGoal: 'Help find words through meaning connections, not just repetition',
    exercisePreferences: [
      { slug: 'photo-naming', weight: 0.8, difficultyHint: 'same' },
      { slug: 'semantic-features', weight: 0.7, difficultyHint: 'easier' },
      { slug: 'category-fluency', weight: 0.5, difficultyHint: 'same' },
    ],
    cueApproach: {
      preferredType: 'semantic',
      aggressiveness: 'delayed',
      rationale: 'Give extra time for self-retrieval before offering semantic associations',
    },
    difficultyBias: 'same',
    pacing: {
      silenceToleranceMs: 10000,   // Longer wait — retrieval takes time
      maxExercisesPerSession: 6,
      conversationToTaskRatio: 0.6,
    },
    mayaPersona: {
      tone: 'patient_steady',
      talkingPoints: [
        ...(retryWords.length > 0
          ? [`These words have been tricky: ${retryWords.slice(0, 3).join(', ')}`]
          : []),
        'Acknowledge when they describe around a word — then gently offer it',
        'Reference meaning connections: "It\'s like a..."',
      ],
      avoid: [
        'Rushing to give the answer',
        'Saying "try again" without support',
      ],
    },
    reasoning: [
      `High circumlocution tendency (${profile.circumlocutionTendency})`,
      profile.latencyTrend === 'slower' ? 'Retrieval getting slower — patience needed' : '',
      retryWords.length > 0 ? `${retryWords.length} persistent struggle words to revisit` : '',
    ].filter(Boolean),
    confidence: profile.sessionCount >= 3 ? 'high' : 'medium',
    drivingPatterns: ['circumlocution_habit', 'slow_retrieval'],
  };
}

function buildPhonologicalTrainingStrategy(
  profile: PatientIntelligenceProfile,
  targetPhonemes: string[],
): TherapyStrategy {
  const phonemeStr = targetPhonemes.slice(0, 3).map(p => `/${p}/`).join(', ');
  return {
    id: 'phonological_training',
    label: 'Phonological Training',
    sessionGoal: `Strengthen sound discrimination for ${phonemeStr}`,
    exercisePreferences: [
      { slug: 'minimal-pairs', weight: 0.9, difficultyHint: 'same' },
      { slug: 'photo-naming', weight: 0.4, difficultyHint: 'easier' },
    ],
    cueApproach: {
      preferredType: 'phonemic',
      aggressiveness: 'standard',
      rationale: 'Phonemic cues align with the training target — first sound, rhyme hints',
    },
    difficultyBias: 'same',
    pacing: {
      silenceToleranceMs: 7000,
      maxExercisesPerSession: 8,
      conversationToTaskRatio: 0.5,
    },
    mayaPersona: {
      tone: 'gently_challenging',
      talkingPoints: [
        `Those ${phonemeStr} sounds have been tricky — let's work on them`,
        'Listen closely — they sound similar',
        'Reference earlier attempts naturally',
      ],
      avoid: [
        'Over-explaining the phoneme difference',
        'Making it feel like a hearing test',
      ],
    },
    reasoning: [
      `Persistent phoneme confusion: ${profile.persistentPhonemeErrors.slice(0, 2).map(e => e.phonemes).join(', ')}`,
      `Spanning ${profile.persistentPhonemeErrors[0]?.sessionCount || 0}+ sessions`,
    ],
    confidence: profile.persistentPhonemeErrors[0]?.sessionCount >= 3 ? 'high' : 'medium',
    drivingPatterns: ['phoneme_confusion'],
  };
}

function buildSpacedReinforcementStrategy(
  profile: PatientIntelligenceProfile,
): TherapyStrategy {
  const recovered = profile.recoveredWords.slice(0, 3);
  const persistent = profile.persistentStruggledWords.slice(0, 3).map(w => w.word);
  return {
    id: 'spaced_reinforcement',
    label: 'Spaced Reinforcement',
    sessionGoal: 'Consolidate recent gains and revisit persistent targets',
    exercisePreferences: [
      { slug: 'photo-naming', weight: 0.7, difficultyHint: 'same' },
      { slug: 'semantic-features', weight: 0.5, difficultyHint: 'same' },
      { slug: 'category-fluency', weight: 0.4, difficultyHint: 'harder' },
    ],
    cueApproach: {
      preferredType: 'auto',
      aggressiveness: 'delayed',
      rationale: 'Test independent retrieval before cueing — these should be getting easier',
    },
    difficultyBias: 'harder',
    pacing: {
      silenceToleranceMs: 8000,
      maxExercisesPerSession: 6,
      conversationToTaskRatio: 0.65,
    },
    mayaPersona: {
      tone: 'celebratory',
      talkingPoints: [
        recovered.length > 0 ? `Celebrate recovered words: ${recovered.join(', ')}` : '',
        persistent.length > 0 ? `Revisit gently: ${persistent.join(', ')}` : '',
        'Reference improvement: "You used to struggle with this one"',
      ].filter(Boolean),
      avoid: [
        'Making recovered words feel like they\'re back to square one',
        'Too many difficult targets at once',
      ],
    },
    reasoning: [
      `${recovered.length} words recovered — reinforce to prevent regression`,
      `${persistent.length} persistent struggle words still need work`,
      profile.successRateTrend === 'improving' ? 'Overall improving trend supports pushing slightly harder' : '',
    ].filter(Boolean),
    confidence: profile.sessionCount >= 5 ? 'high' : 'medium',
    drivingPatterns: ['improving', 'recovered_words'],
  };
}

function buildConfidenceBuildingStrategy(
  profile: PatientIntelligenceProfile,
): TherapyStrategy {
  return {
    id: 'confidence_building',
    label: 'Confidence Building',
    sessionGoal: 'Build wins and reduce pressure — success breeds success',
    exercisePreferences: [
      { slug: 'photo-naming', weight: 0.6, difficultyHint: 'easier' },
      { slug: 'meaning-match', weight: 0.7, difficultyHint: 'easier' },
      { slug: 'yes-no-comprehension', weight: 0.5, difficultyHint: 'easier' },
    ],
    cueApproach: {
      preferredType: 'semantic',
      aggressiveness: 'early',
      rationale: 'Cue early to prevent frustration — goal is success, not struggle',
    },
    difficultyBias: 'easier',
    pacing: {
      silenceToleranceMs: 6000,
      maxExercisesPerSession: 4,
      conversationToTaskRatio: 0.7,
    },
    mayaPersona: {
      tone: 'warm_supportive',
      talkingPoints: [
        'Lead with warmth — every attempt matters',
        'Celebrate small wins genuinely',
        'Keep questions easy — yes/no, A-or-B',
      ],
      avoid: [
        'Pushing difficulty up',
        'Mentioning struggles or errors',
        'Clinical language',
      ],
    },
    reasoning: [
      profile.successRateTrend === 'declining' ? 'Success rate declining — need wins' : '',
      'Prioritizing engagement and emotional safety',
    ].filter(Boolean),
    confidence: 'medium',
    drivingPatterns: ['declining_performance', 'frustration'],
  };
}

function buildFluencyPromotionStrategy(
  profile: PatientIntelligenceProfile,
): TherapyStrategy {
  return {
    id: 'fluency_promotion',
    label: 'Fluency Promotion',
    sessionGoal: 'Increase retrieval speed — accuracy is solid, now push tempo',
    exercisePreferences: [
      { slug: 'category-fluency', weight: 0.8, difficultyHint: 'harder' },
      { slug: 'photo-naming', weight: 0.6, difficultyHint: 'harder' },
      { slug: 'minimal-pairs', weight: 0.5, difficultyHint: 'same' },
    ],
    cueApproach: {
      preferredType: 'auto',
      aggressiveness: 'delayed',
      rationale: 'Delay cues to build independent retrieval speed',
    },
    difficultyBias: 'harder',
    pacing: {
      silenceToleranceMs: 6000,    // Tighter timing to push speed
      maxExercisesPerSession: 8,
      conversationToTaskRatio: 0.5,
    },
    mayaPersona: {
      tone: 'gently_challenging',
      talkingPoints: [
        'You\'re getting the words right — let\'s see how quick you can be',
        'Note speed improvements: "That was fast!"',
        'Push gently: "How about a harder one?"',
      ],
      avoid: [
        'Being too easy or soft — they\'re ready for challenge',
        'Excessive praise for things that are now easy',
      ],
    },
    reasoning: [
      profile.successRateTrend === 'improving' || profile.successRateTrend === 'stable'
        ? 'Accuracy is solid — room to push speed'
        : '',
      profile.latencyTrend === 'stable' ? 'Retrieval speed plateaued — need tempo pressure' : '',
    ].filter(Boolean),
    confidence: profile.sessionCount >= 5 ? 'high' : 'medium',
    drivingPatterns: ['good_accuracy', 'speed_plateau'],
  };
}

function buildBalancedMaintenanceStrategy(): TherapyStrategy {
  return {
    id: 'balanced_maintenance',
    label: 'Balanced Maintenance',
    sessionGoal: 'Maintain progress across domains — observe and adapt',
    exercisePreferences: [
      { slug: 'photo-naming', weight: 0.5, difficultyHint: 'same' },
      { slug: 'minimal-pairs', weight: 0.4, difficultyHint: 'same' },
      { slug: 'semantic-features', weight: 0.4, difficultyHint: 'same' },
      { slug: 'category-fluency', weight: 0.3, difficultyHint: 'same' },
    ],
    cueApproach: {
      preferredType: 'auto',
      aggressiveness: 'standard',
      rationale: 'Standard cueing — observe response to calibrate future strategy',
    },
    difficultyBias: 'same',
    pacing: {
      silenceToleranceMs: 8000,
      maxExercisesPerSession: 6,
      conversationToTaskRatio: 0.6,
    },
    mayaPersona: {
      tone: 'warm_supportive',
      talkingPoints: [
        'Natural conversation first — therapy emerges from topics',
        'Observe patterns for future sessions',
      ],
      avoid: [
        'Forcing a specific domain',
        'Being too structured',
      ],
    },
    reasoning: ['No strong pattern signal — balanced observation session'],
    confidence: 'low',
    drivingPatterns: [],
  };
}

// ═══════════════════════════════════════════════════════════════
// Strategy Selection — The Decision Layer
// ═══════════════════════════════════════════════════════════════

interface StrategyCandidate {
  id: StrategyId;
  score: number;
  reasons: string[];
}

function scoreStrategyCandidates(
  profile: PatientIntelligenceProfile | null,
  todayFocus: TodayFocus | null,
  sessionSnapshot: SessionIntelligenceSnapshot | null,
): StrategyCandidate[] {
  const candidates: StrategyCandidate[] = [];

  if (!profile) {
    return [{ id: 'balanced_maintenance', score: 1, reasons: ['No patient profile — defaulting to observation'] }];
  }

  // ── Semantic Retrieval Support ──
  {
    let score = 0;
    const reasons: string[] = [];
    if (profile.circumlocutionTendency === 'high') { score += 5; reasons.push('High circumlocution'); }
    else if (profile.circumlocutionTendency === 'moderate') { score += 2; reasons.push('Moderate circumlocution'); }
    if (profile.latencyTrend === 'slower') { score += 3; reasons.push('Slowing retrieval'); }
    if (profile.persistentStruggledWords.length >= 3) { score += 2; reasons.push(`${profile.persistentStruggledWords.length} persistent struggle words`); }
    // Session-level circumlocution signal
    if (sessionSnapshot && sessionSnapshot.circumlocutionCount >= 2) { score += 2; reasons.push('Circumlocution in current session'); }
    candidates.push({ id: 'semantic_retrieval_support', score, reasons });
  }

  // ── Phonological Training ──
  {
    let score = 0;
    const reasons: string[] = [];
    if (profile.persistentPhonemeErrors.length > 0) {
      const topError = profile.persistentPhonemeErrors[0];
      score += Math.min(topError.sessionCount * 2, 8);
      reasons.push(`${topError.phonemes} confusion across ${topError.sessionCount} sessions`);
    }
    if (sessionSnapshot) {
      const sessionPhonemeErrors = sessionSnapshot.phonemeErrors.length;
      if (sessionPhonemeErrors >= 2) { score += 3; reasons.push('Active phoneme confusion this session'); }
    }
    candidates.push({ id: 'phonological_training', score, reasons });
  }

  // ── Spaced Reinforcement ──
  {
    let score = 0;
    const reasons: string[] = [];
    if (profile.recoveredWords.length >= 2) { score += 4; reasons.push(`${profile.recoveredWords.length} recovered words to reinforce`); }
    if (profile.successRateTrend === 'improving') { score += 3; reasons.push('Overall improving trend'); }
    if (profile.persistentStruggledWords.length >= 2 && profile.recoveredWords.length >= 1) {
      score += 2;
      reasons.push('Mix of persistent and recovered — good reinforcement opportunity');
    }
    candidates.push({ id: 'spaced_reinforcement', score, reasons });
  }

  // ── Confidence Building ──
  {
    let score = 0;
    const reasons: string[] = [];
    if (profile.successRateTrend === 'declining') { score += 6; reasons.push('Declining success rate'); }
    if (sessionSnapshot && sessionSnapshot.successRate < 0.4 && sessionSnapshot.totalAttempts >= 3) {
      score += 4;
      reasons.push('Low success rate this session');
    }
    // TodayFocus frustration signals
    if (todayFocus?.adaptations?.startDifficulty === 1 && todayFocus.reasoning.some(r => r.toLowerCase().includes('frustration'))) {
      score += 3;
      reasons.push('Adaptive engine detected frustration');
    }
    candidates.push({ id: 'confidence_building', score, reasons });
  }

  // ── Fluency Promotion ──
  {
    let score = 0;
    const reasons: string[] = [];
    if (profile.successRateTrend === 'improving' || profile.successRateTrend === 'stable') {
      if (profile.latencyTrend === 'stable') { score += 4; reasons.push('Good accuracy + speed plateau'); }
      if (profile.latencyTrend === 'faster') { score += 2; reasons.push('Already speeding up — keep pushing'); }
    }
    if (profile.circumlocutionTendency === 'low' && profile.persistentPhonemeErrors.length === 0) {
      score += 2;
      reasons.push('No major deficits — ready for fluency push');
    }
    candidates.push({ id: 'fluency_promotion', score, reasons });
  }

  // ── Balanced Maintenance (fallback) ──
  candidates.push({
    id: 'balanced_maintenance',
    score: 1,
    reasons: ['Default observation strategy'],
  });

  return candidates.sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════

export interface StrategySelectionInput {
  patientProfile: PatientIntelligenceProfile | null;
  todayFocus: TodayFocus | null;
  sessionSnapshot: SessionIntelligenceSnapshot | null;
}

export interface StrategySelectionResult {
  strategy: TherapyStrategy;
  candidates: StrategyCandidate[];
}

export function selectTherapyStrategy(input: StrategySelectionInput): StrategySelectionResult {
  const { patientProfile, todayFocus, sessionSnapshot } = input;
  
  const candidates = scoreStrategyCandidates(patientProfile, todayFocus, sessionSnapshot);
  const winner = candidates[0];

  // Build the winning strategy with full behavioral directives
  let strategy: TherapyStrategy;
  
  const retryWords = patientProfile?.persistentStruggledWords.slice(0, 5).map(w => w.word) || [];
  const targetPhonemes = patientProfile?.persistentPhonemeErrors.slice(0, 3).flatMap(e => {
    const match = e.phonemes.match(/\/(.+?)\//g);
    return match ? match.map(m => m.replace(/\//g, '')) : [];
  }) || [];

  switch (winner.id) {
    case 'semantic_retrieval_support':
      strategy = buildSemanticRetrievalStrategy(patientProfile!, retryWords);
      break;
    case 'phonological_training':
      strategy = buildPhonologicalTrainingStrategy(patientProfile!, targetPhonemes);
      break;
    case 'spaced_reinforcement':
      strategy = buildSpacedReinforcementStrategy(patientProfile!);
      break;
    case 'confidence_building':
      strategy = buildConfidenceBuildingStrategy(patientProfile!);
      break;
    case 'fluency_promotion':
      strategy = buildFluencyPromotionStrategy(patientProfile!);
      break;
    case 'balanced_maintenance':
    default:
      strategy = buildBalancedMaintenanceStrategy();
      break;
  }

  // Merge driving reasons from scoring
  strategy.reasoning = [...winner.reasons, ...strategy.reasoning];
  strategy.drivingPatterns = [...new Set([...strategy.drivingPatterns, ...winner.reasons.map(r => r.toLowerCase())])];

  return { strategy, candidates };
}

// ═══════════════════════════════════════════════════════════════
// Format for AI prompt injection
// ═══════════════════════════════════════════════════════════════

export function formatStrategyForPrompt(strategy: TherapyStrategy): string {
  const parts: string[] = [
    `TODAY'S THERAPY STRATEGY: ${strategy.label}`,
    `GOAL: ${strategy.sessionGoal}`,
    `YOUR TONE: ${strategy.mayaPersona.tone.replace(/_/g, ' ')}`,
  ];

  if (strategy.mayaPersona.talkingPoints.length > 0) {
    parts.push(`KEY BEHAVIORS:\n${strategy.mayaPersona.talkingPoints.map(t => `- ${t}`).join('\n')}`);
  }

  if (strategy.mayaPersona.avoid.length > 0) {
    parts.push(`AVOID:\n${strategy.mayaPersona.avoid.map(a => `- ${a}`).join('\n')}`);
  }

  parts.push(`CUE APPROACH: ${strategy.cueApproach.rationale}`);

  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// Format for clinician review
// ═══════════════════════════════════════════════════════════════

export function formatStrategyForClinician(strategy: TherapyStrategy): {
  label: string;
  goal: string;
  reasoning: string[];
  cueApproach: string;
  difficultyBias: string;
  confidence: string;
} {
  return {
    label: strategy.label,
    goal: strategy.sessionGoal,
    reasoning: strategy.reasoning,
    cueApproach: `${strategy.cueApproach.preferredType} (${strategy.cueApproach.aggressiveness})`,
    difficultyBias: strategy.difficultyBias,
    confidence: strategy.confidence,
  };
}
