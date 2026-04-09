/**
 * Session Recommender — Chooses the best next session based on real signals.
 * 
 * Uses recent session history (strengths, weaknesses, fatigue patterns) to
 * recommend a session template, difficulty, and focus target.
 */

import {
  getRecentSessions,
  detectRepeatedWeaknesses,
  detectFatiguePattern,
  getRecentExerciseAverages,
  type SessionSignalEntry,
} from './sessionSignalStore';

export interface SessionRecommendation {
  templateId: string;
  templateLabel: string;
  reason: string;
  /** Maya's personalized intro text referencing why this session was chosen */
  mayaReason: string;
  focusTarget?: string;
  recommendedDifficulty: 'easier' | 'standard' | 'challenging';
  confidence: 'high' | 'medium' | 'low';
}

// Signal keywords that map to comprehension-related issues
const COMPREHENSION_SIGNALS = [
  'reading between the lines',
  'inference',
  'finding stated facts',
  'literal',
  'clue',
  'anticipating',
  'prediction',
  'cause and effect',
  'key events',
  'story',
  'middle',
  'beginning',
  'ending',
  'retell',
];

// Signal keywords that map to expression/naming issues
const EXPRESSION_SIGNALS = [
  'retriev',
  'naming',
  'word finding',
  'features',
  'synonym',
  'connect',
  'describe',
  'category',
  'cluster',
  'switch',
  'group',
];

// Signal keywords that map to grammar/sentence issues
const GRAMMAR_SIGNALS = [
  'grammar',
  'sentence',
  'word order',
  'tense',
  'articles',
  'preposition',
  'function words',
  'subject-verb',
];

function matchesSignalGroup(text: string, signals: string[]): boolean {
  const lower = text.toLowerCase();
  return signals.some(s => lower.includes(s));
}

/**
 * Score each template based on recent signals.
 * Higher score = better fit.
 */
function scoreTemplates(recent: SessionSignalEntry[]): Record<string, number> {
  const scores: Record<string, number> = {
    core_communication: 0,
    expression_focused: 0,
    comprehension_focused: 0,
    low_energy: 0,
  };

  // Analyze nextStep signals from recent sessions
  for (const entry of recent) {
    const nextStep = entry.insight.nextStep || '';
    
    if (matchesSignalGroup(nextStep, COMPREHENSION_SIGNALS)) {
      scores.comprehension_focused += 3;
      scores.core_communication += 1;
    }
    if (matchesSignalGroup(nextStep, EXPRESSION_SIGNALS)) {
      scores.expression_focused += 3;
    }
    if (matchesSignalGroup(nextStep, GRAMMAR_SIGNALS)) {
      scores.expression_focused += 1; // grammar is part of expression
    }
  }

  // Boost for repeated weaknesses (same nextStep appearing multiple times)
  const repeated = detectRepeatedWeaknesses(3);
  for (const weakness of repeated) {
    if (matchesSignalGroup(weakness, COMPREHENSION_SIGNALS)) {
      scores.comprehension_focused += 2;
    }
    if (matchesSignalGroup(weakness, EXPRESSION_SIGNALS)) {
      scores.expression_focused += 2;
    }
  }

  // Fatigue pattern → strongly boost low_energy
  if (detectFatiguePattern()) {
    scores.low_energy += 8;
  }

  // Avoid repeating the same template consecutively
  if (recent.length > 0) {
    const lastTemplate = recent[recent.length - 1].templateId;
    if (lastTemplate && scores[lastTemplate] !== undefined) {
      scores[lastTemplate] -= 2;
    }
  }

  // Low exercise scores → boost low_energy slightly
  const avgScores = getRecentExerciseAverages(3);
  let overallAvg = 0;
  let count = 0;
  for (const score of avgScores.values()) {
    overallAvg += score;
    count++;
  }
  if (count > 0) {
    overallAvg /= count;
    if (overallAvg < 45) {
      scores.low_energy += 3;
    }
  }

  return scores;
}

function determineDifficulty(recent: SessionSignalEntry[]): 'easier' | 'standard' | 'challenging' {
  if (recent.length === 0) return 'standard';

  const avgScores = getRecentExerciseAverages(3);
  let total = 0;
  let count = 0;
  for (const score of avgScores.values()) {
    total += score;
    count++;
  }
  if (count === 0) return 'standard';

  const avg = total / count;
  if (avg >= 80) return 'challenging';
  if (avg < 50) return 'easier';
  return 'standard';
}

function buildMayaReason(templateId: string, recent: SessionSignalEntry[]): string {
  const lastSession = recent[recent.length - 1];
  const strength = lastSession?.insight.strength;
  const nextStep = lastSession?.insight.nextStep;

  // Build a personalized reason referencing last session
  if (strength && nextStep) {
    switch (templateId) {
      case 'comprehension_focused':
        return `Last time, ${strength} was a real strength. Today we'll focus on understanding — ${nextStep}.`;
      case 'expression_focused':
        return `You showed great ${strength} last session. Today let's work on getting words out — ${nextStep}.`;
      case 'low_energy':
        return `Let's keep it lighter today. We'll do a shorter session to build confidence and keep momentum.`;
      case 'core_communication':
        return `Last time you did well with ${strength}. Today we'll practice both understanding and retelling.`;
    }
  }

  // Default intros per template
  const defaults: Record<string, string> = {
    core_communication: "Today we'll practice understanding stories and telling them back clearly.",
    expression_focused: "Today we'll focus on finding and producing the right words.",
    comprehension_focused: "Today we'll work on understanding what you read and hear.",
    low_energy: "Let's keep it short and build on what's working well.",
  };

  return defaults[templateId] || defaults.core_communication;
}

function buildHumanReason(templateId: string, recent: SessionSignalEntry[]): string {
  const lastSession = recent[recent.length - 1];
  const nextStep = lastSession?.insight.nextStep;

  if (detectFatiguePattern()) {
    return 'Shorter session recommended based on recent patterns';
  }

  if (nextStep) {
    switch (templateId) {
      case 'comprehension_focused':
        return `To strengthen understanding — ${nextStep}`;
      case 'expression_focused':
        return `To improve word retrieval — ${nextStep}`;
      case 'core_communication':
        return `Balanced practice — ${nextStep}`;
      case 'low_energy':
        return 'Lighter session to maintain momentum';
    }
  }

  const defaults: Record<string, string> = {
    core_communication: 'Balanced comprehension and expression practice',
    expression_focused: 'Focus on word finding and naming',
    comprehension_focused: 'Focus on reading and listening comprehension',
    low_energy: 'Shorter session for today',
  };

  return defaults[templateId] || 'Personalized practice session';
}

const TEMPLATE_LABELS: Record<string, string> = {
  core_communication: 'Core Communication',
  expression_focused: 'Expression Focus',
  comprehension_focused: 'Comprehension Focus',
  low_energy: 'Light Session',
};

/**
 * Main recommendation engine.
 * Returns the best session template based on recent signals.
 */
export function recommendNextSession(): SessionRecommendation {
  const recent = getRecentSessions(3);

  // No history → default to core communication
  if (recent.length === 0) {
    return {
      templateId: 'core_communication',
      templateLabel: 'Core Communication',
      reason: 'Great starting point — balanced comprehension and expression',
      mayaReason: "Today we'll practice understanding a short story and telling it back clearly.",
      recommendedDifficulty: 'standard',
      confidence: 'low',
    };
  }

  const scores = scoreTemplates(recent);

  // Find the highest-scoring template
  let bestId = 'core_communication';
  let bestScore = scores.core_communication;
  for (const [id, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestId = id;
      bestScore = score;
    }
  }

  // Determine confidence based on score margin
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  const margin = sortedScores.length >= 2 ? sortedScores[0] - sortedScores[1] : 0;
  const confidence: 'high' | 'medium' | 'low' = margin >= 4 ? 'high' : margin >= 2 ? 'medium' : 'low';

  const difficulty = determineDifficulty(recent);
  const lastNextStep = recent[recent.length - 1]?.insight.nextStep;

  return {
    templateId: bestId,
    templateLabel: TEMPLATE_LABELS[bestId] || bestId,
    reason: buildHumanReason(bestId, recent),
    mayaReason: buildMayaReason(bestId, recent),
    focusTarget: lastNextStep,
    recommendedDifficulty: difficulty,
    confidence,
  };
}
