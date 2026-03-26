/**
 * Normalized Exercise Result
 * 
 * Standardized result format that lets Maya interpret ANY exercise
 * the same way, regardless of the game's internal result shape.
 * 
 * Used by:
 * - ExerciseModalHost → normalizes raw game results
 * - useCoachSession → ingestExerciseResult()
 * - conversation-coach-ai → exerciseContext payload
 */

// ─── Core Type ───

export interface NormalizedExerciseResult {
  slug: string;
  completed: boolean;
  score: number;                // 0–1
  successBand: 'low' | 'target' | 'high';
  accuracy?: number;            // 0–1
  reactionTimeMs?: number;
  cueLevelUsed?: number;
  difficultyTier?: number;
  errorTypes?: string[];
  targetDomain?: string;
  targetWords?: string[];
  targetPhonemes?: string[];
  fatigueSignal?: 'none' | 'mild' | 'high';
  struggleSignal?: 'none' | 'mild' | 'moderate' | 'high';
  summary: string;              // short human-readable summary for Maya
  raw?: unknown;                // preserve original shape
}

// ─── Success Band ───

function computeSuccessBand(score: number): 'low' | 'target' | 'high' {
  if (score < 0.5) return 'low';
  if (score <= 0.85) return 'target';
  return 'high';
}

function computeStruggleSignal(score: number, cueLevelUsed?: number): NormalizedExerciseResult['struggleSignal'] {
  if (score >= 0.85 && (!cueLevelUsed || cueLevelUsed === 0)) return 'none';
  if (score >= 0.7) return 'mild';
  if (score >= 0.5) return 'moderate';
  return 'high';
}

// ─── Per-Exercise Normalizers ───

export function normalizePhotoNamingResult(raw: unknown): NormalizedExerciseResult {
  const r = raw as Record<string, any>;
  const correct = r.correct ?? r.correctCount ?? 0;
  const total = r.total ?? r.totalTrials ?? 10;
  const score = total > 0 ? correct / total : 0;
  const cueLevel = r.cueLevel ?? r.cueLevelUsed ?? 0;
  const avgLatency = r.avgLatencyMs ?? r.reactionTimeMs ?? undefined;
  const errors = r.errorTypes ?? (r.errorPattern ? [r.errorPattern] : []);

  const summary = `Named ${correct} of ${total} items${cueLevel > 0 ? ` with level ${cueLevel} cue support` : ' independently'}.${errors.length > 0 ? ` Patterns: ${errors.join(', ')}.` : ''}`;

  return {
    slug: 'photo-naming',
    completed: true,
    score,
    successBand: computeSuccessBand(score),
    accuracy: score,
    reactionTimeMs: avgLatency,
    cueLevelUsed: cueLevel,
    errorTypes: errors,
    targetDomain: 'expressive_language',
    struggleSignal: computeStruggleSignal(score, cueLevel),
    fatigueSignal: avgLatency && avgLatency > 8000 ? 'mild' : 'none',
    summary,
    raw,
  };
}

export function normalizeSemanticFeatureResult(raw: unknown): NormalizedExerciseResult {
  const r = raw as Record<string, any>;
  const correct = r.correct ?? r.correctCount ?? 0;
  const total = r.total ?? r.totalTrials ?? 10;
  const score = total > 0 ? correct / total : 0;

  return {
    slug: 'semantic-features',
    completed: true,
    score,
    successBand: computeSuccessBand(score),
    accuracy: score,
    targetDomain: 'semantic_processing',
    struggleSignal: computeStruggleSignal(score),
    fatigueSignal: 'none',
    summary: `Identified ${correct} of ${total} semantic features correctly.`,
    raw,
  };
}

export function normalizeMinimalPairsResult(raw: unknown): NormalizedExerciseResult {
  const r = raw as Record<string, any>;
  const correct = r.correctCount ?? r.correct ?? 0;
  const total = r.total ?? r.totalTrials ?? 10;
  const score = total > 0 ? correct / total : 0;
  const accuracy = r.accuracy ? r.accuracy / 100 : score;
  const phonemes = r.focusPhonemes ?? r.targetPhonemes ?? [];

  return {
    slug: 'minimal-pairs',
    completed: true,
    score,
    successBand: computeSuccessBand(score),
    accuracy,
    targetDomain: 'phonology',
    targetPhonemes: phonemes,
    struggleSignal: computeStruggleSignal(score),
    fatigueSignal: 'none',
    summary: `Discriminated ${correct} of ${total} sound pairs${phonemes.length > 0 ? ` focusing on ${phonemes.join(', ')}` : ''}.`,
    raw,
  };
}

export function normalizeMeaningMatchResult(raw: unknown): NormalizedExerciseResult {
  const r = raw as Record<string, any>;
  const results = Array.isArray(r) ? r : (r.results ?? []);
  const correct = results.filter((t: any) => t.correct).length;
  const total = results.length || 10;
  const score = total > 0 ? correct / total : 0;

  return {
    slug: 'meaning-match',
    completed: true,
    score,
    successBand: computeSuccessBand(score),
    accuracy: score,
    targetDomain: 'comprehension',
    struggleSignal: computeStruggleSignal(score),
    fatigueSignal: 'none',
    summary: `Matched ${correct} of ${total} meanings correctly.`,
    raw,
  };
}

export function normalizeSentenceConstructionResult(raw: unknown): NormalizedExerciseResult {
  const r = raw as Record<string, any>;
  const correct = r.correct ?? r.correctCount ?? 0;
  const total = r.total ?? r.totalTrials ?? 10;
  const score = total > 0 ? correct / total : 0;

  return {
    slug: 'sentence-construction',
    completed: true,
    score,
    successBand: computeSuccessBand(score),
    accuracy: score,
    targetDomain: 'sentence_production',
    struggleSignal: computeStruggleSignal(score),
    fatigueSignal: 'none',
    summary: `Built ${correct} of ${total} sentences correctly.`,
    raw,
  };
}

/** Generic fallback normalizer */
export function normalizeGenericResult(slug: string, raw: unknown): NormalizedExerciseResult {
  const r = raw as Record<string, any>;
  const score = r.score ?? r.accuracy ?? (r.correct && r.total ? r.correct / r.total : 0.5);
  const normalizedScore = score > 1 ? score / 100 : score;

  return {
    slug,
    completed: true,
    score: normalizedScore,
    successBand: computeSuccessBand(normalizedScore),
    accuracy: normalizedScore,
    struggleSignal: computeStruggleSignal(normalizedScore),
    fatigueSignal: 'none',
    summary: `Completed ${slug.replace(/-/g, ' ')} exercise.`,
    raw,
  };
}

// ─── Registry ───

const NORMALIZERS: Record<string, (raw: unknown) => NormalizedExerciseResult> = {
  'photo-naming': normalizePhotoNamingResult,
  'semantic-features': normalizeSemanticFeatureResult,
  'minimal-pairs': normalizeMinimalPairsResult,
  'meaning-match': normalizeMeaningMatchResult,
  'sentence-construction': normalizeSentenceConstructionResult,
};

/**
 * Normalize any exercise result to a standard shape.
 * Falls back to generic normalizer for unknown slugs.
 */
export function normalizeExerciseResult(slug: string, raw: unknown): NormalizedExerciseResult {
  const normalizer = NORMALIZERS[slug];
  if (normalizer) return normalizer(raw);
  return normalizeGenericResult(slug, raw);
}
