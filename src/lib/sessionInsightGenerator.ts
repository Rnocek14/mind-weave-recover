/**
 * Auto-generates per-session "Strengths / Struggles / Adaptation" summaries
 * from exercise_events + adaptation_events data.
 */

export interface SessionInsight {
  strengths: string[];
  struggles: string[];
  adaptations: string[];
  overallAccuracy: number;
  exerciseBreakdown: Array<{
    slug: string;
    label: string;
    trials: number;
    accuracy: number;
    avgLatencyMs: number | null;
    errorTypes: Record<string, number>;
    cueTypes: Record<string, number>;
    hasAudio: boolean;
  }>;
}

interface TrialInput {
  exercise_slug: string | null;
  is_correct: boolean | null;
  score?: number | null;
  error_type?: string | null;
  cue_type_given?: string | null;
  cue_was_effective?: boolean | null;
  reaction_time_ms?: number | null;
  audio_storage_path?: string | null;
}

interface AdaptationInput {
  adaptation_type: string;
  exercise_slug?: string | null;
  value_before?: any;
  value_after?: any;
  trigger_type?: string;
}

function formatSlug(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function generateSessionInsight(
  trials: TrialInput[],
  adaptations: AdaptationInput[] = []
): SessionInsight {
  const strengths: string[] = [];
  const struggles: string[] = [];
  const adaptationLabels: string[] = [];

  // Group by exercise
  const byExercise = new Map<string, TrialInput[]>();
  trials.forEach((t) => {
    const slug = t.exercise_slug || "unknown";
    if (!byExercise.has(slug)) byExercise.set(slug, []);
    byExercise.get(slug)!.push(t);
  });

  const exerciseBreakdown = Array.from(byExercise.entries()).map(([slug, exTrials]) => {
    const correct = exTrials.filter((t) => t.is_correct === true || (t.score != null && t.score > 0)).length;
    const accuracy = exTrials.length > 0 ? Math.round((correct / exTrials.length) * 100) : 0;
    
    const latencies = exTrials.map((t) => t.reaction_time_ms).filter((v): v is number => v != null && v > 0);
    const avgLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

    const errorTypes: Record<string, number> = {};
    exTrials.forEach((t) => {
      if (t.error_type && t.error_type !== "correct") {
        errorTypes[t.error_type] = (errorTypes[t.error_type] || 0) + 1;
      }
    });

    const cueTypes: Record<string, number> = {};
    exTrials.forEach((t) => {
      if (t.cue_type_given && t.cue_type_given !== "none") {
        cueTypes[t.cue_type_given] = (cueTypes[t.cue_type_given] || 0) + 1;
      }
    });

    const hasAudio = exTrials.some((t) => !!t.audio_storage_path);
    const label = formatSlug(slug);

    // Generate per-exercise insights
    if (accuracy >= 80 && exTrials.length >= 3) {
      strengths.push(`Strong performance on ${label} (${accuracy}%)`);
    } else if (accuracy >= 80) {
      strengths.push(`${label}: ${accuracy}% accuracy`);
    }

    if (accuracy < 50 && exTrials.length >= 3) {
      struggles.push(`Difficulty with ${label} (${accuracy}%)`);
    } else if (accuracy < 50) {
      struggles.push(`${label}: ${accuracy}% accuracy`);
    }

    // Error-specific insights
    const topError = Object.entries(errorTypes).sort(([, a], [, b]) => b - a)[0];
    if (topError && topError[1] >= 3) {
      const errorLabel = topError[0].replace(/_/g, " ");
      struggles.push(`Frequent ${errorLabel} errors in ${label} (${topError[1]}×)`);
    }

    // Cue insights
    const totalCues = Object.values(cueTypes).reduce((a, b) => a + b, 0);
    const cueEffective = exTrials.filter((t) => t.cue_was_effective === true).length;
    if (totalCues >= 3 && cueEffective > totalCues * 0.7) {
      strengths.push(`Responds well to cues in ${label}`);
    } else if (totalCues >= 3 && cueEffective < totalCues * 0.3) {
      struggles.push(`Cues not effective in ${label}`);
    }

    // Latency insights
    if (avgLatencyMs && avgLatencyMs < 2000 && accuracy >= 70) {
      strengths.push(`Fast responses in ${label} (avg ${(avgLatencyMs / 1000).toFixed(1)}s)`);
    }

    return { slug, label, trials: exTrials.length, accuracy, avgLatencyMs, errorTypes, cueTypes, hasAudio };
  });

  // Adaptation insights
  adaptations.forEach((a) => {
    const ex = a.exercise_slug ? formatSlug(a.exercise_slug) : "session";
    switch (a.adaptation_type) {
      case "difficulty_change":
        adaptationLabels.push(`Difficulty adjusted in ${ex}`);
        break;
      case "cue_level_change":
        adaptationLabels.push(`Cue level adjusted in ${ex}`);
        break;
      case "exercise_swap":
        adaptationLabels.push(`Exercise changed during session`);
        break;
      default:
        adaptationLabels.push(`${a.adaptation_type.replace(/_/g, " ")} in ${ex}`);
    }
  });

  // Overall
  const totalCorrect = trials.filter((t) => t.is_correct === true || (t.score != null && t.score > 0)).length;
  const overallAccuracy = trials.length > 0 ? Math.round((totalCorrect / trials.length) * 100) : 0;

  // Add overall insight if no per-exercise ones generated
  if (strengths.length === 0 && overallAccuracy >= 70) {
    strengths.push(`Good overall accuracy (${overallAccuracy}%)`);
  }
  if (struggles.length === 0 && overallAccuracy < 50 && trials.length >= 3) {
    struggles.push(`Overall accuracy needs work (${overallAccuracy}%)`);
  }
  if (strengths.length === 0 && struggles.length === 0) {
    strengths.push("Session completed");
  }

  return {
    strengths: [...new Set(strengths)].slice(0, 4),
    struggles: [...new Set(struggles)].slice(0, 4),
    adaptations: [...new Set(adaptationLabels)].slice(0, 3),
    overallAccuracy,
    exerciseBreakdown,
  };
}
