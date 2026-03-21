/**
 * Exercise route prefetching — preloads the next exercise's JS chunk
 * during the transition/pause overlay so navigation feels instant.
 */

// Lazy import factories for each exercise route
const exerciseImports: Record<string, () => Promise<any>> = {
  "photo-naming": () => import("@/pages/PhotoNamingExercise"),
  "phonological": () => import("@/pages/PhonologicalExercise"),
  "phonological-awareness": () => import("@/pages/PhonologicalExercise"),
  "semantic-features": () => import("@/pages/SemanticFeatureExercise"),
  "sentence-construction": () => import("@/pages/SentenceConstructionExercise"),
  "phrase-practice": () => import("@/pages/PhonologicalExercise"), // maps to word-practice
  "reach-tap": () => import("@/pages/Exercise"),
  "pattern-match": () => import("@/pages/PatternMatchExercise"),
  "minimal-pairs": () => import("@/pages/MinimalPairsExercise"),
  "conversation-partner": () => import("@/pages/ConversationPartnerExercise"),
  "conversation-coach": () => import("@/pages/ConversationCoachExercise"),
  "two-clues": () => import("@/pages/TwoCluesExercise"),
  "fix-sentence": () => import("@/pages/FixSentenceExercise"),
  "describe-guess": () => import("@/pages/DescribeGuessExercise"),
  "detective-mind": () => import("@/pages/DetectiveMindExercise"),
  "meaning-match": () => import("@/pages/MeaningMatchExercise"),
  "narrative-retell": () => import("@/pages/NarrativeRetellExercise"),
  "abstract-compare": () => import("@/pages/AbstractCompareExercise"),
  "multi-step-plan": () => import("@/pages/MultiStepPlanExercise"),
  "dual-load-naming": () => import("@/pages/DualLoadNamingExercise"),
  "left-side-hunt": () => import("@/pages/Exercise"),
  "thought-continuation": () => import("@/pages/ThoughtContinuationExercise"),
};

const prefetchedRoutes = new Set<string>();

/**
 * Prefetch the JS chunk for an exercise route.
 * Safe to call multiple times — deduplicates automatically.
 */
export function prefetchExerciseRoute(exerciseId: string): void {
  if (prefetchedRoutes.has(exerciseId)) return;
  
  const importFn = exerciseImports[exerciseId];
  if (!importFn) {
    console.warn('[Prefetch] No import mapping for:', exerciseId);
    return;
  }
  
  prefetchedRoutes.add(exerciseId);
  
  // Fire-and-forget — just warms the module cache
  importFn()
    .then(() => {
      console.log(`[Prefetch] ✅ Preloaded: ${exerciseId}`);
    })
    .catch((err) => {
      console.warn(`[Prefetch] Failed to preload ${exerciseId}:`, err);
      prefetchedRoutes.delete(exerciseId); // allow retry
    });
}
