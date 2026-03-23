/**
 * Canonical runtime config read path.
 * 
 * All games/sessions should use this hook to fetch the active runtime_config
 * for the current profile. This ensures a single source of truth for:
 * - difficulty overrides
 * - cue level overrides
 * - practice assignments
 * - any future mutable therapy state
 * 
 * clinical_profile = static clinical truth (impairments, goals, severity)
 * runtime_config   = mutable plan knobs and temporary overrides
 */
import { useMemo } from "react";
import { useProfile } from "@/hooks/useProfile";

export interface RuntimeConfig {
  /** Per-exercise or global difficulty overrides. _global key for global. */
  difficultyOverrides: Record<string, number>;
  /** Global difficulty level (convenience alias for _global) */
  globalDifficulty: number;
  /** Clinician-set cue level override, or null for auto */
  cueOverride: number | null;
  /** When cueing was last reviewed */
  cueReviewedAt: string | null;
  /** Who reviewed cueing */
  cueReviewedBy: string | null;
  /** Active practice assignments */
  practiceAssignments: Array<{
    id: string;
    notes: string;
    assigned_by: string;
    assigned_at: string;
    status: string;
  }>;
  /** Raw JSON for edge cases */
  raw: Record<string, any>;
}

/**
 * Parse raw runtime_config JSONB into a typed structure.
 */
export function parseRuntimeConfig(raw: Record<string, any> | null | undefined): RuntimeConfig {
  const rc = raw || {};
  const difficultyOverrides = rc.difficulty_overrides || {};
  return {
    difficultyOverrides,
    globalDifficulty: difficultyOverrides._global ?? 0,
    cueOverride: rc.cue_level_override ?? null,
    cueReviewedAt: rc.cue_review_at ?? null,
    cueReviewedBy: rc.cue_reviewed_by ?? null,
    practiceAssignments: rc.practice_assignments || [],
    raw: rc,
  };
}

/**
 * Hook: canonical read path for runtime config.
 * Use in games, sessions, and clinician views.
 */
export function useRuntimeConfig() {
  const { activeProfile } = useProfile();
  const rawConfig = (activeProfile as any)?.runtime_config as Record<string, any> | null;

  const config = useMemo(() => parseRuntimeConfig(rawConfig), [rawConfig]);

  return {
    config,
    profileId: activeProfile?.id,
    /** Get effective difficulty for a specific exercise */
    getDifficulty: (exerciseSlug?: string): number => {
      if (exerciseSlug && config.difficultyOverrides[exerciseSlug] !== undefined) {
        return config.difficultyOverrides[exerciseSlug];
      }
      return config.globalDifficulty;
    },
    /** Get effective cue level (null = auto) */
    getCueLevel: (): number | null => config.cueOverride,
    /** Active practice assignments only */
    activePractice: config.practiceAssignments.filter((a) => a.status === "active"),
  };
}
