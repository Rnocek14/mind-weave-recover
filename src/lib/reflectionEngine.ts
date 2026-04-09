/**
 * Reflection Engine v2 — Signal-based session insights
 * 
 * Analyzes real exercise outputs (B/M/E coverage, question types, clustering, 
 * grammar errors) to generate specific, clinically meaningful session reflections.
 * 
 * Falls back to score-based logic when detailed signals are unavailable.
 */

import type { BlockResult } from './sessionFrameTemplates';

export interface SessionInsight {
  strength: string;
  nextStep: string;
  /** Optional deeper explanation */
  explanation?: string;
}

// ─── Signal Extractors (per exercise) ────────────────────────────────

interface NarrativeSignals {
  beginning: 'covered' | 'partial' | 'missed';
  middle: 'covered' | 'partial' | 'missed';
  end: 'covered' | 'partial' | 'missed';
  eventCoverage: number;
  wordCount?: number;
}

interface DetectiveSignals {
  questionTypes: Record<string, { correct: number; total: number }>;
  overallAccuracy: number;
}

interface CategoryFluencySignals {
  totalWords: number;
  clusters: number;
  switches: number;
}

interface SFASignals {
  featureCoverage: Record<string, boolean>;
  retrievalSuccess: boolean;
}

interface SentenceConstructionSignals {
  grammar: Record<string, number>; // category → accuracy (0-1)
  weakestCategory?: string;
}

function extractNarrativeSignals(details: Record<string, any>): NarrativeSignals | null {
  const sb = details.structureBreakdown || details.structure;
  if (!sb) return null;
  return {
    beginning: sb.beginning?.status || (sb.beginning === 'covered' ? 'covered' : 'missed'),
    middle: sb.middle?.status || (sb.middle === 'covered' ? 'covered' : 'missed'),
    end: sb.end?.status || (sb.end === 'covered' ? 'covered' : 'missed'),
    eventCoverage: details.eventCoverage ?? 0,
    wordCount: details.wordCount,
  };
}

function extractDetectiveSignals(details: Record<string, any>): DetectiveSignals | null {
  // details.results is the raw trial results array
  const results = details.results as Array<{ questionType: string; correct: boolean }> | undefined;
  if (!results?.length) return null;
  
  const types: Record<string, { correct: number; total: number }> = {};
  let correctTotal = 0;
  
  for (const r of results) {
    const qt = r.questionType || 'unknown';
    if (!types[qt]) types[qt] = { correct: 0, total: 0 };
    types[qt].total++;
    if (r.correct) {
      types[qt].correct++;
      correctTotal++;
    }
  }
  
  return {
    questionTypes: types,
    overallAccuracy: correctTotal / results.length,
  };
}

function extractCategoryFluencySignals(details: Record<string, any>): CategoryFluencySignals | null {
  if (details.totalWords == null) return null;
  return {
    totalWords: details.totalWords ?? 0,
    clusters: details.clusters ?? 0,
    switches: details.switches ?? 0,
  };
}

function extractSFASignals(details: Record<string, any>): SFASignals | null {
  if (!details.featureCoverage) return null;
  return {
    featureCoverage: details.featureCoverage,
    retrievalSuccess: !!details.retrievalSuccess,
  };
}

function extractSentenceSignals(details: Record<string, any>): SentenceConstructionSignals | null {
  if (!details.grammar) return null;
  const grammar = details.grammar as Record<string, number>;
  let weakest: string | undefined;
  let weakestScore = 1;
  for (const [cat, score] of Object.entries(grammar)) {
    if (score < weakestScore) {
      weakestScore = score;
      weakest = cat;
    }
  }
  return { grammar, weakestCategory: weakest };
}

// ─── Insight Generators ─────────────────────────────────────────────

function narrativeInsight(signals: NarrativeSignals): { strength?: string; nextStep?: string } {
  const sections = { beginning: signals.beginning, middle: signals.middle, end: signals.end };
  const covered = Object.values(sections).filter(s => s === 'covered').length;
  const missed = Object.entries(sections).filter(([, s]) => s === 'missed');
  
  if (covered === 3) {
    return { strength: 'remembering the full story structure — beginning, middle, and end' };
  }
  if (covered >= 2) {
    const missedPart = missed[0]?.[0] || 'middle';
    return {
      strength: `clear recall of ${covered} story sections`,
      nextStep: `hold onto the ${missedPart} details when retelling`,
    };
  }
  if (signals.beginning === 'covered') {
    return {
      strength: 'remembering how the story started',
      nextStep: 'practice holding the middle and ending details while you retell',
    };
  }
  return {
    nextStep: 'focus on catching the main events in each part of the story',
  };
}

function detectiveInsight(signals: DetectiveSignals): { strength?: string; nextStep?: string } {
  const types = signals.questionTypes;
  const entries = Object.entries(types);
  
  // Find strongest and weakest question types
  let strongest: { type: string; acc: number } = { type: '', acc: 0 };
  let weakest: { type: string; acc: number } = { type: '', acc: 1 };
  
  for (const [type, data] of entries) {
    const acc = data.total > 0 ? data.correct / data.total : 0;
    if (acc >= strongest.acc) strongest = { type, acc };
    if (acc <= weakest.acc || (acc < weakest.acc)) weakest = { type, acc };
  }
  
  const typeLabel = (t: string) => {
    const labels: Record<string, string> = {
      inference: 'reading between the lines',
      literal: 'finding stated facts',
      prediction: 'anticipating what comes next',
      'cause-effect': 'understanding cause and effect',
      vocabulary: 'word meaning in context',
    };
    return labels[t] || t.replace(/[-_]/g, ' ');
  };
  
  const result: { strength?: string; nextStep?: string } = {};
  
  if (strongest.acc >= 0.7 && strongest.type) {
    result.strength = typeLabel(strongest.type);
  }
  
  if (weakest.acc < 0.5 && weakest.type && weakest.type !== strongest.type) {
    result.nextStep = `practice ${typeLabel(weakest.type)}`;
  } else if (signals.overallAccuracy < 0.6) {
    result.nextStep = 'try re-reading key sentences before answering';
  }
  
  return result;
}

function categoryFluencyInsight(signals: CategoryFluencySignals): { strength?: string; nextStep?: string } {
  if (signals.switches > 3 && signals.clusters >= 2) {
    return { strength: 'flexible switching between word groups' };
  }
  if (signals.clusters >= 3 && signals.switches <= 1) {
    return {
      strength: 'strong grouping of related words',
      nextStep: 'try jumping to a new group once you run dry',
    };
  }
  if (signals.totalWords >= 8) {
    return { strength: 'generating a good number of words quickly' };
  }
  return {
    nextStep: 'try thinking of a subcategory first, then listing words from it',
  };
}

function sfaInsight(signals: SFASignals): { strength?: string; nextStep?: string } {
  const features = Object.entries(signals.featureCoverage);
  const covered = features.filter(([, v]) => v).length;
  
  if (covered >= 4 && signals.retrievalSuccess) {
    return { strength: 'describing features and retrieving the word' };
  }
  if (covered >= 3 && !signals.retrievalSuccess) {
    return {
      strength: 'describing word features in detail',
      nextStep: 'connect your feature descriptions to the target word',
    };
  }
  if (covered < 3) {
    return { nextStep: 'try describing what the word looks like, where you find it, and what it does' };
  }
  return {};
}

function sentenceInsight(signals: SentenceConstructionSignals): { strength?: string; nextStep?: string } {
  const categories = Object.entries(signals.grammar);
  const strong = categories.filter(([, acc]) => acc >= 0.8);
  
  if (strong.length === categories.length) {
    return { strength: 'building clear, grammatically correct sentences' };
  }
  
  if (signals.weakestCategory) {
    const catLabel = (c: string) => {
      const labels: Record<string, string> = {
        SVO: 'word order (subject-verb-object)',
        past_tense: 'past tense usage',
        articles: 'using articles (a, the)',
        prepositions: 'prepositions (in, on, at)',
        function_words: 'function words',
      };
      return labels[c] || c.replace(/[-_]/g, ' ');
    };
    return { nextStep: `focus on ${catLabel(signals.weakestCategory)}` };
  }
  
  return {};
}

// ─── Main Engine ────────────────────────────────────────────────────

/**
 * Build a session-level insight by analyzing real exercise outputs.
 * Selects 1 strength and 1 next-step from the strongest signals available.
 */
/**
 * Weighted insight with priority score.
 * Higher weight = more clinically significant / bigger gap.
 */
interface WeightedInsight {
  text: string;
  weight: number;
}

/**
 * Compute a gap-based weight for nextSteps (bigger gap = higher priority)
 * and a consistency-based weight for strengths (stronger signal = higher priority).
 */
function extractWeightedInsights(
  block: BlockResult
): { strengths: WeightedInsight[]; nextSteps: WeightedInsight[] } {
  const strengths: WeightedInsight[] = [];
  const nextSteps: WeightedInsight[] = [];

  if (!block.details) return { strengths, nextSteps };

  switch (block.exerciseId) {
    case 'narrative-retell': {
      const s = extractNarrativeSignals(block.details);
      if (s) {
        const sections = [s.beginning, s.middle, s.end];
        const covered = sections.filter(x => x === 'covered').length;
        const missed = sections.filter(x => x === 'missed').length;
        const insight = narrativeInsight(s);
        // Strength weight: higher when more sections covered
        if (insight.strength) strengths.push({ text: insight.strength, weight: covered * 0.33 });
        // NextStep weight: higher when more sections missed (bigger gap)
        if (insight.nextStep) nextSteps.push({ text: insight.nextStep, weight: missed * 0.4 });
      }
      break;
    }
    case 'detective-mind': {
      const s = extractDetectiveSignals(block.details);
      if (s) {
        const insight = detectiveInsight(s);
        // Strength: weighted by overall accuracy
        if (insight.strength) strengths.push({ text: insight.strength, weight: s.overallAccuracy });
        // NextStep: weighted by size of accuracy gap (1 - accuracy = gap)
        if (insight.nextStep) nextSteps.push({ text: insight.nextStep, weight: 1 - s.overallAccuracy });
      }
      break;
    }
    case 'category-fluency': {
      const s = extractCategoryFluencySignals(block.details);
      if (s) {
        const insight = categoryFluencyInsight(s);
        const switchRatio = s.totalWords > 0 ? s.switches / s.totalWords : 0;
        if (insight.strength) strengths.push({ text: insight.strength, weight: 0.5 + switchRatio });
        // Low switches = bigger gap = higher priority
        if (insight.nextStep) nextSteps.push({ text: insight.nextStep, weight: s.switches <= 1 ? 0.8 : 0.4 });
      }
      break;
    }
    case 'semantic-features': {
      const s = extractSFASignals(block.details);
      if (s) {
        const insight = sfaInsight(s);
        const covered = Object.values(s.featureCoverage).filter(Boolean).length;
        const total = Object.keys(s.featureCoverage).length || 1;
        if (insight.strength) strengths.push({ text: insight.strength, weight: covered / total });
        // Failed retrieval despite features = high-priority gap
        if (insight.nextStep) nextSteps.push({ text: insight.nextStep, weight: !s.retrievalSuccess ? 0.9 : 0.4 });
      }
      break;
    }
    case 'sentence-construction': {
      const s = extractSentenceSignals(block.details);
      if (s) {
        const insight = sentenceInsight(s);
        const scores = Object.values(s.grammar);
        const avgGrammar = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0.5;
        if (insight.strength) strengths.push({ text: insight.strength, weight: avgGrammar });
        // Weakest grammar category = big gap
        if (insight.nextStep) {
          const weakest = Math.min(...scores, 1);
          nextSteps.push({ text: insight.nextStep, weight: 1 - weakest });
        }
      }
      break;
    }
  }

  return { strengths, nextSteps };
}

/**
 * Build a session-level insight by analyzing real exercise outputs.
 * Uses weighted prioritization: biggest gap wins for nextStep,
 * strongest consistent signal wins for strength.
 */
export function buildSessionInsight(results: BlockResult[]): SessionInsight {
  const allStrengths: WeightedInsight[] = [];
  const allNextSteps: WeightedInsight[] = [];

  for (const block of results) {
    const { strengths, nextSteps } = extractWeightedInsights(block);
    allStrengths.push(...strengths);
    allNextSteps.push(...nextSteps);
  }

  // No signals → fall back to score-based
  if (allStrengths.length === 0 && allNextSteps.length === 0) {
    return buildScoreBasedInsight(results);
  }

  // Sort descending by weight — highest priority first
  allStrengths.sort((a, b) => b.weight - a.weight);
  allNextSteps.sort((a, b) => b.weight - a.weight);

  return {
    strength: allStrengths[0]?.text || 'staying focused through the full session',
    nextStep: allNextSteps[0]?.text || 'keep building consistency across exercises',
  };
}

/** Fallback: score-based insight when no detailed signals are available */
function buildScoreBasedInsight(results: BlockResult[]): SessionInsight {
  if (results.length === 0) {
    return {
      strength: 'showing up to practice',
      nextStep: 'keep building the habit',
    };
  }
  
  const avgScore = results.reduce((sum, r) => sum + r.avgScore, 0) / results.length;
  
  if (avgScore >= 80) {
    return {
      strength: 'consistent accuracy across exercises',
      nextStep: 'try a slightly harder difficulty next time',
    };
  }
  if (avgScore >= 60) {
    return {
      strength: 'working through challenging material',
      nextStep: 'slow down on harder questions — accuracy over speed',
    };
  }
  return {
    strength: 'sticking with tough exercises',
    nextStep: 'focus on one skill at a time and build from there',
  };
}
